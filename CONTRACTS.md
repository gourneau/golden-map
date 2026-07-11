# Module contracts — The Golden Map

Read this whole file before writing code. `js/main.js` is the single owner of the
renderer, camera, act list, and shared context. Your module plugs into it and MUST
match the signatures below exactly. Do not edit files you don't own.

## Shared context (`ctx`) — built in js/main.js

```js
ctx = {
  THREE, scene, camera, renderer, controls, canvas,
  bus,                    // EventTarget. Events (all CustomEvent with .detail):
                          //   'act'     {act: 'record'|'map'|'pulsars'|'verdict'|'finders'}
                          //   'select'  {target: pulsarObject | 'gc' | null}
                          //   'timeMyr' {myr: number}            (Act V slider)
                          //   'mapmode' {mode: 'engraved'|'modern'|'both'}
  state: { act, selected, timeMyr, mapMode, timeScale },
  pulsars,                // 14 enriched records, see below
  GC,                     // THREE.Vector3 of the galactic center (kpc)
  MAP_EPOCH,              // 1969.7
  ACTS,                   // [{id, numeral, title} x5]
  setAct(id), select(target), setTimeMyr(myr), setMapMode(mode),
  prefersReducedMotion,   // boolean — honor it: skip/shorten animations
  modules: { starfield, record, map3d },  // available AFTER scene modules built
}
```

Each `pulsars[i]` has all fields from `js/data/pulsars.js` (line, bname, jname, alias?,
periodEncoded, periodModern, pdot, ageKyr, ra, dec, dist1977, distModern, distNote,
confidence, note, flaw?, angleErrorDeg?) plus computed: `l, b` (galactic, deg),
`xyzModern`, `xyz1977` (THREE.Vector3, kpc, heliocentric galactic frame: X toward GC,
Y toward l=90°, Z toward north galactic pole — and camera.up is +Z),
`binary` (the engraved bit string), `driftPPM`.

SCALE: 1 scene unit = 1 kpc. The Sun is at the origin. GC at ~(8.2, 0, -0.02).

## Module signatures (each in its own file, ES module)

- `js/starfield.js` → `export function createStarfield(ctx) -> { object3d, update(dt,t) }`
- `js/record.js`    → `export function createRecord(ctx) -> { object3d, update(dt,t), setVisible(v) }`
- `js/map3d.js`     → `export function createMap(ctx) -> { object3d, update(dt,t) }`
   map3d must also: listen to bus 'mapmode', 'timeMyr', 'select'; make every pulsar
   pickable (mesh.userData.pulsar = p, and put all pickables in
   `object3d.userData.pickables` array for the tour's raycaster; also a pickable for
   the galactic center with userData.pulsar = 'gc').
- `js/ui.js`        → `export function initUI(ctx) -> { update(dt,t) }`
   Owns ALL DOM inside `#ui` (build it with JS) and `css/ui.css`. Never touches three.js.
- `js/tour.js`      → `export function initTour(ctx) -> { update(dt,t) }`
   Owns camera movement (tweened fly-tos; write your own small tween, no libs),
   act-driven scene staging, raycast picking on canvas click → ctx.select(...),
   keyboard nav (arrows between acts, Esc = deselect).

## Design system (css/style.css — already written, use its variables)

Colors: `--void #050403`, `--gold #c9a227`, `--gold-bright #f2d478`, `--gold-dim #6e5a1e`,
`--gold-faint #3a2f14`, `--copper #b87333`, `--paper #e8dcc0`, `--paper-dim`,
`--starlight #a9c3d4` (RESERVED for modern/corrected data), `--alarm #c96a4a` (errors, sparing).
Type: `--display` Marcellus (headings, act titles), `--body` EB Garamond, `--mono` IBM Plex Mono
(all data: periods, binary strings, coordinates). Classes available: `.eyebrow`, `.mono`,
`.modern`, `.engraved`, `.flawed`, `.hairline`.

SEMANTIC RULE: warm gold = as-engraved (1969 data); cold starlight = modern/corrected
values; alarm = genuine flaws. Apply this in 3D materials AND in text.

## The five acts (what each module shows per act)

I  record   — hero: the rotating golden record; map lines dim/hidden; title card.
II map      — record recedes; the 15 engraved lines unfold from the record plane
              into 3D positions; hydrogen-unit + binary explainer visible.
III pulsars — full 3D map; list rail active; click/fly-to; detail panel.
IV verdict  — 'both' mode: ghost gold engraved lines vs starlight modern lines,
              error arcs on the 3 angle outliers, swapped pair callout, Crab clock.
V  finders  — time slider 0→100 Myr (log): beacons dim/die by extinction order,
              Sun drifts along its orbit, usable-pulsar counter, Voyager waypoints.

## Facts discipline

All copy must come from `research/brief-raw.txt` (in repo). Key verdict framing:
distances (line lengths) genuinely wrong 2–10× (superseded 1970s DM data); three
angles off 10–18°; one spurious-precision period (B1240-64); BUT reconstruction
succeeds — all 14 identified, Sun triangulated to ~4% (Russel), epoch dated
1969.7±1.2 (Johnston). Label periodModern as "ATNF catalogue period" (NOT "today's");
the Crab clock should compute P(t) = periodEncoded + pdot·Δt.

## Quality floor

Responsive to ~900px width (below that: rail collapses to a toggle). Visible keyboard
focus. `prefersReducedMotion` honored. No console errors. No external network requests —
everything is vendored.
