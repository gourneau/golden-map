// The Golden Map — starfield.js
// Deep-space backdrop: the REAL night sky. Every star brighter than apparent
// magnitude 4.5 (~925 stars, HYG database v3 — Hipparcos/Yale BSC/Gliese,
// David Nash, astronexus.com, CC BY-SA) is placed on the far backdrop sphere
// at its true J2000 direction, converted to the scene's galactic frame with
// the same math the pulsars use (js/astro.js). Brightness follows magnitude,
// tint follows B-V. A faint procedural Milky Way band and the warm glow at
// the true galactic-center direction complete it. Deliberately dim — the
// void must stay near-black.

import { equatorialToGalactic } from './astro.js';

const CATALOG_URL = 'vendor/data/brightstars.json';
const SKY_R = 150; // backdrop sphere radius (scene units = kpc; pure direction)

// B-V color index -> subtle, desaturated tint (fits the gold-on-black page):
// blue-white below 0, white near 0.3, warm yellow near 0.8, orange-red past 1.4.
const BV_RAMP = [
  [-0.30, 0.74, 0.81, 0.93],
  [0.30, 0.90, 0.89, 0.87],
  [0.80, 0.93, 0.86, 0.70],
  [1.40, 0.94, 0.76, 0.55],
];
function bvColor(ci, out, o) {
  const t = Math.min(Math.max(ci, BV_RAMP[0][0]), BV_RAMP[BV_RAMP.length - 1][0]);
  let i = 0;
  while (i < BV_RAMP.length - 2 && t > BV_RAMP[i + 1][0]) i++;
  const [t0, r0, g0, b0] = BV_RAMP[i];
  const [t1, r1, g1, b1] = BV_RAMP[i + 1];
  const k = (t - t0) / (t1 - t0);
  out[o] = r0 + (r1 - r0) * k;
  out[o + 1] = g0 + (g1 - g0) * k;
  out[o + 2] = b0 + (b1 - b0) * k;
}

export function createStarfield(ctx) {
  const { THREE, GC, prefersReducedMotion } = ctx;

  const group = new THREE.Group();
  group.name = 'starfield';

  // one twinkle shader shared by the catalog stars and the Milky Way band
  const starMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aPhase;
      uniform float uTime;
      varying vec3 vColor;
      void main() {
        float tw = 0.78 + 0.22 * sin(uTime * (0.35 + fract(aPhase * 0.31) * 1.35) + aPhase);
        vColor = aColor * tw;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (280.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        float a = smoothstep(0.5, 0.08, length(gl_PointCoord - vec2(0.5)));
        gl_FragColor = vec4(vColor * a, 1.0);
      }`,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });

  function makePoints(geo) {
    const pts = new THREE.Points(geo, starMat);
    pts.frustumCulled = false; // the sphere surrounds the camera
    pts.renderOrder = -10;
    group.add(pts);
    return pts;
  }

  // ---- real stars: HYG catalog, mag <= 4.5, at true directions ------------
  // rows: [raDeg, decDeg, mag, ci]. Geometry is built when the JSON arrives;
  // until then (or if fetch is unavailable, e.g. file://) the backdrop is just
  // the band + glow — no error, no placeholder randomness.
  function buildCatalog(rows) {
    const n = rows.length;
    const positions = new Float32Array(n * 3);
    const aColor = new Float32Array(n * 3);
    const aSize = new Float32Array(n);
    const aPhase = new Float32Array(n);
    const D2R = Math.PI / 180;

    for (let i = 0; i < n; i++) {
      const [raDeg, decDeg, mag, ci] = rows[i];
      // same J2000 equatorial -> galactic conversion as the pulsars
      const { l, b } = equatorialToGalactic(raDeg, decDeg);
      const lr = l * D2R, br = b * D2R;
      const cb = Math.cos(br);
      // scene galactic frame: X toward the GC, Y toward l=90°, Z toward the NGP
      positions[i * 3] = SKY_R * cb * Math.cos(lr);
      positions[i * 3 + 1] = SKY_R * cb * Math.sin(lr);
      positions[i * 3 + 2] = SKY_R * Math.sin(br);

      // brightness ∝ flux = 10^(-0.4·mag), compressed and clamped so Sirius
      // reads as "brightest", not as a flare
      const rel = Math.pow(10, -0.4 * (mag - 4.5)); // 1 (limit) .. ~240 (Sirius)
      const v = Math.min(0.12 + 0.10 * Math.pow(rel, 0.42), 0.85);
      bvColor(ci, aColor, i * 3);
      aColor[i * 3] *= v;
      aColor[i * 3 + 1] *= v;
      aColor[i * 3 + 2] *= v;

      aSize[i] = Math.min(Math.max(0.9 + 0.42 * (4.5 - mag), 0.7), 2.8);
      // deterministic per-star twinkle phase (stable across loads)
      aPhase[i] = (Math.abs(Math.sin(raDeg * 12.9898 + decDeg * 78.233)) * 43758.5453) % (Math.PI * 2);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(aColor, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1));
    makePoints(geo);
  }

  if (typeof fetch === 'function') {
    fetch(CATALOG_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`brightstars: HTTP ${r.status}`);
        return r.json();
      })
      .then(buildCatalog)
      .catch(() => {}); // degrade gracefully: band + glow only
  }

  // ---- Milky Way band: faint procedural haze along the galactic plane -----
  // (unresolved starlight — this part is impressionistic by design, and even
  // dimmer than before so the real stars carry the sky)
  {
    const COUNT = 2600;
    const positions = new Float32Array(COUNT * 3);
    const aColor = new Float32Array(COUNT * 3);
    const aSize = new Float32Array(COUNT);
    const aPhase = new Float32Array(COUNT);

    // cheap approximate gaussian, mean 0, sd ~0.29
    const gauss = () =>
      (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 0.5;

    for (let i = 0; i < COUNT; i++) {
      // tight latitude spread, mild pile-up toward the center
      const l = Math.random() < 0.3 ? gauss() * 1.1 : Math.random() * Math.PI * 2;
      const b = gauss() * 0.16;
      const r = SKY_R + 4 + Math.random() * 22; // just beyond the catalog shell
      const cb = Math.cos(b);
      positions[i * 3] = r * cb * Math.cos(l);
      positions[i * 3 + 1] = r * cb * Math.sin(l);
      positions[i * 3 + 2] = r * Math.sin(b);

      const v = 0.045 + Math.pow(Math.random(), 2.6) * 0.20;
      aColor[i * 3] = v;
      aColor[i * 3 + 1] = v * (0.94 + Math.random() * 0.04);
      aColor[i * 3 + 2] = v * (0.86 + Math.random() * 0.08);
      aSize[i] = 0.4 + Math.pow(Math.random(), 3) * 1.1;
      aPhase[i] = Math.random() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(aColor, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1));
    makePoints(geo);
  }

  // ---- galactic-center glow, far beyond the map's GC ----------------------
  // (GC direction is (1,0,~0) in this frame — the glow marks the real thing)
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

  const gcDir = GC.clone().normalize();

  const broadMat = new THREE.SpriteMaterial({
    map: glowTexture(256, [
      [0, 'rgba(242, 212, 120, 0.55)'],
      [0.35, 'rgba(201, 162, 39, 0.18)'],
      [1, 'rgba(201, 162, 39, 0)'],
    ]),
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const broad = new THREE.Sprite(broadMat);
  broad.position.copy(gcDir).multiplyScalar(SKY_R);
  broad.scale.set(70, 44, 1);
  broad.renderOrder = -9;
  group.add(broad);

  const coreMat = new THREE.SpriteMaterial({
    map: glowTexture(128, [
      [0, 'rgba(255, 240, 200, 0.9)'],
      [0.4, 'rgba(242, 212, 120, 0.25)'],
      [1, 'rgba(242, 212, 120, 0)'],
    ]),
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const core = new THREE.Sprite(coreMat);
  core.position.copy(gcDir).multiplyScalar(SKY_R - 1);
  core.scale.set(16, 12, 1);
  core.renderOrder = -9;
  group.add(core);

  // ---- module ---------------------------------------------------------------
  return {
    object3d: group,
    update(dt, t) {
      if (prefersReducedMotion) return;
      starMat.uniforms.uTime.value = t;
      broadMat.opacity = 0.3 + 0.03 * Math.sin(t * 0.31);
      coreMat.opacity = 0.35 + 0.05 * Math.sin(t * 0.47 + 1.3);
    },
  };
}
