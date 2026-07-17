# Module contracts — The Golden Record (repo: golden-map)

Read this whole file before writing code. `js/main.js` is the single owner of the
renderer, camera, act list, and shared context. Your module plugs into it and MUST
match the signatures below exactly. Do not edit files you don't own.

## Shared context (`ctx`) — built in js/main.js

```js
ctx = {
  THREE, scene, camera, renderer, controls, canvas,
  bus,                    // EventTarget. Events (all CustomEvent with .detail):
                          //   'act'      {act: 'record'|'map'|'pulsars'|'verdict'|'finders'}
                          //   'select'   {target: pulsarObject | 'gc' | 'earth' | 'voyager' | null}
                          //   'timeMyr'  {myr: number}            (Act V slider)
                          //   'mapmode'  {mode: 'engraved'|'modern'|'both'}
                          //   'artifact' {show: boolean}          (engraving overlay toggle)
                          //   'uilayout' {explainerOpen: boolean} (Act II panel state → tour framing)
                          //   'hover'    {pulsar, x, y}           (tour raycast → ui tooltip)
  state: { act, selected, timeMyr, mapMode, timeScale, artifact },
  pulsars,                // 14 enriched records, see below
  GC,                     // THREE.Vector3 of the galactic center (kpc)
  MAP_EPOCH,              // 1969.7
  ACTS,                   // [{id, numeral, title} x5]
  setAct(id), select(target), setTimeMyr(myr), setMapMode(mode), setArtifact(v),
  prefersReducedMotion,   // boolean — honor it: skip/shorten animations
  still,                  // boolean — ?still=1 screenshot mode: pinned hero frame,
                          //   no UI chrome, no idle motion (og.jpg capture)
  modules: { starfield, record, voyager, map3d },  // available AFTER scene modules built
}
```

Each `pulsars[i]` has all fields from `js/data/pulsars.js` (line, bname, jname, alias?,
periodEncoded, periodModern, pdot, ageKyr, ra, dec, dist1977, distModern, distNote,
fineNote, refs [{t, u} — the distance papers], confidence, note, flaw?, angleErrorDeg?)
plus computed: `l, b` (galactic, deg), `xyzModern`, `xyz1977` (THREE.Vector3, kpc,
heliocentric galactic frame: X toward GC, Y toward l=90°, Z toward north galactic
pole — and camera.up is +Z), `binary` (the engraved bit string), `driftPPM`.

SCALE: 1 scene unit = 1 kpc. The Sun is at the origin. GC at ~(8.28, 0, −0.02)
(GRAVITY Collaboration 2022).

## Module signatures (each in its own file, ES module)

- `js/starfield.js` → `export function createStarfield(ctx) -> { object3d, update(dt,t) }`
   Real sky: HYG catalog stars (mag ≤ 4.5) at true positions + faint Milky Way band.
- `js/record.js`    → `export function createRecord(ctx) -> { object3d, update(dt,t), setVisible(v) }`
   The disc, its engraved vector linework, the Act II lift-off ceremony, the
   persistent engraving overlay, the grab-to-spin turntable drag, and the scene
   lighting (everything else is mostly unlit).
- `js/voyager.js`   → `export function createVoyager(ctx) -> { object3d, update(dt,t) }`
   Act I set dressing: the NASA probe on a slow orbit; click-to-inspect arcball
   (the tour disables OrbitControls while inspecting); registers its own pickable.
- `js/map3d.js`     → `export function createMap(ctx) -> { object3d, update(dt,t) }`
   Must listen to bus 'mapmode', 'timeMyr', 'select'; make every pulsar pickable
   (mesh.userData.pulsar = p, and put all pickables in `object3d.userData.pickables`
   for the tour's raycaster; also pickables for the galactic center ('gc') and
   Earth ('earth')).
- `js/ui.js`        → `export function initUI(ctx) -> { update(dt,t) }`
   Owns ALL DOM inside `#ui` (build it with JS) and `css/ui.css`. Never touches
   three.js. Includes the persistent audio mini-dock (SoundCloud Widget API over
   hidden iframes — the one deliberate external network dependency).
- `js/tour.js`      → `export function initTour(ctx) -> { update(dt,t) }`
   Owns camera movement (tweened fly-tos; write your own small tween, no libs),
   act-driven staging, raycast picking on canvas click → ctx.select(...), keyboard
   nav (arrows step acts — clamped at the ends, no wrap; Esc = deselect). Selection
   framings truck screen-right so the subject clears the right-side detail panel.

## Design system (css/style.css — already written, use its variables)

Colors: `--void #050403`, `--gold #c9a227`, `--gold-bright #f2d478`, `--gold-dim #6e5a1e`,
`--gold-faint #3a2f14`, `--copper #b87333`, `--paper #e8dcc0`, `--paper-dim`,
`--starlight #a9c3d4` (RESERVED for modern/corrected data), `--alarm #c96a4a` (errors, sparing).
Type: `--display` Marcellus (headings, act titles), `--body` EB Garamond, `--mono` IBM Plex Mono
(all data: periods, binary strings, coordinates). Classes available: `.eyebrow`, `.mono`,
`.modern`, `.engraved`, `.flawed`, `.hairline`.

SEMANTIC RULE: warm gold = as-engraved (1969 data); cold starlight = modern/corrected
values; alarm = genuine flaws. Apply this in 3D materials AND in text.

CASE RULE: real mixed case for anything the user reads closely (buttons, track
titles, list rows, headings). Uppercase micro-labels only for tiny ambient marks.

## The five acts (what each module shows per act)

I  record   — hero: the golden record (grab to spin); probe orbiting (click to
              inspect); title card + one-off greeting button.
II map      — record recedes; the engraved map ignites, lifts off the disc and
              unfolds 1:1 into 3D; how-to-read panel with the annotated cover.
III pulsars — full 3D map; list rail active; click/fly-to; detail panel with
              per-pulsar reference links.
IV verdict  — 'both' mode: ghost gold engraved lines vs starlight modern lines,
              swapped-pair callout, Crab clock; fact-checked claims with sourcing.
V  finders  — time slider 0→100 Myr (log): beacons die by extinction order, the
              map shears apart; playable Drake equation; grouped Sources panel.

Always present: the audio mini-dock (bottom center; full-width bar ≤900px) and
the corner credit. The engraving overlay + "you are here" chips ride acts II–V.

## Facts discipline

Every number on the page was verified against primary sources (July 2026) — see
the Act V Sources panel and `js/data/pulsars.js` header. Key verdict framing:
distances (line lengths) genuinely wrong 2–10× (superseded 1970s DM data); three
angles off 10.6–17.6° (Johnston 2007, Table 4); one spurious-precision period
(B1240-64); BUT reconstruction succeeds — all 14 identified, Sun triangulated to
~4% (Russel/DSES), epoch dated 1969.7±1.2 (Johnston). Label periodModern as "ATNF
catalogue period" (NOT "today's"); the Crab clock computes P(t) = periodEncoded
+ pdot·Δt. When you change a number, keep its per-pulsar `refs` and the Sources
panel in sync — never publish an uncited value.

## Quality floor

Responsive to ~900px width (below that: bottom sheets + docked player bar).
Visible keyboard focus. `prefersReducedMotion` honored. No console errors. All
code and assets vendored as plain files — no CDNs, no build artifacts, no
base64/data-URI embedding. The single external dependency is the SoundCloud
Widget API for the audio streams (loaded lazily, pre-warmed after page load,
and the player degrades gracefully if it is unreachable).
