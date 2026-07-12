// The Golden Map — voyager.js
// Act I set dressing: the Voyager spacecraft itself, drifting in the middle
// distance behind the record. NASA's official model (public domain),
// meshopt-optimized from 3.1 MB to ~250 KB and embedded in js/data/.

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

export function createVoyager(ctx) {
  const { THREE, bus, prefersReducedMotion } = ctx;

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

  // ---- easter egg: invisible pickable hit sphere ---------------------------
  // Same pattern as map3d's hitMat: a real mesh the tour's raycaster can hit,
  // but the material never draws. Carries userData.pulsar = 'voyager' so the
  // tour's click routing and ui.js's tooltip/detail card pick it up.
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), hitMat);
  hit.userData.pulsar = 'voyager';
  hit.visible = ctx.state.act === 'record'; // tour's raycast filters on .visible
  group.add(hit);
  let hitRegistered = false; // pushed into map3d's pickables once it exists

  // ---- act staging: visible in Act I, gone elsewhere ------------------------
  let fade = 1;
  let target = 1;
  bus.addEventListener('act', (e) => {
    target = e.detail.act === 'record' ? 1 : 0;
    hit.visible = e.detail.act === 'record'; // only clickable while in Act I
  });

  // While the easter-egg visit is active, hold still so the camera framing
  // stays stable; resume the orbit on deselect.
  let held = false;
  bus.addEventListener('select', (e) => {
    held = e.detail.target === 'voyager';
  });

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

      const rate = prefersReducedMotion ? 14 : 2.2;
      fade += (target - fade) * Math.min(1, dt * rate);
      if (Math.abs(target - fade) < 0.003) fade = target;
      group.visible = fade > 0.004;
      if (!group.visible) return;
      for (const m of mats) m.opacity = fade;

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

      inner.rotation.y += dt * (held ? 0.015 : 0.06); // slow tumble, near-still while visited

      if (held) return; // frozen mid-orbit while the camera pays its visit

      phase += dt * OMEGA;
      const cx = portrait ? 0.55 : 0.8;   // ellipse center, x/y
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
