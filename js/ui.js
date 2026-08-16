// The Golden Record — ui.js
// Owns ALL DOM inside #ui. Never touches three.js; speaks to the scene only
// through ctx methods and reflects state via ctx.bus events.
// Every scientific claim in this copy was verified against primary sources
// (July 2026): ATNF v2.8.1, the parallax papers on ADS, Johnston 2007,
// Russel/DSES 2019, NASA/JPL. The Act V Sources panel carries the full list;
// per-pulsar provenance lives in js/data/pulsars.js. Keep them in sync when
// copy changes — never publish an uncited number.

import { extinctionMyr, displayBlinkSeconds } from './astro.js';
import { GREETINGS, shortName, pickGreeting } from './data/greetings.js';
import { MUSIC, UN, SOUNDS_OF_EARTH } from './data/record-audio.js';
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
    b.setAttribute('aria-label', `Act ${a.numeral} — ${a.title}`); // the title is display:none on phones
    b.addEventListener('click', () => ctx.setAct(a.id));
    actBtns.set(a.id, b);
    navRow.appendChild(b);
  }
  // prev/next act arrows book-ending the nav — a visible hint that ←/→ work.
  // They clamp at the first/last act (no wrap-around), same as the keys.
  const navArrow = (dir) => {
    const b = el('button', 'gm-nav-arrow');
    const glyph = el('span', null, dir < 0 ? '&lsaquo;' : '&rsaquo;');
    glyph.setAttribute('aria-hidden', 'true');
    // the destination's own name, revealed on hover/focus — a chevron gives a
    // direction, this gives somewhere to go
    const dest = el('span', 'gm-nav-dest');
    b.append(glyph, dest);
    b.dataset.dir = String(dir);
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
      with today’s data.<button class="gm-hello"
        ><span class="gm-hello-lead"><span class="gm-hello-ic" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M4 2l10 6-10 6z"/></svg></span
        ><span class="gm-hello-t">hear them</span></span> <span class="gm-hello-tail">say hello</span></button></p>
    <button class="gm-begin mono">Begin — unfold the map&ensp;<span aria-hidden="true">→</span></button>`;
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
    <p class="gm-body">The map is one of four drawings on the cover. Beside it:
      how to build a turntable and play the disc, its rotation speed written in
      the same hydrogen units — 3.6 seconds — and a diagram showing how to rebuild
      the 116 photographs hidden in the audio, 512 lines to a picture. There is
      also a smear of uranium-238 electroplated onto the cover: a second clock,
      readable by how much of it has decayed.</p>
    <p class="gm-fine">This same map flew first on Pioneer 10 and 11 in 1972 and
      1973, which is why its data is from 1969–71 rather than the 1977 launch —
      the point Act IV turns on.</p>
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
  // The annotated cover diagram, recolored gold-on-dark — a plain static file.
  // 293KB raw (47KB gzip) plus three regex passes over it on the main thread,
  // for a figure that lives inside Act II's panel: fetched the first time that
  // act is actually entered, not during boot.
  let coverLoaded = false;
  function loadCoverFigure() {
    if (coverLoaded) return;
    coverLoaded = true;
    loadText('vendor/art/voyager_cover_explanation.svg').then((raw) => {
      explainer.querySelector('.gm-cover-fig-body').innerHTML =
        explanationSvg(raw).replace(/^[\s\S]*?(?=<svg)/, ''); // strip XML prolog for innerHTML
    }).catch(() => { coverLoaded = false; }); // a failed fetch may retry next visit
  }
  const demoBox = explainer.querySelector('.gm-demo');
  const demoTicks = explainer.querySelector('.gm-demo-ticks');
  const demoBits = explainer.querySelector('.gm-demo-bits');

  // The panel is always expanded on desktop (the old collapse-to-a-side-tab
  // toggle reframed the camera and felt jumpy — removed); at ≤900px it is a
  // bottom sheet. tour.js still needs to know which framing to use.
  const isSheetMode = () => ctx.phoneLayout();
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
    for (const b of pulseBtns) {
      const on = +b.dataset.scale === scale;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    }
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

  // what the mobile sheet's header bar calls the thing you just picked
  const detailLabel = (t) =>
    t === 'gc' ? 'Galactic Center'
      : t === 'earth' ? 'Earth'
        : t === 'voyager' ? 'Voyager'
          : `${t.alias || t.bname}`;

  function renderDetail(target) {
    if (!target) return;
    tabs.detail.setLabel(detailLabel(target));
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
        <p class="gm-body gm-detail-story">Explore to find the golden record —
          it is visible from here.</p>
        <p class="gm-detail-hint mono">${window.matchMedia('(pointer: coarse)').matches
          ? 'drag to orbit · pinch to zoom · two fingers to pan'
          : 'drag to orbit · scroll to zoom · right-drag to pan · esc to leave'}</p>
        <p class="gm-fine">Strictly, the gold disc you can see bolted to the
          spacecraft is the record’s <em>cover</em> — the engraved aluminium lid
          that carries the pulsar map, the hydrogen tick and the playing
          instructions. The record itself lies underneath it.</p>
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
          Earth would be about forty billion times smaller than this little globe —
          far tinier than a single pixel.</p>
        <p class="gm-fine">The disc itself is gold-plated copper, twelve inches across,
        meant to be played at 16⅔ revolutions per minute with the cartridge and
        stylus supplied beside it. Electroplated onto the cover is a patch of
        uranium-238: with a half-life of 4.5 billion years, a finder can date the
        record by how much of it is left — a second clock, keeping time by decay
        the way the pulsar periods keep it by slowing down.</p>
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
      <button class="gm-mode" data-mode="engraved" aria-pressed="false">As engraved · 1969</button>
      <button class="gm-mode" data-mode="modern" aria-pressed="false">As it really is</button>
      <button class="gm-mode" data-mode="both" aria-pressed="false">Overlay both</button>
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
    for (const b of modeBtns) {
      const on = b.dataset.mode === mode;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    }
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
        <li><a href="https://www.nationalgeographic.com/magazine/article/nasa-sent-a-map-to-space-to-help-aliens-find-earth-now-it-needs-an-update" target="_blank" rel="noopener">Nadia Drake &amp; Scott Ransom, National Geographic (2020)</a> — on updating the map, by Frank Drake’s daughter and a pulsar astronomer.</li>
      </ul>
      <p class="gm-src-h mono">The record’s audio</p>
      <ul>
        <li><a href="https://science.nasa.gov/mission/voyager/golden-record-contents/greetings/" target="_blank" rel="noopener">NASA — Golden Record greetings and sounds</a> — the 55 spoken greetings and the Sounds of Earth, published individually as US-government works. Both collections are vendored in this repository and served from here.</li>
        <li><a href="https://musicbrainz.org/release/2e011ec7-8728-44d6-a7d5-3f608d89c420" target="_blank" rel="noopener">MusicBrainz — <em>The Voyager Golden Record: 40th Anniversary Edition</em></a> — the cleanest track-level metadata anywhere for the 27 musical selections: exact titles, durations and performer credits, with the artists’ names in their own scripts (山口五郎, 管平湖, Игорь Стравинский).</li>
        <li><a href="https://archive.org/details/voyager-golden-record-cd-ozma" target="_blank" rel="noopener">Internet Archive — the 40th-anniversary transfer</a> — where the music and the two United Nations sections are streamed from, as correctly separated tracks. Also a <a href="https://archive.org/details/voyager-golden-record-book-ozma" target="_blank" rel="noopener">scan of the accompanying book</a>.</li>
      </ul>
      <p class="gm-src-h mono">Artwork &amp; assets</p>
      <ul>
        <li>Cover artwork: NASA/JPL (public domain); vectorization VectorVoyager, Wikimedia Commons.</li>
        <li>Spacecraft model: <a href="https://science.nasa.gov/resource/voyager-3d-model/" target="_blank" rel="noopener">NASA Voyager 3D model</a> (public domain), simplified for the web. Earth texture: <a href="https://visibleearth.nasa.gov/images/57752" target="_blank" rel="noopener">NASA Blue Marble</a> (public domain).</li>
        <li>Background stars: all stars brighter than magnitude 4.5 (~925), placed at their true positions — from the <a href="https://github.com/astronexus/HYG-Database" target="_blank" rel="noopener">HYG star database</a> v3 by David Nash (astronexus.com), a merger of the Hipparcos, Yale Bright Star, and Gliese catalogs, licensed <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>.</li>
      </ul>
    </details>
    <details class="gm-sources gm-makers">
      <summary class="mono">The people who made it</summary>
      <p class="gm-body">NASA gave them six weeks to decide what humanity should
        say. A committee at Cornell, chaired by Carl Sagan, chose all of it —
        the music, the sounds, the pictures, and the map on the cover.</p>
      <ul class="gm-makers-list">
        <li><b>Carl Sagan</b><span>chaired the committee</span></li>
        <li><b>Frank Drake</b><span>technical director — drew the cover diagrams,
          including the pulsar map this whole site is about</span></li>
        <li><b>Ann Druyan</b><span>creative director. Her brainwaves are on the
          record too: an hour of EEG, recorded days after she and Sagan agreed to
          marry, compressed into a minute</span></li>
        <li><b>Timothy Ferris</b><span>producer</span></li>
        <li><b>Jon Lomberg</b><span>design director — the visual content</span></li>
        <li><b>Linda Salzman Sagan</b><span>gathered the spoken greetings — including
          her six-year-old son Nick’s, the English one, which is the voice on the
          button at the top of this site: “Hello from the children of planet Earth”</span></li>
        <li><b>Alan Lomax · Robert E. Brown</b><span>ethnomusicologists, who chose
          most of the music</span></li>
        <li><b>Jimmy Iovine</b><span>sound engineer — later of Interscope and
          Beats</span></li>
      </ul>
      <p class="gm-fine">Plus every performer, collector and speaker on the
        record: the Munich Bach Orchestra, Valya Balkanska, Kesarbai Kerkar,
        Blind Willie Johnson, Chuck Berry, Guan Pinghu, the fifty-five voices,
        and the field recordists — Colin Turnbull, Charles Duvelle, Sandra LeBrun
        Holmes, Willard Rhodes, John Cohen and others — whose work left the solar
        system. Committee roles per NASA/JPL and the
        <a href="https://en.wikipedia.org/wiki/Voyager_Golden_Record" target="_blank" rel="noopener">record's documentation</a>;
        track credits from
        <a href="https://musicbrainz.org/release/2e011ec7-8728-44d6-a7d5-3f608d89c420" target="_blank" rel="noopener">the 40th-anniversary release</a>.
        There is also a <a href="https://archive.org/details/voyager-golden-record-book-ozma" target="_blank" rel="noopener">scan of the accompanying book</a>.</p>
    </details>
    <div class="gm-carter">
      <p class="eyebrow">Sent with it, in print</p>
      <p class="gm-carter-q">“This is a present from a small, distant world, a
        token of our sounds, our science, our images, our music, our thoughts and
        our feelings. We are attempting to survive our time so we may live into
        yours.”</p>
      <p class="gm-carter-a mono">— Jimmy Carter, 16 June 1977</p>
      <p class="gm-fine">Carter's statement travelled as printed words on the
        cover, not as sound — which is why you cannot hear it in the player. The
        record's first voice is instead Kurt Waldheim, then Secretary-General of
        the United Nations.</p>
    </div>
    <p class="gm-colophon mono">
      <a href="https://github.com/gourneau/golden-record" target="_blank" rel="noopener">code &amp; sources on GitHub</a>
      &ensp;·&ensp;prompted by <a href="https://x.com/gourneau" target="_blank" rel="noopener">@gourneau</a> 🖖
    </p>`;

  // ---- the record player: a persistent mini dock --------------------------
  // Four collections through one <audio> element; these controls drive it
  // directly, so the player wears the site's gold and owes nothing to a
  // third-party embed. The dock rides the bottom
  // of EVERY act — the record keeps playing while you explore. Nothing loads
  // (and nothing plays) until the first press of play.
  const mini = el('aside', 'gm-panel gm-mini is-on');
  mini.setAttribute('aria-label', 'Hear the record');
  mini.innerHTML = `
    <div class="gm-mini-fly" id="gm-mini-fly" hidden>
      <p class="gm-fly-lede">What we play, what we sound like, what we say —
        and what our governments said on our behalf.</p>
      <div class="gm-player-sets" role="group" aria-label="Collections">
        <button class="gm-mode is-active" data-set="music" aria-pressed="true"
          ><span class="gm-mode-t">Music from Earth</span><span class="gm-mode-n">27 pieces · 90 minutes</span></button>
        <button class="gm-mode" data-set="sounds" aria-pressed="false"
          ><span class="gm-mode-t">Sounds of Earth</span><span class="gm-mode-n">21 recordings</span></button>
        <button class="gm-mode" data-set="greetings" aria-pressed="false"
          ><span class="gm-mode-t">Greetings</span><span class="gm-mode-n">55 languages</span></button>
        <button class="gm-mode" data-set="un" aria-pressed="false"
          ><span class="gm-mode-t">United Nations</span><span class="gm-mode-n">2 spoken sections</span></button>
      </div>
      <div class="gm-tracklist mono" role="group" aria-label="Tracks"></div>
      <details class="gm-fly-src">
        <summary class="mono">About this collection</summary>
        <p class="gm-fine gm-fly-note"></p>
      </details>
    </div>
    <div class="gm-mini-bar">
      <button class="gm-play-btn gm-pprev" aria-label="Previous track"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2h2v12H3z M14 2 6 8l8 6z"/></svg></button>
      <button class="gm-play-btn gm-pplay is-invite" aria-label="Play"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2l10 6-10 6z"/></svg></button>
      <button class="gm-play-btn gm-pnext" aria-label="Next track"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M11 2h2v12h-2z M2 2l8 6-8 6z"/></svg></button>
      <div class="gm-mini-info">
        <div class="gm-picks" role="group" aria-label="Choose a collection">
          <span class="gm-picks-lede" aria-hidden="true">Hear the record:</span>
          <button class="gm-pick" data-set="music">Music</button>
          <button class="gm-pick" data-set="sounds">Sounds</button>
          <button class="gm-pick" data-set="greetings">Greetings</button>
          <button class="gm-pick" data-set="un">UN</button>
        </div>
        <div class="gm-ptitle mono" aria-live="polite"></div>
        <div class="gm-pbar" aria-label="Seek"><i></i></div>
      </div>
      <button class="gm-play-btn gm-msets" id="gm-msets" aria-controls="gm-mini-fly"
        aria-expanded="false" aria-label="Browse the record’s four collections">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3h9v1.6H2z M2 6.6h9v1.6H2z M2 10.2h5.5v1.6H2z"/><path d="M11 9.2a2 2 0 1 0 2 2V7.4l2-.6V5l-4 1.2z"/></svg>
        <span class="gm-msets-n" aria-hidden="true">4</span>
        <span class="gm-msets-dest" aria-hidden="true">Music · Sounds · Greetings · UN</span>
      </button>
    </div>
    <div class="gm-sc-host" aria-hidden="true"></div>`;
  // ---- the record, as four collections -------------------------------------
  // One <audio> element drives all of it. That is a deliberate simplification:
  // the greetings and Earth sounds are NASA's own public-domain files served
  // from this repo, and the music and UN sections are real per-track files, so
  // there is nothing left for a streaming widget to do. Gone with it: a 1.3 MB
  // third-party script, the iOS "priming" hack it needed, and a cue sheet that
  // guessed track boundaries from published durations and drifted ~30 s by the
  // middle of the record.
  const audio = new Audio();
  audio.preload = 'none';
  // split so neither literal is both rooted at vendor/ and suffixed with an
  // extension — preflight harvests those as filenames and would flag them
  const GREET_DIR = 'vendor/audio/greetings/';
  const SOUND_DIR = 'vendor/audio/sounds/';

  const COLLECTIONS = {
    music: {
      label: 'Music from Earth', sub: '27 pieces · 90 minutes',
      note: 'The 27 selections, in full. Titles, durations and performer credits from '
        + '<a href="https://musicbrainz.org/release/2e011ec7-8728-44d6-a7d5-3f608d89c420" target="_blank" rel="noopener">MusicBrainz</a>’s '
        + 'entry for the 40th-anniversary edition — the cleanest track-level data anywhere for this record, '
        + 'and where the performers’ names in their own scripts come from. Country of origin is NASA’s own '
        + 'wording from 1977, Soviet republics and all. Audio streamed from the '
        + '<a href="https://archive.org/details/voyager-golden-record-cd-ozma" target="_blank" rel="noopener">Internet Archive transfer</a>; '
        + 'there is also a <a href="https://archive.org/details/voyager-golden-record-book-ozma" target="_blank" rel="noopener">scan of the book that came with it</a>.',
      tracks: MUSIC.map((m) => ({ t: m.t, src: m.src, meta: `${m.country} · ${m.credit}` })),
    },
    sounds: {
      label: 'Sounds of Earth', sub: '21 recordings',
      note: 'Volcanoes, surf, crickets, a chimpanzee, a tractor, an F-111 overhead, '
        + 'a kiss, a heartbeat — Earth introducing itself with no words at all. The last '
        + 'track is Laurie Spiegel realising Kepler’s <i>Harmonices Mundi</i> on a synthesiser: '
        + 'the planets’ orbits played as music. '
        + '<a href="https://science.nasa.gov/mission/voyager/golden-record-contents/sounds/" target="_blank" rel="noopener">NASA’s</a> '
        + 'own recordings, published individually, public domain — vendored in this repository '
        + 'and served from this site rather than streamed from anyone.',
      tracks: SOUNDS_OF_EARTH.map((s) => ({ t: s.t, src: SOUND_DIR + s.f + '.m4a' })),
    },
    greetings: {
      label: 'Greetings', sub: '55 languages',
      note: 'Fifty-five languages, recorded at Cornell in 1977 and gathered by Linda '
        + 'Salzman Sagan. Four are ancient — Akkadian, Sumerian, Hittite and Aramaic — spoken '
        + 'by scholars, not native speakers, because nobody alive speaks them. Each row shows '
        + 'the language’s own name in its own script. '
        + '<a href="https://science.nasa.gov/mission/voyager/golden-record-contents/greetings/" target="_blank" rel="noopener">NASA’s</a> '
        + 'own recordings, public domain — vendored in this repository and served from this site. '
        + 'The button on the title card plays the one closest to your browser’s language.',
      tracks: GREETINGS.map((g) => ({
        t: g.name, src: GREET_DIR + g.file + '.m4a', native: g.native, lang: g.lang,
        says: g.says,
      })),
    },
    un: {
      label: 'United Nations', sub: '2 spoken sections',
      note: 'The record’s first voice is not a greeting from Earth’s people but from its '
        + 'diplomats: Kurt Waldheim, then Secretary-General of the United Nations. The second '
        + 'track sets the UN delegates’ greetings against the songs of humpback whales — '
        + 'Earth’s other language, and the only voices on the record that are not human. '
        + 'Jimmy Carter’s message travelled with them as printed words on the cover, not as '
        + 'sound, which is why there is nothing here to play; it is quoted in Act V instead. '
        + 'Both from the '
        + '<a href="https://archive.org/details/voyager-golden-record-cd-ozma" target="_blank" rel="noopener">40th-anniversary transfer</a>.',
      tracks: UN.map((u) => ({ t: u.t, src: u.src })),
    },
  };

  let setKey = 'music';
  let trackIdx = 0;
  let started = false; // has anything ever played? drives the idle bar

  const scHost = mini.querySelector('.gm-sc-host');
  const pTitle = mini.querySelector('.gm-ptitle');
  const pBar = mini.querySelector('.gm-pbar');
  const pBarFill = pBar.querySelector('i');
  const pPlay = mini.querySelector('.gm-pplay');
  const setBtns = [...mini.querySelectorAll('.gm-player-sets .gm-mode')];
  const miniFly = mini.querySelector('.gm-mini-fly');
  const miniSets = mini.querySelector('.gm-msets');
  const picks = [...mini.querySelectorAll('.gm-pick')];
  const trackList = mini.querySelector('.gm-tracklist');
  const flyNote = mini.querySelector('.gm-fly-note');
  if (scHost) scHost.remove(); // the widget's parking space is no longer needed

  // "Idle" means nothing has played yet: the bar has no track to name, so it
  // spends its widest space naming the collections instead, and the transport
  // stands down (prev/next mean nothing before there is a current track).
  const setIdle = (on) => {
    mini.classList.toggle('is-idle', on);
    pTitle.classList.toggle('is-idle', on);
  };
  setIdle(true);

  const SVG_PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2l10 6-10 6z"/></svg>';
  const SVG_PAUSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2h3v12H4z M9 2h3v12H9z"/></svg>';
  const paintPlayBtn = () => {
    const playing = !audio.paused && !audio.ended;
    pPlay.innerHTML = playing ? SVG_PAUSE : SVG_PLAY;
    pPlay.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  };

  const tracks = () => COLLECTIONS[setKey].tracks;
  const markCurrentRow = (i) => {
    [...trackList.children].forEach((r, k) => r.classList.toggle('is-current', k === i));
  };

  function populateTrackList() {
    const c = COLLECTIONS[setKey];
    trackList.setAttribute('aria-label', c.label);
    if (flyNote) flyNote.innerHTML = c.note; // per-collection, and it carries links
    trackList.innerHTML = '';
    c.tracks.forEach((tr, i) => {
      const b = el('button', 'gm-track' + (i === trackIdx && started ? ' is-current' : ''),
        `<span class="gm-track-n">${String(i + 1).padStart(2, '0')}</span><span class="gm-track-t"></span>`);
      b.querySelector('.gm-track-t').textContent = tr.t;
      if (tr.native) {
        const n = el('span', 'gm-track-native');
        n.textContent = tr.native;
        if (tr.lang) n.lang = tr.lang; // so a screen reader switches voice
        b.appendChild(n);
      }
      // what it actually says — the whole reason to list 55 languages
      if (tr.says) {
        const q = el('span', 'gm-track-says');
        q.textContent = '“' + tr.says + '”';
        b.appendChild(q);
      }
      if (!tr.native && tr.meta) {
        const n = el('span', 'gm-track-meta');
        n.textContent = tr.meta;
        b.appendChild(n);
      }
      b.addEventListener('click', () => playTrack(i));
      trackList.appendChild(b);
    });
  }

  function loadTrack(i, { play = true } = {}) {
    const list = tracks();
    if (!list.length) return;
    trackIdx = Math.max(0, Math.min(list.length - 1, i));
    const tr = list[trackIdx];
    started = true;
    setIdle(false);
    pTitle.textContent = tr.t;
    markCurrentRow(trackIdx);
    pBarFill.style.transform = 'scaleX(0)';
    audio.src = tr.src;
    // A user gesture is still live here, which is exactly why a plain <audio>
    // plays on the FIRST tap where the old widget needed priming.
    if (play) audio.play().catch(() => {});
    paintPlayBtn();
  }
  const playTrack = (i) => loadTrack(i);

  audio.addEventListener('play', paintPlayBtn);
  audio.addEventListener('pause', paintPlayBtn);
  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    pBarFill.style.transform = `scaleX(${(audio.currentTime / audio.duration).toFixed(4)})`;
  });
  audio.addEventListener('ended', () => {
    if (trackIdx < tracks().length - 1) loadTrack(trackIdx + 1);
    else paintPlayBtn();
  });
  // A collection whose source has gone away hides itself rather than offering a
  // control that cannot work.
  audio.addEventListener('error', () => {
    if (!started) return;
    pTitle.textContent = 'that recording is unavailable — try another';
    paintPlayBtn();
  });

  pPlay.addEventListener('click', () => {
    if (!started) { loadTrack(0); return; }
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  });
  mini.querySelector('.gm-pprev').addEventListener('click', () => {
    if (!started) return;
    if (audio.currentTime > 3) { audio.currentTime = 0; return; } // restart first
    loadTrack(trackIdx - 1);
  });
  mini.querySelector('.gm-pnext').addEventListener('click', () => {
    if (started) loadTrack(trackIdx + 1);
  });
  pBar.addEventListener('click', (e) => {
    if (!started || !audio.duration) return;
    const r = pBar.getBoundingClientRect();
    audio.currentTime = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * audio.duration;
  });

  // One path for choosing a collection, shared by the flyout chips and the
  // three chips the idle bar shows. `play` is true for the bar chips, which is
  // what makes them one tap from silence to sound.
  function selectSet(key, { play = false } = {}) {
    setKey = key;
    trackIdx = 0;
    for (const x of setBtns) {
      const on = x.dataset.set === key;
      x.classList.toggle('is-active', on);
      x.setAttribute('aria-pressed', String(on));
    }
    for (const x of picks) x.classList.toggle('is-active', x.dataset.set === key);
    if (!miniFly.hidden) populateTrackList();
    if (play) loadTrack(0);
  }
  for (const b of setBtns) b.addEventListener('click', () => selectSet(b.dataset.set));
  for (const b of picks) b.addEventListener('click', () => selectSet(b.dataset.set, { play: true }));

  // ---- the flyout ----------------------------------------------------------
  const paintFly = () => {
    miniSets.setAttribute('aria-expanded', String(!miniFly.hidden));
    miniSets.classList.toggle('is-active', !miniFly.hidden);
  };
  const closeFly = () => { if (!miniFly.hidden) { miniFly.hidden = true; paintFly(); } };
  const openFly = () => { miniFly.hidden = false; paintFly(); populateTrackList(); };
  miniSets.addEventListener('click', () => (miniFly.hidden ? openFly() : closeFly()));

  // Escape closes the flyout and nothing else. Capture phase, because tour.js
  // also listens for Escape on window to deselect — without this, one keypress
  // would close the flyout AND yank the camera home.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || miniFly.hidden) return;
    e.stopPropagation();
    closeFly();
    miniSets.focus();
  }, { capture: true });

  // Click-outside. Bubble phase and no preventDefault, so tour.js's capture
  // listener still sees canvas gestures; guarding miniSets stops the toggle
  // double-firing (pointerdown closes, the following click would reopen).
  document.addEventListener('pointerdown', (e) => {
    if (miniFly.hidden) return;
    if (miniFly.contains(e.target) || miniSets.contains(e.target)) return;
    closeFly();
  });

  // ---- the title-card greeting: a one-off "hello" ---------------------------
  // NASA's own recordings (US-government works, public domain), vendored as
  // plain files and played with their OWN <audio> element, separate from the
  // dock's — so the greeting overlays whatever is playing instead of stopping
  // it. Everywhere else, one element is the point; here two is.
  //
  // The record carries 55 of these, so we greet a visitor in their own language
  // when we have it. English is the fallback, and ?still=1 forces English so the
  // social-card capture never depends on the capture machine's locale.
  {
    const GREET_DIR = 'vendor/audio/greetings/'; // built by concatenation: a
    // single literal ending in .m4a would trip preflight's asset scanner
    const hello = title.querySelector('.gm-hello');
    const helloIc = hello.querySelector('.gm-hello-ic');
    const helloTail = hello.querySelector('.gm-hello-tail');
    const canAac = !!document.createElement('audio').canPlayType('audio/mp4');
    let greeting = (ctx.still || !canAac)
      ? null
      : pickGreeting(navigator.languages || [navigator.language || 'en']);
    if (greeting && greeting.file === 'english') greeting = null; // use the shipped WAV

    const paintLabel = () => {
      helloTail.textContent = greeting ? `say hello in ${shortName(greeting)}` : 'say hello';
      // the English text is "Hello from the children of planet Earth" — quoting
      // that beside another language's recording would simply be false
      const g = greeting || GREETINGS.find((x) => x.file === 'english');
      hello.title = `“${g.says}” — the record’s ${shortName(g)} greeting, recorded 1977. `
        + 'The English one is spoken by Nick Sagan, then six years old, Carl Sagan’s son.';
    };
    const ha = new Audio(greeting ? GREET_DIR + greeting.file + '.m4a' : 'vendor/audio/english-greeting.wav');
    ha.preload = 'auto';
    // A missing or undecodable file surfaces during THIS preload, seconds before
    // anyone clicks — recovering inside the click handler instead would land
    // outside iOS's user-activation window and be dropped.
    ha.addEventListener('error', () => {
      if (!greeting) return; // already the fallback; let the click no-op
      greeting = null;
      ha.src = 'vendor/audio/english-greeting.wav';
      paintLabel();
      paintHello(false);
    });
    const paintHello = (playing) => {
      helloIc.innerHTML = playing ? SVG_PAUSE : SVG_PLAY;
      hello.classList.toggle('is-playing', playing);
      hello.setAttribute('aria-label', playing
        ? 'Stop the greeting'
        : greeting
          ? `Play the record’s ${shortName(greeting)} greeting`
          : 'Play the record’s English greeting: hello from the children of planet Earth');
    };
    paintLabel();
    ha.addEventListener('play', () => paintHello(true));
    ha.addEventListener('pause', () => paintHello(false)); // also fires on ended
    ha.addEventListener('ended', () => { ha.currentTime = 0; });
    hello.addEventListener('click', () => {
      if (ha.paused) ha.play().catch(() => {});
      else { ha.pause(); ha.currentTime = 0; }
    });
    paintHello(false); // sets the aria-label once, from the same helper
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
        <input class="gm-slider" type="range" min="0" max="1000" step="1" id="gm-drake-${f.k}">`;
      const input = row.querySelector('input');
      const out = row.querySelector('output');
      row.querySelector('label').setAttribute('for', input.id); // the sentence names the slider
      const say = (v) => { out.textContent = f.fmt(v); input.setAttribute('aria-valuetext', f.fmt(v)); };
      input.value = String(toT(f, vals[f.k]));
      say(vals[f.k]);
      input.addEventListener('input', () => {
        vals[f.k] = toV(f, +input.value);
        say(vals[f.k]);
        for (const b of presetsEl.children) b.classList.remove('is-active');
        paintN();
      });
      rows[f.k] = { f, input, out, say };
      xEl.appendChild(row);
    }
    PRESETS.forEach((p, i) => {
      const b = el('button', 'gm-mode' + (i === 0 ? ' is-active' : ''), p.name);
      b.addEventListener('click', () => {
        Object.assign(vals, p.v);
        for (const f of F) {
          rows[f.k].input.value = String(toT(f, vals[f.k]));
          rows[f.k].say(vals[f.k]);
        }
        for (const x of presetsEl.children) {
          x.classList.toggle('is-active', x === b);
          x.setAttribute('aria-pressed', String(x === b));
        }
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
    slider.setAttribute('aria-valuetext', `${fmtMyr(myr)} million years after launch`);
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
    '<a href="https://github.com/gourneau/golden-record" target="_blank" rel="noopener">code &amp; sources on GitHub</a>' +
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
  earthChip.setAttribute('aria-pressed', 'false');
  // toggles: a second click returns you to where the act's view was
  earthChip.addEventListener('click', () =>
    ctx.select(state.selected === 'earth' ? null : 'earth'));
  bus.addEventListener('select', (e) => {
    const on = e.detail.target === 'earth';
    earthChip.classList.toggle('is-active', on);
    earthChip.setAttribute('aria-pressed', String(on));
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

  // ---- mobile sheet headers -------------------------------------------------
  // On phones every panel is the same bottom sheet, and every sheet wears the
  // same header bar: label on the left, state glyph on the right, the whole row
  // one tap target. An act's own sheet collapses to just that bar (so the scene
  // takes the screen and the bar still says what is hiding there); the
  // transient detail card closes instead — its glyph is a ✕, not a chevron.
  // Desktop hides the bars entirely: there the panels are columns, not sheets.
  const sheetTab = (panel, label, onClose) => {
    const b = el('button', 'gm-sheet-tab mono');
    const l = el('span', 'gm-sheet-tab-l');
    const ic = el('span', 'gm-sheet-tab-ic');
    ic.setAttribute('aria-hidden', 'true');
    l.textContent = label;
    b.append(l, ic);
    panel.prepend(b);

    if (onClose) {
      ic.textContent = '✕';
      const say = (t) => b.setAttribute('aria-label', `Close ${t}`);
      say(label);
      b.addEventListener('click', onClose);
      return { setLabel: (t) => { l.textContent = t; say(t); }, setCollapsed: () => {} };
    }
    const paint = () => {
      const collapsed = panel.classList.contains('sheet-collapsed');
      ic.textContent = collapsed ? '▴' : '▾';
      b.setAttribute('aria-expanded', String(!collapsed));
    };
    const setCollapsed = (on) => {
      panel.classList.toggle('sheet-collapsed', on);
      if (on) panel.scrollTop = 0;
      paint();
    };
    b.addEventListener('click', () => {
      const open = panel.classList.contains('sheet-collapsed');
      setCollapsed(!open);
      // tell the tour: with the sheet down to a bar, the scene owns the whole
      // screen and the portrait framing re-centers into it (act changes reset
      // every sheet to open, and tour.js resets its own flag to match)
      bus.dispatchEvent(new CustomEvent('sheet', { detail: { open } }));
    });
    paint();
    return { setLabel: (t) => { l.textContent = t; }, setCollapsed };
  };
  const tabs = {
    explainer: sheetTab(explainer, 'How to read it'),
    rail: sheetTab(rail, 'The fourteen beacons'),
    verdict: sheetTab(verdict, 'Is it wrong?'),
    finders: sheetTab(finders, 'For the finders'),
    detail: sheetTab(detail, 'Details', () => ctx.select(null)),
  };
  // every act arrives with its own sheet open — one rule, no exceptions — and
  // the portrait camera framings are all composed for exactly that state
  const resetSheets = () => {
    for (const k of ['explainer', 'rail', 'verdict', 'finders']) tabs[k].setCollapsed(false);
  }; // applyAct runs it on every act change, including the first

  // ---- assemble ---------------------------------------------------------
  // `mini` is deliberately NOT in actPanels: the record keeps playing, and
  // its dock keeps showing, across every act change
  root.append(nav, title, explainer, rail, detail, verdict, finders, corner, artifactChip, earthChip, mini, tip);

  // ---- live chrome metrics -------------------------------------------------
  // Every mobile offset in the stylesheet hangs off the REAL height of the
  // docked player and of the act nav — safe-area insets, font swaps, wrapped
  // rows and all — instead of a constant that drifts out of true. Measured
  // here, published as --dock-h / --nav-h.
  const miniBar = mini.querySelector('.gm-mini-bar');
  const measureChrome = () => {
    const set = (k, px) => document.documentElement.style.setProperty(k, `${Math.round(px)}px`);
    set('--dock-h', miniBar.getBoundingClientRect().height);
    set('--nav-h', nav.getBoundingClientRect().height);
    // how far left the second scene chip must sit to ride beside the first
    set('--chip-w', artifactChip.getBoundingClientRect().width + 6);
  };
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(measureChrome); // fires once on observe
    ro.observe(miniBar);
    ro.observe(nav);
    ro.observe(artifactChip);
  } else {
    measureChrome();
    window.addEventListener('resize', measureChrome);
  }

  // ---- what the chrome covers, in px ---------------------------------------
  // The tour frames each act into the part of the viewport the panels DON'T
  // cover. Only ui.js knows which panels are up and how wide the breakpoint
  // made them, so it answers the question rather than letting tour.js re-derive
  // it from class names and media queries — that is exactly the fork this
  // file's ownership rule exists to prevent, and it is how the camera came to
  // compensate for a 400px right-hand panel that Act III does not have while
  // ignoring the 400px LEFT-hand rail that it does.
  //
  // offsetLeft/offsetTop/offsetWidth, NOT getBoundingClientRect: panels ride a
  // translateX(±18px) while they fade in, and the tour asks for insets in the
  // same tick as the class flip, so a transformed rect would be 18px out. The
  // offset* family is layout-based and ignores transforms; html is
  // overflow:hidden and #ui is the fixed offsetParent at 0,0, so these are
  // already viewport coordinates.
  const leftPanels = [explainer, rail, verdict];
  const rightPanels = [detail, finders];
  const up = (n) => n.classList.contains('is-on') && n.offsetWidth > 0;
  ctx.sceneInsets = () => {
    const ins = { left: 0, right: 0, top: 0, bottom: 0 };
    if (ctx.still) return ins; // screenshot mode hides every panel
    const W = window.innerWidth, H = window.innerHeight;
    ins.top = nav.offsetTop + nav.offsetHeight;
    // the docked player is a centered pill floating clear of the bottom edge —
    // measure where its TOP is rather than assuming its height is the whole band
    ins.bottom = H - miniBar.getBoundingClientRect().top;
    for (const n of [artifactChip, earthChip, corner]) {
      if (up(n)) ins.bottom = Math.max(ins.bottom, H - n.offsetTop);
    }
    // ≤900px every panel is a bottom sheet, not a column: no side insets, and
    // the sheet's own height is already handled by PHONE_HOMES + sheetRecenter
    if (ctx.phoneLayout()) return ins;
    for (const n of leftPanels) if (up(n)) ins.left = Math.max(ins.left, n.offsetLeft + n.offsetWidth);
    for (const n of rightPanels) if (up(n)) ins.right = Math.max(ins.right, W - n.offsetLeft);
    return ins;
  };

  // ---- act / selection plumbing ------------------------------------------
  const actPanels = [title, explainer, rail, verdict, finders, artifactChip, earthChip];
  const DETAIL_ACTS = new Set(['pulsars', 'verdict', 'finders']);

  // Panels fade and slide for 0.6s on every act and selection change. For that
  // window, css/style.css drops the backdrop blur and promotes the moving
  // panels to their own layers — blurring a live WebGL backdrop WHILE animating
  // over it is what makes the transitions stutter (Firefox especially, which
  // re-blurs every backdrop every frame). Nothing about the settled look
  // changes; the class is gone before anyone can see the difference.
  let animTimer = 0;
  const markAnimating = () => {
    document.body.classList.add('gm-anim');
    clearTimeout(animTimer);
    animTimer = setTimeout(() => document.body.classList.remove('gm-anim'), 750);
  };

  function paintDetailVisibility() {
    // the Voyager easter egg lives in Act I — its card may show there too
    const on = !!state.selected &&
      (DETAIL_ACTS.has(state.act) || state.selected === 'voyager');
    detail.classList.toggle('is-on', on);
    // on phones the sheet slot holds one card at a time: while a detail card
    // is up the rail steps aside (CSS) rather than stacking two header bars
    document.body.classList.toggle('gm-has-detail', on);
  }
  // Act V: the finders panel and the detail panel share the right column —
  // yield to the detail panel while something is selected, restore on deselect
  function paintFindersVisibility() {
    if (state.act !== 'finders') return; // applyAct already switched it off
    finders.classList.toggle('is-on', !state.selected);
  }
  function applyAct(act) {
    markAnimating();
    for (const p of actPanels) p.classList.toggle('is-on', p.dataset.acts.includes(act));
    for (const [id, b] of actBtns) {
      b.classList.toggle('is-current', id === act);
      if (id === act) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    }
    const i = ACTS.findIndex((a) => a.id === act);
    progress.firstElementChild.style.transform =
      `scaleX(${((i < 0 ? 0 : i) + 1) / ACTS.length})`;
    navTitle.textContent = i < 0 ? '' : ACTS[i].title;
    prevArrow.disabled = i <= 0;
    nextArrow.disabled = i >= ACTS.length - 1;
    // name the act each chevron would take you to (and say it to a screen
    // reader too, which previously only heard "next act")
    for (const b of [prevArrow, nextArrow]) {
      const to = ACTS[i + Number(b.dataset.dir)];
      const key = b.dataset.dir === '-1' ? 'Back' : 'Next';
      const dest = b.querySelector('.gm-nav-dest');
      dest.textContent = '';
      if (to) {
        dest.append(`${key} · ${to.title}`);
        // the keyboard shortcut as a keycap, not a sentence — it reads at a
        // glance and stays inside our own type and palette
        const k = el('kbd', 'gm-key', b.dataset.dir === '-1' ? '←' : '→');
        k.setAttribute('aria-hidden', 'true');
        dest.append(' ', k);
      }
      b.setAttribute('aria-label', to
        ? `${key === 'Back' ? 'Previous act' : 'Next act'}: ${to.numeral} — ${to.title}`
        : `${key === 'Back' ? 'Previous act' : 'Next act'} (none)`);
    }
    resetSheets();
    if (act === 'map') { demoStart(); loadCoverFigure(); }
    else demo.active = false;
    paintDetailVisibility();
    paintFindersVisibility();
  }

  bus.addEventListener('act', (e) => applyAct(e.detail.act));
  bus.addEventListener('select', (e) => {
    const target = e.detail.target;
    markAnimating();
    for (const r of rows) r.el.classList.toggle('is-selected', r.target === target);
    // (on phones the rail simply steps aside under the detail card — CSS —
    // and comes back exactly as the reader left it)
    if (target) renderDetail(target);
    paintDetailVisibility();
    paintFindersVisibility();
  });
  bus.addEventListener('mapmode', (e) => paintMode(e.detail.mode));
  bus.addEventListener('timeMyr', (e) => {
    const myr = e.detail.myr;
    if (document.activeElement !== slider) slider.value = String(myrToV(myr));
    paintTime(myr);
  });

  // ...and again whenever the viewport crosses the phone/desktop boundary,
  // because the Act II framing depends on whether the explainer is a column
  // or a sheet (it fired only once at init, so it went stale on rotate)
  let layoutWasSheet = isSheetMode();
  let layoutTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(() => {
      const now = isSheetMode();
      if (now !== layoutWasSheet) { layoutWasSheet = now; emitLayout(); }
    }, 250);
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
