#!/usr/bin/env node
// Keep a local safety copy of the audio this site does NOT host itself.
//
// The greetings and Earth sounds are vendored in this repo — they are NASA's,
// public domain, and cannot disappear. The 27 musical selections and the two
// United Nations sections are different: they stream from one Internet Archive
// item, and if that item is ever taken down the player loses two collections.
//
// This pulls the whole item to disk so there is always a local original to
// re-cut from. It downloads FLAC by default because a backup should be the
// best copy available, not the one that happens to be small.
//
//   node tools/backup-archive-audio.mjs           FLAC   (~579 MB)
//   node tools/backup-archive-audio.mjs --mp3     MP3    (~141 MB)
//   node tools/backup-archive-audio.mjs --verify  no network; check the copy
//
// The files land in backup/ — which is gitignored. They are a commercial
// release and are NOT ours to redistribute, so they must never be committed or
// served. This is a private archival copy, nothing more.
//
// Safe to re-run: existing files of the right size are skipped, so an
// interrupted download resumes where it stopped.

import { mkdirSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'backup/voyager-golden-record-ozma');
const ITEM = 'voyager-golden-record-cd-ozma';
const WANT = process.argv.includes('--mp3') ? 'VBR MP3' : 'Flac';

const say = (m) => console.log(m);
const mb = (n) => (n / 1048576).toFixed(1) + ' MB';

async function manifest() {
  const r = await fetch(`https://archive.org/metadata/${ITEM}`);
  if (!r.ok) throw new Error(`archive.org metadata: HTTP ${r.status}`);
  const d = await r.json();
  return d.files
    .filter((f) => f.format === WANT)
    .map((f) => ({ name: f.name, size: Number(f.size || 0), md5: f.md5 }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------- verify mode
if (process.argv.includes('--verify')) {
  if (!existsSync(OUT)) { say(`nothing at ${OUT} — run without --verify first\n`); process.exit(1); }
  const have = readdirSync(OUT);
  const bytes = have.reduce((n, f) => n + statSync(join(OUT, f)).size, 0);
  say(`\n${OUT}`);
  say(`  ${have.length} files, ${mb(bytes)}`);
  const short = have.filter((f) => statSync(join(OUT, f)).size < 10000);
  say(short.length ? `  SUSPECT (under 10 KB): ${short.join(', ')}\n` : '  no truncated files\n');
  process.exit(short.length ? 1 : 0);
}

mkdirSync(OUT, { recursive: true });
const files = await manifest();
const total = files.reduce((n, f) => n + f.size, 0);
say(`\n${files.length} ${WANT} files, ${mb(total)} → backup/voyager-golden-record-ozma/`);
say('(gitignored: this is a commercial release, kept locally as a safety copy)\n');

let fetched = 0, skipped = 0, failed = [];
for (const [i, f] of files.entries()) {
  const dst = join(OUT, f.name);
  // resume: a file already at its published size is complete
  if (existsSync(dst) && statSync(dst).size === f.size) {
    skipped++;
    continue;
  }
  const url = `https://archive.org/download/${ITEM}/${encodeURIComponent(f.name)}`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    // a truncated download is worse than none: it would pass an existence check
    if (f.size && buf.length !== f.size) throw new Error(`got ${buf.length} B, expected ${f.size}`);
    writeFileSync(dst, buf);
    fetched++;
    say(`  ${String(i + 1).padStart(2)}/${files.length}  ${mb(buf.length).padStart(9)}  ${f.name.slice(0, 58)}`);
  } catch (e) {
    failed.push(`${f.name} (${e.message})`);
    say(`  ${String(i + 1).padStart(2)}/${files.length}  FAILED    ${f.name.slice(0, 58)} — ${e.message}`);
  }
}

say(`\n${fetched} downloaded, ${skipped} already present`);
if (failed.length) {
  say(`FAILED (${failed.length}) — re-run to retry just these:`);
  for (const f of failed) say(`  ${f}`);
  process.exit(1);
}
say(`done — ${mb(total)} at ${OUT}\n`);
