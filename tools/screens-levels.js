// Headless Levels-mode test + screenshots at 390x844. Needs a server on :8765 (or pass a base URL).
const { chromium } = require(process.env.PW || "playwright-core");
const base = process.argv[2] || "http://127.0.0.1:8765/";
const out = __dirname + "/../screenshots/";
const errors = [];
function watch(page, tag) {
  page.on("console", m => { if (m.type() === "error" || m.type() === "warning") errors.push(tag + " " + m.type() + ": " + m.text()); });
  page.on("pageerror", e => errors.push(tag + " pageerror: " + e.message));
  page.on("requestfailed", r => errors.push(tag + " requestfailed: " + r.url()));
}
async function drag(page, pi, to) {
  const g = await page.evaluate(i => PS.grabPoint(i), pi);
  const from = await page.evaluate(i => PS.state.pos[i], pi);
  let dx = 0, dy = 0;
  if (g.axis === "b") { const w = g.mc + 1; dx = (to % w - from % w) * g.step; dy = (Math.floor(to / w) - Math.floor(from / w)) * g.step; }
  else if (g.axis === "h") dx = (to - from) * g.step; else dy = (to - from) * g.step;
  await page.mouse.move(g.x, g.y); await page.mouse.down();
  await page.mouse.move(g.x + dx, g.y + dy, { steps: 12 });
  await page.mouse.up(); await page.waitForTimeout(420);
  const now = await page.evaluate(i => PS.state.pos[i], pi);
  if (now !== to) throw new Error(`drag pane ${pi} to ${to} landed at ${now}`);
}
async function solve(page, skip = []) {
  const P = await page.evaluate(() => ({ sol: PS.puzzle.solution, lock: PS.puzzle.panes.map(p => !!p.locked) }));
  for (let i = 0; i < P.sol.length; i++) if (!P.lock[i] && !skip.includes(i)) {
    const cur = await page.evaluate(k => PS.state.pos[k], i);
    if (cur !== P.sol[i]) await drag(page, i, P.sol[i]);
  }
}
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage(); watch(page, "[levels]");
  await page.goto(base + "?test=1&tutorial=0", { waitUntil: "networkidle" });
  console.log("start mode:", await page.evaluate(() => PS.mode));
  await page.click("#tabLevels"); await page.waitForTimeout(400);
  console.log("after tab:", await page.evaluate(() => PS.mode));
  await page.click("#btnPlayNext"); await page.waitForTimeout(500);
  console.log("level:", await page.evaluate(() => PS.puzzle.level + " " + PS.puzzle.n + "x" + PS.puzzle.n));
  await solve(page);
  await page.waitForSelector("#dlgLevel[open]", { timeout: 4000 }); await page.waitForTimeout(900);
  await page.screenshot({ path: out + "levels-win.png" });
  console.log("L1 stars:", await page.evaluate(() => PS.progress.stars[1]), "unlocked:", await page.evaluate(() => PS.progress.unlocked));
  await page.click("#btnNext"); await page.waitForTimeout(500);
  console.log("next level:", await page.evaluate(() => PS.puzzle.level));
  // Hint on level 2
  await page.click("#btnHint"); await page.waitForTimeout(500);
  await page.screenshot({ path: out + "levels-hint.png" });
  await solve(page);
  await page.waitForSelector("#dlgLevel[open]", { timeout: 4000 }); await page.waitForTimeout(800);
  console.log("L2 with hint stars:", await page.evaluate(() => PS.progress.stars[2]), "hints left:", await page.evaluate(() => PS.progress.hints));
  await page.click("#btnMap2"); await page.waitForTimeout(500);
  console.log("map mode:", await page.evaluate(() => PS.mode));

  // Seed progress: levels 1-9 cleared, then clear level 10 for the milestone screen.
  await page.evaluate(() => {
    const stars = {}; for (let i = 1; i <= 9; i++) stars[i] = i === 4 ? 2 : 3;
    localStorage.setItem("ps2:levels", JSON.stringify({ unlocked: 10, stars, best: {}, hints: 2, perf: 5, bestPerf: 5, mile: [5], threeSince: 2, tips: [] }));
  });
  await page.goto(base + "?test=1&tutorial=0&level=10", { waitUntil: "networkidle" }); await page.waitForTimeout(500);
  await solve(page);
  await page.waitForSelector("#dlgMile[open]", { timeout: 4000 }); await page.waitForTimeout(900);
  await page.screenshot({ path: out + "levels-milestone.png" });
  await page.click("#btnMileShare"); await page.waitForTimeout(300);
  console.log("milestone share:\n" + await page.evaluate(() => navigator.clipboard.readText()));
  console.log("after L10 hints:", await page.evaluate(() => PS.progress.hints), "(2 + 1 milestone + 1 for three 3-stars, max 5)");
  await page.click("#btnMileNext"); await page.waitForTimeout(500);
  console.log("after milestone level:", await page.evaluate(() => PS.puzzle.level));

  // Map with progress
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem("ps2:levels")); p.unlocked = 27;
    for (let i = 1; i <= 26; i++) p.stars[i] = p.stars[i] || [3, 2, 3, 1, 3][i % 5];
    localStorage.setItem("ps2:levels", JSON.stringify(p));
  });
  await page.goto(base + "?test=1&tutorial=0&mode=levels", { waitUntil: "networkidle" }); await page.waitForTimeout(800);
  await page.screenshot({ path: out + "levels-map.png" });

  // Mid-level: level 30 (locked-glass twist, tip shown), then two correct moves.
  await page.goto(base + "?test=1&tutorial=0&level=30", { waitUntil: "networkidle" }); await page.waitForTimeout(600);
  await page.screenshot({ path: out + "levels-twist-tip.png" });
  const P = await page.evaluate(() => ({ sol: PS.puzzle.solution, lock: PS.puzzle.panes.map(p => !!p.locked), twist: PS.puzzle.twist }));
  console.log("L30 twist:", P.twist, "locked panes:", P.lock.filter(Boolean).length);
  const mov = P.lock.map((l, i) => l ? -1 : i).filter(i => i >= 0);
  await drag(page, mov[0], P.sol[mov[0]]); await drag(page, mov[1], P.sol[mov[1]]);
  await page.waitForTimeout(300);
  await page.screenshot({ path: out + "levels-mid.png" });
  await solve(page);
  await page.waitForSelector("#dlgLevel[open], #dlgMile[open]", { timeout: 4000 });
  console.log("L30 solved, stars:", await page.evaluate(() => PS.progress.stars[30]));

  // Free pane (level 70) with colour-blind patterns
  const p2 = await ctx.newPage(); watch(p2, "[free]");
  await p2.goto(base + "?test=1&tutorial=0&level=70", { waitUntil: "networkidle" });
  await p2.click("#btnSettings"); await p2.click("label:has(#optPatterns)"); await p2.keyboard.press("Escape");
  await p2.waitForTimeout(400);
  await p2.screenshot({ path: out + "levels-free-patterns.png" });
  console.log("L70 twist:", await p2.evaluate(() => PS.puzzle.twist), "patterns:", await p2.evaluate(() => document.body.classList.contains("patterns")));
  await solve(p2);
  await p2.waitForSelector("#dlgLevel[open], #dlgMile[open]", { timeout: 4000 });
  console.log("L70 (free pane) solved by dragging: yes");

  // On-the-fly level beyond the precomputed file
  const t0 = Date.now();
  await p2.goto(base + "?test=1&tutorial=0&level=777", { waitUntil: "networkidle" }); await p2.waitForTimeout(200);
  console.log("L777 generated on the fly:", await p2.evaluate(() => PS.puzzle.level + " " + PS.puzzle.n + "x" + PS.puzzle.n), Date.now() - t0, "ms incl. page load");
  await solve(p2);
  await p2.waitForSelector("#dlgLevel[open], #dlgMile[open]", { timeout: 4000 });
  console.log("L777 solved: yes");

  console.log("console errors/warnings:", errors.length ? errors : "none");
  await browser.close();
})().catch(e => { console.error("TEST FAILED:", e.message); console.log("errors so far:", errors); process.exit(1); });
