// The Golden Record — map3d.js
// The 3D pulsar map itself. Sun at the origin; for each pulsar an engraved
// line (gold, 1977 distance) and a modern line (starlight), each with a
// blinking beacon at its end pulsing at the pulsar's real period (scaled to
// stay watchable). The long galactic-center line. Error arcs for the three
// mis-drawn bearings. Act V shears the whole geometry with differential
// galactic rotation until the map visibly stops working.

import { extinctionMyr, displayBlinkSeconds } from './astro.js';

const TAU = Math.PI * 2;
const V0 = 0.225;       // flat rotation-curve speed, kpc/Myr (~220 km/s)
const SHEAR_GAIN = 1.6; // drama multiplier: 100 Myr must wreck the map
const ARC_N = 33;       // vertices per error arc

export function createMap(ctx) {
  const { THREE, pulsars, GC, bus, state, camera, prefersReducedMotion } = ctx;

  const group = new THREE.Group();
  group.name = 'map3d';

  const GOLD_BEACON = new THREE.Color(0xf2d478);
  const STAR_BEACON = new THREE.Color(0xa9c3d4);
  const EMBER = new THREE.Color(0x6b2c14);

  // ---- shared assets --------------------------------------------------------
  function glowTexture(size, stops) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [at, color] of stops) g.addColorStop(at, color);
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(cv);
  }
  const beaconTex = glowTexture(64, [
    [0, 'rgba(255,255,255,1)'],
    [0.22, 'rgba(255,255,255,0.55)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  const emberTex = glowTexture(32, [
    [0, 'rgba(255,255,255,1)'],
    [0.55, 'rgba(255,255,255,0.75)'],
    [1, 'rgba(255,255,255,0)'],
  ]);

  function makeSprite(texture, color, scale, additive = true) {
    const mat = new THREE.SpriteMaterial({
      map: texture,
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const s = new THREE.Sprite(mat);
    s.scale.set(scale, scale, 1);
    s.frustumCulled = false;
    s.renderOrder = 5;
    return s;
  }

  function makeLine(color, arr6) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr6 || new Float32Array(6), 3));
    const mat = new THREE.LineBasicMaterial({
      color, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    return line;
  }

  const hitGeo = new THREE.SphereGeometry(0.12, 8, 6);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });

  // ---- the Sun ---------------------------------------------------------------
  const sunCore = makeSprite(beaconTex, 0xfff2d0, 0.09);
  sunCore.renderOrder = 4;
  const sunHalo = makeSprite(beaconTex, 0xf2d478, 0.32);
  sunHalo.renderOrder = 3;
  group.add(sunCore, sunHalo);

  // ---- Earth: a small globe beside the Sun, only visible up close -----------
  // (wildly not to scale — at true scale it would be a billionth of a pixel)
  // Texture: NASA Blue Marble, cloud-free (public domain), embedded.
  const EARTH_POS = new THREE.Vector3(0.018, 0, 0);
  const earthTex = new THREE.TextureLoader().load('vendor/art/earth_1024.jpg');
  earthTex.colorSpace = THREE.SRGBColorSpace;
  earthTex.anisotropy = ctx.renderer.capabilities.getMaxAnisotropy();
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(0.008, 32, 24),
    new THREE.MeshBasicMaterial({ map: earthTex, transparent: true, opacity: 0 }),
  );
  earth.position.copy(EARTH_POS);
  earth.rotation.x = Math.PI / 2 - 0.41; // axial tilt against the galactic frame
  const earthGlow = makeSprite(beaconTex, 0x7fb2d9, 0.026);
  earthGlow.position.copy(EARTH_POS);
  earthGlow.renderOrder = 5;
  // a faint orbit hint around the Sun
  const orbitPts = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * TAU;
    orbitPts.push(new THREE.Vector3(Math.cos(a) * 0.018, Math.sin(a) * 0.018, 0));
  }
  const orbit = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(orbitPts),
    new THREE.LineBasicMaterial({ color: 0x7fb2d9, transparent: true, opacity: 0, depthWrite: false }),
  );
  orbit.frustumCulled = false;
  const earthHit = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), hitMat);
  earthHit.position.copy(EARTH_POS);
  earthHit.userData.pulsar = 'earth';
  group.add(earth, earthGlow, orbit, earthHit);

  // ---- the galactic-center line ------------------------------------------------
  const gcArr = new Float32Array([0, 0, 0, GC.x, GC.y, GC.z]);
  const gcLine = makeLine(0xe4c25a, gcArr);
  const gcGlow = makeSprite(beaconTex, 0xe4c25a, 0.9);
  gcGlow.position.copy(GC);
  gcGlow.renderOrder = 3;
  const gcHit = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), hitMat);
  gcHit.position.copy(GC);
  gcHit.userData.pulsar = 'gc';
  group.add(gcLine, gcGlow, gcHit);

  // ---- z-ticks: one merged LineSegments (the map's z-offset notation) --------
  const tickGeo = new THREE.BufferGeometry();
  tickGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pulsars.length * 6), 3));
  const tickMat = new THREE.LineBasicMaterial({ color: 0x6e5a1e, transparent: true, opacity: 0 });
  const ticks = new THREE.LineSegments(tickGeo, tickMat);
  ticks.frustumCulled = false;
  group.add(ticks);

  // ---- depth stalks: verticals from the galactic plane up to each star ------
  // (the engraved map's end-tick concept, made literal — instantly reads 3D)
  const mkStalks = (color) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pulsars.length * 6), 3));
    const m = new THREE.LineBasicMaterial({
      color, transparent: true, opacity: 0, depthWrite: false,
    });
    const l = new THREE.LineSegments(g, m);
    l.frustumCulled = false;
    group.add(l);
    return l;
  };
  const eStalks = mkStalks(0xc9a227);
  const mStalks = mkStalks(0xbcd6e8);

  // ---- plane rings: a whisper of structure to anchor the galactic plane -----
  const ringGroup = new THREE.Group();
  {
    const ringMat = new THREE.LineBasicMaterial({
      color: 0x6e5a1e, transparent: true, opacity: 0, depthWrite: false,
    });
    for (const r of [2, 4, 6, 8]) {
      const pts = [];
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * TAU;
        pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
      }
      const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat);
      ring.frustumCulled = false;
      ringGroup.add(ring);
    }
    ringGroup.userData.mat = ringMat;
  }
  group.add(ringGroup);

  // ---- labels ------------------------------------------------------------------
  function makeLabel(text) {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 64;
    const c = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const redraw = () => {
      c.clearRect(0, 0, 256, 64);
      c.font = '500 30px "IBM Plex Mono", ui-monospace, monospace';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = '#c9a227';
      c.fillText(text, 128, 34);
      tex.needsUpdate = true;
    };
    redraw();
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.52, 0.13, 1);
    sprite.frustumCulled = false;
    sprite.renderOrder = 6;
    return { sprite, redraw };
  }

  // ---- per-pulsar assembly -------------------------------------------------------
  // flatten a position into the galactic plane (in-plane bearing, length
  // preserved) — this matches the engraved map's own drawing convention, so
  // the record's lifted artwork hands off 1:1; Act II unfolds from here
  function flat(v) {
    const len = v.length();
    const a = Math.atan2(v.y, v.x);
    return new THREE.Vector3(Math.cos(a) * len, Math.sin(a) * len, 0);
  }

  const pickables = [];
  const items = pulsars.map((p) => {
    const eLine = makeLine(0xc9a227);
    const mLine = makeLine(0xbcd6e8);

    // dashed displacement link engraved-end → modern-end: in the overlay it
    // shows directly how far each star's mapped position moved
    const linkGeo = new THREE.BufferGeometry();
    linkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const link = new THREE.Line(linkGeo, new THREE.LineDashedMaterial({
      color: 0xd97a56, transparent: true, opacity: 0,
      dashSize: 0.14, gapSize: 0.09, depthWrite: false,
    }));
    link.frustumCulled = false;

    const eBeacon = makeSprite(beaconTex, 0xf2d478, 0.085);
    const mBeacon = makeSprite(beaconTex, 0xbcd6e8, 0.12);
    const remnant = makeSprite(emberTex, 0x3a1c12, 0.05, false);
    remnant.renderOrder = 4;

    const eHit = new THREE.Mesh(hitGeo, hitMat);
    eHit.userData.pulsar = p;
    eHit.userData.kind = 'engraved';
    const mHit = new THREE.Mesh(hitGeo, hitMat);
    mHit.userData.pulsar = p;
    mHit.userData.kind = 'modern';
    pickables.push(eHit, mHit);

    const label = makeLabel(p.bname);

    let arc = null;
    if (p.angleErrorDeg) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ARC_N * 3), 3));
      const mat = new THREE.LineBasicMaterial({ color: 0xc96a4a, transparent: true, opacity: 0 });
      arc = new THREE.Line(geo, mat);
      arc.frustumCulled = false;
      group.add(arc);
    }

    group.add(eLine, mLine, link, eBeacon, mBeacon, remnant, eHit, mHit, label.sprite);

    return {
      p,
      eLine, mLine, link, eBeacon, mBeacon, remnant, eHit, mHit, arc,
      label: label.sprite,
      redrawLabel: label.redraw,
      flatE: flat(p.xyz1977),
      flatM: flat(p.xyzModern),
      eEnd: new THREE.Vector3(),
      mEnd: new THREE.Vector3(),
      // display blink period: Crab frantic, Vela quick, B0525+21 stately
      dispPeriod: displayBlinkSeconds(p),
      ext: extinctionMyr(p),
      phase: Math.random() * TAU,
      bph: Math.random(),
      selF: 1,
    };
  });
  pickables.push(gcHit, earthHit);
  group.userData.pickables = pickables;
  const byPulsar = new Map(items.map((it) => [it.p, it]));

  // crisp label text once the webfont is in
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => items.forEach((it) => it.redrawLabel()));
  }

  // ---- lighthouse beam for the selected pulsar -----------------------------------
  // A radio pulse, not a searchlight: a soft ring that expands from the
  // selected beacon and fades, once per (display-scaled) rotation.
  const ringCanvas = document.createElement('canvas');
  ringCanvas.width = ringCanvas.height = 128;
  {
    const c = ringCanvas.getContext('2d');
    const g = c.createRadialGradient(64, 64, 40, 64, 64, 62);
    g.addColorStop(0, 'rgba(242,212,120,0)');
    g.addColorStop(0.75, 'rgba(242,212,120,0.9)');
    g.addColorStop(1, 'rgba(242,212,120,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(64, 64, 63, 0, Math.PI * 2);
    c.fill();
  }
  const beamMat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(ringCanvas), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const beam = new THREE.Sprite(beamMat); // named `beam` to keep the plumbing below
  beam.visible = false;
  group.add(beam);

  // ---- staging state ----------------------------------------------------------
  let actFade = 0, actTarget = state.act === 'record' ? 0 : 1;
  let engFade = 1, engT = state.mapMode !== 'modern' ? 1 : 0;
  let modFade = 0, modT = state.mapMode !== 'engraved' ? 1 : 0;
  let arcFade = 0, arcT = state.mapMode === 'both' ? 1 : 0;
  let arcAnim = 1;
  let labelFade = 0, labelT = 0;
  let unfold = 0, unfoldT = state.act === 'record' || state.act === 'map' ? (state.act === 'map' ? 1 : 0) : 1;
  let beamFade = 0;
  let selected = state.selected;
  let lastSelItem = null;
  let needLayout = true;

  // entering Act II from Act I, the record's lift ceremony runs first: the
  // flat map fades in as the lifted engraving crossfades out (record.js
  // timeline: crossfade 1.6→2.3 s, so we hold fade until 1.6 s and the
  // unfold until 2.2 s)
  let fadeHold = 0, unfoldHold = 0;
  let prevAct = state.act;
  let curAct = state.act;
  bus.addEventListener('act', (e) => {
    const act = e.detail.act;
    if (act === 'map' && prevAct === 'record' && !prefersReducedMotion) {
      fadeHold = 1.6;
      unfoldHold = 2.2;
    } else {
      fadeHold = 0;
      unfoldHold = 0;
    }
    prevAct = act;
    curAct = act;
    actTarget = act === 'record' ? 0 : 1;
    unfoldT = act === 'record' ? 0 : 1;
    labelT = act === 'pulsars' || act === 'verdict' || act === 'finders' ? 1 : 0;
  });
  bus.addEventListener('mapmode', (e) => {
    const mode = e.detail.mode;
    engT = mode !== 'modern' ? 1 : 0;
    modT = mode !== 'engraved' ? 1 : 0;
    if (mode === 'both' && arcT === 0) arcAnim = prefersReducedMotion ? 1 : 0; // draw-on
    arcT = mode === 'both' ? 1 : 0;
  });
  bus.addEventListener('timeMyr', () => { needLayout = true; });
  bus.addEventListener('select', (e) => {
    selected = e.detail.target;
    if (selected && selected !== 'gc') {
      lastSelItem = byPulsar.get(selected) || null;
      beam.rotation.z = 0;
    }
  });

  // ---- geometry layout: unfold (Act II) + galactic shear (Act V) ----------------
  const OMEGA0 = V0 / Math.hypot(GC.x, GC.y); // Sun's angular rate about the GC
  const _e = new THREE.Vector3();
  const _m = new THREE.Vector3();
  const _d1 = new THREE.Vector3();
  const _d2 = new THREE.Vector3();
  const _axis = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _pt = new THREE.Vector3();

  // differential rotation about the GC axis, in the frame co-rotating with the
  // Sun (so the Sun stays at the origin while everything else drifts)
  function shear(v, myr) {
    const qx = v.x - GC.x, qy = v.y - GC.y;
    const R = Math.hypot(qx, qy);
    if (R < 0.25) return;
    const dth = (V0 / R - OMEGA0) * myr * SHEAR_GAIN;
    const c = Math.cos(dth), s = Math.sin(dth);
    v.x = GC.x + qx * c - qy * s;
    v.y = GC.y + qx * s + qy * c;
  }

  function setEnd(line, v) {
    const a = line.geometry.attributes.position;
    a.array[3] = v.x; a.array[4] = v.y; a.array[5] = v.z;
    a.needsUpdate = true;
  }

  function layoutArc(it) {
    _d1.copy(it.eEnd);
    const rE = _d1.length();
    if (rE < 1e-6) return;
    _d1.normalize();
    _d2.copy(it.mEnd).normalize();
    _axis.crossVectors(_d1, _d2);
    const ang = _d1.angleTo(_d2);
    if (_axis.lengthSq() < 1e-10) _axis.set(0, 0, 1);
    _axis.normalize();
    const arr = it.arc.geometry.attributes.position.array;
    for (let k = 0; k < ARC_N; k++) {
      _q.setFromAxisAngle(_axis, (ang * k) / (ARC_N - 1));
      _pt.copy(_d1).applyQuaternion(_q).multiplyScalar(rE);
      arr[k * 3] = _pt.x; arr[k * 3 + 1] = _pt.y; arr[k * 3 + 2] = _pt.z;
    }
    it.arc.geometry.attributes.position.needsUpdate = true;
  }

  function layout() {
    const u = unfold * unfold * (3 - 2 * unfold); // smoothstep the unfolding
    const myr = state.timeMyr;
    const tickArr = tickGeo.attributes.position.array;
    const esArr = eStalks.geometry.attributes.position.array;
    const msArr = mStalks.geometry.attributes.position.array;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      _e.lerpVectors(it.flatE, it.p.xyz1977, u);
      _m.lerpVectors(it.flatM, it.p.xyzModern, u);
      if (myr > 0) { shear(_e, myr); shear(_m, myr); }
      it.eEnd.copy(_e);
      it.mEnd.copy(_m);
      setEnd(it.eLine, _e);
      setEnd(it.mLine, _m);
      {
        const la = it.link.geometry.attributes.position.array;
        la[0] = _e.x; la[1] = _e.y; la[2] = _e.z;
        la[3] = _m.x; la[4] = _m.y; la[5] = _m.z;
        it.link.geometry.attributes.position.needsUpdate = true;
        it.link.computeLineDistances();
      }
      it.eBeacon.position.copy(_e);
      it.eHit.position.copy(_e);
      it.mBeacon.position.copy(_m);
      it.mHit.position.copy(_m);
      it.remnant.position.copy(_m);
      it.label.position.set(_e.x, _e.y, _e.z + 0.16);
      tickArr[i * 6 + 0] = _e.x; tickArr[i * 6 + 1] = _e.y; tickArr[i * 6 + 2] = _e.z - 0.07;
      tickArr[i * 6 + 3] = _e.x; tickArr[i * 6 + 4] = _e.y; tickArr[i * 6 + 5] = _e.z + 0.07;
      esArr[i * 6 + 0] = _e.x; esArr[i * 6 + 1] = _e.y; esArr[i * 6 + 2] = 0;
      esArr[i * 6 + 3] = _e.x; esArr[i * 6 + 4] = _e.y; esArr[i * 6 + 5] = _e.z;
      msArr[i * 6 + 0] = _m.x; msArr[i * 6 + 1] = _m.y; msArr[i * 6 + 2] = 0;
      msArr[i * 6 + 3] = _m.x; msArr[i * 6 + 4] = _m.y; msArr[i * 6 + 5] = _m.z;
      if (it.arc) layoutArc(it);
    }
    tickGeo.attributes.position.needsUpdate = true;
    eStalks.geometry.attributes.position.needsUpdate = true;
    mStalks.geometry.attributes.position.needsUpdate = true;
  }
  layout();

  // ---- per-frame -----------------------------------------------------------------
  function update(dt, t) {
    const k = prefersReducedMotion ? 1 : Math.min(1, dt * 3.5); // ~0.8 s settles
    if (fadeHold > 0) fadeHold -= dt;
    else actFade += (actTarget - actFade) * k;
    engFade += (engT - engFade) * k;
    modFade += (modT - modFade) * k;
    arcFade += (arcT - arcFade) * k;
    labelFade += (labelT - labelFade) * k;

    if (unfoldHold > 0) unfoldHold -= dt;
    else if (prefersReducedMotion) unfold = unfoldT;
    else if (unfold !== unfoldT) {
      unfold = unfoldT > unfold
        ? Math.min(unfoldT, unfold + dt / 1.6)
        : Math.max(unfoldT, unfold - dt / 1.6);
      needLayout = true;
    }

    group.visible = actFade > 0.004;
    if (!group.visible) {
      // the raycaster tests pickables directly, ignoring hidden ancestors —
      // so a hidden map must explicitly retract its hit targets (but only its
      // OWN: voyager.js parks its easter-egg hit in this array too)
      for (const o of pickables) {
        if (o.userData.pulsar !== 'voyager') o.visible = false;
      }
      return;
    }

    if (needLayout) { layout(); needLayout = false; }

    if (arcT > 0 && arcAnim < 1) {
      arcAnim = Math.min(1, arcAnim + dt / 1.1);
      const count = 2 + Math.floor(arcAnim * (ARC_N - 2));
      for (const it of items) if (it.arc) it.arc.geometry.setDrawRange(0, count);
    }

    const myr = state.timeMyr;
    const selP = selected && selected !== 'gc' ? selected : null;
    const kSel = prefersReducedMotion ? 1 : Math.min(1, dt * 6);

    // deep-zoom cleanup: as the camera closes on the origin (the Earth visit),
    // the beacon sprites/embers/links stop meaning anything — just colored
    // dots — so fade them out and leave the clean radial lines + Earth + Sun
    const camDist = camera.position.length();
    const closeFade = Math.min(1, Math.max(0, (camDist - 0.15) / 0.5));

    for (const it of items) {
      // selection emphasis
      const sT = !selP ? 1 : selP === it.p ? 1.4 : 0.55;
      it.selF += (sT - it.selF) * kSel;

      // extinction: dim, flicker, die
      const lf = myr / it.ext;
      let lineLife = 1, beaconAmp = 1, deadK = 0;
      if (lf >= 1) {
        lineLife = 0.07; beaconAmp = 0; deadK = 1;
      } else if (lf > 0.7) {
        const d = (lf - 0.7) / 0.3;
        const flick = Math.sin(t * (16 + it.phase * 3)) * Math.sin(t * 7.3 + it.phase * 11);
        lineLife = 1 - d * 0.88;
        beaconAmp = (1 - d * 0.75) * (0.3 + 0.7 * Math.abs(flick));
        deadK = d * 0.5;
      }

      // lines
      // in the overlay, pull the engraved set back so modern reads against it
      const eOp = Math.min(1, 1.0 * engFade * actFade * it.selF * lineLife) * (1 - 0.3 * arcFade);
      const mOp = Math.min(1, 1.0 * modFade * actFade * it.selF * lineLife);
      const lkOp = 0.85 * arcFade * engFade * modFade * actFade * it.selF * lineLife * closeFade;
      it.link.material.opacity = lkOp;
      it.link.visible = lkOp > 0.005;
      it.eLine.material.opacity = eOp;
      it.mLine.material.opacity = mOp;
      it.eLine.visible = eOp > 0.005;
      it.mLine.visible = mOp > 0.005;
      // only visible endpoints should be clickable (tour filters on .visible)
      it.eHit.visible = it.eLine.visible;
      it.mHit.visible = it.mLine.visible;

      // beacon blink at the pulsar's (scaled) real period
      it.bph += (dt * state.timeScale) / it.dispPeriod;
      const pulse = Math.pow(0.5 + 0.5 * Math.sin(it.bph * TAU + it.phase), prefersReducedMotion ? 2 : 5);
      const inten = (0.22 + 0.9 * pulse) * beaconAmp;
      const boost = selP === it.p ? 1.5 : 1;
      const scl = (0.085 + 0.11 * pulse) * boost;

      it.eBeacon.material.color.lerpColors(GOLD_BEACON, EMBER, deadK);
      it.eBeacon.material.opacity = Math.min(1, inten * engFade * actFade * it.selF) * closeFade;
      it.eBeacon.scale.set(scl, scl, 1);
      it.eBeacon.visible = it.eBeacon.material.opacity > 0.004;

      it.mBeacon.material.color.lerpColors(STAR_BEACON, EMBER, deadK);
      it.mBeacon.material.opacity = Math.min(1, inten * modFade * actFade * it.selF) * closeFade;
      it.mBeacon.scale.set(scl, scl, 1);
      it.mBeacon.visible = it.mBeacon.material.opacity > 0.004;

      // dead: a tiny dark red-brown remnant
      it.remnant.material.opacity = (deadK >= 1 ? 0.8 : deadK * 0.25) * actFade * closeFade;
      it.remnant.visible = it.remnant.material.opacity > 0.004;

      // label, fading with distance
      const dist = camera.position.distanceTo(it.label.position);
      // Act V's camera sits far out — extend the label range so names still read
      const labelRange = curAct === 'finders' ? 6.5 : 3.2;
      const lOp = labelFade * actFade
        * Math.max(0, Math.min(0.85, labelRange / dist - 0.2))
        * Math.min(1, Math.max(0, (dist - 0.5) / 1.0)) // gone when the camera is up close (Earth zoom)
        * (selP && selP !== it.p ? 0.45 : 1);
      it.label.material.opacity = lOp;
      it.label.visible = lOp > 0.004;

      // error arc
      if (it.arc) {
        const aOp = 0.9 * arcFade * actFade * lineLife;
        it.arc.material.opacity = aOp;
        it.arc.visible = aOp > 0.005;
      }
    }

    // z-ticks belong to the engraved notation
    tickMat.opacity = 0.55 * engFade * actFade;
    ticks.visible = tickMat.opacity > 0.005;

    // depth cues appear with the labels (acts III+): stalks tie each star to
    // the plane; the rings anchor the plane itself
    eStalks.material.opacity = 0.2 * engFade * actFade * labelFade;
    eStalks.visible = eStalks.material.opacity > 0.005;
    mStalks.material.opacity = 0.2 * modFade * actFade * labelFade;
    mStalks.visible = mStalks.material.opacity > 0.005;
    ringGroup.userData.mat.opacity = 0.055 * actFade * labelFade;
    ringGroup.visible = ringGroup.userData.mat.opacity > 0.004;

    // Earth: fades in as the camera closes on the origin, spins slowly
    {
      const dist = camera.position.distanceTo(EARTH_POS);
      const near = Math.min(1, Math.max(0, (0.6 - dist) / 0.45)); // 0 beyond 0.6 kpc
      const eOpE = near * actFade;
      earth.material.opacity = eOpE;
      earth.visible = eOpE > 0.004;
      earthGlow.material.opacity = 0.5 * eOpE;
      earthGlow.visible = earth.visible;
      orbit.material.opacity = 0.3 * eOpE;
      orbit.visible = earth.visible;
      earthHit.visible = actFade > 0.05; // clickable whenever the map is up
      if (earth.visible && !prefersReducedMotion) earth.rotation.y += dt * 0.5;
    }

    // the Sun breathes, gently
    sunCore.material.opacity = actFade;
    sunHalo.material.opacity = actFade * (0.32 + (prefersReducedMotion ? 0 : 0.08 * Math.sin(t * 1.6)));
    const hs = 0.32 + (prefersReducedMotion ? 0 : 0.04 * Math.sin(t * 1.6));
    sunHalo.scale.set(hs, hs, 1);

    // galactic center
    gcHit.visible = actFade > 0.05;
    const gcBoost = selected === 'gc' ? 1.15 : selP ? 0.65 : 1;
    gcLine.material.opacity = Math.min(1, 0.85 * actFade * gcBoost);
    gcGlow.material.opacity = actFade * (0.4 + (prefersReducedMotion ? 0 : 0.06 * Math.sin(t * 0.9))) * gcBoost;

    // lighthouse beam on the selected pulsar
    beamFade += ((selP ? 1 : 0) - beamFade) * k;
    beam.visible = beamFade > 0.004;
    if (beam.visible && lastSelItem) {
      beam.position.copy(modFade > engFade ? lastSelItem.mEnd : lastSelItem.eEnd);
      // expanding ping, once per display blink of the selected pulsar
      const dispP = displayBlinkSeconds(lastSelItem.p);
      const phase = prefersReducedMotion ? 0.35 : (t % dispP) / dispP;
      const reach = Math.min(0.6, Math.max(0.12, beam.position.length() * 0.35));
      beam.scale.setScalar(0.02 + reach * phase);
      beamMat.opacity = 0.85 * (1 - phase) * beamFade * actFade;
    }
  }

  return { object3d: group, update };
}
