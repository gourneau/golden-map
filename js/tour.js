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
  record:  { pos: [0, -3.05, 0.95],  target: [0, 0, 0.12] },
  map:     { pos: [2, -9, 5],        target: [2, 0, 0] },      // pull back as lines unfold
  pulsars: { pos: [4, -14, 9],       target: [3, 0, 0] },      // hero overview
  verdict: { pos: [-1.6, -1.4, 9.2], target: [-1.6, 0.2, 0] }, // plan view; panel now hugs the left margin
  finders: { pos: [-6, -18, 7],      target: [3, 0, 0] },      // wide cinematic
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
  let pointerDown = false;
  let sinceUser = ORBIT_IDLE_S;           // seconds since last user gesture

  function stripBreath() {
    camera.position.sub(breath);
    breath.set(0, 0, 0);
  }

  function cancelTween() {
    if (!tween) return;
    tween = null;
    controls.enabled = true;
  }

  function flyTo(pos, target, dur = 1.6) {
    stripBreath();
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

  // ---- framing ----------------------------------------------------------
  function goHome(dur = 2.2) {
    const h = HOMES[ctx.state.act] || HOMES.record;
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
  bus.addEventListener('act', () => {
    const mode = ACT_MODE[ctx.state.act];
    if (mode && ctx.state.mapMode !== mode) ctx.setMapMode(mode);
    // leaving Act V must un-wreck the map — earlier acts have no time slider
    if (ctx.state.act !== 'finders' && ctx.state.timeMyr !== 0) ctx.setTimeMyr(0);
    if (ctx.state.selected != null) ctx.select(null); // its handler flies home
    else goHome();
  });

  bus.addEventListener('select', (e) => {
    const target = e.detail.target;
    if (target == null) goHome(1.6);
    else if (target === 'gc') frameGC();
    else framePulsar(target);
  });

  bus.addEventListener('mapmode', () => {
    // A selected pulsar's endpoint moves with the mode — keep it framed.
    const sel = ctx.state.selected;
    if (sel && sel !== 'gc') framePulsar(sel);
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

  let downX = 0, downY = 0;

  // Capture on window so the tween is cancelled (and controls re-enabled)
  // BEFORE OrbitControls' own canvas listener sees the event — otherwise the
  // first drag/wheel during a fly-to is swallowed by `enabled === false`.
  window.addEventListener('pointerdown', (e) => {
    if (e.target !== canvas) return;
    pointerDown = true;
    sinceUser = 0;
    downX = e.clientX; downY = e.clientY;
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
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > CLICK_SLOP_PX) return;
    const hit = pick(e);
    if (hit) ctx.select(hit);
    // A miss deselects nothing — panels have their own close buttons.
  });

  let lastHover = 0;
  canvas.addEventListener('pointermove', (e) => {
    if (pointerDown || tween) return;
    const now = performance.now();
    if (now - lastHover < HOVER_INTERVAL_MS) return;
    lastHover = now;
    canvas.style.cursor = pick(e) ? 'pointer' : '';
  });

  // ---- keyboard -------------------------------------------------------------
  function cycleAct(step) {
    const ids = ctx.ACTS.map((a) => a.id);
    const i = ids.indexOf(ctx.state.act);
    ctx.setAct(ids[(i + step + ids.length) % ids.length]);
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

  // ---- opening move -----------------------------------------------------------
  goHome(2.6); // from the bootstrap camera into the Act I portrait

  // ---- per-frame ----------------------------------------------------------------
  const orbitArm = new THREE.Vector3();
  let swayPhase = 0;   // sway oscillator
  let swayPrev = 0;    // last applied sway angle, so each frame rotates by the delta

  function update(dt, t) {
    sinceUser += dt;

    if (tween) {
      tween.el += dt;
      const k = ease(Math.min(tween.el / tween.dur, 1));
      camera.position.lerpVectors(tween.p0, tween.p1, k);
      controls.target.lerpVectors(tween.t0, tween.t1, k);
      if (tween.el >= tween.dur) cancelTween();
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
