#!/usr/bin/env node
// Vendor the Golden Record audio that is genuinely ours to serve.
//
// NASA's retired voyager.jpl.nasa.gov published the 55 spoken greetings and the
// Sounds of Earth recordings as individual files. They are works of the U.S.
// government and therefore public domain, so we host them ourselves rather than
// depending on anyone's streaming service staying up.
//
// Source format is 1977 telephony-grade: 8 kHz mono, µ-law (.au) or 16-bit PCM
// (.wav). No browser plays .au, and WAV is wasteful, so everything is converted
// to AAC-LC in an .m4a container — decodable by every current browser.
//
//   node tools/fetch-audio.mjs            fetch + convert everything
//   node tools/fetch-audio.mjs --verify   no network; check what is on disk
//
// macOS only (uses afconvert). The converted files are committed, so you only
// need this to regenerate them.

import { mkdirSync, writeFileSync, readdirSync, statSync, rmSync, mkdtempSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'vendor/audio');
const BASE = 'http://voyager.jpl.nasa.gov/spacecraft/audio';
const BITRATE = '24000'; // AAC-LC; the source has ~4 kHz of real bandwidth

// The 55 greetings, in the record's own alphabetical order.
// NOTE: `mandarin.au` is NOT the Mandarin greeting — that URL archives as an
// HTML error page. The real file is `man_chin.au`. Nothing about the HTTP
// status reveals this, which is why every download is header-validated below.
const GREETINGS = [
  'akkadian', 'amoy', 'arabic', 'aramaic', 'armenian', 'bengali', 'burmese',
  'cantonese', 'czech', 'dutch', 'english', 'french', 'german', 'greek',
  'gujarati', 'hebrew', 'hindi', 'hittite', 'hungarian', 'ila', 'indonesian',
  'italian', 'japanese', 'kannada', 'kechua', 'korean', 'latin', 'luganda',
  ['mandarin', 'man_chin'], 'marathi', 'nepali', 'nguni', 'nyanja', 'oriya',
  'persian', 'polish', 'portuguese', 'punjabi', 'rajasthani', 'romanian',
  'russian', 'serbian', 'sinhalese', 'sotho', 'spanish', 'sumerian', 'swedish',
  'telugu', 'thai', 'turkish', 'ukrainian', 'urdu', 'vietnamese', 'welsh', 'wu',
];

// Sounds of Earth, as NASA published them individually.
const SOUNDS = [
  'life', 'kiss', 'tractor', 'bus', 'train', 'horse', 'morse', 'herding',
  'tamedog', 'spheres', 'mud', 'wind', 'crickets', 'birds', 'chimpanzee',
  'wildog', 'footsteps', 'fire', 'first', 'volcanoes', 'f-111',
];

const say = (m) => console.log(m);

// ---------------------------------------------------------------- verify mode
if (process.argv.includes('--verify')) {
  let bad = 0;
  for (const [dir, list] of [['greetings', GREETINGS], ['sounds', SOUNDS]]) {
    const d = join(OUT, dir);
    const want = list.map((x) => (Array.isArray(x) ? x[0] : x));
    const have = existsSync(d) ? readdirSync(d).filter((f) => f.endsWith('.m4a')) : [];
    for (const slug of want) {
      if (!have.includes(`${slug}.m4a`)) { say(`  MISSING ${dir}/${slug}.m4a`); bad++; }
    }
    for (const f of have) {
      if (!want.includes(f.replace(/\.m4a$/, ''))) { say(`  ORPHAN  ${dir}/${f}`); bad++; }
    }
    const bytes = have.reduce((n, f) => n + statSync(join(d, f)).size, 0);
    say(`  ${dir}: ${have.length}/${want.length} files, ${(bytes / 1024).toFixed(0)} KB`);
  }
  say(bad ? `\nFAILED — ${bad} problem(s)\n` : '\nVERIFY PASSED\n');
  process.exit(bad ? 1 : 0);
}

// (afconvert exits non-zero for -h, so probe for the binary itself)
if (!existsSync('/usr/bin/afconvert')) {
  say('afconvert not found — this script is macOS only. The .m4a files are committed.');
  process.exit(1);
}

// Resolve a usable Wayback snapshot. Later captures of the retired site serve
// an HTML error page in place of the audio, so we take the EARLIEST 200 and
// still validate the bytes afterwards.
async function snapshots(name) {
  const u = `https://web.archive.org/cdx/search/cdx?url=voyager.jpl.nasa.gov/spacecraft/audio/${name}&output=text&fl=timestamp,statuscode&limit=40`;
  const txt = await fetch(u).then((r) => r.text()).catch(() => '');
  return txt.trim().split('\n')
    .map((l) => l.split(' '))
    .filter((p) => p[1] === '200')
    .map((p) => p[0]);
}

// `.snd` (au): magic, then dataOffset, dataSize, encoding, sampleRate, channels.
// `RIFF....WAVE` for the sounds. Anything else is the HTML-error-page trap.
function validate(buf, name) {
  const b = Buffer.from(buf);
  if (b.slice(0, 4).toString('latin1') === '.snd') {
    const enc = b.readUInt32BE(12), rate = b.readUInt32BE(16);
    if (enc !== 1) throw new Error(`${name}: .au encoding ${enc}, expected 1 (µ-law)`);
    return `µ-law ${rate} Hz`;
  }
  if (b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WAVE') {
    return 'wav';
  }
  throw new Error(`${name}: not audio (${b.slice(0, 16).toString('latin1').replace(/[^\x20-\x7e]/g, '.')})`);
}

const tmp = mkdtempSync(join(tmpdir(), 'gm-audio-'));
let ok = 0, failed = [], srcTotal = 0, outTotal = 0;

async function grab(dir, slug, remote, ext) {
  const outDir = join(OUT, dir);
  mkdirSync(outDir, { recursive: true });
  const stamps = await snapshots(`${remote}.${ext}`);
  if (!stamps.length) { failed.push(`${slug} (no snapshot)`); return; }

  for (const ts of stamps) {
    try {
      const res = await fetch(`https://web.archive.org/web/${ts}id_/${BASE}/${remote}.${ext}`);
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 1000) continue;
      const kind = validate(buf, slug); // throws on the HTML trap → try next stamp
      const src = join(tmp, `${slug}.${ext}`);
      writeFileSync(src, Buffer.from(buf));
      const dst = join(outDir, `${slug}.m4a`);
      execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac@16000', '-c', '1', '-b', BITRATE, src, dst], { stdio: 'pipe' });
      const outSize = statSync(dst).size;
      srcTotal += buf.byteLength; outTotal += outSize; ok++;
      say(`  ${dir}/${slug.padEnd(12)} ${kind.padEnd(14)} ${String(buf.byteLength).padStart(7)} → ${String(outSize).padStart(6)} B`);
      return;
    } catch (e) { /* HTML page or convert failure — try the next snapshot */ }
  }
  failed.push(slug);
}

say('greetings (NASA, public domain — 8 kHz µ-law → AAC-LC):');
for (const entry of GREETINGS) {
  const [slug, remote] = Array.isArray(entry) ? entry : [entry, entry];
  await grab('greetings', slug, remote, 'au');
}
say('\nsounds of earth (NASA, public domain — 8 kHz PCM → AAC-LC):');
for (const slug of SOUNDS) await grab('sounds', slug, slug, 'wav');

rmSync(tmp, { recursive: true, force: true });
say(`\n${ok} files: ${(srcTotal / 1048576).toFixed(2)} MB source → ${(outTotal / 1048576).toFixed(2)} MB m4a`);
if (failed.length) { say(`FAILED (${failed.length}): ${failed.join(', ')}`); process.exit(1); }
say('done\n');
