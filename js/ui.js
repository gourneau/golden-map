// The Golden Record — ui.js
// Owns ALL DOM inside #ui. Never touches three.js; speaks to the scene only
// through ctx methods and reflects state via ctx.bus events.
// Every scientific claim in this copy was verified against primary sources
// (July 2026): ATNF v2.8.1, the parallax papers on ADS, Johnston 2007,
// Russel/DSES 2019, NASA/JPL. The Act V Sources panel carries the full list;
// per-pulsar provenance lives in js/data/pulsars.js. Keep them in sync when
// copy changes — never publish an uncited number.

import { extinctionMyr, displayBlinkSeconds } from './astro.js';
import { loadText, explanationSvg } from './assets.js';

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
  // light-years first, kiloparsecs second (1 kpc = 3,262 ly).
  // ly rounded to 2 significant figures, with thousands separators.
  const fmtLy = (kpc) => {
    const ly = Number((kpc * 3262).toPrecision(2));
    return `≈ ${ly.toLocaleString('en-US')} ly (${Number(kpc.toPrecision(3))} kpc)`;
  };
  // live ATNF Pulsar Catalogue ephemeris for one pulsar — the primary source
  // for every modern period, pdot, age, and position on this page
  const atnfUrl = (jname) =>
    `https://www.atnf.csiro.au/research/pulsar/psrcat/proc_form.php?version=latest&startUserDefined=true&pulsar_names=${encodeURIComponent(jname)}&ephemeris=long&submit_ephemeris=Get+Ephemeris&state=query`;
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
  // prev/next act arrows book-ending the nav — a visible hint that ←/→ work.
  // They clamp at the first/last act (no wrap-around), same as the keys.
  const navArrow = (dir) => {
    const b = el('button', 'gm-nav-arrow', dir < 0 ? '&lsaquo;' : '&rsaquo;');
    b.title = 'arrow keys work too';
    b.setAttribute('aria-label', dir < 0 ? 'Previous act (left arrow key)' : 'Next act (right arrow key)');
    b.addEventListener('click', () => {
      const ids = ACTS.map((a) => a.id);
      const j = ids.indexOf(state.act) + dir;
      if (j >= 0 && j < ids.length) ctx.setAct(ids[j]);
    });
    return b;
  };
  const prevArrow = navArrow(-1);
  const nextArrow = navArrow(1);
  navRow.prepend(prevArrow);
  navRow.appendChild(nextArrow);
  const progress = el('div', 'gm-nav-progress', '<i></i>');
  // compact-nav act title (≤560px, where the buttons show numerals only) —
  // sits under the progress hairline so the hairline never shifts
  const navTitle = el('div', 'gm-nav-title');
  navTitle.setAttribute('aria-hidden', 'true'); // aria-current on the button already says it
  nav.append(navRow, progress, navTitle);

  // ======================================================================
  // 2. TITLE CARD (Act I)
  // ======================================================================
  const title = el('section', 'gm-panel gm-title');
  title.dataset.acts = 'record';
  title.innerHTML = `
    <p class="eyebrow">Launched 1977 · Now in interstellar space</p>
    <h1>The Golden Record</h1>
    <p class="gm-tagline">Earth’s address, written in dying stars</p>
    <p class="gm-hook">In 1977, NASA launched two spacecraft carrying a golden
      record. Engraved on it: a map that shows any finder where Earth is,
      using fourteen flashing stars as landmarks. This is that map — rebuilt
      with today’s data.</p>
    <button class="gm-begin mono">Begin — unfold the map&ensp;<span aria-hidden="true">→</span></button>
    <button class="gm-hello mono" title="the record’s English greeting — from NASA’s official stream">
      <span class="gm-hello-ic" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M4 2l10 6-10 6z"/></svg></span>
      <span>“Hello from the children of planet Earth”</span>
    </button>`;
  title.querySelector('.gm-begin').addEventListener('click', () => ctx.setAct('map'));

  // ======================================================================
  // 3. EXPLAINER (Act II) + animated binary readout for line 1
  // ======================================================================
  const p0 = pulsars[0]; // B1727-47, line 1
  const explainer = el('section', 'gm-panel gm-sheet gm-left gm-explainer');
  explainer.dataset.acts = 'map';
  explainer.innerHTML = `
    <p class="eyebrow">Act II · How the map works</p>
    <h2>How do you draw a map an alien could read?</h2>
    <p class="gm-body">Someday, someone might find this spacecraft — maybe
      millions of years from now, maybe someone not from Earth. NASA wanted
      them to know where it came from. But how? No shared language. No shared
      numbers. Not even a shared idea of a “year.”</p>
    <p class="gm-body">The answer: use landmarks the whole galaxy can see.
      A pulsar is the burnt-out core of an exploded star. It spins, sweeping
      a radio beam past us like a lighthouse — flashing at its own perfectly
      steady rate. No two flash alike. So a flash rate works like a name tag,
      anywhere in the galaxy. This map points to fourteen of them.</p>
    <p class="gm-body">And for a unit of time, the map uses hydrogen — the
      most common atom in the universe. Hydrogen ticks at one exact rate,
      everywhere, for everyone. Any chemist in the galaxy could measure it.
      That tick is the map’s ruler.</p>
    <p class="gm-fine">The tick is drawn on the cover as two hydrogen atoms
      and the digit 1. Its value: <span class="mono gm-nowrap">7.04024 × 10⁻¹⁰
      seconds</span>. Every number on the record counts in this unit.</p>
    <ul class="gm-how">
      <li><b>The binary</b>The marks along each line spell a number: how fast
        that star flashes. Long tick = 1, short dash = 0.</li>
      <li><b>The length</b>Longer line = farther away. Everything is measured
        against the long line pointing to the center of the galaxy.</li>
      <li><b>The end tick</b>The small mark at each line’s end: how far the
        star sits above or below the galaxy’s flat disc. The map is 3D.</li>
      <li><b>The clock</b>Pulsars slow down over time, at known rates. So the
        map also tells you <em>when</em> it was made.</li>
    </ul>
    <div class="gm-demo">
      <p class="eyebrow">Line 1 · decoding</p>
      <div class="gm-demo-ticks mono" aria-hidden="true"></div>
      <div class="gm-demo-bits mono" aria-label="binary readout"></div>
      <p class="gm-demo-result mono">× 0.704024 ns = 0.8296830 s →
        <span class="engraved">PSR B1727-47</span></p>
    </div>
    <details class="gm-cover-fig" open>
      <summary class="mono">The full cover, annotated — NASA/JPL</summary>
      <div class="gm-cover-fig-body"></div>
      <p class="gm-cover-fig-credit">Public domain, NASA/JPL — annotations outlined as vector paths.</p>
    </details>`;
  // the annotated cover diagram, recolored gold-on-dark — a plain static file,
  // fetched when needed and injected once
  loadText('vendor/art/voyager_cover_explanation.svg').then((raw) => {
    explainer.querySelector('.gm-cover-fig-body').innerHTML =
      explanationSvg(raw).replace(/^[\s\S]*?(?=<svg)/, ''); // strip XML prolog for innerHTML
  }).catch(() => {});
  const demoBox = explainer.querySelector('.gm-demo');
  const demoTicks = explainer.querySelector('.gm-demo-ticks');
  const demoBits = explainer.querySelector('.gm-demo-bits');

  // The panel is always expanded on desktop (the old collapse-to-a-side-tab
  // toggle reframed the camera and felt jumpy — removed); at ≤900px it is a
  // bottom sheet. tour.js still needs to know which framing to use.
  const isSheetMode = () => window.innerWidth <= 900;
  const explainerOpen = () => !isSheetMode();
  function emitLayout() {
    bus.dispatchEvent(new CustomEvent('uilayout', { detail: { explainerOpen: explainerOpen() } }));
  }

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
  // Act III only: Act IV belongs to the verdict panel, and Act V's finders
  // panel gets the space for its own content instead of a repeat of this table
  rail.dataset.acts = 'pulsars';
  rail.innerHTML = `
    <header class="gm-rail-head">
      <p class="eyebrow">The beacons · engraved order</p>
      <p class="gm-rail-note">each dot pulses its own period · click one for its story</p>
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
  railToggle.dataset.acts = 'pulsars';
  railToggle.setAttribute('aria-expanded', 'false');
  // while the sheet is open the toggle rides above it as the closer — it
  // must never float over the list rows
  const paintRailToggle = (open) => {
    railToggle.setAttribute('aria-expanded', String(open));
    railToggle.innerHTML = open ? '✕&ensp;close' : '☰&ensp;the fourteen';
  };
  railToggle.addEventListener('click', () => {
    paintRailToggle(rail.classList.toggle('sheet-open'));
  });
  const closeSheet = () => {
    rail.classList.remove('sheet-open');
    paintRailToggle(false);
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

  const kv = (k, v, cls = '', vTitle = '') =>
    `<div class="gm-kv"><span class="gm-k">${k}</span><span class="gm-v mono ${cls}"${vTitle ? ` title="${vTitle}"` : ''}>${v}</span></div>`;

  const FLAW_TEXT = {
    angle: (p) => `Engraved bearing off by ~${p.angleErrorDeg}°. The angle errors
      cluster on the map’s high-latitude pulsars — projection and reproduction
      effects, not bad 1971 astronomy.`,
    'spurious-precision': () => `Engraved to ~30 binary digits, though the period
      was known to only 3 significant figures in 1971 — spurious precision, the
      map’s one honest engraving error.`,
    swapped: () => `Russel’s reconstruction found the Crab and B0525+21 — only
      1.3° apart on the sky — positionally swapped relative to reality.`,
  };

  function renderDetail(target) {
    if (!target) return;
    if (target === 'voyager') {
      detailBody.innerHTML = `
        <p class="eyebrow">The messenger</p>
        <h2 class="gm-detail-name">Voyager</h2>
        <p class="gm-detail-sub mono">the messenger itself · NASA 3D model</p>
        <p class="gm-body">Two of these were launched in 1977 — Voyager 1 and
          Voyager 2. Each carries a golden record bolted to its side, with
          this map engraved on the cover. They are the farthest human-made
          objects in existence, and they are still going.</p>
        ${kv('launched', '1977 — and still flying')}
        ${kv('distance today', 'over 15 billion miles')}
        ${kv('power left', 'science operations into the 2030s')}
        <p class="gm-detail-note">The big dish points back at Earth. Below it
          sits the record. Long after the transmitters fall silent, the map
          rides on.</p>
        <p class="gm-k" style="margin-top:0.8em">drag to rotate the spacecraft · scroll to zoom · esc to leave</p>
        <p class="gm-fine">Spacecraft model: NASA (public domain), from NASA’s
          3D resources — simplified for the web. Voyager 1 is ~170 AU out
          (JPL Horizons, 2026), the farthest spacecraft from Earth.</p>`;
      return;
    }
    if (target === 'earth') {
      detailBody.innerHTML = `
        <p class="eyebrow">You are here</p>
        <h2 class="gm-detail-name">Earth</h2>
        <p class="gm-detail-sub mono">the point every line converges on</p>
        <p class="gm-body">This is what the map is for. Fourteen lines, read
          anywhere in the galaxy, all cross at one unremarkable yellow star —
          and the third planet out is home. Everyone who has ever lived,
          everything on both Voyager records, started here.</p>
        ${kv('distance from the Sun', '≈ 8 light-minutes')}
        ${kv('place on the map', 'the center — by construction')}
        <p class="gm-detail-note">Enormously not to scale: drawn at true scale,
          Earth would be about a billion times smaller than this little globe —
          far tinier than a single pixel.</p>
        <p class="gm-fine">On the engraved map the origin is really the Sun;
          at galactic scale the Sun and Earth are the same point. The blue
          globe is a marker, not a measurement.</p>`;
      return;
    }
    if (target === 'gc') {
      detailBody.innerHTML = `
        <p class="eyebrow">The fifteenth line</p>
        <h2 class="gm-detail-name">Galactic Center</h2>
        <p class="gm-detail-sub mono">no binary number · the longest line</p>
        <p class="gm-body">The one line without a period. It runs from the Sun to
          the center of the galaxy, behind the pulsars, and does two jobs: every
          other line’s angle is measured from it, and its length is the ruler —
          every other line is a fraction of this one.</p>
        ${kv('engraved rule', 'Sun → GC ≡ 1', 'engraved')}
        ${kv('modern value', fmtLy(8.28), 'modern')}
        ${kv('sun off midplane', '≈ 68 ly (20.8 pc)', 'modern')}
        <p class="gm-detail-note">The Sun doesn’t sit exactly in the flat disc
          of the galaxy — it rides slightly above it.</p>
        <p class="gm-fine">Modern Sun-to-center distance 8.277 ± 0.009 kpc,
          from the GRAVITY Collaboration’s orbit tracking of stars around the
          central black hole (2022, A&amp;A 657, L12); the Sun’s height above
          the galactic midplane is ≈ 20.8 pc (Bennett &amp; Bovy 2019).</p>`;
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
      ${kv(p.flaw === 'spurious-precision' ? 'period offset — mostly rounding' : 'spin-down drift', fmtPPM(p.driftPPM), '', 'parts per million')}
      ${kv('engraved line length', fmtLy(p.dist1977), 'engraved')}
      ${kv('modern distance', fmtLy(p.distModern), 'modern')}
      <p class="gm-detail-note">${p.distNote}</p>
      ${p.fineNote ? `<p class="gm-fine">${p.fineNote}</p>` : ''}
      ${p.refs ? `<p class="gm-fine gm-refs">${[
        ...p.refs.map((r) => `<a href="${r.u}" target="_blank" rel="noopener">${r.t}</a>`),
        `<a href="${atnfUrl(p.jname)}" target="_blank" rel="noopener">ATNF catalogue entry</a>`,
      ].join(' · ')}</p>` : ''}
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
    <p class="gm-body">Some of it is out of date. But it still works: all
      fourteen stars can be identified, and the map still points home.</p>

    <p class="gm-k gm-modes-label">show the map</p>
    <div class="gm-modes" role="group" aria-label="Map mode">
      <button class="gm-mode" data-mode="engraved">As engraved · 1969</button>
      <button class="gm-mode" data-mode="modern">As it really is</button>
      <button class="gm-mode" data-mode="both">Overlay both</button>
    </div>

    <h3 class="gm-block-h mono">What’s genuinely off</h3>
    <ul class="gm-list">
      <li>The line lengths are the real problem. In 1977, nobody knew these
        distances well. Most stars are really much closer — or much farther —
        than the map says.
        <span class="gm-fine">Off by roughly 2–10×: superseded 1970s
          dispersion-measure data, not an engraving mistake. Russel (DSES)
          found over 220% error between the drawn lengths and the real
          distances; only 3 of the 14 line lengths come within 3%.</span></li>
      <li>Three lines point a few degrees in the wrong direction.
        <span class="gm-fine">B0950+08 by ~10.6°, B1642-03 by ~13.4°,
          B0823+26 by ~17.6° (Johnston 2007, map vs. modern positions) — the
          three pulsars sitting farthest above the galaxy’s flat disc.</span></li>
      <li>Two neighboring stars got swapped — each drawn in the other’s place.
        <span class="gm-fine">Russel’s reconstruction found B0531+21 (Crab) and
          B0525+21 — only 1.3° apart on the sky — positionally swapped
          relative to reality.</span></li>
      <li>One number was written with more digits than anyone actually knew.
        <span class="gm-fine">B1240-64’s period, known to 3 significant digits
          in 1971, was engraved to ~30 binary digits — spurious
          precision.</span></li>
    </ul>

    <h3 class="gm-block-h mono">What still works</h3>
    <ul class="gm-list">
      <li>In 2007, a researcher took only the engraved numbers — and found all
        fourteen stars. The numbers even revealed <em>when</em> the map was
        made: 1969.7 ± 1.2.
        <span class="gm-fine">Johnston (2007): ten of the fourteen decoded
          periods match the 1975 pulsar catalogue to better than 0.4 ppm
          (parts per million); the young, fast pulsars differ by exactly
          their five years of spin-down — averaging that drift across the
          clocks is what dates the map to 1969.7 ± 1.2.</span></li>
      <li>Another study used only the line directions — and located the Sun
        to within 4%.
        <span class="gm-fine">Russel (DSES) triangulated the Sun’s galactic
          position using only the engraved bearings.</span></li>
    </ul>

    <h3 class="gm-block-h mono">The verdict</h3>
    <p class="gm-body">The internet claim — <em>“read the map and it points to
      the wrong place”</em> — is a myth. Every real attempt to read it has
      worked. The drawing has flaws. The address is still good.</p>
    <details class="gm-fine-more">
      <summary>for the technically curious</summary>
      <p class="gm-fine">Siegel’s “hopelessly wrong” (Forbes, 2017) — the likely
        source of the meme — argues future decay over millions of years, and
        concedes the map was sound when it was made. The substantive
        reconstructions on record, Johnston (2007) and Russel (DSES, 2019),
        both succeeded.</p>
    </details>

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
    if (m < 1) return 'All fourteen beacons burning. A finder today — or in a million years — could still read this.';
    if (m <= 10) return 'The flash rates have drifted. A finder would need to wind the clocks back.';
    if (m <= 40) return 'The ordinary stars are going dark, one by one.';
    if (m <= 90) return 'Most beacons are dead. And the map’s shape is starting to warp.';
    return 'Half a lap around the galaxy. The map has been torn apart. Home is unfindable.';
  };

  const finders = el('section', 'gm-panel gm-sheet gm-finders');
  finders.dataset.acts = 'finders';
  const tickMarks = [1, 10, 40, 100]
    .map((m) => `<span class="gm-tick" style="left:${myrToV(m).toFixed(1)}%">${m}</span>`)
    .join('');
  finders.innerHTML = `
    <p class="eyebrow">Act V · For the finders</p>
    <p class="gm-body gm-finders-intro">This map was built to be read
      <em>millions of years</em> from now. For its first million years, it
      stays basically perfect. Drag time forward and watch how long Earth’s
      address lasts.</p>
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
    <details class="gm-drake" open>
      <summary class="mono">The man who drew the map</summary>
      <p class="gm-body">One person drew both. In 1961, Frank Drake wrote a
        famous equation. It asks a simple question: <em>how many alien
        civilizations could we talk to?</em> Ten years later, he drew this
        map. First he asked who might be listening. Then he made the address
        label for them to find us.</p>
      <p class="gm-drake-eq mono">N = R★ · f<sub>p</sub> · n<sub>e</sub> · f<sub>l</sub> · f<sub>i</sub> · f<sub>c</sub> · L</p>
      <div class="gm-drake-n">N ≈ <b class="gm-drake-count mono">—</b></div>
      <p class="gm-drake-nsub">civilizations in the Milky Way we could talk to right now</p>
      <div class="gm-drake-presets" role="group" aria-label="Seed with a famous estimate"></div>
      <div class="gm-drake-x"></div>
      <p class="gm-fine gm-drake-note">Every dial past f<sub>p</sub> is still argued
        about — the presets are one common reading of each camp, and the 1961
        Green Bank numbers were ranges. That’s the fun: drag and see.</p>
      <p class="gm-drake-tie">The last term, <em>L</em>, is the question this
        map asks back — how long does anyone stay findable?</p>
    </details>
    <details class="gm-sources">
      <summary class="mono">Sources — every number on this page, checked</summary>
      <p class="gm-fine gm-sources-note">Every scientific value on this page
        was checked against the sources below in July 2026 — the catalogue
        entries and papers, not summaries of them. Each pulsar’s card links
        to its own distance measurement and live catalogue entry.</p>
      <p class="gm-src-h mono">The map itself</p>
      <ul>
        <li><a href="https://doi.org/10.1126/science.175.4024.881" target="_blank" rel="noopener">Sagan, Salzman Sagan &amp; Drake — “A Message from Earth,” <em>Science</em> 175, 881 (1972)</a> — the paper that introduced the pulsar map, by the people who made it.</li>
        <li><a href="https://science.nasa.gov/mission/voyager/golden-record-cover/" target="_blank" rel="noopener">NASA — Voyager Golden Record cover</a> — NASA’s own explanation of the cover, including the hydrogen time unit and the binary periods.</li>
        <li><a href="https://www.pbs.org/the-farthest/science/pulsar-map/" target="_blank" rel="noopener">PBS, <em>The Farthest</em> — How to read a pulsar map</a> — Drake’s design, the 14 lines + galactic-center line.</li>
      </ul>
      <p class="gm-src-h mono">Reading the map back (the reconstructions)</p>
      <ul>
        <li><a href="https://www.johnstonsarchive.net/astro/pulsarmap.html" target="_blank" rel="noopener">W. R. Johnston — Reading the Pioneer/Voyager pulsar map (2003, updated 2007)</a> — decoded all 14 pulsars from the engraving; source of the engraved periods, line-length distances, the three bearing errors, and the 1969.7 ± 1.2 date.</li>
        <li><a href="https://dses.science/wp-content/uploads/2020/04/18-Galactic-Navigation-using-the-Pioneer-Spacecraft-Pulsar-Map.pdf" target="_blank" rel="noopener">R. Russel — Galactic Navigation using the Pioneer Spacecraft Pulsar Map (DSES, 2019)</a> — triangulated the Sun’s position to ~4% from line directions alone; source of the &gt;220% length error and the Crab/B0525+21 swap.</li>
        <li><a href="https://ui.adsabs.harvard.edu/abs/1975AJ.....80..794T/abstract" target="_blank" rel="noopener">Taylor &amp; Manchester 1975, AJ 80, 794</a> — the 147-pulsar catalogue Johnston matched the decoded periods against.</li>
      </ul>
      <p class="gm-src-h mono">Modern pulsar data (“as it really is”)</p>
      <ul>
        <li><a href="https://www.atnf.csiro.au/research/pulsar/psrcat/" target="_blank" rel="noopener">ATNF Pulsar Catalogue</a> (<a href="https://ui.adsabs.harvard.edu/abs/2005AJ....129.1993M/abstract" target="_blank" rel="noopener">Manchester et al. 2005</a>), v2.8.1, queried July 2026 — every modern period, spin-down rate, age, position, and best distance shown here.</li>
        <li>Distance measurements, per pulsar (also linked on each card):
          <a href="https://ui.adsabs.harvard.edu/abs/1990Natur.343..240B/abstract" target="_blank" rel="noopener">Bailes et al. 1990</a>,
          <a href="https://ui.adsabs.harvard.edu/abs/2002ApJ...571..906B/abstract" target="_blank" rel="noopener">Brisken et al. 2002</a>,
          <a href="https://ui.adsabs.harvard.edu/abs/2004ApJ...604..339C/abstract" target="_blank" rel="noopener">Chatterjee et al. 2004</a>,
          <a href="https://ui.adsabs.harvard.edu/abs/2009ApJ...698..250C/abstract" target="_blank" rel="noopener">Chatterjee et al. 2009</a>,
          <a href="https://ui.adsabs.harvard.edu/abs/2003ApJ...596.1137D/abstract" target="_blank" rel="noopener">Dodson et al. 2003</a> (Vela),
          <a href="https://ui.adsabs.harvard.edu/abs/2019ApJ...875..100D/abstract" target="_blank" rel="noopener">Deller et al. 2019 (PSRπ)</a> — radio-interferometric parallaxes;
          <a href="https://ui.adsabs.harvard.edu/abs/2012ApJ...755...39V/abstract" target="_blank" rel="noopener">Verbiest et al. 2012</a> — distance bias corrections;
          <a href="https://ui.adsabs.harvard.edu/abs/2017ApJ...835...29Y/abstract" target="_blank" rel="noopener">Yao et al. 2017 (YMW16)</a> and
          <a href="https://arxiv.org/abs/astro-ph/0207156" target="_blank" rel="noopener">Cordes &amp; Lazio 2002 (NE2001)</a> — electron-density models;
          <a href="https://ui.adsabs.harvard.edu/abs/1968AJ.....73..535T/abstract" target="_blank" rel="noopener">Trimble 1968</a> (Crab Nebula);
          <a href="https://ui.adsabs.harvard.edu/abs/2019ApJ...877...78S/abstract" target="_blank" rel="noopener">Shternin et al. 2019</a> (B1727-47’s remnant).</li>
      </ul>
      <p class="gm-src-h mono">Galaxy geometry &amp; constants</p>
      <ul>
        <li><a href="https://ui.adsabs.harvard.edu/abs/2022A%26A...657L..12G/abstract" target="_blank" rel="noopener">GRAVITY Collaboration 2022, A&amp;A 657, L12</a> — Sun → Galactic Center = 8.277 ± 0.009 kpc (and <a href="https://ui.adsabs.harvard.edu/abs/2019A%26A...625L..10G/abstract" target="_blank" rel="noopener">2019, A&amp;A 625, L10</a>).</li>
        <li><a href="https://ui.adsabs.harvard.edu/abs/2019MNRAS.482.1417B/abstract" target="_blank" rel="noopener">Bennett &amp; Bovy 2019, MNRAS 482, 1417</a> — the Sun sits 20.8 ± 0.3 pc above the galactic midplane.</li>
        <li><a href="https://ui.adsabs.harvard.edu/abs/1970ITIM...19..200H/abstract" target="_blank" rel="noopener">Hellwig et al. 1970</a> — the hydrogen 21 cm hyperfine frequency, 1,420,405,751.77 Hz: the map’s time unit.</li>
      </ul>
      <p class="gm-src-h mono">Voyager</p>
      <ul>
        <li><a href="https://science.nasa.gov/mission/voyager/frequently-asked-questions/" target="_blank" rel="noopener">NASA — Voyager FAQ</a> — Voyager 1 passes 1.7 ly from Gliese 445 in ~40,272 AD; <a href="https://www.jpl.nasa.gov/videos/whats-up-march-2020/" target="_blank" rel="noopener">JPL</a> — Voyager 2 passes 4.3 ly from Sirius in ~296,000 yr; distances from <a href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noopener">JPL Horizons</a>.</li>
      </ul>
      <p class="gm-src-h mono">The “hopelessly wrong” debate</p>
      <ul>
        <li><a href="https://www.forbes.com/sites/startswithabang/2017/08/17/voyagers-cosmic-map-of-earths-location-is-hopelessly-wrong/" target="_blank" rel="noopener">E. Siegel — “…Hopelessly Wrong,” Forbes (2017)</a> — the likely source of the meme; argues million-year decay, concedes the map was sound when made.</li>
        <li><a href="https://www.nationalgeographic.com/magazine/article/nasa-sent-a-map-to-space-to-help-aliens-find-earth-now-it-needs-an-update" target="_blank" rel="noopener">Drake &amp; Ransom, National Geographic (2020)</a> — co-authored by pulsar astronomer Scott Ransom, on updating the map.</li>
      </ul>
      <p class="gm-src-h mono">Artwork &amp; assets</p>
      <ul>
        <li>Cover artwork: NASA/JPL (public domain); vectorization VectorVoyager, Wikimedia Commons.</li>
        <li>Spacecraft model: <a href="https://science.nasa.gov/resource/voyager-3d-model/" target="_blank" rel="noopener">NASA Voyager 3D model</a> (public domain), simplified for the web. Earth texture: <a href="https://visibleearth.nasa.gov/images/57752" target="_blank" rel="noopener">NASA Blue Marble</a> (public domain).</li>
        <li>Background stars: all stars brighter than magnitude 4.5 (~925), placed at their true positions — from the <a href="https://github.com/astronexus/HYG-Database" target="_blank" rel="noopener">HYG star database</a> v3 by David Nash (astronexus.com), a merger of the Hipparcos, Yale Bright Star, and Gliese catalogs, licensed <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>.</li>
      </ul>
    </details>
    <p class="gm-colophon mono">
      <a href="https://github.com/gourneau/golden-map" target="_blank" rel="noopener">code &amp; sources on GitHub</a>
      &ensp;·&ensp;prompted by <a href="https://x.com/gourneau" target="_blank" rel="noopener">@gourneau</a> 🖖
    </p>`;

  // ---- the record player: a persistent mini dock --------------------------
  // NASA's official playlists stream through a visually-hidden SoundCloud
  // widget; these controls drive it over the Widget API so the player wears
  // the site's gold instead of SoundCloud's chrome. The dock rides the bottom
  // of EVERY act — the record keeps playing while you explore. Nothing loads
  // (and nothing plays) until the first press of play.
  const mini = el('aside', 'gm-panel gm-mini is-on');
  mini.setAttribute('aria-label', 'Hear the record');
  mini.innerHTML = `
    <div class="gm-mini-fly" hidden>
      <p class="gm-k">Hear the record</p>
      <div class="gm-player-sets" role="group" aria-label="Playlist">
        <button class="gm-mode is-active" data-set="music">Music from Earth · 27</button>
        <button class="gm-mode" data-set="sounds">Sounds of Earth · 19</button>
        <button class="gm-mode" data-set="greetings">Greetings · 55 languages</button>
      </div>
      <div class="gm-tracklist mono" role="list" aria-label="Tracks"></div>
      <p class="gm-fine">Greetings &amp; sounds stream from
        <a href="https://science.nasa.gov/mission/voyager/golden-record-contents/sounds/" target="_blank" rel="noopener">NASA’s Golden Record</a>;
        the music from a
        <a href="https://soundcloud.com/the-film-effect/voyager-golden-record-music-from-earth" target="_blank" rel="noopener">community upload</a>.</p>
    </div>
    <div class="gm-mini-bar">
      <button class="gm-play-btn gm-pprev" aria-label="Previous track"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2h2v12H3z M14 2 6 8l8 6z"/></svg></button>
      <button class="gm-play-btn gm-pplay is-invite" aria-label="Play"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2l10 6-10 6z"/></svg></button>
      <button class="gm-play-btn gm-pnext" aria-label="Next track"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11 2h2v12h-2z M2 2l8 6-8 6z"/></svg></button>
      <div class="gm-mini-info">
        <div class="gm-ptitle mono is-idle" aria-live="polite">Hear the record</div>
        <div class="gm-pbar" aria-label="Seek"><i></i></div>
      </div>
      <button class="gm-play-btn gm-msets" aria-label="Choose playlist and credits" aria-expanded="false">♫</button>
    </div>
    <div class="gm-sc-host" aria-hidden="true"></div>`;
  const SC_SETS = {
    sounds: 'https://soundcloud.com/nasa/sets/golden-record-sounds-of',
    greetings: 'https://soundcloud.com/nasa/sets/golden-record-greetings-to-the',
    // the 90-minute Music from Earth sequence, one continuous file from a
    // community upload (NASA's official release omits the music — it is
    // still under copyright, so this one may someday vanish; the player
    // degrades to its fallback message if it does)
    music: 'https://soundcloud.com/the-film-effect/voyager-golden-record-music-from-earth',
  };
  // Music from Earth cue sheet: NASA's published track order and lengths,
  // accumulated into start offsets (seconds) within the single upload.
  // prev/next seek between cues so the one big file plays like a playlist.
  const MUSIC_CUES = [
    [0,    'Bach — Brandenburg Concerto No. 2, First Movement'],
    [280,  'Java — Court Gamelan, “Kinds of Flowers”'],
    [563,  'Senegal — Percussion'],
    [691,  'Zaire — Mbuti Girls’ Initiation Song'],
    [747,  'Australia — “Morning Star” and “Devil Bird”'],
    [833,  'Mexico — “El Cascabel,” Lorenzo Barcelata'],
    [1027, 'Chuck Berry — “Johnny B. Goode”'],
    [1185, 'New Guinea — Men’s House Song'],
    [1265, 'Japan — Shakuhachi, “Tsuru no Sugomori”'],
    [1556, 'Bach — Gavotte en Rondeaux, Arthur Grumiaux'],
    [1731, 'Mozart — Queen of the Night Aria, Edda Moser'],
    [1906, 'Georgia — “Tchakrulo”'],
    [2044, 'Peru — Panpipes and Drum'],
    [2096, 'Louis Armstrong — “Melancholy Blues”'],
    [2281, 'Azerbaijan — Bagpipes'],
    [2431, 'Stravinsky — Rite of Spring, Sacrificial Dance'],
    [2706, 'Bach — The Well-Tempered Clavier, Glenn Gould'],
    [2994, 'Beethoven — Fifth Symphony, First Movement'],
    [3434, 'Bulgaria — “Izlel je Delyo Hagdutin,” Valya Balkanska'],
    [3733, 'Navajo — Night Chant'],
    [3790, 'Holborne — “The Fairie Round”'],
    [3867, 'Solomon Islands — Panpipes'],
    [3939, 'Peru — Wedding Song'],
    [3977, 'China — Guqin, “Flowing Streams,” Guan Pinghu'],
    [4434, 'India — Raga “Jaat Kahan Ho,” Kesarbai Kerkar'],
    [4644, 'Blind Willie Johnson — “Dark Was the Night”'],
    [4839, 'Beethoven — Cavatina, Budapest String Quartet'],
  ];
  const scHost = mini.querySelector('.gm-sc-host');
  const pTitle = mini.querySelector('.gm-ptitle');
  const pBar = mini.querySelector('.gm-pbar');
  const pBarFill = pBar.querySelector('i');
  const pPlay = mini.querySelector('.gm-pplay');
  const setBtns = [...mini.querySelectorAll('.gm-player-sets .gm-mode')];
  const miniFly = mini.querySelector('.gm-mini-fly');
  const miniSets = mini.querySelector('.gm-msets');
  let scWidget = null;
  let scReady = false;
  let scPlaying = false;
  let scSet = 'music';
  let scApiPromise = null;
  let scDuration = 0;   // current sound's duration (ms), cached on READY
  let scLastIdx = -1;   // last seen playlist index (NASA sets)
  let scPriming = false; // silent buffer-warm in progress (volume 0)

  // iOS only honors play commands that land hard on the heels of a real tap —
  // if the stream still has to BUFFER first, the tap's activation window
  // expires and the play is dropped (that's why the first tap "did nothing"
  // and the second worked: the first one buffered). So right after READY the
  // stream is primed: volume 0, play, pause on the first PLAY, volume back.
  // By the time a human reads the page and taps, the buffer is hot and the
  // first tap plays. Blocked-autoplay browsers simply time out harmlessly.
  const primeStream = () => {
    if (!scWidget || !scReady || scPlaying || scPriming) return;
    scPriming = true;
    scWidget.setVolume(0);
    scWidget.play();
    setTimeout(() => {
      if (scPriming) { scPriming = false; scWidget.setVolume(100); } // play was blocked — fine
    }, 4000);
  };
  const cancelPriming = () => {
    if (scPriming) { scPriming = false; scWidget.setVolume(100); }
  };

  // SoundCloud's PLAY_PROGRESS events arrive on their own lazy cadence and
  // can leave the title/highlight stale for many seconds after a track
  // change — so while playing, poll the true position once a second and
  // reconcile everything from it
  setInterval(() => {
    if (!scWidget || !scReady || !scPlaying) return;
    scWidget.getPosition((ms) => {
      if (scSet === 'music') {
        if (scDuration > 0) pBarFill.style.width = `${((ms || 0) / scDuration * 100).toFixed(1)}%`;
        const i = musicIdxAt(ms || 0);
        if (i !== musicIdx) setMusicTitle(i);
      }
    });
    if (scSet !== 'music') {
      scWidget.getCurrentSoundIndex((ci) => {
        if (ci != null && ci !== scLastIdx) {
          scLastIdx = ci;
          refreshTitle();
          if (!miniFly.hidden) markCurrentRow(ci);
        }
      });
    }
  }, 1000);

  miniSets.addEventListener('click', () => {
    miniFly.hidden = !miniFly.hidden;
    miniSets.setAttribute('aria-expanded', String(!miniFly.hidden));
    miniSets.classList.toggle('is-active', !miniFly.hidden); // lit while open
    if (!miniFly.hidden) populateTrackList();
  });

  // iOS primes the widget's media element on the FIRST play command and only
  // actually starts on the second (why the dock took two taps while the
  // plain-<audio> hello took one) — so every play intent pumps the command
  // again if playback hasn't started. No-ops everywhere else.
  const pumpPlay = () => {
    if (!scWidget || !scReady) return;
    cancelPriming(); // a real play intent takes over from the silent warm-up
    scWidget.play();
    setTimeout(() => { if (scWidget && scReady && !scPlaying) scWidget.play(); }, 700);
    setTimeout(() => { if (scWidget && scReady && !scPlaying) scWidget.play(); }, 1800);
  };

  const SVG_PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2l10 6-10 6z"/></svg>';
  const SVG_PAUSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2h3v12H4z M9 2h3v12H9z"/></svg>';
  const paintPlayBtn = () => {
    pPlay.innerHTML = scPlaying ? SVG_PAUSE : SVG_PLAY;
    pPlay.setAttribute('aria-label', scPlaying ? 'Pause' : 'Play');
  };
  let musicIdx = -1; // current cue in the music sequence (-1 = unknown)
  let pendingSeekMs = null; // seek applied on the next PLAY (a paused widget drops seeks)
  const setMusicTitle = (i) => {
    musicIdx = i;
    pTitle.classList.remove('is-idle');
    pTitle.textContent = MUSIC_CUES[i][1]; // numbering lives in the track list
    markCurrentRow(i);
  };
  const musicIdxAt = (ms) => {
    let i = 0;
    for (let k = 0; k < MUSIC_CUES.length; k++) {
      if (ms >= MUSIC_CUES[k][0] * 1000 - 500) i = k;
    }
    return i;
  };
  // NASA's SoundCloud titles are inconsistently cased and prefixed
  // ("Golden Record: Kiss, Mother And Child", "…(Min Dialect)Greeting") —
  // strip the prefix, restore missing spaces, lower-case the joining words
  const SMALL_WORDS = new Set(['and', 'or', 'the', 'of', 'in', 'a', 'an', 'to', 'from', 'with', 'by']);
  const stripGR = (t) => (t || '')
    .replace(/^golden record:\s*/i, '')
    .replace(/\)([A-Za-z])/g, ') $1')
    .split(' ')
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w.toLowerCase()) ? w.toLowerCase() : w))
    .join(' ');
  const refreshTitle = () => {
    if (!scWidget) return;
    if (scSet === 'music') { if (musicIdx < 0) setMusicTitle(0); return; }
    scWidget.getCurrentSound((s) => {
      if (s) { pTitle.classList.remove('is-idle'); pTitle.textContent = stripGR(s.title); }
    });
  };

  // The two NASA playlists are fixed — their track lists are hard-coded
  // (extracted once from the playlists themselves, titles tidied) so the
  // browser renders instantly instead of waiting on SoundCloud's lazy
  // metadata paging. Click order still maps 1:1 to widget.skip(index).
  const NASA_TRACKS = {
    sounds: [
      'Life Signs, Pulsar', 'Kiss, Mother and Child', 'Tractor, Bus, Auto',
      'Train', 'Horse and Cart', 'Morse Code, Ships', 'Tractor, Riveter',
      'Herding Sheep, Blacksmith, Sawing', 'Tame Dog', 'Music of the Spheres',
      'Mud Pots', 'Wind, Rain, Surf', 'Crickets, Frogs',
      'Birds, Hyena, Elephant', 'Chimpanzee', 'Wild Dog',
      'Footsteps, Heartbeat, Laughter', 'Fire, Speech', 'The First Tools',
    ],
    greetings: [
      'Akkadian', 'Amoy (Min dialect)', 'Arabic', 'Aramaic', 'Armenian',
      'Bengali', 'Burmese', 'Cantonese', 'Czech', 'Dutch', 'English',
      'French', 'German', 'Greek', 'Gujarati', 'Hebrew', 'Hindi', 'Hittite',
      'Hungarian (Magyar)', 'Ila (Zambia)', 'Indonesian', 'Italian',
      'Japanese', 'Kannada (Kanarese)', 'Kechua (Quechua)', 'Korean',
      'Latin', 'Luganda (Ganda)', 'Mandarin Chinese', 'Marathi', 'Nepali',
      'Nguni (Zulu)', 'Nyanja', 'Oriya', 'Persian', 'Polish', 'Portuguese',
      'Punjabi', 'Rajasthani', 'Romanian', 'Russian', 'Serbian', 'Sinhalese',
      'Sotho (Sesotho)', 'Spanish', 'Sumerian', 'Swedish', 'Telugu', 'Thai',
      'Turkish', 'Ukrainian', 'Urdu', 'Vietnamese', 'Welsh', 'Wu',
    ],
  };

  // ---- track list browser (in the ♫ flyout) --------------------------------
  const trackList = mini.querySelector('.gm-tracklist');
  function markCurrentRow(i) {
    [...trackList.children].forEach((r, k) => r.classList.toggle('is-current', k === i));
  }
  function renderTrackRows(labels, currentIdx) {
    trackList.innerHTML = '';
    labels.forEach((label, i) => {
      const b = el('button', 'gm-track' + (i === currentIdx ? ' is-current' : ''),
        `<span class="gm-track-n">${String(i + 1).padStart(2, '0')}</span><span class="gm-track-t"></span>`);
      b.querySelector('.gm-track-t').textContent = label;
      b.setAttribute('role', 'listitem');
      b.addEventListener('click', () => playTrack(i));
      trackList.appendChild(b);
    });
  }
  function populateTrackList() {
    if (scSet === 'music') {
      renderTrackRows(MUSIC_CUES.map((c) => c[1]), Math.max(0, musicIdx));
      return;
    }
    renderTrackRows(NASA_TRACKS[scSet], Math.max(0, scLastIdx));
    if (scWidget && scReady) {
      scWidget.getCurrentSoundIndex((ci) => { if (ci != null) markCurrentRow(ci); });
    }
  }
  function playTrack(i) {
    if (scSet === 'music') {
      setMusicTitle(i);
      const ms = MUSIC_CUES[i][0] * 1000;
      // a widget that isn't playing yet drops seekTo — queue it for PLAY
      if (!scWidget) { pendingSeekMs = ms; buildWidget('music').then(() => pumpPlay()); }
      else if (scReady) {
        if (scPlaying) scWidget.seekTo(ms);
        else { pendingSeekMs = ms; pumpPlay(); }
      }
      return;
    }
    if (scWidget && scReady) { scWidget.skip(i); pumpPlay(); markCurrentRow(i); }
    else if (!scWidget) buildWidget(scSet).then((w) => { if (w) { w.skip(i); pumpPlay(); } });
  }

  const loadScApi = () => {
    if (!scApiPromise) {
      scApiPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://w.soundcloud.com/player/api.js';
        s.onload = () => resolve(window.SC);
        s.onerror = () => { scApiPromise = null; reject(new Error('SoundCloud API failed to load')); };
        document.head.appendChild(s);
      });
    }
    return scApiPromise;
  };

  function buildWidget(setKey) {
    return loadScApi().then((SC) => {
      scReady = false;
      scPlaying = false;
      musicIdx = -1;
      scLastIdx = -1;
      scDuration = 0;
      paintPlayBtn();
      pBarFill.style.width = '0%';
      scHost.innerHTML = '';
      const f = document.createElement('iframe');
      f.allow = 'autoplay';
      f.title = 'NASA Golden Record audio (SoundCloud)';
      f.src = 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(SC_SETS[setKey]) +
        '&auto_play=false&visual=false&show_teaser=false&show_comments=false&color=%23c9a227';
      scHost.appendChild(f);
      scWidget = SC.Widget(f);
      return new Promise((resolve) => {
        const E = SC.Widget.Events;
        scWidget.bind(E.READY, () => {
          scReady = true;
          scWidget.getDuration((d) => { scDuration = d || 0; });
          // never clobber the idle invitation just because the pre-warm
          // finished — the real title arrives with the first PLAY. A set
          // switch mid-session shows 'loading…'; restore the idle voice.
          if (pTitle.textContent === 'loading…') {
            pTitle.classList.add('is-idle');
            pTitle.textContent = 'Hear the record';
          }
          if (scWantPlay) { scWantPlay = false; pumpPlay(); }
          else primeStream(); // no pending intent: warm the buffer for the first tap
          if (!miniFly.hidden) populateTrackList();
          resolve(scWidget);
        });
        scWidget.bind(E.PLAY, () => {
          if (scPriming) { scWidget.pause(); return; } // buffer is warm — stop the silent run
          scPlaying = true;
          if (pendingSeekMs != null) { scWidget.seekTo(pendingSeekMs); pendingSeekMs = null; }
          pPlay.classList.remove('is-invite'); // the invitation was accepted
          paintPlayBtn();
          refreshTitle();
          // keep the flyout list highlight in step
          if (!miniFly.hidden) {
            if (scSet === 'music') markCurrentRow(Math.max(0, musicIdx));
            else scWidget.getCurrentSoundIndex((ci) => {
              if (ci != null) { scLastIdx = ci; markCurrentRow(ci); }
            });
          }
        });
        scWidget.bind(E.PAUSE, () => {
          if (scPriming) { // silent warm-up finished: rewind, restore volume
            scPriming = false;
            scWidget.seekTo(0);
            scWidget.setVolume(100);
            return;
          }
          scPlaying = false;
          paintPlayBtn();
        });
        scWidget.bind(E.FINISH, () => { scPlaying = false; paintPlayBtn(); });
        scWidget.bind(E.PLAY_PROGRESS, (e) => {
          // the silent warm-up (and its straggler events) must not touch the
          // UI — only real playback drives the bar and titles
          if (scPriming || !scPlaying) return;
          pBarFill.style.width = `${((e.relativePosition || 0) * 100).toFixed(1)}%`;
          if (scSet === 'music') {
            const i = musicIdxAt(e.currentPosition || 0);
            if (i !== musicIdx) setMusicTitle(i);
          }
        });
        scWidget.bind(E.ERROR, () => { pTitle.textContent = 'stream unavailable — links below still work'; });
      });
    }).catch(() => { pTitle.textContent = 'stream unavailable — links below still work'; });
  }

  // A tap that lands while the widget is still handshaking must never be
  // dropped (on phones the READY round-trip is slow — this was the
  // "press play twice" bug). The intent is remembered and fires on READY.
  let scWantPlay = false;
  pPlay.addEventListener('click', () => {
    if (!scWidget) { scWantPlay = true; buildWidget(scSet); }
    else if (scReady) { if (scPlaying) scWidget.pause(); else pumpPlay(); }
    else scWantPlay = true;
  });
  // in the music sequence, prev/next hop between cue points inside the one
  // long file; a "prev" more than 3 s into a piece restarts that piece first
  const skipCue = (dir) => {
    scWidget.getPosition((ms) => {
      const i = musicIdxAt(ms || 0);
      const j = dir < 0
        ? ((ms || 0) - MUSIC_CUES[i][0] * 1000 > 3000 ? i : Math.max(0, i - 1))
        : Math.min(MUSIC_CUES.length - 1, i + 1);
      setMusicTitle(j);
      scWidget.seekTo(MUSIC_CUES[j][0] * 1000);
    });
  };
  mini.querySelector('.gm-pprev').addEventListener('click', () => {
    if (!scReady) return;
    if (scSet === 'music') skipCue(-1);
    else { scWidget.prev(); refreshTitle(); }
  });
  mini.querySelector('.gm-pnext').addEventListener('click', () => {
    if (!scReady) return;
    if (scSet === 'music') skipCue(1);
    else { scWidget.next(); refreshTitle(); }
  });
  pBar.addEventListener('click', (e) => {
    if (!scReady) return;
    const r = pBar.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    scWidget.getDuration((d) => scWidget.seekTo(frac * d));
  });
  for (const b of setBtns) {
    b.addEventListener('click', () => {
      if (b.dataset.set === scSet) return;
      scSet = b.dataset.set;
      for (const x of setBtns) x.classList.toggle('is-active', x === b);
      const wasPlaying = scPlaying;
      pTitle.textContent = 'loading…';
      if (!miniFly.hidden) populateTrackList(); // music renders instantly; NASA sets fill on READY
      buildWidget(scSet).then((w) => { if (w && wasPlaying) pumpPlay(); });
    });
  }
  // Pre-warm: build the default widget right away so the READY handshake AND
  // the silent buffer-warm are both done long before a human reads the page
  // and presses play — that's what makes the first tap play on iOS.
  setTimeout(() => { if (!scWidget && !scApiPromise) buildWidget(scSet); }, 400);

  // ---- the title-card greeting: a one-off "hello" ---------------------------
  // NASA's own recording (a US-government work, public domain), vendored as a
  // plain file and played with a bare <audio> element — deliberately NOT a
  // SoundCloud widget, because SoundCloud widgets pause one another. The
  // four-second greeting overlays the music without interrupting it.
  {
    const hello = title.querySelector('.gm-hello');
    const helloIc = hello.querySelector('.gm-hello-ic');
    const ha = new Audio('vendor/audio/english-greeting.wav');
    ha.preload = 'auto';
    const paintHello = (playing) => {
      helloIc.innerHTML = playing ? SVG_PAUSE : SVG_PLAY;
      hello.classList.toggle('is-playing', playing);
    };
    ha.addEventListener('play', () => paintHello(true));
    ha.addEventListener('pause', () => paintHello(false)); // also fires on ended
    ha.addEventListener('ended', () => { ha.currentTime = 0; });
    hello.addEventListener('click', () => {
      if (ha.paused) ha.play().catch(() => {});
      else { ha.pause(); ha.currentTime = 0; }
    });
  }

  // ---- the Drake equation, playable ------------------------------------------
  // Seven log-scale dials, four famous seeds, and N recomputed live. An
  // exploratory toy: the point is watching the answer swing from "alone"
  // to "a crowded galaxy" on a couple of honest-feeling drags.
  {
    const pctFmt = (v) => {
      const p = v * 100;
      return (p >= 10 ? String(Math.round(p)) : p >= 1 ? p.toFixed(1) : p.toPrecision(2)) + '%';
    };
    const fmtBig = (n) => {
      if (n >= 1e9) return parseFloat((n / 1e9).toPrecision(3)) + ' billion';
      if (n >= 1e6) return parseFloat((n / 1e6).toPrecision(3)) + ' million';
      return Math.round(n).toLocaleString('en-US');
    };
    const F = [
      { k: 'R',  html: 'R★ — new stars born each year', min: 0.1, max: 100, fmt: (v) => (v < 10 ? v.toFixed(1) : String(Math.round(v))) + ' / yr' },
      { k: 'fp', html: 'f<sub>p</sub> — stars with planets', min: 0.01, max: 1, fmt: pctFmt },
      { k: 'ne', html: 'n<sub>e</sub> — habitable worlds per system', min: 0.01, max: 5, fmt: (v) => (v >= 1 ? v.toFixed(1) : v.toFixed(2)) },
      { k: 'fl', html: 'f<sub>l</sub> — where life actually begins', min: 0.0001, max: 1, fmt: pctFmt },
      { k: 'fi', html: 'f<sub>i</sub> — where life grows intelligent', min: 0.0001, max: 1, fmt: pctFmt },
      { k: 'fc', html: 'f<sub>c</sub> — intelligence that builds radios', min: 0.01, max: 1, fmt: pctFmt },
      { k: 'L',  html: 'L — years a civilization stays detectable', min: 100, max: 1e9, fmt: (v) => fmtBig(v) + ' yr' },
    ];
    const PRESETS = [
      { name: 'Drake, 1961', v: { R: 1, fp: 0.35, ne: 3, fl: 1, fi: 1, fc: 0.15, L: 1e4 } },
      { name: 'Sagan, hopeful', v: { R: 10, fp: 0.5, ne: 2, fl: 1, fi: 0.1, fc: 0.1, L: 1e7 } },
      { name: 'The pessimist', v: { R: 1.5, fp: 1, ne: 0.02, fl: 0.13, fi: 0.001, fc: 0.2, L: 300 } },
      { name: 'Telescope era', v: { R: 2, fp: 1, ne: 0.4, fl: 0.5, fi: 0.05, fc: 0.2, L: 5000 } },
    ];
    const box = finders.querySelector('.gm-drake');
    const xEl = box.querySelector('.gm-drake-x');
    const nEl = box.querySelector('.gm-drake-count');
    const nSub = box.querySelector('.gm-drake-nsub');
    const presetsEl = box.querySelector('.gm-drake-presets');
    const vals = { ...PRESETS[0].v };
    const toT = (f, v) => Math.round(1000 * Math.log(v / f.min) / Math.log(f.max / f.min));
    const toV = (f, t) => f.min * Math.pow(f.max / f.min, t / 1000);
    const rows = {};
    function paintN() {
      const n = vals.R * vals.fp * vals.ne * vals.fl * vals.fi * vals.fc * vals.L;
      nEl.textContent = n >= 1000 ? fmtBig(n)
        : n >= 10 ? String(Math.round(n))
          : n >= 1 ? n.toFixed(1)
            : parseFloat(n.toPrecision(2)).toString();
      nSub.textContent = n < 1
        ? 'civilizations we could talk to — below one: perhaps we are alone'
        : n < 3 ? 'civilizations in the Milky Way we could talk to — nearly alone'
          : n < 10000 ? 'civilizations in the Milky Way we could talk to right now'
            : 'civilizations in the Milky Way we could talk to — a crowded galaxy';
    }
    for (const f of F) {
      const row = el('div', 'gm-drake-row');
      row.innerHTML = `
        <div class="gm-drake-rowhead"><label>${f.html}</label><output class="mono"></output></div>
        <input class="gm-slider" type="range" min="0" max="1000" step="1" aria-label="${f.k}">`;
      const input = row.querySelector('input');
      const out = row.querySelector('output');
      input.value = String(toT(f, vals[f.k]));
      out.textContent = f.fmt(vals[f.k]);
      input.addEventListener('input', () => {
        vals[f.k] = toV(f, +input.value);
        out.textContent = f.fmt(vals[f.k]);
        for (const b of presetsEl.children) b.classList.remove('is-active');
        paintN();
      });
      rows[f.k] = { f, input, out };
      xEl.appendChild(row);
    }
    PRESETS.forEach((p, i) => {
      const b = el('button', 'gm-mode' + (i === 0 ? ' is-active' : ''), p.name);
      b.addEventListener('click', () => {
        Object.assign(vals, p.v);
        for (const f of F) {
          rows[f.k].input.value = String(toT(f, vals[f.k]));
          rows[f.k].out.textContent = f.fmt(vals[f.k]);
        }
        for (const x of presetsEl.children) x.classList.toggle('is-active', x === b);
        paintN();
      });
      presetsEl.appendChild(b);
    });
    paintN();
  }

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
  // (the map's scale lives on the detail cards — every distance reads in
  // light-years and kpc there; the old "1 grid unit ≈ …" line confused more
  // than it explained)
  const corner = el('p', 'gm-panel gm-corner mono is-on',
    '<a href="https://github.com/gourneau/golden-map" target="_blank" rel="noopener">code &amp; sources on GitHub</a>' +
    ' · prompted by <a href="https://x.com/gourneau" target="_blank" rel="noopener">@gourneau</a> 🖖');

  // ======================================================================
  // 10. ENGRAVING OVERLAY CHIP (Acts II–IV) — mirrors the corner mark,
  //     bottom-right; toggles the cover-engraving artifact overlay
  // ======================================================================
  const artifactChip = el('button', 'gm-panel gm-artifact mono',
    '<span aria-hidden="true">◈</span>&ensp;the engraving');
  artifactChip.dataset.acts = 'map pulsars verdict finders';
  artifactChip.title = 'Overlay the cover engraving at true scale';
  artifactChip.setAttribute('aria-pressed', 'false');
  artifactChip.addEventListener('click', () => ctx.setArtifact(!state.artifact));
  bus.addEventListener('artifact', (e) => {
    const show = !!e.detail.show;
    artifactChip.classList.toggle('is-active', show);
    artifactChip.setAttribute('aria-pressed', String(show));
  });

  // "you are here" — deep zoom to the little blue dot at the origin
  const earthChip = el('button', 'gm-panel gm-artifact gm-earth-chip mono',
    '<span aria-hidden="true">⌖</span>&ensp;you are here');
  earthChip.dataset.acts = 'map pulsars verdict finders';
  earthChip.title = 'Zoom in to Earth, at the center of the map';
  // toggles: a second click returns you to where the act's view was
  earthChip.addEventListener('click', () =>
    ctx.select(state.selected === 'earth' ? null : 'earth'));
  bus.addEventListener('select', (e) => {
    earthChip.classList.toggle('is-active', e.detail.target === 'earth');
  });

  // ======================================================================
  // 11. HOVER TOOLTIP — floating chip fed by the tour's raycast (bus 'hover')
  // ======================================================================
  const tip = el('div', 'gm-tip mono');
  tip.setAttribute('aria-hidden', 'true');
  const sig4 = (v) => String(Number(v.toPrecision(4)));
  bus.addEventListener('hover', (e) => {
    const { pulsar, x, y } = e.detail;
    if (!pulsar) { tip.classList.remove('is-on'); return; }
    tip.textContent = pulsar === 'gc'
      ? 'Galactic Center'
      : pulsar === 'earth'
        ? 'Earth — you are here'
        : pulsar === 'voyager'
          ? 'Voyager — the messenger itself'
          : `${pulsar.bname}${pulsar.alias ? ` · ${pulsar.alias}` : ''} · ${sig4(pulsar.periodEncoded)} s`;
    tip.classList.add('is-on');
    // offset up-right of the cursor, clamped to the viewport
    const r = tip.getBoundingClientRect();
    const pad = 8;
    const left = Math.min(Math.max(x + 14, pad), window.innerWidth - r.width - pad);
    const top = Math.min(Math.max(y - 14 - r.height, pad), window.innerHeight - r.height - pad);
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  });

  // ---- mobile sheet collapse tabs -----------------------------------------
  // On phones every act sheet gets a slim header tab (like "the fourteen"):
  // tapping it drops the sheet down to just the tab so the 3D scene owns the
  // screen; tapping again brings it back. Desktop hides the tabs entirely.
  const sheetTab = (panel, label) => {
    const b = el('button', 'gm-sheet-tab mono');
    const paint = (collapsed) => {
      b.innerHTML = `<span aria-hidden="true">${collapsed ? '▴' : '▾'}</span>&ensp;${label}`;
      b.setAttribute('aria-expanded', String(!collapsed));
    };
    paint(false);
    b.addEventListener('click', () => {
      const collapsed = panel.classList.toggle('sheet-collapsed');
      if (collapsed) panel.scrollTop = 0;
      paint(collapsed);
    });
    panel.prepend(b);
  };
  sheetTab(explainer, 'How to read it');
  sheetTab(verdict, 'Is it wrong?');
  sheetTab(finders, 'For the finders');

  // ---- assemble ---------------------------------------------------------
  // `mini` is deliberately NOT in actPanels: the record keeps playing, and
  // its dock keeps showing, across every act change
  root.append(nav, title, explainer, rail, railToggle, detail, verdict, finders, corner, artifactChip, earthChip, mini, tip);

  // ---- act / selection plumbing ------------------------------------------
  const actPanels = [title, explainer, rail, railToggle, verdict, finders, artifactChip, earthChip];
  const DETAIL_ACTS = new Set(['pulsars', 'verdict', 'finders']);

  function paintDetailVisibility() {
    // the Voyager easter egg lives in Act I — its card may show there too
    detail.classList.toggle('is-on', !!state.selected &&
      (DETAIL_ACTS.has(state.act) || state.selected === 'voyager'));
  }
  // Act V: the finders panel and the detail panel share the right column —
  // yield to the detail panel while something is selected, restore on deselect
  function paintFindersVisibility() {
    if (state.act !== 'finders') return; // applyAct already switched it off
    finders.classList.toggle('is-on', !state.selected);
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
    navTitle.textContent = i < 0 ? '' : ACTS[i].title;
    prevArrow.disabled = i <= 0;
    nextArrow.disabled = i >= ACTS.length - 1;
    closeSheet();
    if (act === 'map') demoStart();
    else demo.active = false;
    paintDetailVisibility();
    paintFindersVisibility();
  }

  bus.addEventListener('act', (e) => applyAct(e.detail.act));
  bus.addEventListener('select', (e) => {
    const target = e.detail.target;
    for (const r of rows) r.el.classList.toggle('is-selected', r.target === target);
    if (target) { renderDetail(target); closeSheet(); }
    paintDetailVisibility();
    paintFindersVisibility();
  });
  bus.addEventListener('mapmode', (e) => paintMode(e.detail.mode));
  bus.addEventListener('timeMyr', (e) => {
    const myr = e.detail.myr;
    if (document.activeElement !== slider) slider.value = String(myrToV(myr));
    paintTime(myr);
  });

  applyAct(state.act);
  paintTime(state.timeMyr);
  // 'uilayout' once at init, deferred a microtask so modules registered after
  // the UI (the tour) have their bus listeners attached before it fires
  queueMicrotask(emitLayout);

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
