// The Golden Map — voyager.js
// Act I set dressing: the Voyager spacecraft itself, drifting in the middle
// distance behind the record. NASA's official model (public domain),
// meshopt-optimized from 3.1 MB to ~250 KB and embedded in js/data/.

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { voyagerGlbBuffer } from './data/voyagerModel.js';

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
  loader.parse(voyagerGlbBuffer(), '', (gltf) => {
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
  }, () => {}); // parse failure: Act I simply has no probe — never fatal

  // ---- act staging: visible in Act I, gone elsewhere ------------------------
  let fade = 1;
  let target = 1;
  bus.addEventListener('act', (e) => {
    target = e.detail.act === 'record' ? 1 : 0;
  });

  return {
    object3d: group,

    update(dt, t) {
      const rate = prefersReducedMotion ? 14 : 2.2;
      fade += (target - fade) * Math.min(1, dt * rate);
      if (Math.abs(target - fade) < 0.003) fade = target;
      group.visible = fade > 0.004;
      if (!group.visible) return;
      for (const m of mats) m.opacity = fade;
      // portrait screens lose the horizontal field the probe floats in —
      // tuck it above the disc instead so phones still get their spacecraft
      const portrait = ctx.camera.aspect < 0.9;
      const bx = portrait ? 0.55 : 2.6;
      const bz = portrait ? 2.1 : 1.15;
      group.position.x = bx;
      group.position.y = portrait ? 3.4 : 2.2;
      if (!prefersReducedMotion) {
        inner.rotation.y += dt * 0.06; // slow tumble
        group.position.z = bz + 0.06 * Math.sin(t * 0.21);
      } else {
        group.position.z = bz;
      }
    },
  };
}
