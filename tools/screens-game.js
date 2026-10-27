// Gamified UI test: light, prefers-dark and Chrome forced-dark at 390x844.
// Flow: tutorial -> daily -> win -> levels map -> level win -> milestone, plus help/settings/stats.
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
async function solve(page) {
  const P = await page.evaluate(() => ({ sol: PS.puzzle.solution, lock: PS.puzzle.panes.map(p => !!p.locked) }));
  for (let i = 0; i < P.sol.length; i++) if (!P.lock[i]) {
    const cur = await page.evaluate(k => PS.state.pos[k], i);
    if (cur !== P.sol[i]) await drag(page, i, P.sol[i]);
  }
}
async function run(browser, tag, ctxOpts, full) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ["clipboard-read", "clipboard-write"] }, ctxOpts));
  const page = await ctx.newPage(); watch(page, "[" + tag + "]");
  const sfx = tag === "light" ? "" : "-" + tag;
  await page.goto(base + "?test=1", { waitUntil: "networkidle" });
  console.log(tag, "first visit:", await page.evaluate(() => PS.mode));
  await page.waitForTimeout(900);
  if (full) await page.screenshot({ path: out + "game-tutorial.png" });
  const t = await page.evaluate(() => PS.puzzle.solution);
  await drag(page, 0, t[0]); await drag(page, 1, t[1]);
  await page.waitForSelector("#dlgEnd[open]", { timeout: 4000 }); await page.waitForTimeout(1600);
  if (full) await page.screenshot({ path: out + "game-tutorial-done.png" });
  await page.click("#btnEndMain"); await page.waitForTimeout(600);
  console.log(tag, "after tutorial:", await page.evaluate(() => PS.mode));
  await page.screenshot({ path: out + "game-daily" + sfx + ".png" });
  await solve(page);
  await page.waitForSelector("#dlgEnd[open]", { timeout: 4000 }); await page.waitForTimeout(1900);
  if (full) {
    await page.screenshot({ path: out + "game-daily-win.png" });
    await page.click("#btnShare"); await page.waitForTimeout(300);
    console.log("daily share text:\n" + await page.evaluate(() => navigator.clipboard.readText()));
  }
  await page.click("#btnEndHome"); await page.waitForTimeout(700);
  console.log(tag, "home:", await page.evaluate(() => PS.mode));
  await page.screenshot({ path: out + "game-home" + sfx + ".png" });
  await page.click("#btnPlay", { force: true }); await page.waitForTimeout(700);
  console.log(tag, "map:", await page.evaluate(() => PS.mode));
  if (full) await page.screenshot({ path: out + "game-map-start.png" });
  await page.click("#btnPlayNext"); await page.waitForTimeout(700);
  await page.screenshot({ path: out + "game-level" + sfx + ".png" });
  await solve(page);
  await page.waitForSelector("#dlgLevel[open]", { timeout: 4000 }); await page.waitForTimeout(1900);
  console.log(tag, "L1 stars:", await page.evaluate(() => PS.progress.stars[1]));
  if (full) await page.screenshot({ path: out + "game-win.png" });
  await page.click("#btnNext"); await page.waitForTimeout(700);
  console.log(tag, "next level:", await page.evaluate(() => PS.puzzle.level));
  if (!full) { await ctx.close(); return; }
  await page.click("#btnHint"); await page.waitForTimeout(700);
  await page.screenshot({ path: out + "game-hint.png" });
  await solve(page);
  await page.waitForSelector("#dlgLevel[open]", { timeout: 4000 }); await page.waitForTimeout(1500);
  console.log("L2 with hint stars:", await page.evaluate(() => PS.progress.stars[2]), "hints left:", await page.evaluate(() => PS.progress.hints));
  await page.click("#btnMap2"); await page.waitForTimeout(500);
  // milestone at level 10
  await page.evaluate(() => {
    const stars = {}; for (let i = 1; i <= 9; i++) stars[i] = i === 4 ? 2 : 3;
    localStorage.setItem("ps2:levels", JSON.stringify({ unlocked: 10, stars, best: {}, hints: 2, perf: 5, bestPerf: 5, mile: [5], threeSince: 2, tips: [] }));
  });
  await page.goto(base + "?test=1&level=10", { waitUntil: "networkidle" }); await page.waitForTimeout(500);
  await solve(page);
  await page.waitForSelector("#dlgMile[open]", { timeout: 4000 }); await page.waitForTimeout(2400);
  await page.screenshot({ path: out + "game-milestone.png" });
  console.log("milestone share:\n" + await page.evaluate(() => PS.mileShareText()));
  console.log("after L10 hints:", await page.evaluate(() => PS.progress.hints));
  await page.click("#btnMileNext"); await page.waitForTimeout(500);
  console.log("after milestone level:", await page.evaluate(() => PS.puzzle.level));
  // map with progress
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem("ps2:levels")); p.unlocked = 27;
    for (let i = 1; i <= 26; i++) p.stars[i] = p.stars[i] || [3, 2, 3, 1, 3][i % 5];
    localStorage.setItem("ps2:levels", JSON.stringify(p));
  });
  await page.goto(base + "?test=1&mode=levels", { waitUntil: "networkidle" }); await page.waitForTimeout(900);
  await page.screenshot({ path: out + "game-map.png" });
  // twist tip level 30 + locked pane
  await page.goto(base + "?test=1&level=30", { waitUntil: "networkidle" }); await page.waitForTimeout(800);
  await page.screenshot({ path: out + "game-level30-tip.png" });
  // free pane level 70 with patterns via settings
  await page.goto(base + "?test=1&level=70", { waitUntil: "networkidle" });
  await page.click("#btnSettings"); await page.waitForTimeout(500);
  await page.click("label:has(#optPatterns)"); await page.waitForTimeout(300);
  await page.screenshot({ path: out + "game-settings.png" });
  await page.keyboard.press("Escape"); await page.waitForTimeout(400);
  await page.screenshot({ path: out + "game-level70-patterns.png" });
  await solve(page);
  await page.waitForSelector("#dlgLevel[open], #dlgMile[open]", { timeout: 4000 });
  console.log("L70 free pane solved: yes");
  // help + stats
  await page.goto(base + "?test=1", { waitUntil: "networkidle" }); await page.waitForTimeout(400);
  await page.click("#btnHelp"); await page.waitForTimeout(1400);
  await page.screenshot({ path: out + "game-help.png" });
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await page.click("#btnStats"); await page.waitForTimeout(700);
  await page.screenshot({ path: out + "game-stats.png" });
  await page.keyboard.press("Escape");
  // big board (Sunday 6x6 practice)
  await page.goto(base + "?test=1&date=2026-11-01", { waitUntil: "networkidle" }); await page.waitForTimeout(500);
  await page.screenshot({ path: out + "game-daily-6x6.png" });
  await ctx.close();
}
(async () => {
  const only = process.env.ONLY;
  const b1 = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
  if (!only || only === "light") await run(b1, "light", {}, true);
  if (!only || only === "dark") await run(b1, "dark", { colorScheme: "dark" }, false);
  await b1.close();
  if (!only || only === "forcedark") {
    const b2 = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--force-dark-mode", "--enable-features=WebContentsForceDark"] });
    await run(b2, "forcedark", { colorScheme: "dark" }, false);
    await b2.close();
  }
  console.log("console errors/warnings:", errors.length ? errors : "none");
})().catch(e => { console.error("TEST FAILED:", e.message); console.log("errors so far:", errors); process.exit(1); });
