// Pre-validates upcoming daily puzzles: unique solution, determinism, par reachable.
// Usage: node tools/validate.js [startDate YYYY-MM-DD] [days]
const E = require("../js/engine.js");
const start = process.argv[2] || new Date().toLocaleDateString("en-CA");
const days = parseInt(process.argv[3] || "30", 10);
let fail = 0, greedyFail = 0, glide = 0;
const rows = [];
for (let i = 0; i < days; i++) {
  const d = E.addDays(start, i);
  let p;
  try { p = E.generate(d); } catch (e) { fail++; rows.push(`${d}  FAIL generate: ${e.message}`); continue; }
  const again = E.generate(d);
  const deterministic = JSON.stringify(again.target) === JSON.stringify(p.target) && JSON.stringify(again.start) === JSON.stringify(p.start);
  if (p.glide) { // glide rules (from ${E.GLIDE_FROM})
    glide++;
    const sols = E.glideSolutions(p), unique = sols.length === 1 && sols[0].join() === p.solution.join();
    const dist = E.distOf(p, p.start), greedy = E.greedySolves(p, p.start, p.par); if (!greedy) greedyFail++;
    const ok = unique && deterministic && dist === p.par && p.n <= 5;
    if (!ok) fail++;
    rows.push(`${d} #${String(p.number).padStart(3)} ${p.day.padEnd(9)} ${p.n}x${p.n} panes=${p.panes.length} par=${p.par} shortest=${dist} unique=${unique ? "yes" : "NO"} deterministic=${deterministic ? "yes" : "NO"} greedy=${greedy ? "solves" : "misses par"}`);
    continue;
  }
  const s = E.solve(p); // classic rules (dates before the switch): brute-force re-check
  const unique = s.solutions.length === 1 && s.solutions[0].join() === p.solution.join();
  const allOff = p.start.every((v, k) => v !== p.solution[k]);
  const ok = unique && deterministic && allOff && E.allVisible(p, p.start);
  if (!ok) fail++;
  rows.push(`${d} #${String(p.number).padStart(3)} classic ${p.n}x${p.n} panes=${p.panes.length} unique=${unique ? "yes" : "NO"} deterministic=${deterministic ? "yes" : "NO"}`);
}
{ // tutorial: one answer, solvable in par from every state you can reach
  const t = E.tutorial(), ok = E.glideSolutions(t).length === 1 && E.distOf(t, t.start) === t.par;
  if (!ok) fail++;
  rows.unshift(`tutorial ${t.n}x${t.n} par=${t.par} ${ok ? "ok" : "FAIL"}`);
}
console.log(rows.join("\n"));
console.log(`\n${days - fail}/${days} puzzles passed. Glide dailies: ${glide}, greedy misses par on ${greedyFail}.`);
process.exit(fail ? 1 : 0);
