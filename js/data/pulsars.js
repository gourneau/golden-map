// The 14 pulsars of the Pioneer plaque / Voyager Golden Record pulsar map.
//
// Sources (see research/brief-raw.txt for the full provenance chain):
//   - Map-decoded (engraved) periods & line-length distances: Wm. Robert Johnston,
//     "Reading the Pioneer/Voyager pulsar map", johnstonsarchive.net/astro/pulsarmap.html
//   - Modern periods, positions, distances: ATNF Pulsar Catalogue v2.6.2
//     (VLBI parallax / SNR-association distances where available, else YMW16 DM model)
//   - Angle errors & reconstruction results: R. Russel, "Galactic Navigation using the
//     Pioneer Spacecraft Pulsar Map", DSES (2019); Johnston (2007)
//
// periodEncoded  = spin period as engraved on the record (seconds), epoch ~1969.7
// periodModern   = ATNF catalogue period (seconds)
// dist1977       = distance implied by the engraved line length (kpc) — 1970s DM data
// distModern     = best modern estimate (kpc)
// distNote       = one plain-language sentence about the distance (primary text)
// fineNote       = technical provenance for the distance (rendered as fine print)
// pdot           = period derivative (s/s), for spin-down animation (ATNF)
// ageKyr         = characteristic age (kyr), for the death-timeline act (ATNF)

// One time unit = the period of the hydrogen 21 cm hyperfine transition:
// 1 / 1,420,405,751.77 Hz. Every number on the record counts in these.
export const HYDROGEN_PERIOD = 7.04024183647e-10; // seconds

// Sun / galaxy geometry for the 3D scene
export const R0_KPC = 8.2;          // Sun -> Galactic Center (GRAVITY Collab. 2019/2021)
export const SUN_Z_KPC = 0.0208;    // Sun sits ~20.8 pc above the galactic midplane
export const MAP_EPOCH = 1969.7;    // data epoch recovered from spin-down (Johnston), +/- 1.2 yr

export const PULSARS = [
  {
    line: 1, bname: 'B1727-47', jname: 'J1731-4744',
    periodEncoded: 0.82968300, periodModern: 0.82994561219,
    pdot: 1.638e-13, ageKyr: 80.4,
    ra: '17:31:42.276', dec: '-47:44:38.81',
    dist1977: 2.3, distModern: 0.7,
    distNote: 'Even today, no one is sure how far away this star really is — the two best modern estimates disagree by a factor of eight.',
    fineNote: 'Supernova-remnant association gives 0.7 kpc; the YMW16 electron-density model says 5.5 kpc — the widest distance ambiguity on the map.',
    confidence: 'secure',
    note: 'Line 1 in Johnston’s numbering. Its engraved line was drawn over 3× too long.',
  },
  {
    line: 2, bname: 'B1451-68', jname: 'J1456-6843',
    periodEncoded: 0.26337676, periodModern: 0.2633769266537,
    pdot: 9.83e-17, ageKyr: 42500,
    ra: '14:55:59.886', dec: '-68:43:39.54',
    dist1977: 0.16, distModern: 0.43,
    distNote: 'This star is really almost three times farther away than the line on the map says.',
    fineNote: 'VLBI parallax — the tiny shift in a star’s apparent position as Earth orbits, which gives its true distance — puts it at 0.43 kpc, about 2.7× the engraved 0.16 kpc.',
    confidence: 'secure',
    note: 'An old, sedate pulsar: its period has drifted so little since 1969 that engraved and modern values agree to better than a part per million.',
  },
  {
    line: 3, bname: 'B1240-64', jname: 'J1243-6423',
    periodEncoded: 0.388000, periodModern: 0.3884851271101,
    pdot: 4.501e-15, ageKyr: 1370,
    ra: '12:43:17.121', dec: '-64:23:23.69',
    dist1977: 4.7, distModern: 2.0,
    distNote: 'Honestly, nobody knows how far away this one is — modern estimates disagree by a factor of four or more.',
    fineNote: 'ATNF best estimate 2.0 kpc; DM electron-density models range 7.4–9.4 kpc. Highly model-dependent.',
    confidence: 'probable',
    note: 'The map’s one honest engraving error: its period was known to only 3 significant digits in 1971, yet was engraved to ~30 binary digits — far more precision than anyone actually had. It is also within 0.2% of line 14’s period — only the line’s direction tells them apart.',
    flaw: 'spurious-precision',
  },
  {
    line: 4, bname: 'B0833-45', jname: 'J0835-4510', alias: 'Vela',
    periodEncoded: 0.08921875, periodModern: 0.089328385024,
    pdot: 1.25e-13, ageKyr: 11.3,
    ra: '08:35:20.611', dec: '-45:10:34.88',
    dist1977: 1.3, distModern: 0.28,
    distNote: 'The line on the map is drawn about four and a half times too long — Vela is much closer than the mapmakers believed.',
    fineNote: 'VLBI parallax: 287 pc (Dodson et al. 2003), against the 1.3 kpc implied by the engraved line length.',
    confidence: 'secure',
    note: 'The Vela pulsar, sitting inside a supernova remnant — the debris cloud of its own explosion — about 11,000 years old. Young, fast-slowing, and prone to sudden glitches — one of the map’s two built-in clocks.',
  },
  {
    line: 5, bname: 'B0950+08', jname: 'J0953+0755',
    periodEncoded: 0.25306504, periodModern: 0.2530654277593,
    pdot: 2.292e-16, ageKyr: 17500,
    ra: '09:53:09.302', dec: '+07:55:36.66',
    dist1977: 0.12, distModern: 0.261,
    distNote: 'One of the nearest pulsars known — though still about twice as far away as the line on the map says.',
    fineNote: 'VLBI parallax: 261 pc (Brisken et al. 2002); the engraved line implies 0.12 kpc.',
    confidence: 'secure',
    note: 'High above the flat disc of the galaxy — one of the three lines whose engraved angle is off, by ~10.6°.',
    flaw: 'angle',
    angleErrorDeg: 10.6,
  },
  {
    line: 6, bname: 'B0823+26', jname: 'J0826+2637',
    periodEncoded: 0.53065960, periodModern: 0.53066051169,
    pdot: 1.72e-15, ageKyr: 4890,
    ra: '08:26:51.507', dec: '+26:37:21.30',
    dist1977: 0.16, distModern: 0.50,
    distNote: 'About three times farther away than the line on the map says.',
    fineNote: 'VLBI parallax: 0.50 kpc (Deller et al. 2019); the engraved line implies 0.16 kpc.',
    confidence: 'secure',
    note: 'The map’s worst-drawn bearing: the engraved angle misses the true direction by ~17.6°.',
    flaw: 'angle',
    angleErrorDeg: 17.6,
  },
  {
    line: 7, bname: 'B0531+21', jname: 'J0534+2200', alias: 'Crab',
    periodEncoded: 0.03312964, periodModern: 0.0333924123,
    pdot: 4.204e-13, ageKyr: 1.26,
    ra: '05:34:31.934', dec: '+22:00:52.19',
    dist1977: 1.5, distModern: 2.0,
    distNote: 'One of the best-known distances on the map — this star sits in a debris cloud left by an explosion people on Earth actually watched, in the year 1054.',
    fineNote: '2.0 ± 0.5 kpc via association with the Crab Nebula, remnant of the supernova of A.D. 1054 — one of the best-anchored distances on the map.',
    confidence: 'secure',
    note: 'The Crab pulsar: born in a supernova witnessed in 1054, spinning 30× a second. It slows faster than anything else on the map — which is precisely what lets us date the map to 1969.7 ± 1.2.',
    flaw: 'swapped',
  },
  {
    line: 8, bname: 'B0525+21', jname: 'J0528+2200',
    periodEncoded: 3.74549080, periodModern: 3.7455392503,
    pdot: 4.00e-14, ageKyr: 1480,
    ra: '05:28:52.264', dec: '+22:00:04',
    dist1977: 0.98, distModern: 1.2,
    distNote: 'The map gets this one roughly right — the modern estimate is only about a quarter farther out.',
    fineNote: 'DM-only distance (no parallax): 1.2 kpc; older electron-density models said ~2.3 kpc.',
    confidence: 'secure',
    note: 'The longest period on the map — 3.75 seconds, unmistakable to any decoder. It sits only 1.4° from the Crab on the sky, and of all fourteen it is the nearest to the pulsar "death line", where radio emission shuts off.',
    flaw: 'swapped',
  },
  {
    line: 9, bname: 'B0329+54', jname: 'J0332+5434',
    periodEncoded: 0.71451864, periodModern: 0.714519699726,
    pdot: 2.05e-15, ageKyr: 5530,
    ra: '03:32:59.410', dec: '+54:34:43.33',
    dist1977: 0.57, distModern: 1.68,
    distNote: 'About three times farther away than the line on the map says.',
    fineNote: 'Parallax-based, 1.0–1.7 kpc range; ATNF best estimate 1.68 kpc, vs 0.57 kpc engraved.',
    confidence: 'secure',
    note: 'The brightest pulsar in the northern sky — the beacon a decoder would likely find first.',
  },
  {
    line: 10, bname: 'B2217+47', jname: 'J2219+4754',
    periodEncoded: 0.53846738, periodModern: 0.5384688219194,
    pdot: 2.765e-15, ageKyr: 3090,
    ra: '22:19:48.139', dec: '+47:54:53.93',
    dist1977: 0.85, distModern: 2.38,
    distNote: 'Probably close to three times farther away than the line on the map says — though its distance has never been measured directly.',
    fineNote: 'DM-only distance (no parallax): 2.38 kpc, model-dependent; the engraved line implies 0.85 kpc.',
    confidence: 'secure',
    note: 'Its period sits within 0.3% of line 6’s — but the two lines point ~150° apart, so there is no real ambiguity.',
  },
  {
    line: 11, bname: 'B2016+28', jname: 'J2018+2839',
    periodEncoded: 0.55795339, periodModern: 0.5579534804225,
    pdot: 1.49e-16, ageKyr: 59400,
    ra: '20:18:03.833', dec: '+28:39:54.21',
    dist1977: 0.28, distModern: 0.98,
    distNote: 'About three and a half times farther away than the line on the map says.',
    fineNote: 'VLBI parallax: 0.98 kpc (Brisken et al. 2002); the DM model agrees. The engraved line implies 0.28 kpc.',
    confidence: 'secure',
    note: 'The single best period match on the map: engraved and modern values agree to a few parts in ten million. So slow-changing it is almost a fixed star of time.',
  },
  {
    line: 12, bname: 'B1933+16', jname: 'J1935+1616',
    periodEncoded: 0.35873542, periodModern: 0.35874514019893,
    pdot: 5.99e-15, ageKyr: 949,
    ra: '19:35:47.828', dec: '+16:16:39.68',
    dist1977: 3.4, distModern: 3.7,
    distNote: 'The map’s line turns out to be nearly right — after decades when astronomers thought the real distance was more than double it.',
    fineNote: 'VLBI parallax (Ding et al. 2023): 3.7 kpc, vs 3.4 kpc engraved. Later electron-density models had pushed the assumed distance to ~7.9 kpc before the parallax settled it back near the original value.',
    confidence: 'secure',
    note: 'The most distant securely-measured pulsar on the map.',
  },
  {
    line: 13, bname: 'B1929+10', jname: 'J1932+1059',
    periodEncoded: 0.22651704, periodModern: 0.22651892659397,
    pdot: 1.157e-15, ageKyr: 3100,
    ra: '19:32:14.091', dec: '+10:59:33.37',
    dist1977: 0.081, distModern: 0.31,
    distNote: 'We now know this star is almost four times farther away than the line on the map says.',
    fineNote: 'VLBI parallax: 0.31 kpc; the engraved line implies 81 pc — nearly 4× too short.',
    confidence: 'secure',
    note: 'Drawn as the nearest pulsar on the map — the shortest of the fourteen lines.',
  },
  {
    line: 14, bname: 'B1642-03', jname: 'J1645-0317',
    periodEncoded: 0.38768878, periodModern: 0.3876916862626,
    pdot: 1.78e-15, ageKyr: 3450,
    ra: '16:45:02.038', dec: '-03:17:57.38',
    dist1977: 0.32, distModern: 4.0,
    distNote: 'The biggest distance mistake on the map — this star is somewhere between four and twelve times farther away than its line says.',
    fineNote: 'ATNF lists 4.0 kpc (HI absorption); the YMW16 model says 1.33 kpc. Either way, far beyond the engraved 0.32 kpc — the largest distance error on the map.',
    confidence: 'secure',
    note: 'Twin-period partner of line 3 (within 0.2%), and one of the three angle outliers: its bearing is off by ~13.3°.',
    flaw: 'angle',
    angleErrorDeg: 13.3,
  },
];

// Reference l,b values (approx) for cross-checking the coordinate math in astro.js.
// From ATNF / research brief. Keyed by bname.
export const LB_CHECK = {
  'B0833-45': { l: 263.6, b: -2.8 },
  'B0950+08': { l: 228.9, b: 43.7 },
  'B0823+26': { l: 197.0, b: 31.7 },
  'B0531+21': { l: 184.6, b: -5.8 },
  'B0525+21': { l: 183.9, b: -6.9 },
  'B0329+54': { l: 145.0, b: -1.2 },
  'B2217+47': { l: 98.4, b: -7.6 },
  'B2016+28': { l: 68.1, b: -4.0 },
  'B1933+16': { l: 52.4, b: -2.1 },
  'B1929+10': { l: 47.4, b: -3.9 },
  'B1642-03': { l: 14.1, b: 26.1 },
};
