// The Golden Record — record.js
// Act I hero: the golden record with the REAL cover design — parsed from the
// public-domain plaque SVG into crisp vector lines (no rasterized artwork
// textures, no moiré). At Act II the pulsar-map portion of the engraving
// ignites, lifts off the disc, lays down into the galactic plane and hands
// off 1:1 to map3d's flat map, which then unfolds into true 3D.
// This module also owns the scene lighting (everything else is mostly unlit).

import { loadText, plaqueSvg } from './assets.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---- measured artwork geometry (SVG user units, viewBox "106 261 505 500") --
// Disk center/radii measured from the artwork's own gold-disk path (its arc
// runs rx=290.62, ry=288.91 about local (304.25, 301.318) under a 0.8333
// scale + (106, 261) translate). Using per-axis radii also circularizes the
// slightly elliptical drawing onto the round disc mesh.
const DISK_C = { x: 359.54, y: 512.10 };
const DISK_RX = 242.18;
const DISK_RY = 240.76;
const DISK_R = DISK_RX;              // scalar uses (stroke widths, lift scale)
const MAP_C = { x: 263.8, y: 628.9 };// pulsar-map burst point (the Sun)
const MAP_R = 190;                   // radius enclosing all map lines
const GC_LEN_SVG = 183.5;            // galactic-center line length
// neighbors inside MAP_R that are NOT part of the map (excluded from the lift
// and the engraving overlay — only the pulsar map itself should rise)
const EXCLUDE = [
  { x0: 338, y0: 472, x1: 415, y1: 535 }, // video calibration frame
  { x0: 338, y0: 573, x1: 418, y1: 632 }, // hydrogen atoms glyph
  // the whole how-to-play-the-record cluster: plan view (its circle is dashed,
  // so it parses as many short segments), tonearm, elevation view, binary marks
  { x0: 108, y0: 315, x1: 340, y1: 505 },
];

// ---- lift timeline (seconds; map3d.js delays must match) --------------------
const T_FREEZE = 0.5;  // disc rotation settles, rest of design fades
const T_LIFT_END = 2.1;// lift group reaches the galactic plane
const T_XF_START = 1.6;// lift lines start crossfading out (map3d fades in)
const T_XF_END = 2.3;

const ENGRAVE = 0x3e3220;   // dark engraving on bright gold
const GLOW = 0xe8c968;      // ignited line gold

export function createRecord(ctx) {
  const { THREE, bus, prefersReducedMotion, R0 } = ctx;

  const group = new THREE.Group();
  group.name = 'record';
  group.rotation.x = -0.26; // tip the face gently toward the camera

  // ==== the disc body: smooth gold, low-frequency shading only (no fine
  // rings — 1px canvas rings are what moiréd during camera motion) ==========
  // One clean, uniform gold — a single gentle highlight, no label disc, no
  // tonal band rings (up close those read as colored grooves).
  function drawFace() {
    const S = 1024;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const c = cv.getContext('2d');
    const cx = S / 2, cy = S / 2, R = S / 2;
    const g = c.createRadialGradient(cx - R * 0.3, cy - R * 0.34, R * 0.1, cx, cy, R * 1.35);
    g.addColorStop(0, '#f4d878');
    g.addColorStop(0.55, '#e5bb4e');
    g.addColorStop(1, '#d3a63c');
    c.fillStyle = g;
    c.fillRect(0, 0, S, S);
    // spindle hole only — a thin dark edge where the metal is pierced
    c.beginPath(); c.arc(cx, cy, R * 0.028, 0, Math.PI * 2);
    c.fillStyle = '#0a0805'; c.fill();
    c.beginPath(); c.arc(cx, cy, R * 0.031, 0, Math.PI * 2);
    c.lineWidth = 3; c.strokeStyle = 'rgba(90, 64, 16, 0.55)'; c.stroke();
    return cv;
  }

  function drawBack() {
    const S = 512;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const c = cv.getContext('2d');
    const cx = S / 2, cy = S / 2;
    const g = c.createRadialGradient(cx - 60, cy - 70, 30, cx, cy, S * 0.68);
    g.addColorStop(0, '#f0d072');
    g.addColorStop(0.6, '#ddb247');
    g.addColorStop(1, '#c99e38');
    c.fillStyle = g;
    c.fillRect(0, 0, S, S);
    c.beginPath(); c.arc(cx, cy, S * 0.03, 0, Math.PI * 2);
    c.fillStyle = '#0a0806'; c.fill();
    return cv;
  }

  const maxAniso = ctx.renderer.capabilities.getMaxAnisotropy();
  const makeTex = (canvas) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  };
  const faceTex = makeTex(drawFace());
  const backTex = makeTex(drawBack());

  const sideMat = new THREE.MeshStandardMaterial({
    color: 0xe8b633, metalness: 1.0, roughness: 0.3, transparent: true,
  });
  const backMat = new THREE.MeshStandardMaterial({
    map: backTex, metalness: 1.0, roughness: 0.25, transparent: true,
  });
  // the face: painted mirror gold, self-illuminated (full-metal PBR with no
  // envMap goes black). Its color/emissive dim to near-dark during the lift.
  // depthWrite ON: the disc must occlude what drifts behind it (the probe and
  // its caption) — the old depthWrite:false dated from the two-stacked-faces
  // era and let sprites bleed through the record
  const faceMat = new THREE.MeshStandardMaterial({
    map: faceTex, metalness: 0.35, roughness: 0.5, transparent: true,
    emissive: 0xfff2d0, emissiveMap: faceTex, emissiveIntensity: 0.78,
  });

  // cylinder axis is +Y: [side, top(+Y, away), bottom(-Y, faces camera)]
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 0.02, 128),
    [sideMat, backMat, faceMat]
  );
  group.add(disc);

  // ==== the cover design as triangulated vector strokes =====================
  // Parse once; classify every polyline as map (lifts off) or not. Each stroke
  // is tessellated with true width (SVGLoader.pointsToStroke), so the
  // engraving scales like real engraving instead of 1px GL hairlines.
  const inExclude = (x, y) => EXCLUDE.some((b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1);

  // The artwork arrives as a plain static file; the three stroke meshes are
  // created empty and filled the moment it loads (same-origin, ~instant).
  function buildFromRaw(raw) {
    const designGeos = []; // face-local stroke geometries, everything but the map
    const mapGeos = [];    // face-local stroke geometries, the pulsar map as engraved

    const parsed = new SVGLoader().parse(plaqueSvg(raw, { stroke: '#ffffff', disk: 'none' }));

    // First pass: collect every polyline with its stats (and its stroke style).
    const polys = [];
    for (const path of parsed.paths) {
      for (const sub of path.subPaths) {
        const pts = sub.getPoints(20);
        if (pts.length < 2) continue;
        let minD = Infinity, len = 0, sx = 0, sy = 0, tip = pts[0], tipD = 0;
        for (let i = 0; i < pts.length; i++) {
          const d = Math.hypot(pts[i].x - MAP_C.x, pts[i].y - MAP_C.y);
          if (d < minD) minD = d;
          if (d > tipD) { tipD = d; tip = pts[i]; }
          if (i) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
          sx += pts[i].x; sy += pts[i].y;
        }
        polys.push({
          pts, minD, len, tip,
          cx: sx / pts.length, cy: sy / pts.length,
          style: path.userData.style,
        });
      }
    }

    // The map's radial lines pass through the burst point.
    const radial = polys.filter(
      (q) => q.minD < 15 && Math.hypot(q.cx - MAP_C.x, q.cy - MAP_C.y) < MAP_R,
    );

    // distance from a point to the burst→tip chord of a radial line
    const distToRadial = (x, y) => {
      let best = Infinity;
      for (const r of radial) {
        const dx = r.tip.x - MAP_C.x, dy = r.tip.y - MAP_C.y;
        const L2 = dx * dx + dy * dy;
        if (L2 < 1) continue;
        const t = Math.min(1, Math.max(0, ((x - MAP_C.x) * dx + (y - MAP_C.y) * dy) / L2));
        const d = Math.hypot(x - (MAP_C.x + t * dx), y - (MAP_C.y + t * dy));
        if (d < best) best = d;
      }
      return best;
    };

    for (const q of polys) {
      // Fill-only elements (the gold disk itself, with its center-hole ring)
      // carry stroke:none — they were never drawn linework and must not be
      // tessellated, or a bold phantom ring appears at the hub.
      const style = q.style || {};
      if (!style.stroke || style.stroke === 'none') continue;
      const centDist = Math.hypot(q.cx - MAP_C.x, q.cy - MAP_C.y);
      // "just the map part": the radial lines themselves, plus short binary
      // ticks that actually sit ON one of those lines — nothing else lifts
      // (the plan-view record circle is dashed, so proximity, not size, is
      // what separates its dashes from the map's ticks)
      const isMap =
        radial.includes(q) ||
        (q.len < 16 && centDist < MAP_R && !inExclude(q.cx, q.cy) &&
          distToRadial(q.cx, q.cy) < 8);
      // Triangulated stroke with true width (GL lines are 1px hairlines at
      // every zoom — up close they read as broken dashes on the gold).
      const faceLocal = q.pts.map(
        (p) => new THREE.Vector2((p.x - DISK_C.x) / DISK_RX, -(p.y - DISK_C.y) / DISK_RY),
      );
      const geo = SVGLoader.pointsToStroke(faceLocal, {
        ...style,
        strokeWidth: (style.strokeWidth || 0.6) * 1.15 / DISK_R,
        strokeLineJoin: 'round',
        strokeLineCap: 'round',
      });
      if (!geo) continue; // degenerate polyline (all points coincident)
      (isMap ? mapGeos : designGeos).push(geo);
    }

    const swap = (mesh, merged) => {
      mesh.geometry.dispose();
      mesh.geometry = merged || segGeo();
      mesh.geometry.computeBoundingSphere();
    };
    const designGeo = designGeos.length ? mergeGeometries(designGeos) : null;
    const mapGeo = mapGeos.length ? mergeGeometries(mapGeos) : null;
    // lift copy: same map strokes, re-origined on the burst point (face-local
    // already flipped y, so the burst offset is (bx, -by') — undo both)
    const liftGeo = mapGeo
      ? mapGeo.clone().translate(-(MAP_C.x - DISK_C.x) / DISK_RX, (MAP_C.y - DISK_C.y) / DISK_RY, 0)
      : null;
    for (const g of designGeos) g.dispose();
    for (const g of mapGeos) g.dispose();
    swap(designLines, designGeo);
    swap(mapLines, mapGeo);
    swap(liftLines, liftGeo);
  }

  const segGeo = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
    return g;
  };
  const designMat = new THREE.MeshBasicMaterial({
    color: ENGRAVE, transparent: true, opacity: 1, side: THREE.DoubleSide,
  });
  const mapMat = new THREE.MeshBasicMaterial({
    color: ENGRAVE, transparent: true, opacity: 1, side: THREE.DoubleSide,
  });
  const liftMat = new THREE.MeshBasicMaterial({
    color: GLOW, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });

  // design sits on the face plane (local XY → rotate to face -Y), child of the
  // disc so it spins with the turntable
  const designGroup = new THREE.Group();
  designGroup.rotation.x = Math.PI / 2;
  designGroup.position.y = -0.013;
  const designLines = new THREE.Mesh(segGeo(), designMat);
  const mapLines = new THREE.Mesh(segGeo(), mapMat);
  designLines.renderOrder = 2;
  mapLines.renderOrder = 2;
  designGroup.add(designLines, mapLines);
  disc.add(designGroup);

  // anchor marking the burst point on the face — the lift starts from its
  // world transform
  const anchor = new THREE.Object3D();
  anchor.position.set((MAP_C.x - DISK_C.x) / DISK_RX, -(MAP_C.y - DISK_C.y) / DISK_RY, 0.002);
  designGroup.add(anchor);

  // the lift group lives in the SCENE (not the record group), so it stays put
  // while the record recedes underneath it
  const liftGroup = new THREE.Group();
  const liftLines = new THREE.Mesh(segGeo(), liftMat);
  liftLines.frustumCulled = false;
  liftLines.renderOrder = 3;
  liftGroup.add(liftLines);
  liftGroup.visible = false;
  ctx.scene.add(liftGroup);

  // fetch the artwork (a plain static file) and fill the meshes
  loadText('vendor/art/voyager_golden_plaque.svg')
    .then(buildFromRaw)
    .catch(() => {}); // without it, the record is a clean gold disc — never fatal

  // scale that makes the engraved GC line span the real Sun→GC distance
  const LIFT_SCALE_END = (ctx.GC ? ctx.GC.length() : 8.2) / (GC_LEN_SVG / DISK_R);

  // ==== lighting (owned here; the rest of the scene is unlit) ================
  const key = new THREE.DirectionalLight(0xffe8b0, 3.2);
  key.position.set(2.5, -3.5, 3);
  const rim = new THREE.DirectionalLight(0x8fa8bd, 0.9);
  rim.position.set(-2.5, 3.5, 1.5);
  const ambient = new THREE.AmbientLight(0x2a2114, 1.9);
  group.add(key, rim, ambient);

  // ==== act staging ===========================================================
  let fade = 1;          // overall record visibility
  let target = 1;
  let receding = false;
  let lifting = false;   // Act II lift timeline active
  let liftT = 0;
  let liftStartPos = new THREE.Vector3();
  let liftStartQuat = new THREE.Quaternion();
  let liftCaptured = false;
  let rotStart = 0;      // disc rotation at lift start (settles to 0 mod 2π)
  let rotTarget = 0;
  let spin = true;
  let act = ctx.state.act;               // current act, tracked for the overlay
  let restoring = false;                 // Act I re-light in progress
  let restoreT = 0;
  let restoreFrom = null;
  let artifact = !!ctx.state.artifact;   // persistent-overlay toggle
  let overlayFade = 0;                   // overlay opacity ease, 0..1
  const OVERLAY_ACTS = ['map', 'pulsars', 'verdict', 'finders'];
  const overlayWanted = () => artifact && OVERLAY_ACTS.includes(act);

  const _q = new THREE.Quaternion();
  const _engrave = new THREE.Color(ENGRAVE);
  const _glow = new THREE.Color(GLOW);
  const _faceEmissive = new THREE.Color(0xfff2d0);
  const _faceDark = new THREE.Color(0x181006);
  const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  function resetToEngraved() {
    lifting = false;
    liftCaptured = false;
    liftT = 0;
    overlayFade = 0; // the overlay only exists off the record
    liftGroup.visible = false;
    liftMat.opacity = 0;
    mapLines.visible = true;
    spin = true;
    designMat.opacity = 1;
    mapMat.color.copy(_engrave);
    faceMat.emissive.copy(_faceEmissive);
    faceMat.emissiveIntensity = 0.78;
  }

  // Returning to Act I: instead of snapping, the record re-lights over ~1.2 s
  // (the reverse of the ignite — face brightens, the design fades back in,
  // the map lines cool from glow to engraving) while map3d fades itself out.
  function beginRestore() {
    lifting = false;
    liftCaptured = false;
    liftT = 0;
    overlayFade = 0;
    liftGroup.visible = false;
    liftMat.opacity = 0;
    mapLines.visible = true;
    spin = true;
    if (prefersReducedMotion) { resetToEngraved(); return; }
    restoring = true;
    restoreT = 0;
    // capture where the dimming left things so the reverse starts seamlessly
    restoreFrom = {
      design: designMat.opacity,
      emissive: faceMat.emissive.clone(),
      intensity: faceMat.emissiveIntensity,
      mapColor: mapMat.color.clone(),
    };
  }

  bus.addEventListener('artifact', (e) => { artifact = !!e.detail.show; });

  // ==== grab-and-spin: the disc is a turntable ==============================
  // Dragging the record spins it about its spindle (screen-tangential drag →
  // rotation.y), with flick inertia that relaxes back to the ambient slow
  // spin — the same grab-hand language as the probe, but record physics.
  // rotation.y-only keeps the lift ceremony's settle math valid.
  const AUTO_SPIN = prefersReducedMotion ? 0.02 : 0.12; // rad/s ambient
  const FLICK_MAX = 7;      // rad/s cap on release velocity
  const FLICK_RELAX_S = 1.6;// e-fold time for flick → ambient
  let spinVel = AUTO_SPIN;
  let dragging = false;
  let dragAngle = 0;        // last pointer angle about the disc's screen center
  let dragVel = 0;          // smoothed angular velocity while dragging
  let dragAt = 0;           // performance.now() of the last drag sample
  let hoverGrab = false;    // we own the cursor while the grab hand shows

  const _wp = new THREE.Vector3();
  const canDrag = () =>
    act === 'record' && !lifting && fade > 0.5 &&
    ctx.state.selected !== 'voyager' && group.visible;

  // pointer angle about the disc center, in screen pixels (y-down, so a
  // visually-clockwise drag increases the angle — matching +rotation.y as
  // seen from the Act I camera)
  function pointerAngle(e) {
    const r = ctx.canvas.getBoundingClientRect();
    group.getWorldPosition(_wp).project(ctx.camera);
    const cx = r.left + ((_wp.x + 1) / 2) * r.width;
    const cy = r.top + ((-_wp.y + 1) / 2) * r.height;
    return Math.atan2(e.clientY - cy, e.clientX - cx);
  }

  const _ray = new THREE.Raycaster();
  const _ndc = new THREE.Vector2();
  function hitDisc(e) {
    const r = ctx.canvas.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    _ndc.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    _ray.setFromCamera(_ndc, ctx.camera);
    return _ray.intersectObject(disc, false).length > 0;
  }

  const wrapPi = (a) => ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    ctx.controls.enabled = true;
    spinVel = Math.max(-FLICK_MAX, Math.min(FLICK_MAX, dragVel));
    ctx.canvas.style.cursor = hoverGrab ? 'grab' : '';
  }

  // capture-phase on window: runs before OrbitControls — when the grab lands
  // on the disc, controls are switched off so the camera holds still. The
  // event still propagates: tour.js must see the gesture (it pauses the idle
  // sway and its hover tooltips while the pointer is down).
  window.addEventListener('pointerdown', (e) => {
    if (e.target !== ctx.canvas || e.button !== 0) return;
    if (!canDrag() || !hitDisc(e)) return;
    dragging = true;
    ctx.controls.enabled = false;
    dragAngle = pointerAngle(e);
    dragVel = 0;
    dragAt = performance.now();
    ctx.canvas.style.cursor = 'grabbing';
  }, { capture: true });

  window.addEventListener('pointermove', (e) => {
    if (dragging) {
      // re-assert every move: a cancelled tween re-arms OrbitControls and
      // tour's hover handler resets the cursor — both after our pointerdown
      ctx.controls.enabled = false;
      ctx.canvas.style.cursor = 'grabbing';
      const now = performance.now();
      const dtm = Math.max(1, now - dragAt) / 1000;
      dragAt = now;
      const a = pointerAngle(e);
      const d = wrapPi(a - dragAngle);
      dragAngle = a;
      disc.rotation.y += d;
      // smoothed release velocity (a flick is the last few samples, not one)
      dragVel += ((d / dtm) - dragVel) * Math.min(1, dtm * 12);
      return;
    }
    // hover: show the grab hand over the disc. This window listener runs
    // after tour.js's canvas hover handler, so the override wins on the disc
    // and leaves tour's pointer/default everywhere else.
    if (e.target !== ctx.canvas) { hoverGrab = false; return; }
    const over = canDrag() && hitDisc(e);
    if (over) { ctx.canvas.style.cursor = 'grab'; hoverGrab = true; }
    else if (hoverGrab) { hoverGrab = false; ctx.canvas.style.cursor = ''; }
  });

  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  bus.addEventListener('act', (e) => {
    act = e.detail.act;
    if (act !== 'record') { endDrag(); if (hoverGrab) { hoverGrab = false; ctx.canvas.style.cursor = ''; } }
    const wasRecord = target === 1;
    target = act === 'record' ? 1 : 0;
    receding = act === 'map';
    if (act === 'record') {
      beginRestore();
    } else if (act === 'map' && wasRecord && !prefersReducedMotion) {
      restoring = false;
      lifting = true;
      liftT = 0;
      liftCaptured = false;
      spin = false;
      rotStart = disc.rotation.y;
      rotTarget = Math.round(rotStart / (Math.PI * 2)) * Math.PI * 2;
    } else {
      // jumped past the ceremony (act III+, or reduced motion): no lift
      lifting = false;
      liftGroup.visible = false;
      mapLines.visible = true;
      spin = act === 'record';
    }
  });

  function apply(t) {
    sideMat.opacity = backMat.opacity = faceMat.opacity = fade;
    group.position.y = (1 - fade) * 2.4;
    if (!prefersReducedMotion) group.position.z = 0.03 * Math.sin(t * 0.5) * fade;
    group.scale.setScalar(0.7 + 0.3 * fade);
    group.visible = fade > 0.004;
  }
  apply(0);

  return {
    object3d: group,

    update(dt, t) {
      if (spin && !dragging && !ctx.still) { // still mode: engraving stays canonical
        disc.rotation.y += spinVel * dt;
        // a flick decays back to the ambient turntable rate
        spinVel += (AUTO_SPIN - spinVel) * Math.min(1, dt / FLICK_RELAX_S);
      }

      const rate = prefersReducedMotion ? 14 : (target > fade ? 2.4 : receding ? 1.6 : 2.8);
      fade += (target - fade) * Math.min(1, dt * rate);
      if (Math.abs(target - fade) < 0.003) fade = target;

      if (restoring) {
        // the reverse of the ignite: re-light over 1.2 s from wherever the
        // dimming left off
        restoreT += dt;
        const k = ease(clamp01(restoreT / 1.2));
        designMat.opacity = restoreFrom.design + (1 - restoreFrom.design) * k;
        faceMat.emissive.copy(restoreFrom.emissive).lerp(_faceEmissive, k);
        faceMat.emissiveIntensity = restoreFrom.intensity + (0.78 - restoreFrom.intensity) * k;
        mapMat.color.copy(restoreFrom.mapColor).lerp(_engrave, k);
        if (k >= 1) restoring = false;
      }

      if (lifting) {
        liftT += dt;

        // 0 → T_FREEZE: the turntable settles, the rest of the design fades,
        // the gold face dims to night
        const settle = ease(clamp01(liftT / T_FREEZE));
        disc.rotation.y = rotStart + (rotTarget - rotStart) * settle;
        const dim = ease(clamp01(liftT / 0.9));
        designMat.opacity = 1 - dim;
        faceMat.emissive.copy(_faceEmissive).lerp(_faceDark, dim);
        faceMat.emissiveIntensity = 0.78 - 0.6 * dim;
        // the map ignites while everything else goes dark
        mapMat.color.copy(_engrave).lerp(_glow, dim);

        // at T_FREEZE: hand the engraved map to the lift group, seamlessly
        if (!liftCaptured && liftT >= T_FREEZE) {
          liftCaptured = true;
          anchor.getWorldPosition(liftStartPos);
          anchor.getWorldQuaternion(liftStartQuat);
          liftGroup.position.copy(liftStartPos);
          liftGroup.quaternion.copy(liftStartQuat);
          liftGroup.scale.setScalar(group.scale.x);
          liftMat.color.copy(mapMat.color);
          liftMat.opacity = 1;
          liftGroup.visible = true;
          mapLines.visible = false;
        }

        if (liftCaptured) {
          // T_FREEZE → T_LIFT_END: rise off the face, lay down into the
          // galactic plane, grow to true scale (GC line → 8.2 kpc)
          const k = ease(clamp01((liftT - T_FREEZE) / (T_LIFT_END - T_FREEZE)));
          liftGroup.position.lerpVectors(liftStartPos, new THREE.Vector3(0, 0, 0), k);
          _q.identity();
          liftGroup.quaternion.slerpQuaternions(liftStartQuat, _q, k);
          const s0 = group.scale.x;
          liftGroup.scale.setScalar(s0 * Math.pow(LIFT_SCALE_END / s0, k)); // log-lerp
          liftMat.color.copy(_glow);
          // T_XF_START → T_XF_END: hand off to map3d's flat vector map
          const xf = clamp01((liftT - T_XF_START) / (T_XF_END - T_XF_START));
          liftMat.opacity = 1 - xf;
          if (xf >= 1) {
            lifting = false;
            if (overlayWanted()) {
              // hand off into the persistent overlay: the pose is already the
              // overlay's end frame; opacity eases from here back up to 0.45
              overlayFade = liftMat.opacity / 0.45;
            } else {
              liftGroup.visible = false;
            }
          }
        }
      }

      // persistent engraved overlay: while state.artifact is on (Acts II–IV)
      // the ignited map stays laid into the galactic plane as a faint ghost.
      // The ceremony owns liftGroup while `lifting` — never fight it.
      if (!lifting) {
        const want = overlayWanted() ? 1 : 0;
        if (prefersReducedMotion) overlayFade = want;
        else if (overlayFade !== want) {
          const step = dt / 0.5;
          overlayFade = want > overlayFade
            ? Math.min(want, overlayFade + step)
            : Math.max(want, overlayFade - step);
        }
        liftGroup.position.set(0, 0, 0);
        liftGroup.quaternion.identity();
        liftGroup.scale.setScalar(LIFT_SCALE_END);
        liftMat.color.copy(_glow);
        // fade the overlay away when the camera dives to the origin (the
        // Earth visit) — up close its kpc-scale strokes are just noise
        const camDist = ctx.camera.position.length();
        const closeFade = Math.min(1, Math.max(0, (camDist - 0.15) / 0.5));
        liftMat.opacity = 0.45 * overlayFade * closeFade;
        liftGroup.visible = liftMat.opacity > 0.004;
      }

      apply(t);
    },

    setVisible(v) {
      target = v ? 1 : 0;
      receding = false;
    },
  };
}
