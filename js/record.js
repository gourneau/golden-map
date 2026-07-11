// The Golden Map — record.js
// Act I hero: the golden record, standing near the origin, slowly turning.
// Its face is black anodized with the pulsar map engraved in gold, drawn
// onto a CanvasTexture at runtime from the actual data. This module also
// owns the scene lighting (everything else is mostly unlit).

export function createRecord(ctx) {
  const { THREE, pulsars, GC, bus, prefersReducedMotion } = ctx;

  const group = new THREE.Group();
  group.name = 'record';
  group.rotation.x = -0.26; // tip the face gently toward the camera

  // ---- the engraved face (black anodized, gold lines) ----------------------
  function drawFace() {
    const S = 1024;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const c = cv.getContext('2d');
    const cx = S / 2, cy = S / 2, R = S / 2;

    c.fillStyle = '#070503';
    c.fillRect(0, 0, S, S);

    const ring = (r, w, alpha) => {
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.lineWidth = w;
      c.strokeStyle = `rgba(201, 162, 39, ${alpha})`;
      c.stroke();
    };

    // rim, the two "record grooves" rings, and a band of micro-grooves
    ring(R * 0.985, 4, 0.55);
    ring(R * 0.925, 2.5, 0.8);
    ring(R * 0.885, 1.5, 0.55);
    for (let r = R * 0.86; r > R * 0.78; r -= 5) ring(r, 1, 0.07);

    // one radial map line with binary tick-dash marks along it
    const mapLine = (angle, len, width, alpha, bits) => {
      const dx = Math.cos(angle), dy = -Math.sin(angle); // canvas y is down
      c.beginPath();
      c.moveTo(cx + dx * 10, cy + dy * 10);
      c.lineTo(cx + dx * len, cy + dy * len);
      c.lineWidth = width;
      c.strokeStyle = `rgba(201, 162, 39, ${alpha})`;
      c.stroke();
      if (!bits) return;
      // perpendicular ticks: long dash = 1, short = 0 (the engraved period)
      const px = Math.sin(angle), py = Math.cos(angle);
      c.lineWidth = 1.3;
      c.strokeStyle = 'rgba(201, 162, 39, 0.6)';
      for (let j = 0; j < bits.length; j++) {
        const d = 18 + j * 7;
        if (d > len - 5) break;
        const h = bits[j] === '1' ? 6 : 3;
        const x = cx + dx * d, y = cy + dy * d;
        c.beginPath();
        c.moveTo(x - px * h, y - py * h);
        c.lineTo(x + px * h, y + py * h);
        c.stroke();
      }
    };

    // the 14 pulsar lines: angle from the 3D direction projected onto the
    // record plane (galactic X right, galactic Z up), length ∝ dist1977
    for (const p of pulsars) {
      const v = p.xyz1977;
      const a = Math.atan2(v.z, v.x);
      const len = Math.max(R * 0.06, p.dist1977 * R * 0.072);
      mapLine(a, len, 2.2, 0.95, p.binary);
    }
    // the long galactic-center line
    mapLine(Math.atan2(GC.z, GC.x), R * 0.74, 2.6, 0.95, null);

    // hydrogen hyperfine glyph, simplified: two atoms, opposite spins
    const hx = cx - R * 0.54, hy = cy + R * 0.54, hr = R * 0.045;
    c.strokeStyle = 'rgba(201, 162, 39, 0.85)';
    c.fillStyle = 'rgba(201, 162, 39, 0.85)';
    c.lineWidth = 1.8;
    for (const s of [-1, 1]) {
      const ax = hx + s * hr * 1.35;
      c.beginPath(); c.arc(ax, hy, hr, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(ax, hy, 3, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(ax, hy); c.lineTo(ax, hy - s * hr * 0.85); c.stroke();
    }
    // the unit dash between them: "1"
    c.beginPath();
    c.moveTo(hx - 5, hy + hr * 1.7);
    c.lineTo(hx + 5, hy + hr * 1.7);
    c.stroke();

    // center hole
    c.beginPath();
    c.arc(cx, cy, R * 0.028, 0, Math.PI * 2);
    c.fillStyle = '#050403';
    c.fill();
    ring(R * 0.028, 2, 0.7);

    return cv;
  }

  // ---- the playing side: gold, finely grooved ------------------------------
  function drawBack() {
    const S = 512;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const c = cv.getContext('2d');
    const cx = S / 2, cy = S / 2;
    const g = c.createRadialGradient(cx, cy, 20, cx, cy, S / 2);
    g.addColorStop(0, '#caa63a');
    g.addColorStop(0.75, '#a9862a');
    g.addColorStop(1, '#8a6c1f');
    c.fillStyle = g;
    c.fillRect(0, 0, S, S);
    c.lineWidth = 1;
    for (let r = S * 0.48; r > S * 0.1; r -= 3) {
      c.beginPath();
      c.arc(cx, cy, r, 0, Math.PI * 2);
      c.strokeStyle = `rgba(40, 30, 8, ${0.05 + 0.1 * Math.random()})`;
      c.stroke();
    }
    c.beginPath();
    c.arc(cx, cy, S * 0.03, 0, Math.PI * 2);
    c.fillStyle = '#0a0806';
    c.fill();
    return cv;
  }

  const maxAniso = ctx.renderer.capabilities.getMaxAnisotropy();
  const faceTex = new THREE.CanvasTexture(drawFace());
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = maxAniso;
  const backTex = new THREE.CanvasTexture(drawBack());
  backTex.colorSpace = THREE.SRGBColorSpace;
  backTex.anisotropy = maxAniso;

  const sideMat = new THREE.MeshStandardMaterial({
    color: 0xc9a227, metalness: 0.9, roughness: 0.35, transparent: true,
  });
  const backMat = new THREE.MeshStandardMaterial({
    map: backTex, metalness: 0.9, roughness: 0.32, transparent: true,
  });
  const faceMat = new THREE.MeshStandardMaterial({
    map: faceTex, metalness: 0.6, roughness: 0.42, transparent: true,
    emissive: 0xc9a227, emissiveMap: faceTex, emissiveIntensity: 0.95,
  });

  // cylinder axis is +Y: side, top (+Y, away from camera), bottom (-Y, facing)
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 0.02, 128),
    [sideMat, backMat, faceMat]
  );
  group.add(disc);

  // ---- lighting (owned here; the rest of the scene is unlit) ---------------
  const key = new THREE.DirectionalLight(0xffe3a8, 2.4);
  key.position.set(2.5, -3.5, 3);
  const rim = new THREE.DirectionalLight(0x8fa8bd, 0.9);
  rim.position.set(-2.5, 3.5, 1.5);
  const ambient = new THREE.AmbientLight(0x2a2114, 1.6);
  group.add(key, rim, ambient);

  // ---- act staging ----------------------------------------------------------
  let fade = 1;        // current visibility 0..1
  let target = 1;      // where fade is headed
  let receding = false;

  bus.addEventListener('act', (e) => {
    const act = e.detail.act;
    target = act === 'record' ? 1 : 0;
    receding = act === 'map'; // Act II: recede slowly rather than vanish
  });

  function apply(t) {
    sideMat.opacity = backMat.opacity = faceMat.opacity = fade;
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
      apply(t);
    },

    setVisible(v) {
      target = v ? 1 : 0;
      receding = false;
    },
  };
}
