// Pre-validates upcoming daily puzzles: unique solution, determinism, difficulty.
// Usage: node tools/validate.js [startDate YYYY-MM-DD] [days]
const E = require("../js/engine.js");
const start = process.argv[2] || new Date().toLocaleDateString("en-CA");
const days = parseInt(process.argv[3] || "30", 10);
let fail = 0;
const rows = [];
for (let i = 0; i < days; i++) {
  const d = E.addDays(start, i);
  let p;
  try { p = E.generate(d); } catch (e) { fail++; rows.push(`${d}  FAIL generate: ${e.message}`); continue; }
  const again = E.generate(d);
  const deterministic = JSON.stringify(again.target) === JSON.stringify(p.target) && JSON.stringify(again.start) === JSON.stringify(p.start);
  const s = E.solve(p); // independent brute-force re-check
  const unique = s.solutions.length === 1 && s.solutions[0].join() === p.solution.join();
  const startDiff = E.diffCount(E.render(p, p.start), p.target);
  const allOff = p.start.every((v, k) => v !== p.solution[k]); // par = number of panes
  const visible = E.allVisible(p, p.start);
  const ok = unique && deterministic && startDiff >= 4 && allOff && visible;
  if (!ok) fail++;
  rows.push(`${d} #${String(p.number).padStart(3)} ${p.day.padEnd(9)} ${p.n}x${p.n} panes=${p.panes.length} combos=${String(s.total).padStart(4)} near=${String(s.near).padStart(3)} mixed=${String(s.mixed).padStart(2)} diff=${String(s.difficulty).padStart(5)} unique=${unique ? "yes" : "NO"} deterministic=${deterministic ? "yes" : "NO"} startOff=${startDiff} fits=${p.stats.fits} par=${allOff ? p.panes.length : "BAD"} grabbable=${visible ? "yes" : "NO"}`);
}
{ // tutorial must also have exactly one answer
  const t = E.tutorial(), s = E.solve(t);
  const ok = s.solutions.length === 1 && s.solutions[0].join() === t.solution.join() && t.start.every((v, k) => v !== t.solution[k]);
  if (!ok) fail++;
  rows.unshift(`tutorial 3x3 solutions=${s.solutions.length} ${ok ? "ok" : "FAIL"}`);
}
console.log(rows.join("\n"));
console.log(`\n${days - fail}/${days} puzzles passed.`);
process.exit(fail ? 1 : 0);
