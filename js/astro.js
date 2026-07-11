// Coordinate and encoding math for the pulsar map.
// Conventions follow the research brief (research/brief-raw.txt):
//   J2000 North Galactic Pole: alpha = 192.85948°, delta = 27.12825°; l_NCP = 122.93192°.
//   Heliocentric galactic Cartesian: X toward the Galactic Center, Y toward l = 90°
//   (direction of galactic rotation), Z toward the North Galactic Pole.

import { HYDROGEN_PERIOD } from './data/pulsars.js';

const D2R = Math.PI / 180;

const A_NGP = 192.85948 * D2R;
const D_NGP = 27.12825 * D2R;
const L_NCP = 122.93192 * D2R;

// "17:31:42.276" (hours) -> degrees
export function raToDeg(ra) {
  const [h, m, s] = ra.split(':').map(Number);
  return (h + m / 60 + s / 3600) * 15;
}

// "-47:44:38.81" -> degrees
export function decToDeg(dec) {
  const neg = dec.trim().startsWith('-');
  const [d, m, s = 0] = dec.replace(/^[+-]/, '').split(':').map(Number);
  const val = d + m / 60 + s / 3600;
  return neg ? -val : val;
}

// J2000 equatorial (degrees) -> galactic l, b (degrees)
export function equatorialToGalactic(raDeg, decDeg) {
  const a = raDeg * D2R;
  const d = decDeg * D2R;
  const sinB = Math.sin(D_NGP) * Math.sin(d) + Math.cos(D_NGP) * Math.cos(d) * Math.cos(a - A_NGP);
  const b = Math.asin(sinB);
  const y = Math.cos(d) * Math.sin(a - A_NGP);
  const x = Math.cos(D_NGP) * Math.sin(d) - Math.sin(D_NGP) * Math.cos(d) * Math.cos(a - A_NGP);
  let l = L_NCP - Math.atan2(y, x);
  if (l < 0) l += 2 * Math.PI;
  if (l >= 2 * Math.PI) l -= 2 * Math.PI;
  return { l: l / D2R, b: b / D2R };
}

// galactic l, b (degrees) + distance -> heliocentric galactic XYZ (same unit as d)
export function galacticToXYZ(lDeg, bDeg, d) {
  const l = lDeg * D2R;
  const b = bDeg * D2R;
  return {
    x: d * Math.cos(b) * Math.cos(l),
    y: d * Math.cos(b) * Math.sin(l),
    z: d * Math.sin(b),
  };
}

// Convenience: pulsar record + a chosen distance (kpc) -> XYZ in kpc
export function pulsarXYZ(p, distKpc) {
  const { l, b } = equatorialToGalactic(raToDeg(p.ra), decToDeg(p.dec));
  return { ...galacticToXYZ(l, b, distKpc), l, b };
}

// Spin period (s) -> the binary string as engraved on the record:
// the period counted in hydrogen hyperfine periods, most significant bit first.
export function periodToBinary(periodSeconds) {
  return Math.round(periodSeconds / HYDROGEN_PERIOD).toString(2);
}

// Binary string -> period in seconds (the decoder's direction)
export function binaryToPeriod(bits) {
  return parseInt(bits, 2) * HYDROGEN_PERIOD;
}

// Fractional period drift between engraved and modern values, in parts per million
export function driftPPM(p) {
  return ((p.periodModern - p.periodEncoded) / p.periodEncoded) * 1e6;
}

// One display blink rate for a pulsar, shared by the 3D beacons and the UI rail
// so the two never disagree: 20× real period, eased for the extremes so the
// Crab stays frantic and B0525+21 stays watchable.
export function displayBlinkSeconds(p) {
  return Math.min(20 * p.periodModern, 5 + 1.5 * p.periodModern);
}

// Rough remaining radio lifetime ordering for Act V.
// Pulsars die (cross the "death line") roughly when P/(2*Pdot)-style timescales
// run out: the old, slow ones on the map go dark first, the young violent ones
// (Crab, Vela) shine longest. Illustrative monotonic model, not a fit — spreads
// extinctions across ~8–55 Myr so the timeline matches the published
// "several to tens of millions of years" band (see research/brief-raw.txt).
export function extinctionMyr(p) {
  const tauMyr = p.ageKyr / 1000;                    // characteristic age, Myr
  const logTau = Math.log10(Math.max(tauMyr, 1e-3)); // ~ -2.9 (Crab) .. 1.8 (oldest)
  const t = (1.8 - logTau) / 4.7;                    // 0 = oldest, 1 = youngest
  return 8 + 47 * Math.min(Math.max(t, 0), 1);       // 8 Myr .. 55 Myr
}
