// The Golden Map — voyager.js
// Act I set dressing: the Voyager spacecraft itself, drifting in the middle
// distance behind the record. NASA's official model (public domain),
// meshopt-optimized from 3.1 MB to ~250 KB and embedded in js/data/.

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export function createVoyager(ctx) {
  const { THREE, bus, prefersReducedMotion, camera, canvas, controls } = ctx;

  const group = new THREE.Group();
  group.name = 'voyager';
  // upper-right middle distance, behind and beside the record, facing the
  // Act I camera obliquely so the dish reads
  group.position.set(2.6, 2.2, 1.15);
  group.rotation.set(0.35, -0.7, 0.1);

  const inner = new THREE.Group(); // model pivot (loaded async)
  group.add(inner);

  const mats = []; // for the fade
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load('vendor/art/voyager.glb', (gltf) => {
    const model = gltf.scene;
    // normalize: center the model, scale so its largest span ≈ 1.6 units
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const s = 1.6 / Math.max(size.x, size.y, size.z);
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center).multiplyScalar(s);
    model.scale.setScalar(s);
    model.traverse((o) => {
      if (o.isMesh && o.material) {
        o.material = o.material.clone(); // don't share with the loader cache
        o.material.transparent = true;
        // lift the model out of pitch-black: our scene is lit by record.js's
        // warm key; give the probe a whisper of self-illumination so its
        // shadowed side still silhouettes against the void
        if (o.material.emissive) {
          o.material.emissive.set(0x1a140a);
          o.material.emissiveIntensity = 1.0;
        }
        mats.push(o.material);
      }
    });
    inner.add(model);
  }, undefined, () => {}); // load failure: Act I simply has no probe — never fatal

  // ---- invisible pickable hit sphere ----------------------------------------
  // Same pattern as map3d's hitMat: a real mesh the tour's raycaster can hit,
  // but the material never draws. Carries userData.pulsar = 'voyager' so the
  // tour's click routing and ui.js's tooltip/detail card pick it up.
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), hitMat);
  hit.userData.pulsar = 'voyager';
  hit.visible = ctx.state.act === 'record'; // tour's raycast filters on .visible
  group.add(hit);
  let hitRegistered = false; // pushed into map3d's pickables once it exists

  // ---- caption: quiet invitation under the drifting probe --------------------
  // Canvas-drawn like map3d's labels: IBM Plex Mono, gold, tiny. Visible only
  // in Act I while the probe is unselected; fades with the group fade.
  const CAP_W = 512, CAP_H = 64;
  const capCanvas = document.createElement('canvas');
  capCanvas.width = CAP_W;
  capCanvas.height = CAP_H;
  const capC = capCanvas.getContext('2d');
  const capTex = new THREE.CanvasTexture(capCanvas);
  capTex.colorSpace = THREE.SRGBColorSpace;
  const drawCaption = () => {
    capC.clearRect(0, 0, CAP_W, CAP_H);
    capC.font = '500 24px "IBM Plex Mono", ui-monospace, monospace';
    capC.textAlign = 'center';
    capC.textBaseline = 'middle';
    capC.fillStyle = '#c9a227';
    capC.fillText('voyager · click to inspect', CAP_W / 2, CAP_H / 2 + 2);
    capTex.needsUpdate = true;
  };
  drawCaption();
  // crisp caption text once the webfont is in (same trick as map3d's labels)
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawCaption);
  const capMat = new THREE.SpriteMaterial({
    map: capTex, transparent: true, opacity: 0, depthWrite: false,
  });
  const caption = new THREE.Sprite(capMat);
  caption.scale.set(1.0, 0.125, 1); // canvas is 8:1
  caption.frustumCulled = false;
  caption.renderOrder = 6;
  // "below the probe" in SCREEN terms is roughly world -Z (camera.up is +Z, and
  // the Act I camera looks nearly level). The group carries a fixed decorative
  // rotation, so express that world offset in the group's local space once.
  caption.position.set(0, 0, -1.1).applyQuaternion(group.quaternion.clone().invert());
  group.add(caption);
  let capFade = 0; // eased caption visibility (drops to 0 while inspecting)

  // ---- act staging: visible in Act I, gone elsewhere ------------------------
  let fade = 1;
  let target = 1;
  bus.addEventListener('act', (e) => {
    target = e.detail.act === 'record' ? 1 : 0;
    hit.visible = e.detail.act === 'record'; // only clickable while in Act I
  });

  // While the inspection visit is active, hold still so the camera framing
  // stays stable; resume the orbit on deselect. The cursor becomes an open
  // hand — this is a "rotate the object" surface now, not a click target.
  let held = false;
  bus.addEventListener('select', (e) => {
    held = e.detail.target === 'voyager';
    if (!held) { dragId = null; velYaw = 0; velPitch = 0; } // no stale spin next visit
    canvas.style.cursor = held ? 'grab' : '';
  });

  // ---- inspect: arcball rotation + wheel dolly --------------------------------
  // While the probe is selected the tour disables OrbitControls entirely and
  // this module owns the gesture, model-viewer style: dragging rotates the
  // MODEL about the camera's screen axes (yaw about camera-up, pitch about
  // camera-right) — never the camera about a far-off target. All handlers
  // no-op unless `held` (i.e. ctx.state.selected === 'voyager').
  const ROT_PER_PX = 0.006;   // rad of model rotation per pixel of drag
  const INERTIA_TAU = 0.8;    // s — spin velocity e-folds in 0.8 s (~2.5 s to fade out)
  const DOLLY_MIN = 1.0;      // camera–probe distance clamps for the wheel dolly
  const DOLLY_MAX = 4.5;

  let dragId = null;            // active pointerId, or null
  let lastX = 0, lastY = 0;     // last pointer position (px)
  let lastMoveT = 0;            // ms timestamp of the last move, for velocity
  let velYaw = 0, velPitch = 0; // rad/s, carried into post-release inertia

  const _axis = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _qParentInv = new THREE.Quaternion();
  const _center = new THREE.Vector3();
  const _off = new THREE.Vector3();

  // Rotate the model pivot about the camera's world-space up (yaw) and right
  // (pitch) axes. premultiply on `inner` composes in its parent's (the group's)
  // space, so each world axis is transformed by the inverse of the group's
  // world quaternion first. Camera right/up come from matrixWorld columns 0/1.
  function rotateInner(yaw, pitch) {
    const e = camera.matrixWorld.elements;
    group.getWorldQuaternion(_qParentInv).invert();
    _axis.set(e[4], e[5], e[6]).normalize().applyQuaternion(_qParentInv); // camera up
    inner.quaternion.premultiply(_q.setFromAxisAngle(_axis, yaw));
    _axis.set(e[0], e[1], e[2]).normalize().applyQuaternion(_qParentInv); // camera right
    inner.quaternion.premultiply(_q.setFromAxisAngle(_axis, pitch));
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!held || e.button !== 0 || dragId !== null) return;
    dragId = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
    lastX = e.clientX;
    lastY = e.clientY;
    lastMoveT = performance.now();
    velYaw = 0; velPitch = 0; // grabbing the model kills any leftover spin
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!held || e.pointerId !== dragId) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    const yaw = dx * ROT_PER_PX;
    const pitch = dy * ROT_PER_PX;
    rotateInner(yaw, pitch);
    const now = performance.now();
    const dts = Math.max((now - lastMoveT) / 1000, 1 / 240);
    lastMoveT = now;
    velYaw = yaw / dts;
    velPitch = pitch / dts;
  });

  function endDrag(e) {
    if (e.pointerId !== dragId) return;
    dragId = null;
    if (held) canvas.style.cursor = 'grab';
    // no inertia under reduced motion; a long-stalled drag must not fling either
    if (prefersReducedMotion || performance.now() - lastMoveT > 120) {
      velYaw = 0; velPitch = 0;
    }
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // Wheel: dolly the camera along its axis to the probe, distance clamped.
  // Passive is fine — every event recomputes from the CURRENT distance, so
  // nothing accumulates. controls.target stays pinned at the probe center so
  // exiting inspect (OrbitControls re-enabled) is seamless.
  canvas.addEventListener('wheel', (e) => {
    if (!held) return;
    group.getWorldPosition(_center);
    _off.copy(camera.position).sub(_center);
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY; // line-mode → px-ish
    const dist = Math.min(DOLLY_MAX,
      Math.max(DOLLY_MIN, _off.length() * Math.exp(dy * 0.0011)));
    camera.position.copy(_center).addScaledVector(_off.normalize(), dist);
    controls.target.copy(_center);
  }, { passive: true });

  // ---- the graceful orbit ----------------------------------------------------
  // A slow, wide ellipse across the upper background of Act I. The Act I camera
  // sits at ~(0, -3.05, 0.95) looking at the origin, where the record disc
  // (radius 1) lives — so the orbit's y never dips below 1.4: the probe drifts
  // BEHIND the disc, never in front of it.
  const LAP_S = 110;                      // seconds per full lap
  const OMEGA = (Math.PI * 2) / LAP_S;
  let phase = 0;                          // orbit phase (only advances unheld)

  return {
    object3d: group,

    update(dt, t) {
      // Register the pickable once — main.js builds map3d AFTER voyager, so
      // the constructor can't do this. Guard against double-push too.
      if (!hitRegistered) {
        const pickables = ctx.modules?.map3d?.object3d?.userData?.pickables;
        if (pickables) {
          if (!pickables.includes(hit)) pickables.push(hit);
          hitRegistered = true;
        }
      }

      if (ctx.still) {
        // screenshot mode: the probe holds the hero pose beside the record
        group.position.set(0.72, -0.55, 0.28);
        group.rotation.set(0.1, 0.75, 0.02);
        caption.visible = false;
        return;
      }

      const rate = prefersReducedMotion ? 14 : 2.2;
      fade += (target - fade) * Math.min(1, dt * rate);
      if (Math.abs(target - fade) < 0.003) fade = target;
      group.visible = fade > 0.004;
      if (!group.visible) return;
      for (const m of mats) m.opacity = fade;

      // caption rides the group fade at ~half strength, and ducks out while
      // the probe is under inspection (its invitation has been accepted)
      const capRate = prefersReducedMotion ? 14 : 6;
      capFade += ((held ? 0 : 1) - capFade) * Math.min(1, dt * capRate);
      capMat.opacity = fade * capFade * 0.5;
      caption.visible = capMat.opacity > 0.01;

      // post-release inertia: the model keeps spinning, exponentially damped
      // (endDrag zeroes the velocity under prefersReducedMotion, so this idles)
      if (held && dragId === null && (velYaw !== 0 || velPitch !== 0)) {
        rotateInner(velYaw * dt, velPitch * dt);
        const k = Math.exp(-dt / INERTIA_TAU);
        velYaw *= k;
        velPitch *= k;
        if (Math.hypot(velYaw, velPitch) < 0.002) { velYaw = 0; velPitch = 0; }
      }

      // portrait screens lose the horizontal field the probe floats in —
      // compress the orbit toward the upper zone (higher z, tighter x) so
      // phones still get their spacecraft, clear of the disc and the sheets
      const portrait = ctx.camera.aspect < 0.9;

      if (prefersReducedMotion) {
        // static portrait of the probe — no orbit, no tumble, no bob
        if (portrait) group.position.set(0.55, 3.4, 2.1);
        else group.position.set(2.6, 2.2, 1.15);
        return;
      }

      // slow tumble in flight; FULLY still while visited, so the user's drag
      // is the only motion and the spacecraft holds its pose under inspection
      if (!held) inner.rotation.y += dt * 0.06;

      if (held) return; // frozen mid-orbit while the camera pays its visit

      phase += dt * OMEGA;
      const cx = portrait ? 0.55 : 0.25;  // ellipse center, x/y (wide screens truck the camera left)
      const cy = portrait ? 3.2 : 2.6;    // y stays ≥ 1.4 in both orientations
      const rx = portrait ? 0.9 : 2.2;    // radii
      const ry = portrait ? 0.9 : 1.1;
      const zc = portrait ? 2.15 : 1.5;   // gentle z drift: 0.9–2.1 (landscape)
      const za = portrait ? 0.45 : 0.6;
      group.position.set(
        cx + rx * Math.cos(phase),
        cy + ry * Math.sin(phase),
        zc + za * Math.sin(phase * 2 + 0.6),
      );
    },
  };
}
