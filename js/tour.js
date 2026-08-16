// The Golden Record — tour: camera choreography and interaction.
// Owns: tweened fly-tos (camera.position + controls.target), act staging,
// raycast picking on the canvas, keyboard navigation, and idle motion.
// Never fights OrbitControls: controls are disabled while a tween runs,
// and any user gesture (pointerdown / wheel) cancels the tween immediately.

import * as THREE from 'three';

const Z_UP = new THREE.Vector3(0, 0, 1);

// ease in-out cubic
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

// Home viewpoints per act (kpc). The map unfolds toward +X (galactic center).
const HOMES = {
  // face-on portrait: 2.6 kpc along the disc's face normal (disc tilts -0.26 rad
  // about X, so the face looks along ~(0, -0.966, 0.257)) — the engraved design reads whole
  record:  { pos: [0, -3.55, 1.1],   target: [0, 0, 0.18] }, // centered (portrait/phones)
  // wide screens: the title masthead owns the left column, so truck the camera
  // left — the disc (and the probe's orbit) compose in the right two-thirds
  recordWide: { pos: [-0.62, -3.45, 1.05], target: [-0.62, 0, 0.16] },
  // a phone on its side: the masthead is a left column ~46% of a very wide,
  // very short frame — truck further right and stand back so the disc composes
  // whole in what's left, clear of the nav above and the dock below
  recordLandscape: { pos: [-1.30, -3.85, 1.02], target: [-1.30, 0, 0.10] },
  map:     { pos: [2, -9, 5],        target: [2, 0, 0] },      // pull back as lines unfold
  // Act II with the explainer panel expanded: shift the scene right, clear of it
  mapOpen: { pos: [0.6, -9, 5],      target: [0.6, 0, 0] },
  pulsars: { pos: [4, -14, 9],       target: [3, 0, 0] },      // hero overview
  verdict: { pos: [-1.6, -1.4, 9.2], target: [-1.6, 0.2, 0] }, // plan view; panel now hugs the left margin
  // finders panel lives in the RIGHT column (400px): center the map in the rest
  finders: { pos: [-4.2, -13, 5],    target: [1.6, 0, 0.9] },
};

// Portrait (phone) homes: composed from scratch for tall screens — content
// centered horizontally with the subject in the upper half (the bottom ~46vh
// belongs to the sheets). The landscape HOMES bake in x-offsets that clear
// desktop side panels, which don't exist on phones; portraitize()-ing them
// left the map hugging a screen edge.
const PHONE_HOMES = {
  // Act I: the disc reads whole between the nav and the masthead — pulled back
  // far enough that neither crowds it, and that the probe has a corner to fly in
  record:  { pos: [0, -8.95, 0.81],  target: [0, 0, -1.88] },
  // short screens (SE-class): the masthead's type doesn't shrink with the
  // viewport, so stand back further and lift — disc AND probe still fit above it
  recordShort: { pos: [0, -10.55, 1.22], target: [0, 0, -1.95] },
  // II–V are composed for the band between the act nav and an open bottom
  // sheet — subject centered in it, whole, at every act. (Measured against a
  // 390 × 844 frame; they scale with the viewport.)
  map:     { pos: [1.13, -11.04, 4.86], target: [0.68, 0, -3.17] },
  // Act III frames the BEACONS, not the ruler: including the galactic center
  // meant standing 29 kpc back, which shrank the fourteen lines to a smudge.
  // The GC now runs off frame — its own row in the list flies you to it.
  pulsars: { pos: [1.05, -11.50, 6.96], target: [0.55, 0, -4.04] },
  verdict: { pos: [0.59, -8.41, 15.78], target: [0.57, -3.83, 0] }, // plan view
  finders: { pos: [1.49, -14.96, 6.43], target: [0.79, 0, -2.21] },
};

// Map rendering mode per act: warm gold engraved for I–III,
// engraved-vs-modern comparison for the verdict, modern for the finders.
const ACT_MODE = {
  record: 'engraved',
  map: 'engraved',
  pulsars: 'engraved',
  verdict: 'both',
  finders: 'modern',
};

const PORTRAIT_ASPECT = 0.9;    // below this aspect the viewport counts as portrait
const PORTRAIT_PUSH_MAX = 2.2;  // cap on the portrait pull-back factor
const PORTRAIT_DROP = 0.22;     // look-point drop × offset length: raises the subject
                                // out from under the bottom sheets on phones —
                                // a constant ~180px lift, whatever the distance
const RESIZE_DEBOUNCE_MS = 250; // settle time before the resize re-frame check
const SHORT_SCREEN_PX = 700;    // below this viewport height Act I stands back
                                // (matches the ≤700px masthead rule in ui.css)

// ---- fitted framing ---------------------------------------------------------
// For acts III–V, HOMES supplies a view DIRECTION — a composition choice — and
// nothing else. The distance and the lateral/vertical offset are solved per
// viewport so that everything the act is about lands inside the part of the
// screen the panels are not covering.
//
// Hard-coded distances could not do this. HOMES.pulsars stood 16.67 kpc back
// (sized to keep the galactic center at 8.28 kpc in frame), which left the
// fourteen beacons filling 21% of a 1920px frame — and on a 1280px one put the
// two leftmost of them under the opaque 400px rail, 12 of 14 at 1024px. Nothing
// was ever frustum-clipped: it was occlusion, plus a frame three times too big.
const FIT_ACTS = new Set(['pulsars', 'verdict', 'finders']);
const FIT_PAD_PX = 18;        // air between the content and the usable rect
const FIT_MIN_DIST = 1.2;     // kpc floor, and the near-plane guard
const FIT_TOLERANCE = 0.04;   // a resize under 4% of the fitted distance is ignored
// Room held back for the idle sway and the camera breath, which move the frame
// AFTER it has been fitted. Without it the fit is exactly tight and the first
// thing the drift does is push the outermost beacon out of the visible band —
// which is how this was found. A sway of MAP_SWAY_AMPL about the target moves a
// point r out by r·θ, and Act V's oblique framing puts the worst case at ~7% of
// the half-frame, so 10% covers it with room for the breath on top.
const FIT_SWAY_SLACK = 1.10;
// map3d's name sprites are fixed-size billboards parked just above each beacon.
// They are part of the picture, so the fit holds them too — otherwise the
// outermost beacon sits neatly at the edge with its own name hanging off it.
const LABEL_HALF_W = 0.26, LABEL_HALF_H = 0.065, LABEL_LIFT = 0.16;
const ORIGIN = new THREE.Vector3(0, 0, 0);

const CLICK_SLOP_PX = 6;      // pointer travel beyond this is a drag, not a click
const HOVER_INTERVAL_MS = 80; // throttle for hover raycasts
const ORBIT_IDLE_S = 4;       // seconds of stillness before Act I idle sway resumes
const SWAY_AMPL = 0.05;       // rad, Act I idle sway about the face-on portrait
const SWAY_RATE = 0.3;        // rad/s of sway phase (~21 s per full sway cycle)
// The map acts get a wider, slower version of the same sway. A still frame of a
// 3D star map reads as a flat drawing — the parallax is what tells you the
// fourteen beacons sit at different depths, which is the entire point of
// rebuilding the engraving in 3D. It moves the CAMERA, never the stars: the
// pulsars are not visibly going anywhere, the map is dated to epoch 1969.7, and
// Act V's slider already owns real motion (map3d's shear()). Drifting them here
// would imply time was passing and quietly contradict it.
// Kept small on purpose. The map acts are FITTED — their content fills the
// visible band almost exactly — so a sway of the ±0.12 rad this started at
// swung the outermost beacon straight back under the rail it was just rescued
// from. 0.05 rad moves the farthest point by ~4% of the half-frame, which
// FIT_SWAY_SLACK below reserves for it.
const MAP_SWAY_AMPL = 0.05;   // rad
const MAP_SWAY_RATE = 0.16;   // rad/s (~39 s per full cycle)
const BREATH_AMPL = 0.0035;   // fraction of camera–target distance

export function initTour(ctx) {
  const { camera, controls, canvas, bus } = ctx;

  // ---- tween ------------------------------------------------------------
  let tween = null;                       // { el, dur, p0, p1, t0, t1 }
  const breath = new THREE.Vector3();     // last applied idle offset
  let inspecting = false;                 // probe inspect: OrbitControls aimed at the probe
  let pointerDown = false;
  let sinceUser = ORBIT_IDLE_S;           // seconds since last user gesture
  // Act II explainer panel state (ui.js 'uilayout'). It starts expanded, so the
  // default matches even if the init dispatch fires before this module loads.
  let explainerOpen = true;
  // phone bottom-sheet state (ui.js 'sheet'); every act opens with its sheet up
  let sheetOpen = true;

  function stripBreath() {
    camera.position.sub(breath);
    breath.set(0, 0, 0);
  }

  let legs = [];      // queued follow-up tween legs: [{pos, target, dur}, ...]

  function cancelTween() {
    if (!tween) return;
    tween = null;
    legs = [];
    controls.enabled = true; // the probe visit keeps them on too, aimed at it
  }

  // Portrait compensation. HOMES and the framing math are tuned for landscape
  // (~1.5 aspect); on a portrait phone the horizontal field collapses and the
  // map crops. So: pull the camera farther out along the same offset, and drop
  // the look-point (lowering it raises the subject on screen, clear of the
  // bottom sheets). Returns new vectors — never mutates the inputs — and
  // passes landscape framings through untouched.
  const portraitPush = () =>
    Math.min((PORTRAIT_ASPECT / camera.aspect) ** 0.8, PORTRAIT_PUSH_MAX);

  function portraitize(pos, target) {
    const aspect = camera.aspect;
    if (!(aspect < PORTRAIT_ASPECT)) return { pos, target };
    const off = pos.clone().sub(target).multiplyScalar(portraitPush());
    const t = target.clone();
    t.z -= off.length() * PORTRAIT_DROP;
    return { pos: target.clone().add(off), target: t };
  }

  function flyTo(rawPos, rawTarget, dur = 1.6, raw = false) {
    clearHover(); // the tooltip must not linger through a camera move
    stripBreath();
    legs = []; // a direct fly-to supersedes any queued sweep legs
    // Selection framings (frameLine/frameEarth/frameVoyager) get the portrait
    // compensation; act homes pass raw=true — on phones they come from
    // PHONE_HOMES, already composed for portrait.
    const { pos, target } = raw ? { pos: rawPos, target: rawTarget } : portraitize(rawPos, rawTarget);
    if (ctx.prefersReducedMotion || dur <= 0) {
      cancelTween();
      camera.position.copy(pos);
      controls.target.copy(target);
      return;
    }
    tween = {
      el: 0, dur,
      p0: camera.position.clone(), p1: pos.clone(),
      t0: controls.target.clone(), t1: target.clone(),
    };
    controls.enabled = false;
  }

  // A chained camera path: fly the first leg, queue the rest (a user gesture
  // or any direct flyTo cancels the remainder). Reduced motion: jump to the end.
  function flyPath(path) {
    if (ctx.prefersReducedMotion) {
      const last = path[path.length - 1];
      flyTo(last.pos, last.target, 0);
      return;
    }
    flyTo(path[0].pos, path[0].target, path[0].dur);
    legs = path.slice(1);
  }

  // ---- framing ----------------------------------------------------------
  // PHONE_HOMES are composed for the band above an OPEN bottom sheet. Collapse
  // that sheet to its header bar and the scene inherits the rest of the screen,
  // so the whole rig slides up by half the height the sheet gave back — which
  // drops the subject into the middle of what the reader can now see.
  function sheetRecenter(pos, target) {
    if (sheetOpen || ctx.state.act === 'record') return; // Act I has no sheet
    const d = pos.distanceTo(target);
    // half the screen the collapsed sheet just gave back. Read --sheet-h from
    // the stylesheet rather than duplicating it: this drifted once already.
    const cs = getComputedStyle(document.documentElement);
    const sheetVh = parseFloat(cs.getPropertyValue('--sheet-h')) || 40;
    const px = (sheetVh / 100 * window.innerHeight - 46) / 2;
    const dz = (px / window.innerHeight) * 2 * d * Math.tan((camera.fov * Math.PI) / 360);
    // "up on screen" — works for the oblique acts and the plan view alike
    const fwd = target.clone().sub(pos).normalize();
    const screenUp = Z_UP.clone().addScaledVector(fwd, -Z_UP.dot(fwd)).normalize();
    pos.addScaledVector(screenUp, dz);
    target.addScaledVector(screenUp, dz);
  }

  // Slide a framing past a side panel, so the subject centers in the VISIBLE
  // area rather than half under the panel. `frac` is the panel's share of the
  // viewport width, signed: positive for a panel on the RIGHT (the desktop
  // detail card), negative for one on the LEFT (a landscape phone's sheet).
  function truckPastPanel(pos, target, frac) {
    const dist = pos.distanceTo(target);
    const halfW = dist * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect;
    const lookDir = target.clone().sub(pos).normalize();
    const scrRight = new THREE.Vector3().crossVectors(lookDir, Z_UP).normalize();
    pos.addScaledVector(scrRight, halfW * frac);
    target.addScaledVector(scrRight, halfW * frac);
  }

  // ---- fitted framing -------------------------------------------------------
  const _f = new THREE.Vector3(), _rt = new THREE.Vector3(), _up = new THREE.Vector3();
  const _v = new THREE.Vector3(), _dir = new THREE.Vector3();
  const _fitPos = new THREE.Vector3(), _fitTgt = new THREE.Vector3();
  const noInsets = { left: 0, right: 0, top: 0, bottom: 0 };
  const insets = () => (ctx.sceneInsets ? ctx.sceneInsets() : noInsets);

  // The usable rectangle, in NDC. ui.js measures which panels are actually up,
  // so this needs no knowledge of class names or breakpoints.
  const _rect = { x0: -1, x1: 1, y0: -1, y1: 1 };
  function usableRect() {
    const W = window.innerWidth, H = window.innerHeight;
    const ins = insets();
    _rect.x0 = (2 * (ins.left + FIT_PAD_PX)) / W - 1;
    _rect.x1 = 1 - (2 * (ins.right + FIT_PAD_PX)) / W;
    _rect.y0 = (2 * (ins.bottom + FIT_PAD_PX)) / H - 1;
    _rect.y1 = 1 - (2 * (ins.top + FIT_PAD_PX)) / H;
    // A viewport can be narrower or shorter than its own chrome. Never hand the
    // solver an inside-out rect: fall back to a sliver at the middle of it.
    if (_rect.x1 - _rect.x0 < 0.2) {
      const c = (_rect.x0 + _rect.x1) / 2; _rect.x0 = c - 0.1; _rect.x1 = c + 0.1;
    }
    if (_rect.y1 - _rect.y0 < 0.2) {
      const c = (_rect.y0 + _rect.y1) / 2; _rect.y0 = c - 0.1; _rect.y1 = c + 0.1;
    }
    return _rect;
  }

  // Solve camera position + target for a set of world points, keeping the view
  // direction exactly as composed. Writes into outPos/outTgt, returns the
  // camera-to-target distance.
  //
  // Why points and not a bounding sphere. A sphere of radius R needs
  // d = R/sin(fov/2) — the frustum plane is TANGENT to it — not the R/tan(fov/2)
  // the flat-disc shortcut gives; that alone is a sec(24°) = 9.5% error at this
  // fov. But the real cost is the sphere itself: the tightest sphere over the
  // pulsar cloud has R = 3.375 kpc, and fitting it to a 1440x900 frame from Act
  // III's angle wants 8.30 kpc where fitting the POINTS wants 4.56. The cloud is
  // a lopsided flattened shell; a ball around it is nearly twice the frame it
  // needs, which would have fixed the occlusion and left the "too zoomed out"
  // complaint almost untouched. And once the camera trucks sideways to clear the
  // rail the sphere is off-axis, its silhouette grows, and the sphere fit stops
  // being correct at all without iterating.
  //
  // The points cost nothing to fit exactly. With camera
  //     C = K − d·f + sx·r + sy·u
  // a point P has depth (P−K)·f + d and screen offset (P−K)·r − sx, so
  // "inside the left edge x0" reads
  //     (P−K)·r − sx  ≥  x0 · A · ((P−K)·f + d)
  // which is LINEAR in (d, sx, sy). Requiring the sx interval to be non-empty
  // eliminates sx and leaves d in closed form; same for sy. One pass for the
  // distance, one for the offsets — and no iteration is needed because r and u
  // are perpendicular to f, so trucking sideways does not change any point's
  // DEPTH, and depth is the only thing the perspective divide uses.
  function fitFraming(points, dir, outPos, outTgt) {
    const rect = usableRect();
    const B = Math.tan((camera.fov * Math.PI) / 360); // half-height per unit depth
    const A = B * camera.aspect;                      // half-width  per unit depth

    _f.copy(dir).normalize();
    _rt.crossVectors(_f, Z_UP);                       // three's own camera-right
    if (_rt.lengthSq() < 1e-8) _rt.set(1, 0, 0);      // a dead-on plan view
    _rt.normalize();
    _up.crossVectors(_rt, _f);

    // Anchor at the centroid. The solve is anchor-invariant; this only keeps the
    // offsets it reports small enough to read.
    outTgt.set(0, 0, 0);
    for (const p of points) outTgt.add(p);
    outTgt.multiplyScalar(1 / points.length);

    let hMax = -Infinity, gMin = Infinity, qMax = -Infinity, pMin = Infinity;
    let zMin = Infinity;
    let sxLo = -Infinity, sxHi = Infinity, syLo = -Infinity, syHi = Infinity;
    let d = 0;

    // one visitor, run twice: pass 0 collects the binding extremes that give d,
    // pass 1 collects the slack at that d and hands back the offsets
    const sweep = (pass) => {
      for (const p of points) {
        _v.copy(p).sub(outTgt);
        const z = _v.dot(_f), x = _v.dot(_rt), y = _v.dot(_up);
        for (let k = 0; k < 3; k++) {
          // the point itself, then the two corners of its name billboard
          const px = k === 0 ? x : k === 1 ? x + LABEL_HALF_W : x - LABEL_HALF_W;
          const py = k === 0 ? y : k === 1 ? y + LABEL_HALF_H + LABEL_LIFT
                                           : y - LABEL_HALF_H + LABEL_LIFT;
          if (pass === 0) {
            if (px - rect.x1 * A * z > hMax) hMax = px - rect.x1 * A * z;
            if (px - rect.x0 * A * z < gMin) gMin = px - rect.x0 * A * z;
            if (py - rect.y1 * B * z > qMax) qMax = py - rect.y1 * B * z;
            if (py - rect.y0 * B * z < pMin) pMin = py - rect.y0 * B * z;
            if (z < zMin) zMin = z;
          } else {
            const zz = z + d;
            if (px - rect.x1 * A * zz > sxLo) sxLo = px - rect.x1 * A * zz;
            if (px - rect.x0 * A * zz < sxHi) sxHi = px - rect.x0 * A * zz;
            if (py - rect.y1 * B * zz > syLo) syLo = py - rect.y1 * B * zz;
            if (py - rect.y0 * B * zz < syHi) syHi = py - rect.y0 * B * zz;
          }
        }
      }
    };

    sweep(0);
    d = Math.min(
      Math.max(
        (hMax - gMin) / ((rect.x1 - rect.x0) * A),
        (qMax - pMin) / ((rect.y1 - rect.y0) * B),
        FIT_MIN_DIST - zMin,   // nothing behind (or on top of) the camera
        FIT_MIN_DIST,
      ),
      controls.maxDistance * 0.95, // the reader must still be able to pull back
    );
    d *= FIT_SWAY_SLACK;
    sweep(1);

    outTgt.addScaledVector(_rt, (sxLo + sxHi) / 2)
          .addScaledVector(_up, (syLo + syHi) / 2);
    outPos.copy(outTgt).addScaledVector(_f, -d);
    return d;
  }

  // What the frame must contain. Deliberately NOT the galactic center: at
  // 8.28 kpc it is nearly twice the farthest beacon (4.70 kpc, B1240-64 as
  // engraved), and including it pushes the Act III camera from 6.7 to 11.1 kpc
  // on a 1440px screen — the fourteen beacons, which are what Act III IS, drop
  // to 60% of their size to keep one dot in shot. It has its own row in the
  // rail ("15 · Galactic Center") that flies you straight to it. The phone
  // framing made this call already (see the note above PHONE_HOMES); this agrees.
  // Fit against where the beacons END UP, not where they happen to be right now.
  // The live endpoints move: Act II unfolds them from flat over 1.6s, and the
  // fit runs on the act change, before a frame of that has played. Reading them
  // live meant framing a map that was still folded — jump straight from Act I to
  // Act V and the outermost beacon was simply not in the set, so the solver
  // never reserved room for it and it landed under the nav. The unfold always
  // finishes at these exact vectors, and Act V is fitted at timeMyr = 0 (the
  // shear is the reader's own business, and re-fitting under their slider would
  // pull the camera back while they drag it), so the static data is the truth.
  const _pts = [];
  function actPoints() {
    _pts.length = 0;
    _pts.push(ORIGIN); // the Sun: every line starts there, it is never optional
    const mode = ctx.state.mapMode;
    for (const p of ctx.pulsars) {
      if (mode !== 'modern') _pts.push(p.xyz1977);
      if (mode !== 'engraved') _pts.push(p.xyzModern);
    }
    return _pts;
  }

  // Slide a framing so the subject centers in the VISIBLE area rather than in
  // the frame. The panels are opaque, and the frame's middle is not the reader's
  // middle. Supersedes a fixed `422 / innerWidth` truck that knew about the
  // right-hand detail panel and nothing else: in Act III the 400px list rail
  // sits on the LEFT as well, the two cancel out, and trucking anyway pushed the
  // selected beacon 211px left at 1280px wide — straight under the rail, along
  // with its name and its line back to the Sun.
  //   visible band [L, W−R], its centre in NDC is (L−R)/W;
  //   shifting the rig screen-right by s puts the subject at NDC −s/halfW;
  //   so s = halfW · (R−L)/W.  (L=0 reduces to the old 422/W. Same for Y.)
  function centerInUsable(pos, target) {
    const W = window.innerWidth, H = window.innerHeight;
    const ins = insets();
    const halfH = pos.distanceTo(target) * Math.tan((camera.fov * Math.PI) / 360);
    const lookDir = target.clone().sub(pos).normalize();
    const scrRight = new THREE.Vector3().crossVectors(lookDir, Z_UP);
    if (scrRight.lengthSq() < 1e-8) scrRight.set(1, 0, 0);
    scrRight.normalize();
    const scrUp = new THREE.Vector3().crossVectors(scrRight, lookDir);
    const dx = halfH * camera.aspect * ((ins.right - ins.left) / W);
    const dy = halfH * ((ins.top - ins.bottom) / H);
    for (const v of [pos, target]) v.addScaledVector(scrRight, dx).addScaledVector(scrUp, dy);
  }

  // A phone on its side: the act sheet is a left column that can take half the
  // frame, and HOMES are composed for a desktop's proportions. Stand back for
  // the height a 390px-tall frame doesn't have, then truck clear of the column.
  const narrowLandscape = () => ctx.phoneLandscape();
  const LANDSCAPE_PULL = 1.3;

  let lastFitDist = 0;   // distance the standing framing was fitted at
  let userMoved = false; // the reader has driven the camera since the last home

  function goHome(dur = 2.2) {
    userMoved = false;
    if (camera.aspect < PORTRAIT_ASPECT) {
      let h = PHONE_HOMES[ctx.state.act] || PHONE_HOMES.record;
      if (ctx.state.act === 'record' && window.innerHeight < SHORT_SCREEN_PX) h = PHONE_HOMES.recordShort;
      const pos = new THREE.Vector3(...h.pos);
      const target = new THREE.Vector3(...h.target);
      sheetRecenter(pos, target);
      flyTo(pos, target, dur, true);
      return;
    }
    let h = HOMES[ctx.state.act] || HOMES.record;
    if (ctx.state.act === 'map' && explainerOpen) h = HOMES.mapOpen;
    if (ctx.state.act === 'record') h = narrowLandscape() ? HOMES.recordLandscape : HOMES.recordWide;
    const pos = new THREE.Vector3(...h.pos);
    const target = new THREE.Vector3(...h.target);

    // Acts III–V: HOMES gives the direction, the fit gives distance and offset.
    // (A landscape phone keeps the hand-composed pull-and-truck for now — its
    // sheet is a left column and those homes are already tuned against it.)
    if (FIT_ACTS.has(ctx.state.act) && !narrowLandscape()) {
      _dir.copy(target).sub(pos);
      lastFitDist = fitFraming(actPoints(), _dir, pos, target);
      ctx.homeDist = lastFitDist;
      flyTo(pos, target, dur, true);
      return;
    }

    if (narrowLandscape() && ctx.state.act !== 'record') {
      pos.copy(target).addScaledVector(new THREE.Vector3(...h.pos).sub(target), LANDSCAPE_PULL);
      truckPastPanel(pos, target, -0.42); // the sheet is the LEFT column here
    }
    flyTo(pos, target, dur, true);
  }

  // Frame the Sun→end line: target at `lookAt`, camera offset perpendicular-ish
  // to the line, `spread` × line length away (min 0.8 kpc), lifted above the plane.
  function frameLine(end, lookAt, spread) {
    const len = end.length();
    const portrait = camera.aspect < PORTRAIT_ASPECT;
    let d = Math.max(spread * len, 0.8);
    let look = lookAt;
    if (portrait) {
      // A phone frame is narrow, and `lookAt`'s bias is composed for a wide
      // one — on portrait it pushed the beacon to the screen edge and its
      // label off it. Look at the line itself, and stand back far enough that
      // BOTH ends fit. (flyTo's portraitize pushes again, so divide it out.)
      look = end.clone().multiplyScalar(0.62);
      const halfW = Math.tan((camera.fov * Math.PI) / 360) * camera.aspect;
      d = Math.max(d, (0.62 * len * 1.32) / halfW / portraitPush());
    }
    const dir = len > 1e-6 ? end.clone().divideScalar(len) : new THREE.Vector3(1, 0, 0);
    const side = new THREE.Vector3().crossVectors(dir, Z_UP);
    if (side.lengthSq() < 1e-4) side.set(0, -1, 0);
    else side.normalize();
    if (side.y > 0) side.negate(); // stay on the map's near side, like the act views
    const pos = end.clone()
      .addScaledVector(side, d * 0.8)
      .addScaledVector(Z_UP, d * 0.42)
      .addScaledVector(dir, -d * 0.25); // nudge back toward the Sun so both ends read
    const target = look.clone();
    // On wide screens the detail panel covers the right edge of the viewport —
    // truck the whole framing screen-right by half the panel's width (in world
    // units at the subject's distance) so the subject centers in the VISIBLE
    // area instead of hiding under the panel (the Galactic Center, rightmost
    // thing on the map, was fully covered without this).
    if (camera.aspect >= PORTRAIT_ASPECT) {
      // `spread` is a dramatic choice, not a guarantee: on a narrow window the
      // Sun end of a long line fell off the left edge. Take whichever distance
      // is larger — the composed one, or the one that actually fits both ends
      // and the beacon's name inside the visible area. (The fit centres on its
      // own centroid, not on frameLine's look point, so treat it as a floor.)
      const dv = target.clone().sub(pos);
      const have = dv.length();
      const need = fitFraming([ORIGIN, end], dv, _fitPos, _fitTgt);
      if (need > have) pos.copy(target).addScaledVector(dv.divideScalar(have), -need);
      centerInUsable(pos, target);
    }
    flyTo(pos, target, 1.6);
  }

  function framePulsar(p) {
    // Prefer the live hit-mesh position: it tracks the Act II unfold and the
    // Act V galactic shear, where the static xyz vectors do not.
    const kind = ctx.state.mapMode === 'engraved' ? 'engraved' : 'modern';
    const hitMesh = ctx.modules?.map3d?.object3d?.userData?.pickables
      ?.find((o) => o.userData.pulsar === p && o.userData.kind === kind);
    const end = hitMesh
      ? hitMesh.getWorldPosition(new THREE.Vector3())
      : (kind === 'engraved' ? p.xyz1977 : p.xyzModern);
    // look at a point 60% of the way out so the Sun stays in frame with the beacon
    frameLine(end, end.clone().multiplyScalar(0.6), 1.6);
  }

  function frameGC() {
    // look most of the way out along the line: the center itself is the
    // subject, and it must land in the visible area left of the detail panel
    frameLine(ctx.GC, ctx.GC.clone().multiplyScalar(0.78), 1.1);
  }

  // ---- bus: act staging & selection fly-tos -------------------------------
  let prevAct = ctx.state.act;
  bus.addEventListener('act', () => {
    const from = prevAct;
    prevAct = ctx.state.act;
    sheetOpen = true; // ui.js reopens every sheet on an act change
    const mode = ACT_MODE[ctx.state.act];
    if (mode && ctx.state.mapMode !== mode) ctx.setMapMode(mode);
    // leaving Act V must un-wreck the map — earlier acts have no time slider
    if (ctx.state.act !== 'finders' && ctx.state.timeMyr !== 0) ctx.setTimeMyr(0);
    if (ctx.state.selected != null) { ctx.select(null); return; } // its handler flies home
    if (ctx.state.act === 'pulsars' && from === 'map'
        && camera.aspect >= PORTRAIT_ASPECT && !narrowLandscape()) {
      // the dimensional sweep: swoop to plane level — the stars visibly rise
      // out of the galactic disc — then climb to the hero overview
      // (landscape only: the legs are composed for wide frames).
      // Both legs are built from the FITTED frame rather than HOMES.pulsars:
      // landing leg 2 on the old constant would park the camera at a framing the
      // fit never chose, and it would sit there until the next act change.
      const pos = new THREE.Vector3(), target = new THREE.Vector3();
      _dir.set(...HOMES.pulsars.target).sub(new THREE.Vector3(...HOMES.pulsars.pos));
      const d = fitFraming(actPoints(), _dir, pos, target);
      lastFitDist = d;
      ctx.homeDist = d;
      userMoved = false;
      // leg 1: same target and compass bearing, camera dropped to disc level
      const az = Math.atan2(pos.y - target.y, pos.x - target.x);
      const low = new THREE.Vector3(
        target.x + Math.cos(az) * d * 0.92,
        target.y + Math.sin(az) * d * 0.92,
        target.z + d * 0.05,
      );
      flyPath([
        { pos: low, target: target.clone(), dur: 2.4 },
        { pos, target, dur: 2.4 },
      ]);
      return;
    }
    goHome();
  });

  function frameEarth() {
    // the deep zoom: five orders of magnitude down to the little blue dot
    flyTo(new THREE.Vector3(0.055, -0.1, 0.045), new THREE.Vector3(0.018, 0, 0), 2.6);
  }

  // The Act I probe visit: frame the drifting spacecraft. Read its live world
  // position (voyager.js freezes the orbit while selected, so this holds).
  function frameVoyager() {
    const obj = ctx.modules?.voyager?.object3d;
    if (!obj) { goHome(1.6); return; }
    const p = obj.getWorldPosition(new THREE.Vector3());
    // ~1.7 units out, offset toward the Act I camera side (-y), slightly above
    const off = new THREE.Vector3(0.25, -1.0, 0.35).normalize().multiplyScalar(1.7);
    flyTo(p.clone().add(off), p, 2.0);
  }

  // Probe inspect mode: while visiting Voyager the camera becomes an ordinary
  // 3D viewer around it — left-drag orbits, wheel zooms, right-drag (or two
  // fingers) pans, exactly the conventions every model viewer uses. That is
  // what lets someone wander round the back of the spacecraft, pull out, and
  // spot the record on its flank. The distance clamps are the only special
  // thing: close enough to read the dish, far enough to see the record too.
  const INSPECT_MIN = 0.5;
  const INSPECT_MAX = 12;
  let inspectSaved = null;
  function setInspect(on) {
    if (on && !inspectSaved) {
      inspectSaved = {
        minDistance: controls.minDistance,
        maxDistance: controls.maxDistance,
        screenSpacePanning: controls.screenSpacePanning,
      };
      inspecting = true;
      controls.minDistance = INSPECT_MIN;
      controls.maxDistance = INSPECT_MAX;
      controls.screenSpacePanning = true; // pan in the view plane, viewer-style
    } else if (!on && inspectSaved) {
      inspecting = false;
      Object.assign(controls, inspectSaved);
      inspectSaved = null;
    }
  }

  bus.addEventListener('select', (e) => {
    const target = e.detail.target;
    setInspect(target === 'voyager');
    if (target == null) goHome(1.6);
    else if (target === 'gc') frameGC();
    else if (target === 'earth') frameEarth();
    else if (target === 'voyager') frameVoyager();
    else framePulsar(target);
  });

  // A phone reader collapsing an act's sheet is asking for the map: re-frame
  // into the screen it just freed (never mid-gesture, never over a selection).
  bus.addEventListener('sheet', (e) => {
    const open = !!e.detail.open;
    if (open === sheetOpen) return;
    sheetOpen = open;
    if (camera.aspect < PORTRAIT_ASPECT && ctx.state.selected == null && !pointerDown) {
      goHome(1.0);
    }
  });

  bus.addEventListener('uilayout', (e) => {
    const open = !!e.detail.explainerOpen;
    if (open === explainerOpen) return;
    explainerOpen = open;
    // Reflow the Act II framing when the panel toggles — but never yank the
    // camera mid-gesture or away from a selection. (The init dispatch is safe
    // either side of the opening move: that one flies to HOMES.record, and
    // any act === 'map' framing after this point picks the right variant.)
    if (ctx.state.act === 'map' && ctx.state.selected == null && !pointerDown) goHome(1.2);
  });

  bus.addEventListener('mapmode', () => {
    // A selected pulsar's endpoint moves with the mode — keep it framed.
    // ('voyager' is not a pulsar and has no engraved/modern endpoints.)
    // only real pulsar objects have endpoints to re-frame; 'gc', 'earth' and
    // 'voyager' are string sentinels (Earth's position is mode-independent)
    const sel = ctx.state.selected;
    if (sel && typeof sel === 'object') framePulsar(sel);
  });

  // ---- picking ------------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  raycaster.params.Line = { ...raycaster.params.Line, threshold: 0.04 };
  raycaster.params.Points = { ...raycaster.params.Points, threshold: 0.06 };
  const ndc = new THREE.Vector2();

  function pick(ev) {
    const pickables = ctx.modules?.map3d?.object3d?.userData?.pickables;
    if (!pickables || pickables.length === 0) return null;
    const r = canvas.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    ndc.set(
      ((ev.clientX - r.left) / r.width) * 2 - 1,
      -((ev.clientY - r.top) / r.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(pickables.filter((o) => o.visible), false);
    return hits.length ? (hits[0].object.userData.pulsar ?? null) : null;
  }

  // ---- hover events (bus 'hover', consumed by ui.js for the tooltip) -------
  let hovered = null; // last hovered pick result: pulsar object | 'gc' | null

  function clearHover() {
    if (hovered == null) return;
    hovered = null;
    bus.dispatchEvent(new CustomEvent('hover', { detail: { pulsar: null } }));
  }

  let downX = 0, downY = 0;

  // Capture on window so the tween is cancelled (and controls re-enabled)
  // BEFORE OrbitControls' own canvas listener sees the event — otherwise the
  // first drag/wheel during a fly-to is swallowed by `enabled === false`.
  window.addEventListener('pointerdown', (e) => {
    if (e.target !== canvas) return;
    pointerDown = true;
    sinceUser = 0;
    userMoved = true; // hand-framed now: a resize must not restage it
    downX = e.clientX; downY = e.clientY;
    clearHover(); // drag starts — the tooltip must not linger under the cursor
    stripBreath();
    cancelTween(); // user drag always wins
  }, { capture: true });
  window.addEventListener('pointerup', () => { pointerDown = false; });
  window.addEventListener('pointercancel', () => { pointerDown = false; });

  window.addEventListener('wheel', (e) => {
    if (e.target !== canvas) return;
    sinceUser = 0;
    userMoved = true; // zoomed by hand: same rule as a drag
    cancelTween();
  }, { passive: true, capture: true });

  canvas.addEventListener('click', (e) => {
    if (inspecting) return; // the canvas is a rotation surface during inspect
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > CLICK_SLOP_PX) return;
    const hit = pick(e);
    if (hit) ctx.select(hit);
    // A miss deselects nothing — panels have their own close buttons.
  });

  let lastHover = 0;
  canvas.addEventListener('pointermove', (e) => {
    if (pointerDown || tween) return;
    if (inspecting) return; // voyager.js owns the cursor (grab) + no tooltips here
    const now = performance.now();
    if (now - lastHover < HOVER_INTERVAL_MS) return;
    lastHover = now;
    const hit = pick(e);
    canvas.style.cursor = hit ? 'pointer' : '';
    if (hit == null) { clearHover(); return; }
    // New target OR same target: ui.js needs the fresh x/y either way so the
    // tooltip follows the cursor; dispatch at the same throttled cadence.
    hovered = hit;
    bus.dispatchEvent(new CustomEvent('hover', {
      detail: { pulsar: hit, x: e.clientX, y: e.clientY },
    }));
  });
  canvas.addEventListener('pointerleave', clearHover);

  // ---- keyboard -------------------------------------------------------------
  // arrow keys step through the acts and stop at either end — no wrap-around
  function cycleAct(step) {
    const ids = ctx.ACTS.map((a) => a.id);
    const j = ids.indexOf(ctx.state.act) + step;
    if (j >= 0 && j < ids.length) ctx.setAct(ids[j]);
  }

  window.addEventListener('keydown', (e) => {
    const el = e.target;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ||
               el.tagName === 'SELECT' || el.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); sinceUser = 0; cycleAct(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); sinceUser = 0; cycleAct(-1); }
    else if (e.key === 'Escape') {
      sinceUser = 0;
      // no-op when nothing is selected: don't yank a hand-framed camera home
      if (ctx.state.selected != null) ctx.select(null);
    }
    else if (e.key.length === 1 && e.key >= '1' && e.key <= '5') {
      sinceUser = 0;
      ctx.setAct(ctx.ACTS[e.key - 1].id);
    }
  });

  // ---- resize: re-framing -----------------------------------------------------
  // main.js updates camera.aspect on resize. Two things can go stale: the
  // portrait/landscape choice of home, and — now that III–V are FITTED to the
  // viewport — the fit itself. Re-home for either, but never yank a tween, a
  // gesture, a selection, or a camera the reader has moved by hand: someone who
  // orbited in to look at Vela did not ask their window resize to throw it away.
  let wasPortrait = camera.aspect < PORTRAIT_ASPECT;
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const isPortrait = camera.aspect < PORTRAIT_ASPECT;
      const crossed = isPortrait !== wasPortrait;
      wasPortrait = isPortrait;
      if (tween || pointerDown || ctx.state.selected != null) return;
      if (crossed) { goHome(0.9); return; }
      if (isPortrait || userMoved || !FIT_ACTS.has(ctx.state.act) || narrowLandscape()) return;
      // Would the fit actually move? Solve into scratch and compare, so that
      // dragging a window edge does not restage the camera on every settle.
      _dir.copy(controls.target).sub(camera.position);
      const need = fitFraming(actPoints(), _dir, _fitPos, _fitTgt);
      if (lastFitDist > 0
          && Math.abs(need - lastFitDist) < lastFitDist * FIT_TOLERANCE
          && _fitPos.distanceTo(camera.position) < need * FIT_TOLERANCE) return;
      goHome(0.7); // shorter than an act change: this is a correction, not a move
    }, RESIZE_DEBOUNCE_MS);
  });

  // ---- opening move -----------------------------------------------------------
  if (ctx.still) {
    // ?still=1 screenshot mode: pin the canonical Act I still frame
    camera.position.set(-0.62, -2.95, 0.55);
    controls.target.set(-0.62, 0, -0.18);
  } else {
    goHome(2.6); // from the bootstrap camera into the Act I portrait
  }

  // ---- per-frame ----------------------------------------------------------------
  const orbitArm = new THREE.Vector3();
  let swayPhase = 0;   // sway oscillator
  let swayPrev = 0;    // last applied sway angle, so each frame rotates by the delta

  function update(dt, t) {
    if (ctx.still) return; // screenshot mode: the camera is pinned
    sinceUser += dt;

    if (tween) {
      tween.el += dt;
      const k = ease(Math.min(tween.el / tween.dur, 1));
      camera.position.lerpVectors(tween.p0, tween.p1, k);
      controls.target.lerpVectors(tween.t0, tween.t1, k);
      if (tween.el >= tween.dur) {
        // chain into the next queued leg, if any (multi-leg sweeps)
        const next = legs.shift();
        tween = null;
        if (next) {
          const rest = legs;
          flyTo(next.pos, next.target, next.dur); // clears legs —
          legs = rest;                            // — restore the queue
        } else {
          // arriving AT the probe hands the camera to OrbitControls with the
          // probe as its target — the fly-to tweened controls.target there
          controls.enabled = true;
        }
      }
      return;
    }

    if (ctx.prefersReducedMotion || pointerDown) return;

    camera.position.sub(breath); // undo last frame's breathing before real motion

    // Act I: barely-there idle sway (±SWAY_AMPL rad) about the face-on portrait —
    // a full orbit would swing the disc edge-on and lose the engraved design.
    if ((ctx.state.act === 'record' || FIT_ACTS.has(ctx.state.act))
        && !ctx.state.selected && sinceUser > ORBIT_IDLE_S) {
      const onMap = ctx.state.act !== 'record';
      swayPhase += dt * (onMap ? MAP_SWAY_RATE : SWAY_RATE);
      const sway = (onMap ? MAP_SWAY_AMPL : SWAY_AMPL) * Math.sin(swayPhase);
      orbitArm.copy(camera.position).sub(controls.target).applyAxisAngle(Z_UP, sway - swayPrev);
      swayPrev = sway;
      camera.position.copy(controls.target).add(orbitArm);
    }

    // Camera breathing: a tiny slow sinusoid, scaled to viewing distance.
    const a = camera.position.distanceTo(controls.target) * BREATH_AMPL;
    breath.set(
      Math.sin(t * 0.21) * a,
      Math.sin(t * 0.26 + 2.1) * a,
      Math.sin(t * 0.15 + 4.2) * a * 0.5,
    );
    camera.position.add(breath);
  }

  return { update };
}
