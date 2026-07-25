// The Golden Record — voyager.js
// Act I set dressing: the Voyager spacecraft itself, drifting in the middle
// distance behind the record. NASA's official model (public domain),
// meshopt-optimized from 3.1 MB to ~250 KB, served as vendor/art/voyager.glb.

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// Where the probe hovers on portrait phones (world units): in front of the
// disc's lower-left rim, ~1.6 units nearer the camera than the record itself,
// so it reads large and unmistakably in front of the gold.
const PHONE_DRIFT = [-0.39, -1.31, -0.22];

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
  let capPortrait = false; // phones draw the caption on a plate (see below)
  const drawCaption = () => {
    capC.clearRect(0, 0, CAP_W, CAP_H);
    // On phones the probe flies in front of the gold, so the invitation would
    // be gold-on-gold. Back it with the same dark plate the UI chips wear —
    // on desktop it stays plain text against the void, as before.
    if (capPortrait) {
      const x = 22, y = 6, w = CAP_W - 44, h = CAP_H - 12;
      capC.beginPath();
      if (capC.roundRect) capC.roundRect(x, y, w, h, h / 2);
      else capC.rect(x, y, w, h);
      capC.fillStyle = 'rgba(5, 4, 3, 0.88)';
      capC.fill();
      capC.strokeStyle = 'rgba(110, 90, 30, 0.95)';
      capC.lineWidth = 2;
      capC.stroke();
    }
    capC.font = '500 24px "IBM Plex Mono", ui-monospace, monospace';
    capC.textAlign = 'center';
    capC.textBaseline = 'middle';
    capC.fillStyle = '#c9a227';
    capC.fillText(capPortrait ? 'voyager · tap to inspect' : 'voyager · click to inspect',
      CAP_W / 2, CAP_H / 2 + 2);
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
  // (group.rotation is fixed set dressing, so this local vector is stable.)
  // On phones the probe sits lower in frame, so the invitation tucks closer
  // under it — far enough down to read, never far enough to reach the masthead.
  let capReady = false;
  const setCaptionOffset = (portrait) => {
    if (capReady && portrait === capPortrait) return;
    capReady = true;
    capPortrait = portrait;
    // clear of the model on phones (its tail hangs well below the pivot)
    caption.position.set(0, 0, portrait ? -0.95 : -1.1)
      .applyQuaternion(group.quaternion.clone().invert());
    // and set bigger there: at phone distances the 1-unit sprite renders its
    // line about seven pixels tall, which is not a legible invitation
    caption.scale.set(portrait ? 1.4 : 1.0, portrait ? 0.175 : 0.125, 1);
    drawCaption();
  };
  setCaptionOffset(false);
  group.add(caption);
  let capFade = 0; // eased caption visibility (drops to 0 while inspecting)

  // ---- act staging: visible in Act I, gone elsewhere ------------------------
  let fade = 1;
  let target = 1;
  bus.addEventListener('act', (e) => {
    target = e.detail.act === 'record' ? 1 : 0;
    hit.visible = e.detail.act === 'record'; // only clickable while in Act I
  });

  // While the inspection visit is active the probe holds still and the camera
  // becomes a 3D viewer around it — orbit, zoom and pan are OrbitControls',
  // aimed at the probe by tour.js (setInspect). Nothing model-specific here
  // any more: the conventions are the ones every 3D viewer already uses, so
  // a visitor can wander round the back, pull out, and find the record.
  let held = false;
  bus.addEventListener('select', (e) => {
    held = e.detail.target === 'voyager';
    canvas.style.cursor = held ? 'grab' : '';
  });
  const setGrabCursor = (down) => { if (held) canvas.style.cursor = down ? 'grabbing' : 'grab'; };
  canvas.addEventListener('pointerdown', () => setGrabCursor(true));
  window.addEventListener('pointerup', () => setGrabCursor(false));
  window.addEventListener('pointercancel', () => setGrabCursor(false));

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
        // screenshot mode: the probe rides the disc's lower-left edge, big,
        // dish up, boom sweeping across under the record
        group.position.set(-0.5, -1.02, -0.55);
        group.rotation.set(0.3, 2.5, 0.05);
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

      // Phones: the probe used to drift in the far upper-right, where the act
      // nav covered it — three-quarters off screen and easy to miss. It flies
      // beside the disc's lower-left now: clear of the nav and the masthead,
      // unmistakably there, but small enough that the RECORD is still the
      // centerpiece and the probe is the thing off to the side.
      const portrait = ctx.camera.aspect < 0.9;
      inner.scale.setScalar(portrait ? 0.78 : 1);
      setCaptionOffset(portrait);

      if (prefersReducedMotion) {
        // static portrait of the probe — no orbit, no tumble, no bob
        if (portrait) group.position.set(...PHONE_DRIFT);
        else group.position.set(2.6, 2.2, 1.15);
        return;
      }

      // slow tumble in flight; FULLY still while visited, so the user's drag
      // is the only motion and the spacecraft holds its pose under inspection
      if (!held) inner.rotation.y += dt * 0.06;

      if (held) return; // frozen mid-orbit while the camera pays its visit

      phase += dt * OMEGA;
      const cx = portrait ? PHONE_DRIFT[0] : 0.25;  // ellipse center, x/y
      const cy = portrait ? PHONE_DRIFT[1] : 2.6;   // (wide screens truck the camera left)
      const rx = portrait ? 0.18 : 2.2;   // radii — a slow hover on phones, not a
      const ry = portrait ? 0.18 : 1.1;   // lap: the whole probe must stay in frame
      const zc = portrait ? PHONE_DRIFT[2] : 1.5;   // gentle z drift
      const za = portrait ? 0.12 : 0.6;
      group.position.set(
        cx + rx * Math.cos(phase),
        cy + ry * Math.sin(phase),
        zc + za * Math.sin(phase * 2 + 0.6),
      );
    },
  };
}
