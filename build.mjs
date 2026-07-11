#!/usr/bin/env node
// Build the single-file index.html: bundle the ES modules (three.js included),
// inline both stylesheets, and embed the fonts as data: URIs. The result runs
// anywhere — GitHub Pages, a local server, or a double-clicked file:// page.
//
// Usage: node build.mjs   (writes ./index.html; dev version lives at ./dev.html)

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const bundle = '/tmp/golden-map-bundle.js';
execSync(
  [
    'npx esbuild js/main.js --bundle --minify --format=iife',
    '--alias:three=./vendor/three.module.js',
    `'--alias:three/addons/controls/OrbitControls.js=./vendor/OrbitControls.js'`,
    `--outfile=${bundle}`,
  ].join(' '),
  { stdio: 'inherit', cwd: new URL('.', import.meta.url).pathname },
);

const js = readFileSync(bundle, 'utf8');

const inlineFonts = (css) =>
  css.replace(/url\('\.\.\/vendor\/fonts\/([^']+)'\)/g, (_, file) => {
    const b64 = readFileSync(new URL(`vendor/fonts/${file}`, import.meta.url)).toString('base64');
    return `url('data:font/woff2;base64,${b64}')`;
  });

const css =
  inlineFonts(readFileSync(new URL('css/style.css', import.meta.url), 'utf8')) +
  '\n' +
  readFileSync(new URL('css/ui.css', import.meta.url), 'utf8');

let html = readFileSync(new URL('dev.html', import.meta.url), 'utf8');
html = html
  .replace(/<link rel="stylesheet" href="css\/style.css">\s*/,
    `<style>\n${css}\n</style>\n`)
  .replace(/<link rel="stylesheet" href="css\/ui.css">\s*/, '')
  .replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '')
  .replace(/<script type="module" src="js\/main.js"><\/script>/,
    () => `<script>\n${js}\n</script>`);

writeFileSync(new URL('index.html', import.meta.url), html);
console.log(`index.html written (${(html.length / 1024 / 1024).toFixed(2)} MB, self-contained)`);
