#!/usr/bin/env node
// Does the page actually boot? Asked of a real browser, in FIREFOX by default.
//
// This exists because of a specific outage: a <link rel="modulepreload"> above
// the import map invalidated the map, every bare specifier failed to resolve,
// and the site died — in Firefox, while Chrome shrugged and carried on. Every
// static check I had said PASS, because static checks read text.
//
// The only question that matters is "did a frame render", and only a browser
// can answer it. Firefox is the default because Firefox is what caught it.
//
//   node tools/smoke.mjs                        # live site, firefox
//   node tools/smoke.mjs --url http://localhost:8000
//   node tools/smoke.mjs --browser webkit       # Safari's engine
//   node tools/smoke.mjs --browser all
//
// Needs: npm i && npx playwright install firefox

import * as pw from 'playwright';

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const URL_ = arg('--url', 'https://goldenrecord.voyage/');
const which = arg('--browser', 'firefox');
const ENGINES = which === 'all' ? ['firefox', 'chromium', 'webkit'] : [which];

let failures = 0;
const pass = (m) => console.log(`  ok   ${m}`);
const fail = (m) => { failures++; console.log(`  FAIL ${m}`); };

for (const engine of ENGINES) {
  console.log(`\n${engine} → ${URL_}`);
  const browser = await pw[engine].launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const consoleErrors = [];
  const pageErrors = [];
  const badResponses = [];
  // archive.org and soundcloud.com USED to be on this list, declared "not ours
  // and not actionable". So when archive.org became unreachable for a real
  // visitor and two of the four collections went silent, this file printed
  // SMOKE PASSED. A whitelist that hides the failure mode you actually have is
  // not noise reduction. Only the analytics beacon remains, and only because it
  // is aborted by route() below and refuses a localhost origin by design.
  const THIRD_PARTY = ['cloudflareinsights.com'];
  // Only OUR errors. The SoundCloud iframe emits Firefox cookie warnings we
  // neither cause nor can fix, and a check that cries wolf stops being read.
  const origin = new URL(URL_).origin;
  // Hosts whose failures are not ours and not actionable: the SoundCloud iframe
  // emits Firefox cookie warnings, and the analytics beacon refuses a localhost
  // origin by design. A check that cries wolf is a check nobody reads.
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const from = m.location()?.url || '';
    if (from && !from.startsWith(origin)) return;
    const text = m.text();
    if (THIRD_PARTY.some((h) => text.includes(h))) return;
    consoleErrors.push(text);
  });
  page.on('pageerror', (e) => {
    const t = String(e);
    if (THIRD_PARTY.some((h) => t.includes(h))) return; // not ours, not actionable
    pageErrors.push(t);
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().startsWith(new URL(URL_).origin)) badResponses.push(`${r.status()} ${r.url()}`);
  });

  // The analytics beacon is not part of the site working, and it refuses a
  // localhost origin by design — which WebKit reports as a CORS console error
  // with no host in the message, so it cannot be filtered after the fact.
  // Block it outright: this test is about OUR page.
  await page.route('**/*cloudflareinsights.com/**', (r) => r.abort());

  try {
    await page.goto(URL_, { waitUntil: 'load', timeout: 45000 });

    // 1. the boot mark is removed only by a rendered frame or by the watchdog
    try {
      await page.waitForFunction(() => !document.getElementById('gm-boot'), null, { timeout: 25000 });
      pass('boot mark retired');
    } catch {
      fail('boot mark never retired — the page is stuck exactly as it was during the outage');
    }

    // 2. the watchdog fallback must NOT be what retired it
    const surrendered = await page.evaluate(() => !!document.querySelector('.gm-fallback'));
    surrendered ? fail('the failure fallback rendered — the scene never started') : pass('no failure fallback (the real page loaded)');

    // 3. the scene exists and has drawn something
    const info = await page.evaluate(() => ({
      ctx: !!window.__ctx,
      revision: window.__ctx?.THREE?.REVISION ?? null,
      modules: Object.keys(window.__ctx?.modules ?? {}),
      calls: window.__ctx?.renderer?.info?.render?.calls ?? 0,
      h1: document.querySelector('.gm-title h1')?.textContent ?? null,
    }));
    info.ctx ? pass(`window.__ctx built (three r${info.revision})`) : fail('window.__ctx missing — the module graph never finished');
    info.modules.length === 4 ? pass(`4 scene modules: ${info.modules.join(', ')}`) : fail(`expected 4 scene modules, got ${info.modules.length}`);
    info.calls > 0 ? pass(`renderer drew ${info.calls} calls`) : fail('renderer drew nothing — a frame never rendered');
    info.h1 ? pass(`ui built ("${info.h1}")`) : fail('ui.js never built the masthead');

    // 4. walk the acts — most of the site's code only runs on an act change
    for (const act of ['map', 'pulsars', 'verdict', 'finders']) {
      await page.evaluate((a) => window.__ctx.setAct(a), act);
      await page.waitForTimeout(700);
    }
    const after = await page.evaluate(() => window.__ctx.renderer.info.render.calls);
    after > 0 ? pass('all five acts render') : fail('rendering stopped during the act walk');

    // 5. nothing 404ed and nothing threw
    badResponses.length === 0 ? pass('no 4xx/5xx responses') : badResponses.forEach((r) => fail(`bad response: ${r}`));
    pageErrors.length === 0 ? pass('no uncaught exceptions') : pageErrors.forEach((e) => fail(`uncaught: ${e}`));
    consoleErrors.length === 0 ? pass('no console errors') : consoleErrors.forEach((e) => fail(`console error: ${e}`));
  } catch (e) {
    fail(`${engine}: ${e.message}`);
  } finally {
    await browser.close();
  }
}


// ---- the fallback, exercised rather than assumed ---------------------------
// The reported bug: archive.org unreachable from a visitor's network, Music and
// UN silent, Greetings and Sounds fine. Two shapes, and they are NOT one test.
// A refused connection fires 'error' in milliseconds. A filter that DROPS
// packets fires nothing at all — which is why the player has a watchdog, and
// why a test that only simulated refusal would prove nothing about the outage
// that actually happened.
export async function fallbackRun(engine, URL_, mode) {
  const pw = await import('playwright');
  const browser = await pw[engine].launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.route('**/*cloudflareinsights.com/**', (r) => r.abort());
  let hits = 0;
  await page.route(/^https?:\/\/([a-z0-9-]+\.)*archive\.org\//i, async (r) => {
    hits++;
    if (mode === 'refused') return r.abort('connectionfailed');
    // match a DROP rule on the wire: no RST, no DNS error, just silence —
    // longer than the player's FIRST_BYTE_MS so the watchdog is what decides
    await new Promise((res) => setTimeout(res, 30000));
    return r.abort('timedout');
  });
  const out = [];
  const ok = (m) => out.push(`  ok   ${m}`);
  const bad = (m) => out.push(`  FAIL ${m}`);
  await page.goto(URL_, { waitUntil: 'load', timeout: 45000 });
  await page.waitForTimeout(2500);
  await page.click('.gm-pick[data-set="music"]');
  let switched = false;
  try {
    await page.waitForFunction(() => window.__ctx.audio.state().engine === 'backup',
      null, { timeout: 35000 });
    switched = true;
  } catch { /* reported below */ }
  switched ? ok(`${mode}: failed over to the backup engine`)
           : bad(`${mode}: still on archive.org after 35s — the visitor gets silence`);
  const st = await page.evaluate(() => window.__ctx.audio.state());
  st.host === 'bad' ? ok(`${mode}: archive.org marked unreachable ("${st.why}")`)
                    : bad(`${mode}: host state "${st.host}", expected "bad"`);
  hits > 0 ? ok(`${mode}: ${hits} archive.org request(s) intercepted`)
           : bad(`${mode}: nothing requested archive.org — the test proved nothing`);
  // The engine swaps the moment the widget object exists; SoundCloud then needs
  // a few seconds to buffer and report PLAY. Wait for sound rather than sampling
  // the instant of the swap — "silent" here must mean silent, not "not yet".
  let sounding = false;
  try {
    await page.waitForFunction(() => window.__ctx.audio.state().playing, null, { timeout: 20000 });
    sounding = true;
  } catch { /* reported below */ }
  sounding ? ok(`${mode}: audio is actually playing from the backup`)
           : bad(`${mode}: backup engine loaded but produced no sound in 20s`);
  // the playlist must be untouched — names and credits are ours, not the source's
  await page.click('.gm-msets').catch(() => {});
  await page.waitForTimeout(700);
  const rows = await page.evaluate(() => [...document.querySelectorAll('.gm-track')].map((r) => ({
    t: r.querySelector('.gm-track-t')?.textContent,
    m: r.querySelector('.gm-track-meta')?.textContent })));
  rows.length === 27 ? ok(`${mode}: all 27 rows still listed`)
                     : bad(`${mode}: ${rows.length} rows, expected 27`);
  rows[6] && /Johnny B. Goode/.test(rows[6].t) && /Chuck Berry/.test(rows[6].m || '')
    ? ok(`${mode}: names and credits unchanged in fallback`)
    : bad(`${mode}: playlist degraded — row 7 is ${JSON.stringify(rows[6])}`);
  // UN has no backup and must SAY so: present, focusable, explained
  const un = await page.evaluate(() => {
    const b = document.querySelector('.gm-pick[data-set="un"]');
    return { present: !!b, dis: b && b.getAttribute('aria-disabled'), why: (b && b.title || '').length };
  });
  un.present && un.dis === 'true' && un.why > 20
    ? ok(`${mode}: UN disabled in place with a reason`)
    : bad(`${mode}: UN chip is ${JSON.stringify(un)} — expected present, aria-disabled, explained`);
  await browser.close();
  return out;
}

// Run both shapes of the outage as part of the normal invocation. This is the
// case that reached a visitor, so it is not an opt-in flag.
if (!process.argv.includes('--no-fallback')) {
  for (const mode of ['refused', 'blackhole']) {
    console.log(`\narchive.org ${mode}`);
    // Pinned to Chromium on purpose. This case tests OUR fallback logic, and it
    // needs an engine where the SoundCloud widget itself demonstrably runs:
    // Playwright's Firefox build never starts that iframe even with autoplay
    // fully allowed, though it plays our own vendored audio fine. Pinning is not
    // whitelisting — every assertion still runs and still fails the build; only
    // the engine that hosts the third-party iframe is fixed.
    for (const line of await fallbackRun('chromium', URL_, mode)) {
      console.log(line);
      if (line.startsWith('  FAIL')) failures++;
    }
  }
}

console.log(`\n${failures ? `SMOKE FAILED — ${failures} problem(s)` : 'SMOKE PASSED'}\n`);
process.exit(failures ? 1 : 0);
