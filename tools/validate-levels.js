// Validate Levels mode (glide rules). Usage: node tools/validate-levels.js [extraUpTo=1000]
// For every precomputed level in js/levels.js, plus on-the-fly levels up to extraUpTo:
//  - deterministic: identical to the seeded generator
//  - exactly one arrangement of the panes shows the target (and it is the stored solution)
//  - par is reachable: an independent forward search from the start finds the target in exactly `par` swipes
//  - board at most 5x5
//  - v8 mechanics: an independent cell-by-cell re-implementation of the glide rules (pillars, ice,
//    sand, one-way) must agree with the engine on every move and on par; gems are collectible on
//    the hint path within par; at most 2 mechanics per level (3 only on challenge levels after 100);
//    nothing appears before it is taught; every mechanic recurs in every chapter after its intro.
// It also reports how often a "greedy" player (always fixes the most cells) misses par.
const E = require("../js/engine.js"), fs = require("fs"), vm = require("vm");
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(__dirname + "/../js/levels.js", "utf8"), ctx);
const DATA = ctx.window.PANESLIDE_LEVELS, extra = Math.max(+process.argv[2] || 1000, DATA.length);
let fail = 0, fb = 0; const tiers = {};
// ---- independent rules (cells, not bitmasks) ----
function cellsOf(p, v) { return E.paneCells(p, v).map(c => c[0] * 100 + c[1]); }
function myGlide(P, pos, i, d) {
  const p = P.panes[i]; if (p.locked || p.axis === "b") return pos[i];
  if (P.oneway && P.oneway[i] && P.oneway[i] !== d) return pos[i];
  const n = P.n, key = k => Math.floor(k / 100) * n + (k % 100);
  const walls = new Set(P.walls || []), ice = new Set(P.ice || []), sand = new Set(P.sand || []);
  const same = j => j !== i && (P.panes[j].axis === p.axis || P.panes[j].axis === "b");
  const blocked = v => cellsOf(p, v).some(k => walls.has(key(k)) || P.panes.some((q, j) => same(j) && cellsOf(q, pos[j]).includes(k)));
  const over = v => { let c = 0; cellsOf(p, v).forEach(k => { if (ice.has(key(k))) return; P.panes.forEach((q, j) => { if (j !== i && !same(j) && cellsOf(q, pos[j]).includes(k)) c++; }); }); return c; };
  const sandN = v => cellsOf(p, v).filter(k => sand.has(key(k))).length;
  let v = pos[i], ov = over(v), sd = sandN(v);
  for (;;) { const w = v + d; if (w < 0 || w > p.max || blocked(w)) break; v = w; const o = over(w); if (o > ov) break; ov = o; const s2 = sandN(w); if (s2 > sd) break; sd = s2; }
  return v;
}
function myMoves(P, pos) { const out = []; P.panes.forEach((p, i) => [-1, 1].forEach(d => { const v = myGlide(P, pos, i, d); if (v !== pos[i]) { const q = pos.slice(); q[i] = v; out.push({ pane: i, dir: d, to: v, pos: q }); } })); return out; }
function myPar(p) {
  const goal = p.solution.join(), seen = new Set([p.start.join()]); let q = [p.start.slice()], d = 0;
  while (q.length) { if (q.some(s => s.join() === goal)) return d; const nq = []; d++;
    for (const s of q) for (const m of myMoves(p, s)) { const k = m.pos.join(); if (!seen.has(k)) { seen.add(k); nq.push(m.pos); } }
    q = nq; if (d > 40) return -1; }
  return -1;
}
const mechUse = {}, chapterUse = {};
function forwardPar(p) { // plain BFS from the start, written separately from the engine's table
  const goal = p.solution.join(), seen = new Set([p.start.join()]); let q = [p.start.slice()], d = 0;
  while (q.length) {
    if (q.some(s => s.join() === goal)) return d;
    const nq = []; d++;
    for (const s of q) for (const m of E.glideMoves(p, s)) { const k = m.pos.join(); if (!seen.has(k)) { seen.add(k); nq.push(m.pos); } }
    q = nq; if (d > 40) return -1;
  }
  return -1;
}
function check(l, N, src) {
  const errs = [];
  if (!l.glide) errs.push("not a glide level");
  if (E.glideSolutions(l).length !== 1 || E.glideSolutions(l)[0].join() !== l.solution.join()) errs.push("solutions=" + E.glideSolutions(l).length);
  if (E.diffCount(E.render(l, l.solution), l.target) !== 0 || !E.validState(l, l.solution)) errs.push("stored solution wrong");
  if (!E.validState(l, l.start)) errs.push("start invalid");
  const fp = forwardPar(l); if (fp !== l.par) errs.push("par " + l.par + " but shortest " + fp);
  if (l.n > 5) errs.push("board bigger than 5x5");
  // v8 mechanics
  const want = E.mechsFor(N), ms = l.mechs || [];
  if (ms.join() !== want.join()) errs.push("mechs " + ms + " but schedule says " + want);
  const cap = (l.challenge && N > 100) ? 3 : 2; if (ms.length > cap) errs.push(ms.length + " mechanics (cap " + cap + ")");
  ms.forEach(m => { if (E.introAt(N) !== m && N < E.MECHS.find(x => x.key === m).at) errs.push(m + " before its intro"); });
  const has = { locked: l.panes.some(p => p.locked), duo: new Set(l.panes.map(p => p.color)).size === 2, pillar: !!(l.walls && l.walls.length), gem: !!(l.gems && l.gems.length), ice: !!(l.ice && l.ice.length), sand: !!(l.sand && l.sand.length), oneway: !!(l.oneway && Object.keys(l.oneway).length), frost: !!(l.frost && l.frost.length), mystery: !!l.mystery };
  ms.forEach(m => { if (!has[m]) errs.push(m + " listed but not on the board"); });
  Object.keys(has).forEach(m => { if (has[m] && m !== "duo" && ms.indexOf(m) < 0) errs.push(m + " on the board but not listed"); });
  if (E.introAt(N) && ms.length !== 1) errs.push("teach level has other mechanics");
  if ((l.walls || []).some(k => l.target[k])) errs.push("pillar under the answer");
  if ((l.frost || []).some(i => l.start[i] === l.solution[i])) errs.push("frosted pane never has to move");
  if (ms.length) {
    if (myPar(l) !== l.par) errs.push("independent rules: shortest " + myPar(l) + " vs par " + l.par);
    let pos = l.start.slice(), steps = 0, got = new Set();
    for (; steps < 40 && pos.join() !== l.solution.join(); steps++) {
      const mv = E.nextMove(l, pos); if (!mv) break;
      const mine = myGlide(l, pos, mv.pane, mv.dir); if (mine !== mv.to) { errs.push("engine/independent disagree on a move"); break; }
      E.sweptCells(l, mv.pane, pos[mv.pane], mv.to).forEach(k => got.add(k)); pos = mv.pos;
    }
    if (steps !== l.par) errs.push("hint path " + steps + " vs par " + l.par);
    if (l.gems && l.gems.some(k => !got.has(k))) errs.push("a gem is not collectible within par");
    const start = new Set(); l.panes.forEach((p, i) => E.paneCells(p, l.start[i]).forEach(c => start.add(c[0] * l.n + c[1])));
    if (l.gems && l.gems.some(k => start.has(k))) errs.push("gem under glass at start");
  }
  ms.forEach(m => { const u = mechUse[m] || (mechUse[m] = []); u.push(N); const ch = Math.ceil(N / 20); (chapterUse[ch] = chapterUse[ch] || new Set()).add(m); });
  if (errs.length) { fail++; console.log(src, "level", N, "FAIL", errs.join(", ")); }
  if (l.fallback) fb++;
  const k = N <= 3 ? "1-3" : N <= 7 ? "4-7" : N <= 10 ? "8-10" : N <= 20 ? "11-20" : N <= 50 ? "21-50" : N <= 100 ? "51-100" : N <= 200 ? "101-200" : N <= 500 ? "201-500" : "501-1000";
  const t = tiers[k] || (tiers[k] = { order: N, n: new Set(), par: [], panes: [], greedyFail: 0, count: 0 });
  t.n.add(l.n + "x" + l.n); t.par.push(l.par); t.panes.push(l.panes.length); t.count++; if (!E.greedySolves(l, l.start, l.par)) t.greedyFail++;
}
const t0 = Date.now();
DATA.forEach((a, i) => {
  const N = i + 1, l = E.unpackLevel(a, N), g = E.generateLevel(N);
  if (JSON.stringify(E.packLevel(g)) !== JSON.stringify(a)) { fail++; console.log("level", N, "FAIL not deterministic"); }
  l.fallback = g.fallback; check(l, N, "pre");
});
let slow = 0;
for (let N = DATA.length + 1; N <= extra; N++) { const s = Date.now(), l = E.generateLevel(N); slow = Math.max(slow, Date.now() - s); check(l, N, "fly"); }
const avg = a => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
console.log("levels     board     avg par  avg panes  greedy misses par");
Object.keys(tiers).sort((a, b) => tiers[a].order - tiers[b].order).forEach(k => { const t = tiers[k]; console.log(k.padEnd(10), [...t.n].join("/").padEnd(9), avg(t.par).padEnd(8), avg(t.panes).padEnd(10), t.greedyFail + "/" + t.count); });
console.log("\nmechanic   taught  uses(1-1000)  first recurrences");
E.MECHS.forEach(m => { const u = (mechUse[m.key] || []); console.log(m.key.padEnd(10), String(m.at).padEnd(7), String(u.length).padEnd(13), u.filter(x => x > m.at).slice(0, 8).join(",")); });
let miss = [];
for (let ch = 1; ch <= Math.ceil(extra / 20); ch++) E.MECHS.forEach(m => { if (m.at <= (ch - 1) * 20 && !(chapterUse[ch] && chapterUse[ch].has(m.key))) miss.push("ch" + ch + ":" + m.key); });
if (miss.length) { fail++; console.log("mechanic missing from a later chapter:", miss.slice(0, 20).join(" ")); } else console.log("every mechanic returns in every chapter after it is taught");
console.log(`levels using fallback 1 (par one off the curve): ${fb}; ${Date.now() - t0} ms total` + (extra > DATA.length ? `, on-the-fly slowest ${slow} ms` : ""));
console.log(fail ? fail + " FAILURES" : `All checks passed (${DATA.length} precomputed + ${extra - DATA.length} on-the-fly).`);
process.exit(fail ? 1 : 0);
