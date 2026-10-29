// Original SVG diagrams for the guides, drawn like the game board. Panes are rectangles:
// { c: "C"|"M"|"Y", r, col, w, h, axis: "h"|"v", locked, one: 1|-1, frost, ghost }
const HEX = { C: "#3CC8F0", M: "#F0509A", Y: "#FFD84A" };
const BIT = { C: 1, M: 2, Y: 4 };
function rgb(h) { return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); }
function mix(mask) { let c = [255, 255, 255]; ["C", "M", "Y"].forEach(k => { if (mask & BIT[k]) { const x = rgb(HEX[k]); c = c.map((v, i) => Math.min(v, x[i])); } }); return "rgb(" + c.join(",") + ")"; }
function dark(h, f) { return "rgb(" + rgb(h).map(v => Math.round(v * f)).join(",") + ")"; }
const CELL = 56, GAP = 6, PAD = 10, STEP = CELL + GAP;
function x0(c) { return PAD + c * STEP; }
function has(list, r, c) { return (list || []).some(p => p[0] === r && p[1] === c); }
function arrowPath(cx, cy, axis, one, s) { // a double (or single) headed arrow centred on cx,cy
  const L = s * 0.62, H = s * 0.2;
  const seg = axis === "h" ? [[cx - L / 2, cy], [cx + L / 2, cy]] : [[cx, cy - L / 2], [cx, cy + L / 2]];
  let d = `M${seg[0][0]} ${seg[0][1]}L${seg[1][0]} ${seg[1][1]}`;
  const head = (p, dir) => axis === "h" ? `M${p[0] - dir * H} ${p[1] - H}L${p[0]} ${p[1]}L${p[0] - dir * H} ${p[1] + H}` : `M${p[0] - H} ${p[1] - dir * H}L${p[0]} ${p[1]}L${p[0] + H} ${p[1] - dir * H}`;
  if (!one || one > 0) d += head(seg[1], 1);
  if (!one || one < 0) d += head(seg[0], -1);
  return d;
}
function board(o) {
  const n = o.n, W = PAD * 2 + n * STEP - GAP, panes = o.panes || [];
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" width="${o.size || W}" height="${o.size || W}" role="img" aria-label="${esc(o.alt || "PaneSlide board diagram")}">`;
  s += `<rect x="1" y="1" width="${W - 2}" height="${W - 2}" rx="18" fill="#F4EFFF" stroke="#D9CCF7" stroke-width="2"/>`;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const x = x0(c), y = x0(r);
    if (has(o.walls, r, c)) { s += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="11" fill="#8E8AA0"/><path d="M${x + 8} ${y + 20}h${CELL - 16}M${x + 8} ${y + 38}h${CELL - 16}M${x + 22} ${y + 6}v14M${x + 34} ${y + 20}v18M${x + 20} ${y + 38}v12" stroke="#6E6A82" stroke-width="3" stroke-linecap="round"/>`; continue; }
    let fill = "#FFFFFF"; if (has(o.ice, r, c)) fill = "#DDF4FF"; if (has(o.sand, r, c)) fill = "#F6E2B3";
    s += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="11" fill="${fill}" stroke="#E2D9F7" stroke-width="2"/>`;
  }
  // glass bodies mix like filters (multiply), one piece per pane
  s += `<g style="isolation:isolate">`;
  panes.filter(p => !p.ghost).forEach(p => { s += `<rect x="${x0(p.col)}" y="${x0(p.r)}" width="${p.w * STEP - GAP}" height="${p.h * STEP - GAP}" rx="11" fill="${HEX[p.c]}" style="mix-blend-mode:multiply"/>`; });
  s += `</g>`;
  // cell marks drawn above glass: ice flakes, sand dots, gems
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const cx = x0(c) + CELL / 2, cy = x0(r) + CELL / 2;
    if (has(o.ice, r, c)) s += `<g stroke="#5AA9D6" stroke-width="2.4" stroke-linecap="round" opacity=".9"><path d="M${cx} ${cy - 11}v22M${cx - 9.5} ${cy - 5.5}l19 11M${cx - 9.5} ${cy + 5.5}l19 -11"/></g>`;
    if (has(o.sand, r, c)) s += `<g fill="#C9A15A">${[[-12, -10], [6, -13], [13, 3], [-4, 2], [-13, 12], [5, 14]].map(d => `<circle cx="${cx + d[0]}" cy="${cy + d[1]}" r="2.4"/>`).join("")}</g>`;
    if (has(o.gems, r, c)) s += `<path d="M${cx} ${cy - 12}L${cx + 11} ${cy - 2}L${cx} ${cy + 13}L${cx - 11} ${cy - 2}Z" fill="#7BE0FF" stroke="#2A6FB8" stroke-width="2"/><path d="M${cx - 11} ${cy - 2}H${cx + 11}" stroke="#2A6FB8" stroke-width="1.6"/>`;
  }
  // pane outlines, arrows, locks, frost
  panes.forEach(p => {
    const x = x0(p.col) - 2, y = x0(p.r) - 2, w = p.w * STEP - GAP + 4, h = p.h * STEP - GAP + 4;
    if (p.ghost) { s += `<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4}" rx="12" fill="none" stroke="${dark(HEX[p.c], .7)}" stroke-width="2.5" stroke-dasharray="7 6"/>`; return; }
    if (p.frost) s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="13" fill="#E9E6F2" opacity=".93"/><g fill="#fff" opacity=".9"><circle cx="${x + w * .3}" cy="${y + h * .35}" r="5"/><circle cx="${x + w * .62}" cy="${y + h * .6}" r="7"/><circle cx="${x + w * .75}" cy="${y + h * .28}" r="4"/></g>`;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="13" fill="none" stroke="#FFFFFF" stroke-width="4"/>`;
    s += `<rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${h - 6}" rx="10" fill="none" stroke="${p.frost ? "#B5AFC8" : dark(HEX[p.c], .72)}" stroke-width="1.6"/>`;
    const cx = x + w / 2, cy = y + h / 2;
    if (p.locked) s += `<g transform="translate(${cx - 10} ${cy - 12})"><rect x="0" y="9" width="20" height="15" rx="3.5" fill="#2A1B4D"/><path d="M4 10V6a6 6 0 0 1 12 0v4" fill="none" stroke="#2A1B4D" stroke-width="3"/></g>`;
    else if (p.frost) s += `<text x="${cx}" y="${cy + 7}" text-anchor="middle" font-family="Fredoka, system-ui, sans-serif" font-weight="700" font-size="20" fill="#8B7FB0">?</text>`;
    else if (o.arrows !== false) s += `<path d="${arrowPath(cx, cy, p.axis, p.one, CELL)}" fill="none" stroke="rgba(42,27,77,.72)" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`;
  });
  // motion arrows: [[r,c],[r,c]] cell centres
  (o.moves || []).forEach(m => {
    const a = [x0(m[0][1]) + CELL / 2, x0(m[0][0]) + CELL / 2], b = [x0(m[1][1]) + CELL / 2, x0(m[1][0]) + CELL / 2];
    const dx = Math.sign(b[0] - a[0]), dy = Math.sign(b[1] - a[1]), H = 9;
    s += `<path d="M${a[0]} ${a[1]}L${b[0]} ${b[1]}" stroke="#2A1B4D" stroke-width="3.5" stroke-dasharray="2 7" stroke-linecap="round"/>`;
    s += `<path d="M${b[0] - dx * H - dy * H} ${b[1] - dy * H - dx * H}L${b[0]} ${b[1]}L${b[0] - dx * H + dy * H} ${b[1] - dy * H + dx * H}" fill="none" stroke="#2A1B4D" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  });
  (o.stops || []).forEach(p => { const cx = x0(p[1]) + CELL / 2, cy = x0(p[0]) + CELL / 2; s += `<circle cx="${cx}" cy="${cy}" r="12" fill="#fff" stroke="#E8553D" stroke-width="3"/><path d="M${cx - 5} ${cy - 5}l10 10M${cx + 5} ${cy - 5}l-10 10" stroke="#E8553D" stroke-width="3" stroke-linecap="round"/>`; });
  return s + "</svg>";
}
// a target picture: rows of strings using . C M Y B(blue) G(green) R(red) K(black) # (pillar)
const CH = { ".": 0, C: 1, M: 2, B: 3, Y: 4, G: 5, R: 6, K: 7 };
function target(rows, o) {
  o = o || {}; const n = rows.length, T = 34, G = 5, W = 8 + n * (T + G) - G;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" width="${o.size || W}" height="${o.size || W}" role="img" aria-label="${esc(o.alt || "Target picture")}"><rect width="${W}" height="${W}" rx="12" fill="#2A1B4D"/>`;
  rows.forEach((row, r) => row.split("").forEach((ch, c) => {
    const x = 4 + c * (T + G), y = 4 + r * (T + G);
    if (ch === "#") { s += `<rect x="${x}" y="${y}" width="${T}" height="${T}" rx="6" fill="#8E8AA0"/>`; return; }
    if (ch === "?") { s += `<rect x="${x}" y="${y}" width="${T}" height="${T}" rx="6" fill="#B7A9DC"/><text x="${x + T / 2}" y="${y + T * .72}" text-anchor="middle" font-family="Fredoka, system-ui, sans-serif" font-weight="700" font-size="22" fill="#fff">?</text>`; return; }
    const m = CH[ch]; s += `<rect x="${x}" y="${y}" width="${T}" height="${T}" rx="6" fill="${m ? mix(m) : "#3A2A63"}"/>`;
    if (m) s += `<rect x="${x + 1.5}" y="${y + 1.5}" width="${T - 3}" height="${T - 3}" rx="5" fill="none" stroke="rgba(255,255,255,.8)" stroke-width="1.5"/>`;
  }));
  return s + "</svg>";
}
function swatches(list, o) { // [[mask, label], ...] in a row with + and = signs handled by caller
  o = o || {}; const T = 48, G = 14; let x = 4, parts = [];
  list.forEach(it => { if (typeof it === "string") { parts.push(`<text x="${x + 10}" y="${T / 2 + 14}" text-anchor="middle" font-family="Fredoka, system-ui, sans-serif" font-weight="700" font-size="28" fill="#2A1B4D">${it}</text>`); x += 20 + G; return; }
    parts.push(`<rect x="${x}" y="4" width="${T}" height="${T}" rx="11" fill="${mix(it[0])}" stroke="#fff" stroke-width="3"/><rect x="${x}" y="4" width="${T}" height="${T}" rx="11" fill="none" stroke="#CFC3F0" stroke-width="1.2"/><text x="${x + T / 2}" y="${T + 24}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="13" fill="#5E5285">${it[1]}</text>`); x += T + G; });
  const W = x - G + 4, H = T + 32;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(o.alt || "Colour swatches")}">${parts.join("")}</svg>`;
}
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
module.exports = { board, target, swatches, mix, BIT };
