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
  // Only OUR errors. The SoundCloud iframe emits Firefox cookie warnings we
  // neither cause nor can fix, and a check that cries wolf stops being read.
  const origin = new URL(URL_).origin;
  // Hosts whose failures are not ours and not actionable: the SoundCloud iframe
  // emits Firefox cookie warnings, and the analytics beacon refuses a localhost
  // origin by design. A check that cries wolf is a check nobody reads.
  const THIRD_PARTY = ['soundcloud.com', 'sndcdn.com', 'cloudflareinsights.com', 'archive.org'];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const from = m.location()?.url || '';
    if (from && !from.startsWith(origin)) return;
    const text = m.text();
    if (THIRD_PARTY.some((h) => text.includes(h))) return;
    consoleErrors.push(text);
  });
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('response', (r) => {
    if (r.status() >= 400 && r.url().startsWith(new URL(URL_).origin)) badResponses.push(`${r.status()} ${r.url()}`);
  });

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

console.log(`\n${failures ? `SMOKE FAILED — ${failures} problem(s)` : 'SMOKE PASSED'}\n`);
process.exit(failures ? 1 : 0);
