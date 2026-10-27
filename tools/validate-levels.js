// Validate Levels mode. Usage: node tools/validate-levels.js [extraUpTo=600]
// 1) Every precomputed level in js/levels.js: brute-force exactly one solution, identical to the
//    seeded generator (deterministic), every pane starts out of place and is grabbable.
// 2) On-the-fly levels 301..extraUpTo: same checks plus generation time.
const E = require("../js/engine.js"), fs = require("fs"), vm = require("vm");
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(__dirname + "/../js/levels.js", "utf8"), ctx);
const DATA = ctx.window.PANESLIDE_LEVELS, extra = +process.argv[2] || 600;
let fail = 0; const tiers = {};
function fitsOf(l) { return l.panes.reduce((a, p) => { let k = 0; for (let v = 0; v <= p.max; v++) if (E.paneCells(p, v).every(c => l.target[c[0] * l.n + c[1]] & E.BIT[p.color])) k++; return a * k; }, 1); }
let relaxed = 0; const twists = {}, flavours = {};
function check(l, N, src) {
  if (fitsOf(l) < E.levelConfig(N).fits) relaxed++;
  const s = E.solve(l), errs = [];
  if (s.solutions.length !== 1) errs.push("solutions=" + s.solutions.length);
  else if (s.solutions[0].join() !== l.solution.join()) errs.push("solution mismatch");
  if (!l.start.every((v, i) => l.panes[i].locked ? v === l.solution[i] : v !== l.solution[i])) errs.push("a pane starts in place");
  if (!E.allVisible(l, l.start)) errs.push("pane not grabbable");
  if (errs.length) { fail++; console.log(src, "level", N, "FAIL", errs.join(", ")); }
  if (l.n > 5) { fail++; console.log("level", N, "FAIL board bigger than 5x5"); }
  twists[l.twist || "none"] = (twists[l.twist || "none"] || 0) + 1; if (l.challenge) twists.challenge = (twists.challenge || 0) + 1;
  flavours[l.flavour || "early"] = (flavours[l.flavour || "early"] || 0) + 1;
  if (l.breather) return;
  const k = N <= 22 ? "1-22" : N <= 50 ? "23-50" : N <= 100 ? "51-100" : N <= 200 ? "101-200" : N <= 300 ? "201-300" : N <= 500 ? "301-500" : N <= 1000 ? "501-1000" : "1001+";
  const cf = E.levelConfig(N), t = tiers[k] || (tiers[k] = { order: N, n: new Set(), panes: [], fits: [], mixed: [], s: [] });
  t.n.add(l.n + "x" + l.n); t.panes.push(E.movable(l)); t.fits.push(fitsOf(l)); t.mixed.push(l.target.filter(m => m & (m - 1)).length); t.s.push(cf.s);
}
DATA.forEach((a, i) => {
  const N = i + 1, l = E.unpackLevel(a, N), g = E.generateLevel(N);
  if (JSON.stringify(E.packLevel(g)) !== JSON.stringify(a)) { fail++; console.log("level", N, "FAIL not deterministic"); }
  check(l, N, "pre");
});
let slow = 0, fb = 0; const t0 = Date.now();
for (let N = DATA.length + 1; N <= extra; N++) {
  const s = Date.now(), l = E.generateLevel(N); slow = Math.max(slow, Date.now() - s); if (l.fallback) fb++;
  check(l, N, "fly"); // brute force on 7x7 is slower; sample
}
const avg = a => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
console.log("levels     board        avg panes  avg spots(fits)  avg mixed cells  curve s   (breathers excluded)");
Object.values(tiers).sort((a, b) => a.order - b.order).forEach(t => { const k = Object.keys(tiers).find(x => tiers[x] === t); console.log(k.padEnd(10), [...t.n].join("/").padEnd(12), avg(t.panes).padEnd(10), avg(t.fits).padEnd(16), avg(t.mixed).padEnd(16), avg(t.s)); });
console.log(`on-the-fly ${DATA.length + 1}-${extra}: ${Date.now() - t0} ms total, slowest ${slow} ms, fallbacks ${fb}`);
console.log("twists/challenges:", JSON.stringify(twists), " flavours:", JSON.stringify(flavours));
console.log("levels where the ambiguity rule was relaxed to find a puzzle:", relaxed);
console.log(fail ? fail + " FAILURES" : `All checks passed (${DATA.length} precomputed + ${extra - DATA.length} on-the-fly).`);
process.exit(fail ? 1 : 0);
