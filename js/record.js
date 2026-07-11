// The Golden Map — record.js
// Act I hero: the golden record with the REAL engraved cover design.
// The face is the actual Voyager plaque artwork (public domain, NASA/JPL;
// vectorization VectorVoyager via Wikimedia Commons), rasterized from
// js/data/coverArt.js onto two coincident face textures:
//   - the gold face: dark engraving on bright mirror gold (Act I, the artifact)
//   - the night face: the same design as glowing gold lines on near-black
// Act I → II crossfades between them ("ignition") before map3d unfolds the
// lines into 3D. This module also owns the scene lighting (everything else
// is mostly unlit).

import { plaqueSvg, svgToDataUri } from './data/coverArt.js';

export function createRecord(ctx) {
  const { THREE, bus, prefersReducedMotion } = ctx;

  const group = new THREE.Group();
  group.name = 'record';
  group.rotation.x = -0.26; // tip the face gently toward the camera

  // ---- face bases (procedural, drawn immediately — never a blank frame) ----
  // The plaque SVG composites on top asynchronously when its Image loads.
  function drawFaceBase(goldMode) {
    const S = 2048;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const c = cv.getContext('2d');
    const cx = S / 2, cy = S / 2, R = S / 2;

    if (goldMode) {
      // mirror gold: specular core offset up-left so it reads as lit metal
      const g = c.createRadialGradient(
        cx - R * 0.32, cy - R * 0.38, R * 0.05,
        cx, cy, R * 1.12
      );
      g.addColorStop(0, '#fff3c4');
      g.addColorStop(0.28, '#f0c85a');
      g.addColorStop(0.55, '#e8b633');
      g.addColorStop(0.82, '#a97a1c');
      g.addColorStop(1, '#7a5510');
      c.fillStyle = g;
      c.fillRect(0, 0, S, S);

      // broad soft radial sheen streaks, like light fanning on a polished disc
      for (const [a0, spread, alpha] of [
        [-1.05, 0.30, 0.10],
        [0.55, 0.22, 0.07],
        [2.35, 0.34, 0.06],
      ]) {
        const steps = 7;
        for (let i = 0; i < steps; i++) {
          const w = spread * (1 - i / steps);
          c.beginPath();
          c.moveTo(cx, cy);
          c.arc(cx, cy, R, a0 - w, a0 + w);
          c.closePath();
          c.fillStyle = `rgba(255, 243, 196, ${(alpha / steps).toFixed(4)})`;
          c.fill();
        }
      }

      // fine concentric grooves over the outer band, very subtle
      c.lineWidth = 1.5;
      for (let r = R * 0.98; r > R * 0.36; r -= 6) {
        c.beginPath();
        c.arc(cx, cy, r, 0, Math.PI * 2);
        c.strokeStyle = `rgba(74, 50, 10, ${0.04 + 0.04 * Math.random()})`;
        c.stroke();
      }

      // smoother label-like disc region at the center
      const lg = c.createRadialGradient(
        cx - R * 0.08, cy - R * 0.1, R * 0.02,
        cx, cy, R * 0.34
      );
      lg.addColorStop(0, '#f4d476');
      lg.addColorStop(0.7, '#e2ae30');
      lg.addColorStop(1, '#c1902a');
      c.beginPath();
      c.arc(cx, cy, R * 0.33, 0, Math.PI * 2);
      c.fillStyle = lg;
      c.fill();
      c.lineWidth = 3;
      c.strokeStyle = 'rgba(74, 50, 10, 0.18)';
      c.stroke();
    } else {
      // night face: near-black with a faint warm vignette
      c.fillStyle = '#0a0805';
      c.fillRect(0, 0, S, S);
      const g = c.createRadialGradient(cx, cy, R * 0.1, cx, cy, R);
      g.addColorStop(0, 'rgba(58, 47, 20, 0.16)');
      g.addColorStop(0.6, 'rgba(58, 47, 20, 0.05)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
      c.fillStyle = g;
      c.fillRect(0, 0, S, S);
    }

    // spindle hole with a hub ring (both faces)
    c.beginPath();
    c.arc(cx, cy, R * 0.026, 0, Math.PI * 2);
    c.fillStyle = '#050403';
    c.fill();
    c.beginPath();
    c.arc(cx, cy, R * 0.036, 0, Math.PI * 2);
    c.lineWidth = 4;
    c.strokeStyle = goldMode ? 'rgba(74, 50, 10, 0.55)' : 'rgba(201, 162, 39, 0.5)';
    c.stroke();

    return cv;
  }

  // ---- the playing side: mirror gold, finely grooved ------------------------
  function drawBack() {
    const S = 1024;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const c = cv.getContext('2d');
    const cx = S / 2, cy = S / 2, R = S / 2;
    const g = c.createRadialGradient(
      cx - R * 0.3, cy - R * 0.35, R * 0.05,
      cx, cy, R * 1.1
    );
    g.addColorStop(0, '#fff3c4');
    g.addColorStop(0.3, '#efc554');
    g.addColorStop(0.6, '#e8b633');
    g.addColorStop(1, '#7a5510');
    c.fillStyle = g;
    c.fillRect(0, 0, S, S);
    c.lineWidth = 1;
    for (let r = S * 0.49; r > S * 0.08; r -= 3) {
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.strokeStyle = `rgba(74, 50, 10, ${0.04 + 0.06 * Math.random()})`;
      c.stroke();
    }
    c.beginPath();
    c.arc(cx, cy, S * 0.026, 0, Math.PI * 2);
    c.fillStyle = '#0a0806';
    c.fill();
    return cv;
  }

  const maxAniso = ctx.renderer.capabilities.getMaxAnisotropy();
  const makeTex = (canvas) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    return tex;
  };

  const goldCanvas = drawFaceBase(true);
  const nightCanvas = drawFaceBase(false);
  const goldTex = makeTex(goldCanvas);
  const nightTex = makeTex(nightCanvas);
  const backTex = makeTex(drawBack());

  // ---- composite the real cover design onto both faces (async) -------------
  // viewBox is "106 261 505 500": the disk is a circle inscribed in the box
  // (diameter 500, the box height). Scale uniformly so the SVG's disk rim
  // meets the canvas circle rim (canvas circle radius = S/2), center it; the
  // ~5 extra SVG units of width are harmless overflow.
  function compositeSvg(canvas, tex, stroke) {
    const img = new Image();
    img.onload = () => {
      const c = canvas.getContext('2d');
      const S = canvas.width;
      const s = S / 500; // disk diameter 500 SVG units → full canvas
      const w = 505 * s, h = 500 * s;
      c.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
      tex.needsUpdate = true;
    };
    img.onerror = () => {}; // procedural base still looks fine
    img.src = svgToDataUri(plaqueSvg({ stroke, disk: 'none' }));
  }
  compositeSvg(goldCanvas, goldTex, '#3e3220');  // dark engraving on gold
  compositeSvg(nightCanvas, nightTex, '#c9a227'); // glowing lines on black

  // ---- materials -------------------------------------------------------------
  const sideMat = new THREE.MeshStandardMaterial({
    color: 0xe8b633, metalness: 1.0, roughness: 0.3, transparent: true,
  });
  const backMat = new THREE.MeshStandardMaterial({
    map: backTex, metalness: 1.0, roughness: 0.25, transparent: true,
  });
  // bottom cap sits behind the two face circles; keep it dark so the
  // mid-crossfade blend reads as the gold dimming into night
  const capMat = new THREE.MeshStandardMaterial({
    color: 0x0a0805, metalness: 0.4, roughness: 0.6, transparent: true,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    // fully-metallic PBR with no envMap renders near-black, so the painted
    // mirror-gold gradient carries the shine: self-illuminate it instead
    map: goldTex, metalness: 0.35, roughness: 0.5, transparent: true,
    emissive: 0xfff2d0, emissiveMap: goldTex, emissiveIntensity: 0.78,
  });
  const nightMat = new THREE.MeshStandardMaterial({
    map: nightTex, metalness: 0.4, roughness: 0.5, transparent: true,
    emissive: 0xc9a227, emissiveMap: nightTex, emissiveIntensity: 1.0,
  });

  // cylinder axis is +Y: side, top (+Y, away from camera), bottom (-Y, facing)
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 0.02, 128),
    [sideMat, backMat, capMat]
  );
  group.add(disc);

  // two coincident face circles, children of the disc so they spin with it.
  // CircleGeometry faces +Z; rotation.x = +PI/2 turns the front toward -Y
  // (the camera side) without mirroring the design.
  const faceGeo = new THREE.CircleGeometry(1, 128);
  const goldFace = new THREE.Mesh(faceGeo, goldMat);
  goldFace.rotation.x = Math.PI / 2;
  goldFace.position.y = -0.01 - 0.0015;
  const nightFace = new THREE.Mesh(faceGeo, nightMat);
  nightFace.rotation.x = Math.PI / 2;
  nightFace.position.y = -0.01 - 0.003;
  disc.add(goldFace, nightFace);

  // ---- lighting (owned here; the rest of the scene is unlit) ---------------
  const key = new THREE.DirectionalLight(0xffe8b0, 3.2);
  key.position.set(2.5, -3.5, 3);
  const rim = new THREE.DirectionalLight(0x8fa8bd, 0.9);
  rim.position.set(-2.5, 3.5, 1.5);
  const ambient = new THREE.AmbientLight(0x2a2114, 1.9);
  group.add(key, rim, ambient);

  // ---- act staging ----------------------------------------------------------
  let fade = 1;         // overall visibility 0..1
  let target = 1;       // where fade is headed
  let receding = false;
  let igniteMix = 0;    // 0 = engraved gold artifact, 1 = glowing night face
  let igniteTarget = 0;

  bus.addEventListener('act', (e) => {
    const act = e.detail.act;
    target = act === 'record' ? 1 : 0;
    receding = act === 'map'; // Act II: recede slowly rather than vanish
    igniteTarget = act === 'record' ? 0 : 1;
  });

  function apply(t) {
    sideMat.opacity = backMat.opacity = capMat.opacity = fade;
    goldMat.opacity = fade * (1 - igniteMix);
    nightMat.opacity = fade * igniteMix;
    group.position.y = (1 - fade) * 2.4; // drift away from the camera
    if (!prefersReducedMotion) {
      group.position.z = 0.03 * Math.sin(t * 0.5) * fade;
    }
    group.scale.setScalar(0.7 + 0.3 * fade);
    group.visible = fade > 0.004;
  }
  apply(0);

  return {
    object3d: group,

    update(dt, t) {
      disc.rotation.y += dt * (prefersReducedMotion ? 0.02 : 0.12);
      const rate = prefersReducedMotion ? 14 : (target > fade ? 2.4 : receding ? 1.1 : 2.8);
      fade += (target - fade) * Math.min(1, dt * rate);
      if (Math.abs(target - fade) < 0.003) fade = target;
      // the ignition crossfade: ~1.2s into Act II, quicker back to Act I
      if (prefersReducedMotion) {
        igniteMix = igniteTarget;
      } else if (igniteTarget > igniteMix) {
        igniteMix = Math.min(igniteTarget, igniteMix + dt / 1.2);
      } else {
        igniteMix = Math.max(igniteTarget, igniteMix - dt / 0.5);
      }
      apply(t);
    },

    setVisible(v) {
      target = v ? 1 : 0;
      receding = false;
    },
  };
}
