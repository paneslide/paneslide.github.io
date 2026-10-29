// Gamified UI test at 390x844: Chromium light, prefers-dark, forced-dark, Firefox dark, and a
// Dark Reader simulation. Flow: tutorial -> daily -> levels map -> levels (solved by real swipes
// along the shortest route), undo, hint, map bottom. Fails on any console error.
// Usage: node tools/screens-game.js [baseUrl]   (env PW = path to playwright-core, ONLY = one run)
const pw = require(process.env.PW || "playwright-core");
const base = process.argv[2] || "http://127.0.0.1:8765/";
const out = __dirname + "/../screenshots/";
const errors = [];
function watch(page, tag) {
  page.on("console", m => { if (m.type() === "error" || m.type() === "warning") errors.push(tag + " " + m.type() + ": " + m.text() + (process.env.DBG ? " @" + JSON.stringify(m.location()) + " " + page.url() : "")); });
  page.on("pageerror", e => errors.push(tag + " pageerror: " + e.message));
  page.on("requestfailed", r => errors.push(tag + " requestfailed: " + r.url()));
}
async function idle(page) { await page.waitForFunction(() => !PS.busy, null, { timeout: 4000 }); await page.waitForTimeout(60); }
async function swipe(page, pi, dir) { // real pointer swipe on a cell of pane pi
  const g = await page.evaluate(i => { const p = PS.puzzle.panes[i], c = PS.E.paneCells(p, PS.state.pos[i])[0]; return Object.assign(PS.cellPoint(c[0], c[1]), { axis: p.axis }); }, pi);
  const d = 40 * dir, before = await page.evaluate(() => PS.state.moves);
  await page.mouse.move(g.x, g.y); await page.mouse.down();
  await page.mouse.move(g.x + (g.axis === "h" ? d : 0), g.y + (g.axis === "v" ? d : 0), { steps: 6 });
  await page.mouse.up(); await idle(page);
  return (await page.evaluate(() => PS.state.moves)) - before;
}
// Classic (drag) rules: practice dailies before the switch date still use them.
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
async function solveClassic(page) {
  // A pane can be hidden under a same-direction pane that was moved later, so pick an order of
  // moves (like a careful player) in which every pane is still grabbable when its turn comes.
  const order = await page.evaluate(() => {
    const E = window.PaneEngine, puz = PS.puzzle, pos = PS.state.pos.slice();
    const todo = puz.panes.map((p, i) => i).filter(i => !puz.panes[i].locked && pos[i] !== puz.solution[i]);
    const perms = a => a.length <= 1 ? [a] : a.flatMap((x, k) => perms(a.filter((_, j) => j !== k)).map(r => [x].concat(r)));
    const at = (P, c) => puz.panes.map((p, i) => i).filter(i => E.paneCells(puz.panes[i], P[i]).some(q => q[0] === c[0] && q[1] === c[1]));
    for (const ord of perms(todo)) {
      const P = pos.slice(), z = puz.panes.map(() => 0); let top = 0, ok = true;
      for (const i of ord) {
        const p = puz.panes[i], cells = E.paneCells(p, P[i]);
        const only = cells.filter(c => at(P, c).every(q => q === i || puz.panes[q].locked));
        const free = cells.filter(c => at(P, c).every(q => q === i || puz.panes[q].locked || (puz.panes[q].axis !== p.axis && puz.panes[q].axis !== "b" && p.axis !== "b")));
        const c = only[0] || free[0] || cells[0];
        let want = p.axis;
        if (p.axis === "b") { const w = p.mc + 1; want = Math.abs(puz.solution[i] % w - P[i] % w) >= Math.abs(Math.floor(puz.solution[i] / w) - Math.floor(P[i] / w)) ? "h" : "v"; }
        const cands = at(P, c).filter(q => !puz.panes[q].locked).sort((a, b) => z[a] - z[b]);
        const m = cands.filter(q => puz.panes[q].axis === want || puz.panes[q].axis === "b");
        if ((m.length ? m : cands).slice(-1)[0] !== i) { ok = false; break; }
        P[i] = puz.solution[i]; z[i] = ++top;
      }
      if (ok) return ord;
    }
    return null;
  });
  if (!order) throw new Error("no grabbable move order for level " + await page.evaluate(() => PS.puzzle.level));
  for (const i of order) await drag(page, i, await page.evaluate(k => PS.puzzle.solution[k], i));
}
async function solve(page) { // follow the shortest route, one real swipe at a time
  if (!(await page.evaluate(() => PS.puzzle.glide))) return solveClassic(page);
  for (let k = 0; k < 30; k++) {
    const st = await page.evaluate(() => PS.state.status); if (st !== "playing") return;
    const m = await page.evaluate(() => PS.E.nextMove(PS.puzzle, PS.state.pos));
    if (!m) return;
    const moved = await swipe(page, m.pane, m.dir);
    const pos = await page.evaluate(i => PS.state.pos[i], m.pane);
    if (!moved || pos !== m.to) throw new Error(`swipe pane ${m.pane} dir ${m.dir} expected ${m.to}, got ${pos} (moved ${moved})`);
  }
}
async function colourCheck(page, tag) { // the puzzle must keep its true colours: sample board + target canvases
  return page.evaluate(() => {
    const cv = document.querySelector("#board canvas"), x = cv.getContext("2d"), d = x.getImageData(0, 0, cv.width, cv.height).data;
    let dark = 0, tot = 0; for (let i = 0; i < d.length; i += 4 * 97) { tot++; if (d[i] + d[i + 1] + d[i + 2] < 150 && d[i + 3] > 200) dark++; }
    const bodyBg = getComputedStyle(document.body).backgroundColor, rect = cv.getBoundingClientRect();
    return { darkPixelShare: +(dark / tot).toFixed(3), bodyBg, boardW: Math.round(rect.width) };
  });
}
async function run(browser, tag, ctxOpts, full, darkReader) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }, ctxOpts));
  const page = await ctx.newPage(); watch(page, "[" + tag + "]");
  if (darkReader) await page.addInitScript({ path: require.resolve("darkreader/darkreader.js", { paths: ["/tmp/dr/node_modules"] }) });
  const sfx = tag === "light" ? "" : "-" + tag;
  const go = async q => { await page.goto(base + "?test=1" + q, { waitUntil: "networkidle" }); if (darkReader) await page.evaluate(() => DarkReader.enable({ brightness: 100, contrast: 90, sepia: 10 })); await page.waitForTimeout(500); };
  await go("");
  console.log(tag, "first visit:", await page.evaluate(() => PS.mode));
  if (full) await page.screenshot({ path: out + "game-tutorial.png" });
  await solve(page);
  await page.waitForSelector("#dlgEnd[open]", { timeout: 4000 }); await page.waitForTimeout(1200);
  await page.click("#btnEndMain"); await page.waitForTimeout(600);
  console.log(tag, "after tutorial:", await page.evaluate(() => PS.mode), "daily par", await page.evaluate(() => PS.puzzle.par));
  await page.screenshot({ path: out + "game-daily" + sfx + ".png" });
  await solve(page);
  await page.waitForSelector("#dlgEnd[open]", { timeout: 4000 }); await page.waitForTimeout(1200);
  await page.click("#btnEndHome"); await page.waitForTimeout(700);
  await page.click("#btnPlay", { force: true }); await page.waitForTimeout(700);
  console.log(tag, "map:", await page.evaluate(() => PS.mode));
  await page.click("#btnPlayNext"); await page.waitForTimeout(700);
  await solve(page);
  await page.waitForSelector("#dlgLevel[open]", { timeout: 4000 }); await page.waitForTimeout(800);
  console.log(tag, "L1 stars:", await page.evaluate(() => PS.progress.stars[1]));
  for (const L of [5, 10, 20]) {
    await go("&level=" + L);
    const cc = await colourCheck(page, tag);
    await page.screenshot({ path: out + "level" + L + sfx + ".png" });
    if (L === 10 && full) { // undo + hint + stuck
      const m = await page.evaluate(() => { const E = PS.E, p = PS.puzzle, s = PS.state.pos; return E.glideMoves(p, s).find(x => E.distOf(p, x.pos) !== E.distOf(p, s) - 1); });
      if (m) { await swipe(page, m.pane, m.dir); await page.waitForTimeout(300); await page.screenshot({ path: out + "level10-after-wrong-move.png" }); await page.click("#btnUndo"); await idle(page); }
      const back = await page.evaluate(() => PS.state.pos.join() === PS.puzzle.start.join());
      await page.click("#btnHint"); await page.waitForTimeout(500); await page.screenshot({ path: out + "level10-hint.png" });
      console.log(tag, "L10 undo restored start:", back, "hint tip:", await page.evaluate(() => document.getElementById("rule").textContent));
    }
    await solve(page);
    await page.waitForSelector("#dlgLevel[open], #dlgMile[open]", { timeout: 4000 });
    console.log(tag, "L" + L, "par", await page.evaluate(() => PS.puzzle.par), "moves", await page.evaluate(() => PS.state.moves), "stars", await page.evaluate(n => PS.progress.stars[n], L), JSON.stringify(cc));
  }
  // map with progress: the bottom of the map (level 1) must be clear of the PLAY bar
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem("ps2:levels")); p.unlocked = 27; for (let i = 1; i <= 26; i++) p.stars[i] = p.stars[i] || [3, 2, 3, 1, 3][i % 5]; localStorage.setItem("ps2:levels", JSON.stringify(p)); });
  await go("&mode=levels"); await page.waitForTimeout(500);
  await page.screenshot({ path: out + "map" + sfx + ".png" });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(400);
  const clear = await page.evaluate(() => { const bar = document.getElementById("mapBar").getBoundingClientRect(); return [...document.querySelectorAll("#mapPath .node")].every(n => { const r = n.getBoundingClientRect(); return r.bottom <= bar.top || r.top >= bar.bottom || r.bottom < 0; }); });
  await page.screenshot({ path: out + "map-bottom" + sfx + ".png" });
  console.log(tag, "map bottom: every node clear of PLAY bar:", clear);
  if (!clear) errors.push(tag + " a map node is covered by the PLAY bar");
  if (full) { await go(""); await page.click("#btnHelp"); await page.waitForTimeout(900); await page.screenshot({ path: out + "help.png" }); }
  await ctx.close();
}
(async () => {
  const only = process.env.ONLY, chrome = { executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] };
  if (!only || only === "light" || only === "dark" || only === "darkreader") {
    const b1 = await pw.chromium.launch(chrome);
    if (!only || only === "light") await run(b1, "light", {}, true);
    if (!only || only === "dark") await run(b1, "dark", { colorScheme: "dark" }, false);
    if (!only || only === "darkreader") await run(b1, "darkreader", { colorScheme: "dark" }, false, true);
    await b1.close();
  }
  if (!only || only === "forcedark") {
    const b2 = await pw.chromium.launch({ executablePath: chrome.executablePath, args: ["--no-sandbox", "--force-dark-mode", "--enable-features=WebContentsForceDark"] });
    await run(b2, "forcedark", { colorScheme: "dark" }, false); await b2.close();
  }
  if (!only || only === "firefox") {
    const b3 = await pw.firefox.launch(); await run(b3, "firefox-dark", { colorScheme: "dark" }, false); await b3.close();
  }
  console.log("console errors/warnings:", errors.length ? errors : "none");
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error("TEST FAILED:", e.message); console.log("errors so far:", errors); process.exit(1); });
