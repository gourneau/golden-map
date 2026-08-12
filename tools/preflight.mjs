#!/usr/bin/env node
// Preflight: the checks that must pass before anything is pushed.
//
// Written after a <link rel="modulepreload"> was added ABOVE the import map,
// which silently invalidated the map, left every bare specifier unresolvable,
// and took the live site down — while a grep for the new code "verified" fine.
//
// v1 of this file then failed its own standard: an adversarial review proved
// its --live mode made ONE request and asserted `html.includes('id="gm-boot"')`,
// a string that is static markup and present whether or not a line of JS ran.
// Proof-by-string-presence, inside the tool written to stop proof-by-string-
// presence. That check is gone. Everything here now resolves a real path or
// makes a real request.
//
//   node tools/preflight.mjs            check the working tree
//   node tools/preflight.mjs --live     also probe every deployed URL
//
// Still cannot catch: a runtime throw, a CSS parse error, anything that needs a
// browser engine. Those need a headless run in Firefox — see NOT COVERED below.

import { readFileSync, existsSync, readdirSync, statSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve, basename, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LIVE = 'https://goldenrecord.voyage';
const raw = readFileSync(join(ROOT, 'index.html'), 'utf8');
// HTML comments are not markup: a commented-out module tag was making the
// ordering and existence checks fail on a perfectly correct page.
const html = raw.replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length));

let failures = 0;
const pass = (m) => console.log(`  ok   ${m}`);
const fail = (m) => { failures++; console.log(`  FAIL ${m}`); };
const section = (m) => console.log(`\n${m}`);

// APFS is case-insensitive; the Pages origin is not. existsSync('Foo.js') is
// true here and 404 there, so compare the real directory listing.
function exactPathExists(rel) {
  const abs = join(ROOT, rel.replace(/^\//, '').split(/[?#]/)[0]);
  if (!existsSync(abs)) return false;
  const dir = dirname(abs);
  try { return readdirSync(dir).includes(basename(abs)); } catch { return false; }
}

const listJs = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) listJs(p, out);
    else if (e.endsWith('.js') || e.endsWith('.mjs')) out.push(p);
  }
  return out;
};

// ---------------------------------------------------------------- import map
section('import map');
const mapIdx = html.indexOf('<script type="importmap"');
let mapJson = null;
if (mapIdx < 0) {
  fail('no <script type="importmap"> found');
} else {
  // attribute values may legally be unquoted: type=module slipped past a
  // quoted-only regex, which is how the original outage could be reintroduced
  const earlier = [
    [/<link\b[^>]*\brel\s*=\s*["']?modulepreload\b/i, 'a <link rel=modulepreload>'],
    [/<script\b[^>]*\btype\s*=\s*["']?module\b/i, 'a <script type=module>'],
  ];
  let clean = true;
  for (const [re, what] of earlier) {
    const m = html.match(re);
    if (m && html.indexOf(m[0]) < mapIdx) {
      fail(`${what} appears BEFORE the import map — the map is ignored and every ` +
           'bare specifier fails to resolve (this is the bug that broke production)');
      clean = false;
    }
  }
  if (clean) pass('import map precedes every module load and preload');

  try {
    mapJson = JSON.parse(html.slice(html.indexOf('{', mapIdx), html.indexOf('</script>', mapIdx)));
    pass('import map is valid JSON');
  } catch (e) {
    fail(`import map is not valid JSON (${e.message}) — the browser ignores it entirely`);
  }
}

// every bare specifier imported anywhere must be mapped, AND its target must
// exist. v1 only checked the key, so pointing "three" at a missing file passed.
if (mapJson) {
  const bare = new Set();
  for (const f of [...listJs(join(ROOT, 'js')), ...listJs(join(ROOT, 'vendor'))]) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/^\s*import\s[\s\S]*?from\s*['"]([^'"]+)['"]/gm)) bare.add(m[1]);
    for (const m of src.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) bare.add(m[1]);
  }
  let bad = 0;
  for (const spec of [...bare].filter((s) => !/^[./]/.test(s))) {
    if (!mapJson.imports?.[spec]) { fail(`bare specifier "${spec}" is imported but NOT mapped`); bad++; }
  }
  for (const [k, v] of Object.entries(mapJson.imports ?? {})) {
    if (/^[./]/.test(v) && !exactPathExists(v)) { fail(`import map "${k}" -> ${v} does not exist on disk`); bad++; }
  }
  if (!bad) pass(`${Object.keys(mapJson.imports ?? {}).length} mapped specifiers resolve to real files`);
}

// -------------------------------------------------- relative imports resolve
// A typo'd relative import used to pass clean: they were filtered out and never
// resolved, and vendor/ was never scanned at all.
section('relative imports');
let brokenImports = 0, edges = 0;
for (const f of [...listJs(join(ROOT, 'js')), ...listJs(join(ROOT, 'vendor'))]) {
  const src = readFileSync(f, 'utf8');
  const specs = [
    ...[...src.matchAll(/^\s*import\s[\s\S]*?from\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]),
    ...[...src.matchAll(/^\s*export\s[\s\S]*?from\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]),
    ...[...src.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]),
  ];
  for (const spec of specs.filter((s) => /^\.{1,2}\//.test(s))) {
    edges++;
    const target = resolve(dirname(f), spec);
    const rel = target.replace(ROOT + '/', '');
    if (!exactPathExists(rel)) { fail(`${f.replace(ROOT + '/', '')} imports "${spec}" — no such file`); brokenImports++; }
  }
}
if (!brokenImports) pass(`${edges} relative imports resolve`);

// ------------------------------------------------------------ cross-origin JS
section('cross-origin scripts');
// A cross-origin script tagged type="module" is fetched with CORS and must also
// cope with document.currentScript being null. Both are host-specific; the
// default is simply not to use the module form for third-party tags.
let xo = 0;
for (const m of html.matchAll(/<script\b([^>]*)>/gi)) {
  const src = m[1].match(/\bsrc\s*=\s*["']?([^"'\s>]+)/)?.[1];
  if (!src || !/^https?:\/\//.test(src)) continue;
  xo++;
  if (/\btype\s*=\s*["']?module\b/.test(m[1])) fail(`cross-origin script as type=module: ${src}`);
  else pass(`cross-origin script uses a classic tag: ${src}`);
}
if (xo === 0) pass('no cross-origin scripts');

// ------------------------------------------------- every referenced local file
section('referenced files exist');
const localRefs = new Set();
for (const m of html.matchAll(/\b(?:href|src)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/g)) {
  const ref = m[1] ?? m[2] ?? m[3];
  if (!/^(https?:)?\/\/|^data:|^#|^mailto:/.test(ref)) localRefs.add(ref);
}
// ...including the ones only JavaScript and CSS ever name, which nothing checked
for (const f of listJs(join(ROOT, 'js'))) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/['"`]((?:vendor|art|js|css)\/[^'"`]+\.[a-z0-9]{2,5})['"`]/gi)) localRefs.add(m[1]);
}
for (const cssFile of ['css/style.css', 'css/ui.css']) {
  const src = readFileSync(join(ROOT, cssFile), 'utf8');
  for (const m of src.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
    if (/^(https?:)?\/\/|^data:/.test(m[1])) continue;
    localRefs.add(resolve(dirname(join(ROOT, cssFile)), m[1]).replace(ROOT + '/', ''));
  }
}
let missing = 0;
for (const ref of localRefs) if (!exactPathExists(ref)) { fail(`referenced but missing: ${ref}`); missing++; }
if (!missing) pass(`${localRefs.size} referenced files exist (html + js + css)`);

// ------------------------------------------------------- vendored audio slugs
// The audio paths are built by concatenation (see js/ui.js), so the literal
// scan above cannot see them. Resolve them from the data instead — both
// directions, so a renamed slug and an orphaned file both fail.
section('vendored audio');
{
  const g = readFileSync(join(ROOT, 'js/data/greetings.js'), 'utf8');
  const a = readFileSync(join(ROOT, 'js/data/record-audio.js'), 'utf8');
  const want = {
    greetings: [...g.matchAll(/file:\s*'([^']+)'/g)].map((m) => m[1]),
    sounds: [...a.matchAll(/f:\s*'([^']+)'/g)].map((m) => m[1]),
  };
  let bad = 0;
  for (const [dir, slugs] of Object.entries(want)) {
    for (const slug of slugs) {
      if (!exactPathExists(`vendor/audio/${dir}/${slug}.m4a`)) { fail(`vendor/audio/${dir}/${slug}.m4a referenced but missing`); bad++; }
    }
    const onDisk = readdirSync(join(ROOT, 'vendor/audio', dir)).filter((f) => f.endsWith('.m4a'));
    for (const f of onDisk) {
      if (!slugs.includes(f.replace(/\.m4a$/, ''))) { fail(`vendor/audio/${dir}/${f} is on disk but nothing references it`); bad++; }
    }
    if (!bad) pass(`${dir}: ${slugs.length} slugs resolve, no orphans`);
  }
}

// ------------------------------------------------------------------- js parse
section('javascript parses (module goal)');
// `node --check foo.js` is a lenient dual-goal parse: `export { a, missing }`
// passes as .js and dies at instantiation. Copy to .mjs to force module goal.
const tmp = mkdtempSync(join(tmpdir(), 'gm-preflight-'));
let parseFails = 0;
const projectJs = listJs(join(ROOT, 'js'));
for (const f of projectJs) {
  const t = join(tmp, basename(f, extname(f)) + '.mjs');
  writeFileSync(t, readFileSync(f));
  try { execFileSync('node', ['--check', t], { stdio: 'pipe' }); }
  catch (e) {
    fail(`module-goal syntax error: ${f.replace(ROOT + '/', '')}\n       ${String(e.stderr).split('\n')[2] ?? ''}`);
    parseFails++;
  }
}
rmSync(tmp, { recursive: true, force: true });
if (!parseFails) pass(`${projectJs.length} modules parse as modules`);

// ----------------------------------------------------------------- css sanity
section('css sanity');
// Not a validator — but one unclosed brace voids every rule after it, and the
// entire sub-900px sheet system is pure CSS with no JS to fail loudly.
for (const cssFile of ['css/style.css', 'css/ui.css']) {
  const src = readFileSync(join(ROOT, cssFile), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const open = (src.match(/{/g) || []).length;
  const close = (src.match(/}/g) || []).length;
  if (open !== close) fail(`${cssFile}: ${open} { vs ${close} } — a rule block is unterminated`);
  else pass(`${cssFile}: braces balance (${open})`);
}

// ---------------------------------------------------------------- live checks
if (process.argv.includes('--live')) {
  section('live site');
  const head = async (url) => {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      return { status: r.status, type: r.headers.get('content-type') || '' };
    } catch (e) { return { status: 0, type: String(e.message) }; }
  };

  const page = await fetch(LIVE + '/', { cache: 'no-store' });
  page.ok ? pass(`${LIVE}/ → ${page.status}`) : fail(`${LIVE}/ → ${page.status}`);
  const liveHtml = (await page.text()).replace(/<!--[\s\S]*?-->/g, '');

  const liveMap = liveHtml.indexOf('<script type="importmap"');
  const liveMod = liveHtml.search(/<link\b[^>]*\brel\s*=\s*["']?modulepreload|<script\b[^>]*\btype\s*=\s*["']?module/i);
  if (liveMap >= 0 && (liveMod < 0 || liveMap < liveMod)) pass('live import map ordering is correct');
  else fail('live import map is preceded by a module load — the site will not boot');

  // the deployed bytes must BE the commit, not merely resemble it
  try {
    const localHash = execFileSync('shasum', ['-a', '256', join(ROOT, 'index.html')]).toString().split(' ')[0];
    const liveHash = execFileSync('shasum', ['-a', '256'], { input: await (await fetch(LIVE + '/', { cache: 'no-store' })).text() })
      .toString().split(' ')[0];
    liveHash === localHash
      ? pass('deployed index.html is byte-identical to the working tree')
      : console.log('  note deployed index.html differs from the tree (unpushed edits, or Pages still publishing)');
  } catch { /* shasum unavailable — skip */ }

  // EVERY module and runtime asset, actually requested. A 404 returns
  // text/html, which is fatal for a module even before the status code.
  const urls = new Set();
  for (const v of Object.values(mapJson?.imports ?? {})) if (/^[./]/.test(v)) urls.add(v.replace(/^\.?\//, ''));
  for (const ref of localRefs) urls.add(ref.replace(/^\//, ''));
  let bad = 0;
  for (const u of urls) {
    const { status, type } = await head(`${LIVE}/${u}`);
    const isJs = u.endsWith('.js');
    if (status !== 200) { fail(`${u} → ${status} ${type}`); bad++; }
    else if (isJs && !/javascript|ecmascript/i.test(type)) { fail(`${u} → 200 but content-type ${type} (fatal for a module)`); bad++; }
  }
  if (!bad) pass(`${urls.size} live URLs return 200 with usable content types`);
}

// NOT COVERED, and worth knowing: a runtime throw, a CSS rule that parses but
// misbehaves, an engine-specific failure. The only check that would subsume
// those is a headless load — in FIREFOX, since Chrome tolerated the ordering
// bug Firefox rejected — asserting #gm-boot is removed, window.__ctx exists,
// renderer.info.render.calls > 0, and no 4xx in the resource timeline.
console.log(`\n${failures ? `FAILED — ${failures} problem(s)` : 'PREFLIGHT PASSED'}\n`);
process.exit(failures ? 1 : 0);
