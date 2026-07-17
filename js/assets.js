// Static-asset helpers: the artwork ships as plain files under vendor/art/
// (normal static hosting — GitHub Pages, python -m http.server, anywhere).
//
// Sources (both public domain):
//   vendor/art/voyager_golden_plaque.svg      — full cover design, PD-US,
//     vectorization VectorVoyager / Wikimedia Commons, after NASA/JPL
//   vendor/art/voyager_cover_explanation.svg  — NASA/JPL annotated diagram

export async function loadText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

// The plaque, restyled: strokes -> `stroke`, the gold disk fill -> `disk`
// ('none' lets a richer canvas-painted gold show through).
export function plaqueSvg(raw, { stroke = '#3e3220', disk = 'none' } = {}) {
  return raw
    .replaceAll('stroke:#ffffff', 'stroke:' + stroke)
    .replaceAll('fill:#d4af37', 'fill:' + disk);
}

// The explanation diagram, restyled for the page's dark theme. The label
// text is outlined as paths with NO fill/stroke attributes — SVG defaults
// those to black (invisible on our void), so an injected rule turns exactly
// that set gold and readable.
export function explanationSvg(raw, { stroke = '#c9a227', fill = '#0d0a06', text = '#e8cf7a' } = {}) {
  return raw
    .replaceAll('stroke="#000000"', 'stroke="' + stroke + '"')
    .replaceAll('fill="#FFFFFF"', 'fill="' + fill + '"')
    .replace(/<svg\b[^>]*>/, (m) =>
      `${m}<style>path:not([fill]):not([stroke]){fill:${text}}</style>`);
}
