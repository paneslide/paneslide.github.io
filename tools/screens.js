// Headless smoke test + screenshots at 390x844. Usage: node tools/screens.js [baseUrl]
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
  const d = (to - from) * g.step;
  await page.mouse.move(g.x, g.y); await page.mouse.down();
  await page.mouse.move(g.x + (g.axis === "h" ? d : 0), g.y + (g.axis === "v" ? d : 0), { steps: 10 });
  await page.mouse.up(); await page.waitForTimeout(450);
  const now = await page.evaluate(i => PS.state.pos[i], pi);
  if (now !== to) throw new Error(`drag pane ${pi} to ${to} landed at ${now}`);
}
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage(); watch(page, "[daily]");
  await page.goto(base + "?test=1", { waitUntil: "networkidle" });
  console.log("first visit mode:", await page.evaluate(() => PS.mode));
  await page.waitForTimeout(1100);
  await page.screenshot({ path: out + "1-tutorial.png" });
  const tsol = await page.evaluate(() => PS.puzzle.solution);
  await drag(page, 0, tsol[0]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: out + "2-tutorial-step2.png" });
  await drag(page, 1, tsol[1]);
  await page.waitForSelector("#dlgEnd[open]", { timeout: 4000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: out + "3-tutorial-done.png" });
  await page.click("#btnShare");
  await page.waitForTimeout(500);
  console.log("after tutorial mode:", await page.evaluate(() => PS.mode));
  await page.screenshot({ path: out + "4-daily-start.png" });

  const P = await page.evaluate(() => ({ sol: PS.puzzle.solution, panes: PS.puzzle.panes.map(p => p.max) }));
  // one deliberate wrong move, then fix, then the rest
  const wrong = P.sol[0] === 0 ? 1 : P.sol[0] - 1;
  const cur0 = await page.evaluate(() => PS.state.pos[0]);
  if (wrong !== cur0) await drag(page, 0, wrong);
  await drag(page, 0, P.sol[0]);
  await drag(page, 1, P.sol[1]);
  await page.waitForTimeout(200);
  await page.screenshot({ path: out + "5-daily-mid.png" });
  for (let i = 2; i < P.sol.length; i++) await drag(page, i, P.sol[i]);
  await page.waitForSelector("#dlgEnd[open]", { timeout: 4000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: out + "6-win.png" });
  await page.click("#btnShare"); await page.waitForTimeout(300);
  console.log("clipboard:\n" + await page.evaluate(() => navigator.clipboard.readText()));
  console.log("moves/par:", await page.evaluate(() => PS.state.moves + "/" + PS.puzzle.panes.length));
  console.log("stats:", await page.evaluate(() => localStorage.getItem("ps2:stats")));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("#dlgEnd[open]", { timeout: 3000 });
  console.log("persisted after reload: yes; mode", await page.evaluate(() => PS.mode));

  // 6x6 Sunday practice with colour-blind patterns on
  const p2 = await ctx.newPage(); watch(p2, "[sunday]");
  await p2.goto(base + "?test=1&date=2026-11-01", { waitUntil: "networkidle" });
  await p2.click("#btnSettings"); await p2.click("label:has(#optPatterns)"); await p2.keyboard.press("Escape");
  await p2.waitForTimeout(300);
  await p2.screenshot({ path: out + "7-sunday-6x6-patterns.png" });
  // help sheet
  await p2.click("#btnHelp"); await p2.waitForTimeout(350);
  await p2.screenshot({ path: out + "8-help.png" });

  console.log("console errors/warnings:", errors.length ? errors : "none");
  await browser.close();
})().catch(e => { console.error("TEST FAILED:", e.message); console.log("errors so far:", errors); process.exit(1); });
