#!/usr/bin/env node
// Preflight: the checks that must pass before anything is pushed.
//
// Written after a modulepreload link was added ABOVE the import map, which
// silently invalidated the map, left every bare specifier unresolvable, and
// took the live site down — while a grep for the new code "verified" fine.
// Grep proves a file uploaded. These prove the page can actually boot.
//
//   node tools/preflight.mjs            check the working tree
//   node tools/preflight.mjs --live     also check https://goldenrecord.voyage
//
// Exit code 1 on any failure, so it can gate a push.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

let failures = 0;
const pass = (m) => console.log(`  ok   ${m}`);
const fail = (m) => { failures++; console.log(`  FAIL ${m}`); };
const section = (m) => console.log(`\n${m}`);

// ---------------------------------------------------------------- import map
// The HTML spec: an import map must be in place before ANY module load or
// preload begins. Break this and every bare specifier ("three") stops
// resolving — the exact failure that broke production.
section('import map');
const mapIdx = html.indexOf('<script type="importmap"');
if (mapIdx < 0) {
  fail('no <script type="importmap"> found');
} else {
  const earlier = [
    [/<link[^>]+rel=["']?modulepreload/i, 'a <link rel="modulepreload">'],
    [/<script[^>]+type=["']module["']/i, 'a <script type="module">'],
  ];
  let clean = true;
  for (const [re, what] of earlier) {
    const m = html.match(re);
    if (m && html.indexOf(m[0]) < mapIdx) {
      fail(`${what} appears BEFORE the import map — the map will be ignored ` +
           'and every bare specifier will fail to resolve');
      clean = false;
    }
  }
  if (clean) pass('import map precedes every module load and preload');

  // every bare specifier imported anywhere in js/ must be mapped
  const imports = new Set();
  const walk = (dir) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (e.endsWith('.js')) {
        // anchor on a real import statement — a bare /from ['"]/ also matches
        // prose inside comments and strings (it flagged the word "alone")
        const src = readFileSync(p, 'utf8');
        for (const m of src.matchAll(/^\s*import\s[\s\S]*?from\s*['"]([^'"]+)['"]/gm)) {
          if (!/^[./]/.test(m[1])) imports.add(m[1]);
        }
        for (const m of src.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
          if (!/^[./]/.test(m[1])) imports.add(m[1]);
        }
      }
    }
  };
  walk(join(ROOT, 'js'));
  const mapJson = JSON.parse(html.slice(html.indexOf('{', mapIdx), html.indexOf('</script>', mapIdx)));
  for (const spec of imports) {
    if (mapJson.imports?.[spec]) pass(`bare specifier "${spec}" is mapped`);
    else fail(`bare specifier "${spec}" is imported but NOT in the import map`);
  }
}

// ------------------------------------------------------------ cross-origin JS
// A cross-origin script tagged type="module" is fetched with CORS; if the host
// sends no Access-Control-Allow-Origin the browser blocks it outright.
section('cross-origin scripts');
let xo = 0;
for (const m of html.matchAll(/<script([^>]*)>/gi)) {
  const attrs = m[1];
  const src = attrs.match(/src=["']([^"']+)["']/)?.[1];
  if (!src || !/^https?:\/\//.test(src)) continue;
  xo++;
  if (/type=["']module["']/.test(attrs)) {
    fail(`cross-origin script loaded as type="module" (needs CORS): ${src}`);
  } else {
    pass(`cross-origin script uses a classic tag: ${src}`);
  }
}
if (xo === 0) pass('no cross-origin scripts');

// ---------------------------------------------------------- local references
// Every local asset index.html points at must exist on disk.
section('local references in index.html');
let missing = 0;
for (const m of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
  const ref = m[1];
  if (/^(https?:)?\/\/|^data:|^#|^mailto:/.test(ref)) continue;
  const p = join(ROOT, ref.replace(/^\//, '').split('?')[0]);
  if (!existsSync(p)) { fail(`referenced but missing on disk: ${ref}`); missing++; }
}
if (!missing) pass('every referenced local file exists');

// ------------------------------------------------------------------- js parse
section('javascript parses');
const jsFiles = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (e.endsWith('.js')) jsFiles.push(p);
  }
})(join(ROOT, 'js'));
let parseFails = 0;
for (const f of jsFiles) {
  try { execFileSync('node', ['--check', f], { stdio: 'pipe' }); }
  catch (e) { fail(`syntax error: ${f.replace(ROOT + '/', '')}`); parseFails++; }
}
if (!parseFails) pass(`${jsFiles.length} modules parse`);

// ---------------------------------------------------------------- live checks
if (process.argv.includes('--live')) {
  section('live site');
  const url = 'https://goldenrecord.voyage/';
  const res = await fetch(url, { cache: 'no-store' });
  res.ok ? pass(`${url} → ${res.status}`) : fail(`${url} → ${res.status}`);
  const live = await res.text();
  const liveMap = live.indexOf('<script type="importmap"');
  const liveMod = live.search(/<link[^>]+rel=["']?modulepreload|<script[^>]+type=["']module["']/i);
  if (liveMap >= 0 && (liveMod < 0 || liveMap < liveMod)) pass('live import map ordering is correct');
  else fail('live import map is preceded by a module load — the site will not boot');
  // the boot placeholder must exist in the source (it is removed at runtime)
  live.includes('id="gm-boot"') ? pass('boot placeholder present in source') : fail('boot placeholder missing');
}

console.log(`\n${failures ? `FAILED — ${failures} problem(s)` : 'PREFLIGHT PASSED'}\n`);
process.exit(failures ? 1 : 0);
