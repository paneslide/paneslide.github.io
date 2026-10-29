// Validate Levels mode (glide rules). Usage: node tools/validate-levels.js [extraUpTo=1000]
// For every precomputed level in js/levels.js, plus on-the-fly levels up to extraUpTo:
//  - deterministic: identical to the seeded generator
//  - exactly one arrangement of the panes shows the target (and it is the stored solution)
//  - par is reachable: an independent forward search from the start finds the target in exactly `par` swipes
//  - board at most 5x5
// It also reports how often a "greedy" player (always fixes the most cells) misses par.
const E = require("../js/engine.js"), fs = require("fs"), vm = require("vm");
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(__dirname + "/../js/levels.js", "utf8"), ctx);
const DATA = ctx.window.PANESLIDE_LEVELS, extra = Math.max(+process.argv[2] || 1000, DATA.length);
let fail = 0, fb = 0; const tiers = {};
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
console.log(`levels using fallback 1 (par one off the curve): ${fb}; ${Date.now() - t0} ms total` + (extra > DATA.length ? `, on-the-fly slowest ${slow} ms` : ""));
console.log(fail ? fail + " FAILURES" : `All checks passed (${DATA.length} precomputed + ${extra - DATA.length} on-the-fly).`);
process.exit(fail ? 1 : 0);
