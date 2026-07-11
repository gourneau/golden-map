// The Golden Map — ui.js
// Owns ALL DOM inside #ui. Never touches three.js; speaks to the scene only
// through ctx methods and reflects state via ctx.bus events.
// All copy sourced from research/brief-raw.txt (Johnston; Sagan, Sagan & Drake
// 1972; Russel/DSES; Siegel 2017; ATNF). See the Sources disclosure in Act V.

import { extinctionMyr, displayBlinkSeconds } from './astro.js';
import { explanationSvg } from './data/coverArt.js';

export function initUI(ctx) {
  const { bus, pulsars, ACTS, state } = ctx;
  const root = document.getElementById('ui');

  // ---- tiny helpers -----------------------------------------------------
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const fmtDist = (kpc) =>
    kpc < 1 ? `${Math.round(kpc * 1000)} pc` : `${kpc.toFixed(kpc < 10 ? 2 : 1)} kpc`;
  const fmtPPM = (v) => {
    const a = Math.abs(v);
    return `${v < 0 ? '−' : '+'}${a < 10 ? a.toFixed(2) : a.toFixed(0)} ppm`;
  };
  const blinkSecs = (p) => displayBlinkSeconds(p);

  // ======================================================================
  // 1. ACT NAV
  // ======================================================================
  const nav = el('nav', 'gm-nav gm-panel is-on');
  nav.setAttribute('aria-label', 'Acts');
  const navRow = el('div', 'gm-nav-row');
  const actBtns = new Map();
  for (const a of ACTS) {
    const b = el('button', 'gm-act',
      `<span class="gm-act-n mono">${a.numeral}</span><span class="gm-act-t">${a.title}</span>`);
    b.addEventListener('click', () => ctx.setAct(a.id));
    actBtns.set(a.id, b);
    navRow.appendChild(b);
  }
  const progress = el('div', 'gm-nav-progress', '<i></i>');
  nav.append(navRow, progress);

  // ======================================================================
  // 2. TITLE CARD (Act I)
  // ======================================================================
  const title = el('section', 'gm-panel gm-title');
  title.dataset.acts = 'record';
  title.innerHTML = `
    <p class="eyebrow">Launched 1977 · Still transmitting silence</p>
    <h1>The Golden Map</h1>
    <p class="gm-hook">Two spacecraft are leaving the solar system carrying an
      engraved return address for Earth, written in the periods of fourteen
      dead stars. This is that map — reconstructed with modern data.</p>
    <button class="gm-begin mono">Begin — unfold the map&ensp;<span aria-hidden="true">→</span></button>`;
  title.querySelector('.gm-begin').addEventListener('click', () => ctx.setAct('map'));

  // ======================================================================
  // 3. EXPLAINER (Act II) + animated binary readout for line 1
  // ======================================================================
  const p0 = pulsars[0]; // B1727-47, line 1
  const explainer = el('section', 'gm-panel gm-sheet gm-left gm-explainer');
  explainer.dataset.acts = 'map';
  explainer.innerHTML = `
    <p class="eyebrow">Act II · How to read it</p>
    <h2>Fourteen clocks, one ruler</h2>
    <p class="gm-body">Every number on the record counts in a single unit: the
      period of the hydrogen hyperfine transition —
      <span class="mono engraved gm-nowrap">7.04024 × 10⁻¹⁰ s</span> —
      defined on the cover by two hydrogen atoms and the digit 1.</p>
    <ul class="gm-how">
      <li><b>The binary</b>Along each line, tick = 1 and dash = 0, most
        significant digit at the Sun: the pulsar’s spin period, counted in
        hydrogen units.</li>
      <li><b>The length</b>Each line’s length is the pulsar’s in-plane
        distance, relative to the long unnumbered fifteenth line — Sun to
        Galactic Center.</li>
      <li><b>The end tick</b>The short tick at a line’s end is its height off
        the galactic plane. The map is three-dimensional.</li>
      <li><b>The clock</b>Pulsars slow at known rates. Compare an engraved
        period with the observed one, and the map tells you when it was
        drawn.</li>
    </ul>
    <div class="gm-demo">
      <p class="eyebrow">Line 1 · decoding</p>
      <div class="gm-demo-ticks mono" aria-hidden="true"></div>
      <div class="gm-demo-bits mono" aria-label="binary readout"></div>
      <p class="gm-demo-result mono">× 0.704024 ns = 0.8296830 s →
        <span class="engraved">PSR B1727-47</span></p>
    </div>
    <details class="gm-cover-fig">
      <summary class="mono">The full cover, annotated — NASA/JPL</summary>
      <div class="gm-cover-fig-body"></div>
      <p class="gm-cover-fig-credit">Public domain, NASA/JPL — annotations outlined as vector paths.</p>
    </details>`;
  // the annotated cover diagram, recolored gold-on-dark (huge string — inject once)
  explainer.querySelector('.gm-cover-fig-body').innerHTML =
    explanationSvg().replace(/^[\s\S]*?(?=<svg)/, ''); // strip XML prolog for innerHTML
  const demoBox = explainer.querySelector('.gm-demo');
  const demoTicks = explainer.querySelector('.gm-demo-ticks');
  const demoBits = explainer.querySelector('.gm-demo-bits');

  const demo = { bits: p0.binary, i: 0, acc: 0, active: false };
  const STEP = 0.09; // seconds per bit
  function demoFinish() {
    demo.active = false;
    demoTicks.textContent = demo.bits.replace(/1/g, '|').replace(/0/g, '–');
    demoBits.textContent = demo.bits;
    demoBox.classList.remove('typing');
    demoBox.classList.add('is-done');
  }
  function demoStart() {
    demo.i = 0; demo.acc = 0;
    demoTicks.textContent = '';
    demoBits.textContent = '';
    demoBox.classList.remove('is-done');
    if (ctx.prefersReducedMotion) { demoFinish(); return; }
    demoBox.classList.add('typing');
    demo.active = true;
  }

  // ======================================================================
  // 4. PULSAR RAIL (Act III+)
  // ======================================================================
  const rail = el('section', 'gm-panel gm-sheet gm-rail');
  rail.dataset.acts = 'pulsars finders'; // hidden in Act IV so the verdict panel + map own the view
  rail.innerHTML = `
    <header class="gm-rail-head">
      <p class="eyebrow">The beacons · engraved order</p>
      <p class="gm-rail-note">each dot pulses its own period</p>
      <div class="gm-pulse-ctl" role="group" aria-label="Pulse rate">
        <span class="gm-k">pulse rate</span>
        <button class="gm-mode is-active" data-scale="1">slowed 20×</button>
        <button class="gm-mode" data-scale="4">slowed 5×</button>
        <button class="gm-mode" data-scale="20">true speed</button>
      </div>
    </header>`;
  const railList = el('div', 'gm-rail-list');
  rail.appendChild(railList);

  // pulse-rate control: scales the 3D beacon blink (ctx.state.timeScale, read
  // live by map3d) and the rail dots' CSS animation in step
  const pulseBtns = [...rail.querySelectorAll('.gm-pulse-ctl .gm-mode')];
  function setPulseScale(scale) {
    state.timeScale = scale;
    for (const b of pulseBtns) b.classList.toggle('is-active', +b.dataset.scale === scale);
    for (const d of railList.querySelectorAll('.gm-dot:not(.gm-dot-still)')) {
      d.style.animationDuration = `${Math.max(0.09, +d.dataset.base / scale).toFixed(3)}s`;
    }
  }
  for (const b of pulseBtns) b.addEventListener('click', () => setPulseScale(+b.dataset.scale));

  const rows = []; // { target, el }
  for (const p of pulsars) {
    const row = el('button', 'gm-row');
    row.innerHTML = `
      <span class="gm-row-n mono">${p.line}</span>
      <span class="gm-row-id">
        <span class="gm-row-name">${p.bname}</span>${p.alias ? `<span class="gm-row-alias">${p.alias}</span>` : ''}
        ${p.confidence === 'probable' ? '<span class="gm-row-conf">identification: probable</span>' : ''}
      </span>
      <span class="gm-row-p mono engraved">${p.periodEncoded.toFixed(8)} s</span>
      <span class="gm-dot" data-base="${blinkSecs(p).toFixed(3)}" style="animation-duration:${blinkSecs(p).toFixed(2)}s"></span>`;
    row.addEventListener('click', () => ctx.select(p));
    rows.push({ target: p, el: row });
    railList.appendChild(row);
  }
  {
    const gcRow = el('button', 'gm-row gm-row-gc');
    gcRow.innerHTML = `
      <span class="gm-row-n mono">15</span>
      <span class="gm-row-id">
        <span class="gm-row-name">Galactic Center</span>
        <span class="gm-row-conf">no number — sets the scale</span>
      </span>
      <span class="gm-row-p mono">—</span>
      <span class="gm-dot gm-dot-still"></span>`;
    gcRow.addEventListener('click', () => ctx.select('gc'));
    rows.push({ target: 'gc', el: gcRow });
    railList.appendChild(gcRow);
  }

  // mobile bottom-sheet toggle for the rail
  const railToggle = el('button', 'gm-panel gm-rail-toggle mono', '☰&ensp;the fourteen');
  railToggle.dataset.acts = 'pulsars finders';
  railToggle.setAttribute('aria-expanded', 'false');
  railToggle.addEventListener('click', () => {
    const open = rail.classList.toggle('sheet-open');
    railToggle.setAttribute('aria-expanded', String(open));
  });
  const closeSheet = () => {
    rail.classList.remove('sheet-open');
    railToggle.setAttribute('aria-expanded', 'false');
  };

  // ======================================================================
  // 5. DETAIL PANEL (right, on selection)
  // ======================================================================
  const detail = el('aside', 'gm-panel gm-sheet gm-detail');
  const detailClose = el('button', 'gm-close', '✕');
  detailClose.setAttribute('aria-label', 'Close details');
  detailClose.addEventListener('click', () => ctx.select(null));
  const detailBody = el('div', 'gm-detail-body');
  detail.append(detailClose, detailBody);

  const kv = (k, v, cls = '') =>
    `<div class="gm-kv"><span class="gm-k">${k}</span><span class="gm-v mono ${cls}">${v}</span></div>`;

  const FLAW_TEXT = {
    angle: (p) => `Engraved bearing off by ~${p.angleErrorDeg}°. The angle errors
      cluster on the map’s high-latitude pulsars — projection and reproduction
      effects, not bad 1971 astronomy.`,
    'spurious-precision': () => `Engraved to ~30 binary digits, though the period
      was known to only 3 significant figures in 1971 — spurious precision, the
      map’s one honest engraving error.`,
    swapped: () => `Russel’s reconstruction found the Crab and B0525+21 — only
      1.4° apart on the sky — positionally swapped relative to reality.`,
  };

  function renderDetail(target) {
    if (!target) return;
    if (target === 'gc') {
      detailBody.innerHTML = `
        <p class="eyebrow">The fifteenth line</p>
        <h2 class="gm-detail-name">Galactic Center</h2>
        <p class="gm-detail-sub mono">no binary number · the longest line</p>
        <p class="gm-body">The one line without a period. It runs from the Sun to
          the center of the galaxy, behind the pulsars, and does two jobs: it is
          the angular reference every bearing is measured against, and its length
          is the ruler — every other line is a fraction of this one.</p>
        ${kv('engraved rule', 'Sun → GC ≡ 1', 'engraved')}
        ${kv('modern value', '8.2 kpc', 'modern')}
        ${kv('sun off midplane', '+20.8 pc', 'modern')}
        <p class="gm-detail-note">Modern distance from the GRAVITY Collaboration
          (2019/2021); the Sun rides slightly above the galactic midplane.</p>`;
      return;
    }
    const p = target;
    detailBody.innerHTML = `
      <p class="eyebrow">Line ${p.line} of 14 · identification ${p.confidence}</p>
      <h2 class="gm-detail-name">${p.alias || p.bname}</h2>
      <p class="gm-detail-sub mono">PSR ${p.bname} · ${p.jname}</p>
      <p class="gm-k gm-bin-label">as engraved — period in hydrogen units</p>
      <p class="gm-bin mono">${p.binary}</p>
      ${kv('engraved period', `${p.periodEncoded.toFixed(8)} s`, 'engraved')}
      ${kv('ATNF catalogue period', `${p.periodModern} s`, 'modern')}
      ${kv(p.flaw === 'spurious-precision' ? 'period offset — mostly rounding' : 'spin-down drift', fmtPPM(p.driftPPM))}
      ${kv('engraved line length', fmtDist(p.dist1977), 'engraved')}
      ${kv('modern distance', fmtDist(p.distModern), 'modern')}
      <p class="gm-detail-note">${p.distNote}</p>
      ${kv('galactic', `ℓ ${p.l.toFixed(1)}° · b ${p.b.toFixed(1)}°`)}
      ${kv('RA / Dec', `${p.ra}&ensp;${p.dec}`)}
      <p class="gm-body gm-detail-story">${p.note}</p>
      ${p.flaw ? `<div class="gm-flaw"><p class="gm-flaw-label mono">flaw</p><p>${FLAW_TEXT[p.flaw](p)}</p></div>` : ''}`;
  }

  // ======================================================================
  // 6. VERDICT PANEL (Act IV)
  // ======================================================================
  const verdict = el('section', 'gm-panel gm-sheet gm-verdict');
  verdict.dataset.acts = 'verdict';
  verdict.innerHTML = `
    <p class="eyebrow">Act IV · The reckoning</p>
    <h2>So — is the map wrong?</h2>
    <p class="gm-verdict-lede">Partially — <em>but not the way the internet
      says.</em></p>

    <p class="gm-k gm-modes-label">show the map</p>
    <div class="gm-modes" role="group" aria-label="Map mode">
      <button class="gm-mode" data-mode="engraved">As engraved · 1969</button>
      <button class="gm-mode" data-mode="modern">As it really is</button>
      <button class="gm-mode" data-mode="both">Overlay both</button>
    </div>

    <h3 class="gm-block-h mono">What’s genuinely off</h3>
    <ul class="gm-list">
      <li>The line lengths. Distances are wrong by factors of 2–10× —
        superseded 1970s dispersion-measure data, not engraving error. Russel
        (DSES) measured over 220% average error; only 3 of the 14 lines come
        within 3%.</li>
      <li>Three bearings miss: B0950+08 by ~10.6°, B1642-03 by ~13.3°,
        B0823+26 by ~17.6°.</li>
      <li>The Crab and B0525+21 — 1.4° apart on the sky — sit positionally
        swapped.</li>
      <li>B1240-64’s period, known to 3 significant digits, was engraved to
        ~30 — spurious precision.</li>
    </ul>

    <h3 class="gm-block-h mono">What still works</h3>
    <ul class="gm-list">
      <li>Johnston (2007) identified all 14 pulsars from the engraved periods
        (one twin-period pair also needed line direction to separate),
        most matching to better than 1 ppm — and recovered the map’s epoch from
        spin-down: 1969.7 ± 1.2.</li>
      <li>Russel triangulated the Sun’s galactic position to within ~4% from
        the angles alone.</li>
    </ul>

    <h3 class="gm-block-h mono">The verdict</h3>
    <p class="gm-body">The strong claim — <em>reconstruct it and it points to the
      wrong place</em> — is a myth. Every documented reconstruction has
      succeeded. Siegel’s “hopelessly wrong” (Forbes, 2017) argues future decay
      over millions of years, and concedes the map was sound when it was
      made.</p>

    <div class="gm-crab">
      <p class="eyebrow">The Crab clock</p>
      <p class="gm-crab-f mono">P(t) = P₀ + Ṗ · Δt</p>
      <div class="gm-kv"><span class="gm-k">engraved P (1969.7)</span>
        <span class="gm-v mono engraved">0.03312964 s</span></div>
      <div class="gm-kv"><span class="gm-k">P(<span class="gm-crab-year">now</span>), spin-down applied</span>
        <span class="gm-v mono modern gm-crab-now">—</span></div>
      <p class="gm-crab-line">the drift <em>is</em> the date: 1969.7 ± 1.2</p>
    </div>`;

  const crab = pulsars.find((p) => p.alias === 'Crab');
  const EPOCH_MS = Date.UTC(1969, 0, 1) + 0.7 * 365.25 * 86400e3; // 1969.7
  const crabNowEl = verdict.querySelector('.gm-crab-now');
  verdict.querySelector('.gm-crab-year').textContent = String(new Date().getFullYear());
  const crabP = () => crab.periodEncoded + crab.pdot * (Date.now() - EPOCH_MS) / 1000;
  const paintCrab = () => { crabNowEl.textContent = `${crabP().toFixed(13)} s`; };
  paintCrab();

  const modeBtns = [...verdict.querySelectorAll('.gm-mode')];
  for (const b of modeBtns) b.addEventListener('click', () => ctx.setMapMode(b.dataset.mode));
  function paintMode(mode) {
    for (const b of modeBtns) b.classList.toggle('is-active', b.dataset.mode === mode);
  }
  paintMode(state.mapMode);

  // ======================================================================
  // 7. FINDERS PANEL (Act V) — time slider + waypoints + 8. sources
  // ======================================================================
  const K = Math.log10(101); // slider 0..100 -> 0..100 Myr, log-ish
  const vToMyr = (v) => Math.pow(10, (v * K) / 100) - 1;
  const myrToV = (m) => (100 * Math.log10(m + 1)) / K;
  const fmtMyr = (m) => (m < 0.05 ? '0' : m < 10 ? m.toFixed(1) : String(Math.round(m)));
  const eraLine = (m) => {
    if (m < 1) return 'All fourteen beacons burning. The map still reads.';
    if (m <= 10) return 'The periods have drifted. A finder must rewind the spin-down.';
    if (m <= 40) return 'The ordinary pulsars are guttering out.';
    if (m <= 90) return 'Most beacons dark. Only the geometry remains — and it is warping.';
    return 'Half a galactic orbit gone. Shear has torn the map apart. Home is unfindable.';
  };

  const finders = el('section', 'gm-panel gm-sheet gm-finders');
  finders.dataset.acts = 'finders';
  const tickMarks = [1, 10, 40, 100]
    .map((m) => `<span class="gm-tick" style="left:${myrToV(m).toFixed(1)}%">${m}</span>`)
    .join('');
  finders.innerHTML = `
    <p class="eyebrow">Act V · For the finders</p>
    <div class="gm-time-row mono">
      <span class="gm-tplus">T + 0 Myr</span>
      <span class="gm-beacons" title="Extinction times are illustrative — no peer-reviewed per-pulsar survival table exists">beacons still shining: 14/14</span>
    </div>
    <div class="gm-slider-wrap">
      <input class="gm-slider" type="range" min="0" max="100" step="0.1" value="0"
        aria-label="Time since launch, millions of years">
      <div class="gm-ticks" aria-hidden="true">${tickMarks}</div>
    </div>
    <p class="gm-era">${eraLine(0)}</p>
    <div class="gm-chips">
      <span class="gm-chip mono">40,272 AD — Voyager 1 passes 1.7 ly from Gliese 445</span>
      <span class="gm-chip mono">+296,000 yr — Voyager 2 passes 4.3 ly from Sirius</span>
    </div>
    <details class="gm-sources">
      <summary class="mono">Sources</summary>
      <ul>
        <li><a href="https://www.johnstonsarchive.net/astro/pulsarmap.html" target="_blank" rel="noopener">W. R. Johnston — Reading the Pioneer/Voyager pulsar map</a></li>
        <li><a href="https://www.science.org/doi/10.1126/science.175.4024.881" target="_blank" rel="noopener">Sagan, Sagan &amp; Drake — “A Message from Earth,” <em>Science</em> 175, 881 (1972)</a></li>
        <li><a href="https://science.nasa.gov/mission/voyager/golden-record-cover/" target="_blank" rel="noopener">NASA — Voyager Golden Record cover</a></li>
        <li><a href="https://www.atnf.csiro.au/research/pulsar/psrcat/" target="_blank" rel="noopener">ATNF Pulsar Catalogue</a></li>
        <li><a href="https://dses.science/wp-content/uploads/2020/04/18-Galactic-Navigation-using-the-Pioneer-Spacecraft-Pulsar-Map.pdf" target="_blank" rel="noopener">R. Russel — Galactic Navigation using the Pioneer Pulsar Map (DSES)</a></li>
        <li><a href="https://www.forbes.com/sites/startswithabang/2017/08/17/voyagers-cosmic-map-of-earths-location-is-hopelessly-wrong/" target="_blank" rel="noopener">E. Siegel — “…Hopelessly Wrong,” Forbes (2017)</a></li>
        <li><a href="https://www.nationalgeographic.com/magazine/article/nasa-sent-a-map-to-space-to-help-aliens-find-earth-now-it-needs-an-update" target="_blank" rel="noopener">National Geographic — S. Ransom on updating the map</a></li>
        <li>Cover artwork: NASA/JPL (public domain); vectorization VectorVoyager, Wikimedia Commons.</li>
      </ul>
    </details>`;

  const slider = finders.querySelector('.gm-slider');
  const tplusEl = finders.querySelector('.gm-tplus');
  const beaconsEl = finders.querySelector('.gm-beacons');
  const eraEl = finders.querySelector('.gm-era');
  function paintTime(myr) {
    tplusEl.textContent = `T + ${fmtMyr(myr)} Myr`;
    const n = pulsars.filter((p) => extinctionMyr(p) > myr).length;
    beaconsEl.textContent = `beacons still shining: ${n}/14`;
    eraEl.textContent = eraLine(myr);
  }
  slider.addEventListener('input', () => ctx.setTimeMyr(vToMyr(Number(slider.value))));

  // ======================================================================
  // 9. CORNER MARK (always present)
  // ======================================================================
  const corner = el('p', 'gm-panel gm-corner mono is-on',
    '1 unit = 1 kiloparsec · you are at the origin');

  // ---- assemble ---------------------------------------------------------
  root.append(nav, title, explainer, rail, railToggle, detail, verdict, finders, corner);

  // ---- act / selection plumbing ------------------------------------------
  const actPanels = [title, explainer, rail, railToggle, verdict, finders];
  const DETAIL_ACTS = new Set(['pulsars', 'verdict', 'finders']);

  function paintDetailVisibility() {
    detail.classList.toggle('is-on', !!state.selected && DETAIL_ACTS.has(state.act));
  }
  function applyAct(act) {
    for (const p of actPanels) p.classList.toggle('is-on', p.dataset.acts.includes(act));
    for (const [id, b] of actBtns) {
      b.classList.toggle('is-current', id === act);
      if (id === act) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    }
    const i = ACTS.findIndex((a) => a.id === act);
    progress.firstElementChild.style.width = `${(((i < 0 ? 0 : i) + 1) / ACTS.length) * 100}%`;
    closeSheet();
    if (act === 'map') demoStart();
    else demo.active = false;
    paintDetailVisibility();
  }

  bus.addEventListener('act', (e) => applyAct(e.detail.act));
  bus.addEventListener('select', (e) => {
    const target = e.detail.target;
    for (const r of rows) r.el.classList.toggle('is-selected', r.target === target);
    if (target) { renderDetail(target); closeSheet(); }
    paintDetailVisibility();
  });
  bus.addEventListener('mapmode', (e) => paintMode(e.detail.mode));
  bus.addEventListener('timeMyr', (e) => {
    const myr = e.detail.myr;
    if (document.activeElement !== slider) slider.value = String(myrToV(myr));
    paintTime(myr);
  });

  applyAct(state.act);
  paintTime(state.timeMyr);

  // ---- per-frame work -----------------------------------------------------
  let crabAcc = 0;
  function update(dt) {
    // binary readout types itself, tick by tick
    if (demo.active) {
      demo.acc += dt;
      while (demo.acc >= STEP && demo.i < demo.bits.length) {
        demo.acc -= STEP;
        const bit = demo.bits[demo.i++];
        demoTicks.textContent += bit === '1' ? '|' : '–';
        demoBits.textContent += bit;
      }
      if (demo.i >= demo.bits.length) demoFinish();
    }
    // the Crab clock ticks in its 13th decimal
    if (state.act === 'verdict' && !ctx.prefersReducedMotion) {
      crabAcc += dt;
      if (crabAcc >= 0.2) { crabAcc = 0; paintCrab(); }
    }
  }

  return { update };
}
