// The Golden Record — bootstrap and orchestration.
// Owns: renderer, camera, shared context (ctx), render loop, act definitions.
// Scene modules (starfield, record, map3d), UI (ui.js) and the tour (tour.js)
// plug into ctx and communicate only via ctx.bus events. See CONTRACTS.md.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PULSARS, R0_KPC, SUN_Z_KPC, MAP_EPOCH } from './data/pulsars.js';
import { pulsarXYZ, periodToBinary, driftPPM } from './astro.js';
import { createStarfield } from './starfield.js';
import { createRecord } from './record.js';
import { createVoyager } from './voyager.js';
import { createMap } from './map3d.js';
import { initUI } from './ui.js';
import { initTour } from './tour.js';

// ---- acts ------------------------------------------------------------
export const ACTS = [
  { id: 'record',  numeral: 'I',   title: 'The Record' },
  { id: 'map',     numeral: 'II',  title: 'The Map' },
  { id: 'pulsars', numeral: 'III', title: 'The Pulsars' },
  { id: 'verdict', numeral: 'IV',  title: 'Is It Wrong?' },
  { id: 'finders', numeral: 'V',   title: 'For the Finders' },
];

// ---- enriched pulsar data (positions in kpc, 1 scene unit = 1 kpc) ----
export const pulsars = PULSARS.map((p) => {
  const modern = pulsarXYZ(p, p.distModern);
  const engraved = pulsarXYZ(p, p.dist1977); // true direction, 1970s distance
  return {
    ...p,
    l: modern.l, b: modern.b,
    xyzModern: new THREE.Vector3(modern.x, modern.y, modern.z),
    xyz1977: new THREE.Vector3(engraved.x, engraved.y, engraved.z),
    binary: periodToBinary(p.periodEncoded),
    driftPPM: driftPPM(p),
  };
});

export const GC = new THREE.Vector3(R0_KPC, 0, -SUN_Z_KPC); // galactic center, kpc

// ---- three.js bootstrap ----------------------------------------------
const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050403);

// near plane 0.02 (not 0.001): a tighter depth range is what keeps coplanar
// geometry from z-fighting/shimmering while the camera moves
const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.02, 500);
camera.position.set(0, -4.2, 2.4);
camera.up.set(0, 0, 1); // galactic plane is the XY plane; +Z = north galactic pole

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxDistance = 60;
controls.minDistance = 0.02;

// ---- shared context ---------------------------------------------------
export const ctx = {
  THREE, scene, camera, renderer, controls, canvas,
  bus: new EventTarget(),
  state: {
    act: 'record',      // ACTS id
    selected: null,     // pulsar object from `pulsars`, or 'gc', or null
    timeMyr: 0,         // Act V slider, 0 = launch epoch
    mapMode: 'engraved',// 'engraved' | 'modern' | 'both'
    timeScale: 1,       // beacon blink speed multiplier
    artifact: false,    // persistent engraved-map overlay (Acts II–IV)
  },
  pulsars,
  GC,
  MAP_EPOCH,
  ACTS,
  prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  // ?still=1 — screenshot mode: the canonical Act I composition (record high,
  // probe close) with no UI chrome and no idle motion. Used to capture art/og.jpg.
  still: new URLSearchParams(location.search).has('still'),
};
if (ctx.still) document.body.classList.add('gm-still');

// helpers for modules
export function setAct(id) {
  if (ctx.state.act === id) return;
  ctx.state.act = id;
  ctx.bus.dispatchEvent(new CustomEvent('act', { detail: { act: id } }));
}
export function select(target) { // pulsar object | 'gc' | null
  ctx.state.selected = target;
  ctx.bus.dispatchEvent(new CustomEvent('select', { detail: { target } }));
}
export function setTimeMyr(myr) {
  ctx.state.timeMyr = myr;
  ctx.bus.dispatchEvent(new CustomEvent('timeMyr', { detail: { myr } }));
}
export function setMapMode(mode) {
  ctx.state.mapMode = mode;
  ctx.bus.dispatchEvent(new CustomEvent('mapmode', { detail: { mode } }));
}
export function setArtifact(v) {
  ctx.state.artifact = v;
  ctx.bus.dispatchEvent(new CustomEvent('artifact', { detail: { show: v } }));
}
ctx.setAct = setAct; ctx.select = select; ctx.setTimeMyr = setTimeMyr; ctx.setMapMode = setMapMode;
ctx.setArtifact = setArtifact;

// ---- assemble ----------------------------------------------------------
const modules = [];
function register(m) { if (m) modules.push(m); return m; }

const starfield = register(createStarfield(ctx));
const record = register(createRecord(ctx));
const voyager = register(createVoyager(ctx));
const map3d = register(createMap(ctx));
ctx.modules = { starfield, record, voyager, map3d };

for (const m of [starfield, record, voyager, map3d]) {
  if (m && m.object3d) scene.add(m.object3d);
}

register(initUI(ctx));
register(initTour(ctx));

// ---- loop ---------------------------------------------------------------
// debugging & verification hooks: __tick advances the scene deterministically
// even when the tab is hidden and requestAnimationFrame is throttled.
window.__ctx = ctx;
let simT = 0;
window.__tick = (n = 1, dt = 1 / 60) => {
  for (let i = 0; i < n; i++) {
    simT += dt;
    controls.update();
    for (const m of modules) if (m.update) m.update(dt, simT);
  }
  renderer.render(scene, camera);
};

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  controls.update();
  for (const m of modules) if (m.update) m.update(dt, t);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
