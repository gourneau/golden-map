// The Golden Map — starfield.js
// Deep-space backdrop: ~6000 twinkling point stars on a far sphere,
// concentrated along the galactic plane (the XY plane; +Z is the north
// galactic pole), plus a warm, faint glow far beyond the galactic center.
// Deliberately dim — the void must stay near-black.

export function createStarfield(ctx) {
  const { THREE, GC, prefersReducedMotion } = ctx;

  const group = new THREE.Group();
  group.name = 'starfield';

  // ---- stars -------------------------------------------------------------
  const COUNT = 6000;
  const positions = new Float32Array(COUNT * 3);
  const aColor = new Float32Array(COUNT * 3);
  const aSize = new Float32Array(COUNT);
  const aPhase = new Float32Array(COUNT);

  // cheap approximate gaussian, mean 0, sd ~0.29
  const gauss = () =>
    (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 0.5;

  for (let i = 0; i < COUNT; i++) {
    const inBand = Math.random() < 0.68;
    let l, b;
    if (inBand) {
      // Milky Way band: tight latitude spread, mild pile-up toward the center
      l = Math.random() < 0.3 ? gauss() * 1.1 : Math.random() * Math.PI * 2;
      b = gauss() * 0.16;
    } else {
      l = Math.random() * Math.PI * 2;
      b = Math.asin(Math.random() * 2 - 1);
    }
    const r = 132 + Math.random() * 42;
    const cb = Math.cos(b);
    positions[i * 3] = r * cb * Math.cos(l);
    positions[i * 3 + 1] = r * cb * Math.sin(l);
    positions[i * 3 + 2] = r * Math.sin(b);

    // mostly faint warm whites, a scattering of gold-tinted stars
    const v = 0.10 + Math.pow(Math.random(), 2.4) * 0.55;
    if (Math.random() < 0.08) {
      aColor[i * 3] = v;
      aColor[i * 3 + 1] = v * 0.82;
      aColor[i * 3 + 2] = v * 0.46;
    } else {
      aColor[i * 3] = v;
      aColor[i * 3 + 1] = v * (0.94 + Math.random() * 0.04);
      aColor[i * 3 + 2] = v * (0.86 + Math.random() * 0.08);
    }
    aSize[i] = 0.5 + Math.pow(Math.random(), 3) * 1.7;
    aPhase[i] = Math.random() * Math.PI * 2;
  }

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeo.setAttribute('aColor', new THREE.BufferAttribute(aColor, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
  starGeo.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1));

  const starMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aPhase;
      uniform float uTime;
      varying vec3 vColor;
      void main() {
        float tw = 0.74 + 0.26 * sin(uTime * (0.35 + fract(aPhase * 0.31) * 1.35) + aPhase);
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

  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false; // the sphere surrounds the camera
  stars.renderOrder = -10;
  group.add(stars);

  // ---- galactic-center glow, far beyond the map's GC ----------------------
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
  broad.position.copy(gcDir).multiplyScalar(150);
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
  core.position.copy(gcDir).multiplyScalar(149);
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
