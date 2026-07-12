#!/usr/bin/env node
// One-shot: build vendor/data/brightstars.json from the HYG star database
// (v3.8, David Nash, astronexus.com — CC BY-SA 4.0,
// https://github.com/astronexus/HYG-Database). Keeps every star with apparent
// magnitude <= 4.5 (~900 stars — the real naked-eye sky) as compact rows of
//   [raDeg, decDeg, mag, ci]        (ci = B-V color index; 0.5 when missing)
// The JSON is committed to the repo; this script is NOT a runtime dependency.
//
//   node tools/fetch-brightstars.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const URL_CSV =
  'https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/v3/hyg_v38.csv.gz';
const MAG_LIMIT = 4.5;

const res = await fetch(URL_CSV);
if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText}`);
const csv = gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8');

const lines = csv.trim().split('\n');
const cols = lines[0].split(',').map((c) => c.replace(/^"|"$/g, ''));
const iRa = cols.indexOf('ra');   // decimal HOURS in HYG
const iDec = cols.indexOf('dec'); // degrees
const iMag = cols.indexOf('mag');
const iCi = cols.indexOf('ci');   // B-V color index
const iDist = cols.indexOf('dist');
if ([iRa, iDec, iMag, iCi, iDist].includes(-1)) throw new Error('unexpected CSV header');

const round = (v, p) => Number(v.toFixed(p));
const stars = [];
for (let n = 1; n < lines.length; n++) {
  const f = lines[n].split(',');
  const mag = Number(f[iMag]);
  if (!(mag <= MAG_LIMIT)) continue;
  if (Number(f[iDist]) === 0) continue; // the Sun (HYG id 0)
  const ci = f[iCi] === '' ? 0.5 : Number(f[iCi]);
  stars.push([
    round(Number(f[iRa]) * 15, 4), // hours -> degrees
    round(Number(f[iDec]), 4),
    round(mag, 2),
    round(ci, 2),
  ]);
}
stars.sort((a, b) => a[2] - b[2]); // brightest first

mkdirSync(new URL('../vendor/data', import.meta.url), { recursive: true });
const out = new URL('../vendor/data/brightstars.json', import.meta.url);
const json = '[\n' + stars.map((s) => JSON.stringify(s)).join(',\n') + '\n]\n';
writeFileSync(out, json);
console.log(`brightstars.json: ${stars.length} stars (mag <= ${MAG_LIMIT}), ${(json.length / 1024).toFixed(1)} KB`);
