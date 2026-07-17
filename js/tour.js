// The Golden Map — tour: camera choreography and interaction.
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
  map:     { pos: [2, -9, 5],        target: [2, 0, 0] },      // pull back as lines unfold
  // Act II with the explainer panel expanded: shift the scene right, clear of it
  mapOpen: { pos: [0.6, -9, 5],      target: [0.6, 0, 0] },
  pulsars: { pos: [4, -14, 9],       target: [3, 0, 0] },      // hero overview
  verdict: { pos: [-1.6, -1.4, 9.2], target: [-1.6, 0.2, 0] }, // plan view; panel now hugs the left margin
  // finders panel lives in the RIGHT column (400px): center the map in the rest
  finders: { pos: [-4.2, -13, 5],    target: [1.6, 0, 0.9] },
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
const PORTRAIT_DROP = 0.10;     // look-point drop × offset length: raises the subject
                                // above the bottom sheets on phones
const RESIZE_DEBOUNCE_MS = 250; // settle time before the resize re-frame check

const CLICK_SLOP_PX = 6;      // pointer travel beyond this is a drag, not a click
const HOVER_INTERVAL_MS = 80; // throttle for hover raycasts
const ORBIT_IDLE_S = 4;       // seconds of stillness before Act I idle sway resumes
const SWAY_AMPL = 0.05;       // rad, Act I idle sway about the face-on portrait
const SWAY_RATE = 0.3;        // rad/s of sway phase (~21 s per full sway cycle)
const BREATH_AMPL = 0.0035;   // fraction of camera–target distance

export function initTour(ctx) {
  const { camera, controls, canvas, bus } = ctx;

  // ---- tween ------------------------------------------------------------
  let tween = null;                       // { el, dur, p0, p1, t0, t1 }
  const breath = new THREE.Vector3();     // last applied idle offset
  let inspecting = false;                 // probe inspect: controls stay OFF (see setInspect)
  let pointerDown = false;
  let sinceUser = ORBIT_IDLE_S;           // seconds since last user gesture
  // Act II explainer panel state (ui.js 'uilayout'). It starts expanded, so the
  // default matches even if the init dispatch fires before this module loads.
  let explainerOpen = true;

  function stripBreath() {
    camera.position.sub(breath);
    breath.set(0, 0, 0);
  }

  let legs = [];      // queued follow-up tween legs: [{pos, target, dur}, ...]

  function cancelTween() {
    if (!tween) return;
    tween = null;
    legs = [];
    controls.enabled = !inspecting; // never re-arm OrbitControls mid-inspect
  }

  // Portrait compensation. HOMES and the framing math are tuned for landscape
  // (~1.5 aspect); on a portrait phone the horizontal field collapses and the
  // map crops. So: pull the camera farther out along the same offset, and drop
  // the look-point (lowering it raises the subject on screen, clear of the
  // bottom sheets). Returns new vectors — never mutates the inputs — and
  // passes landscape framings through untouched.
  function portraitize(pos, target) {
    const aspect = camera.aspect;
    if (!(aspect < PORTRAIT_ASPECT)) return { pos, target };
    const off = pos.clone().sub(target)
      .multiplyScalar(Math.min((PORTRAIT_ASPECT / aspect) ** 0.8, PORTRAIT_PUSH_MAX));
    const t = target.clone();
    t.z -= off.length() * PORTRAIT_DROP;
    return { pos: target.clone().add(off), target: t };
  }

  function flyTo(rawPos, rawTarget, dur = 1.6) {
    clearHover(); // the tooltip must not linger through a camera move
    stripBreath();
    legs = []; // a direct fly-to supersedes any queued sweep legs
    // Every flyTo destination is computed framing — goHome, frameLine (via
    // framePulsar/frameGC), frameEarth, and the sweep legs — never a user
    // gesture, so the portrait fix applies here once for all of them.
    const { pos, target } = portraitize(rawPos, rawTarget);
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
  function goHome(dur = 2.2) {
    let h = HOMES[ctx.state.act] || HOMES.record;
    if (ctx.state.act === 'map' && explainerOpen) h = HOMES.mapOpen;
    if (ctx.state.act === 'record' && camera.aspect >= PORTRAIT_ASPECT) h = HOMES.recordWide;
    flyTo(new THREE.Vector3(...h.pos), new THREE.Vector3(...h.target), dur);
  }

  // Frame the Sun→end line: target at `lookAt`, camera offset perpendicular-ish
  // to the line, `spread` × line length away (min 0.8 kpc), lifted above the plane.
  function frameLine(end, lookAt, spread) {
    const len = end.length();
    const d = Math.max(spread * len, 0.8);
    const dir = len > 1e-6 ? end.clone().divideScalar(len) : new THREE.Vector3(1, 0, 0);
    const side = new THREE.Vector3().crossVectors(dir, Z_UP);
    if (side.lengthSq() < 1e-4) side.set(0, -1, 0);
    else side.normalize();
    if (side.y > 0) side.negate(); // stay on the map's near side, like the act views
    const pos = end.clone()
      .addScaledVector(side, d * 0.8)
      .addScaledVector(Z_UP, d * 0.42)
      .addScaledVector(dir, -d * 0.25); // nudge back toward the Sun so both ends read
    flyTo(pos, lookAt.clone(), 1.6);
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
    frameLine(ctx.GC, ctx.GC.clone().multiplyScalar(0.5), 1.1);
  }

  // ---- bus: act staging & selection fly-tos -------------------------------
  let prevAct = ctx.state.act;
  bus.addEventListener('act', () => {
    const from = prevAct;
    prevAct = ctx.state.act;
    const mode = ACT_MODE[ctx.state.act];
    if (mode && ctx.state.mapMode !== mode) ctx.setMapMode(mode);
    // leaving Act V must un-wreck the map — earlier acts have no time slider
    if (ctx.state.act !== 'finders' && ctx.state.timeMyr !== 0) ctx.setTimeMyr(0);
    if (ctx.state.selected != null) { ctx.select(null); return; } // its handler flies home
    if (ctx.state.act === 'pulsars' && from === 'map') {
      // the dimensional sweep: swoop to plane level — the stars visibly rise
      // out of the galactic disc — then climb to the hero overview
      flyPath([
        { pos: new THREE.Vector3(4, -11, 0.7), target: new THREE.Vector3(3, 0, 0.5), dur: 2.4 },
        { pos: new THREE.Vector3(...HOMES.pulsars.pos), target: new THREE.Vector3(...HOMES.pulsars.target), dur: 2.4 },
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

  // Probe inspect mode: while visiting Voyager, OrbitControls goes fully
  // silent and voyager.js owns the gesture (arcball rotation of the MODEL,
  // wheel dolly). No competing camera rotation. Restored on any deselect.
  let inspectSaved = null;
  function setInspect(on) {
    if (on && !inspectSaved) {
      inspectSaved = {
        enabled: controls.enabled,
        minDistance: controls.minDistance,
        maxDistance: controls.maxDistance,
      };
      inspecting = true;
      controls.enabled = false;
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
    const sel = ctx.state.selected;
    if (sel && sel !== 'gc' && sel !== 'voyager') framePulsar(sel);
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

  // ---- resize: portrait re-framing --------------------------------------------
  // main.js updates camera.aspect on resize. When the viewport crosses the
  // portrait threshold, the standing framing was computed for the other
  // orientation — re-home, but never yank a tween, a gesture, or a selection.
  let wasPortrait = camera.aspect < PORTRAIT_ASPECT;
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const isPortrait = camera.aspect < PORTRAIT_ASPECT;
      const crossed = isPortrait !== wasPortrait;
      wasPortrait = isPortrait;
      if (crossed && !tween && !pointerDown && ctx.state.selected == null) goHome(0.9);
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
          // arriving AT the probe must not hand the camera to OrbitControls —
          // voyager.js owns the inspect gesture until deselect restores this
          controls.enabled = !inspecting;
        }
      }
      return;
    }

    if (ctx.prefersReducedMotion || pointerDown) return;

    camera.position.sub(breath); // undo last frame's breathing before real motion

    // Act I: barely-there idle sway (±SWAY_AMPL rad) about the face-on portrait —
    // a full orbit would swing the disc edge-on and lose the engraved design.
    if (ctx.state.act === 'record' && !ctx.state.selected && sinceUser > ORBIT_IDLE_S) {
      swayPhase += dt * SWAY_RATE;
      const sway = SWAY_AMPL * Math.sin(swayPhase);
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
