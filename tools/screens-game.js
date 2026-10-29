// Gamified UI test at 390x844: Chromium light, prefers-dark, forced-dark, Firefox dark, and a
// Dark Reader simulation. Flow: tutorial -> daily -> levels map -> levels (solved by real swipes
// along the shortest route), undo, hint, map bottom. Fails on any console error.
// Usage: node tools/screens-game.js [baseUrl]   (env PW = path to playwright-core, ONLY = one run)
const pw = require(process.env.PW || "playwright-core");
const base = process.argv[2] || "http://127.0.0.1:8765/";
const out = __dirname + "/../screenshots/";
const errors = [];
function watch(page, tag) {
  page.on("console", m => { if (/\[.*fallbackfont\]/.test(tag) && /ERR_FAILED/.test(m.text())) return; if (m.type() === "error" || m.type() === "warning") errors.push(tag + " " + m.type() + ": " + m.text() + (process.env.DBG ? " @" + JSON.stringify(m.location()) + " " + page.url() : "")); });
  page.on("pageerror", e => errors.push(tag + " pageerror: " + e.message));
  page.on("requestfailed", r => /fallbackfont/.test(tag) && /\.woff2$/.test(r.url()) || errors.push(tag + " requestfailed: " + r.url()));
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
  for (const L of [5, 9, 10, 12, 20]) {
    await go("&level=" + L);
    const cc = await colourCheck(page, tag);
    await page.screenshot({ path: out + "level" + L + sfx + ".png" });
    if ((L === 9 || L === 10) && full) {
      const bb = await page.evaluate(() => { const r = document.querySelector("#board canvas").getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
      await page.screenshot({ path: out + "glass-closeup-level" + L + ".png", clip: bb });
    }
    if (L === 12 && full) { // glass close-up of the board (locked glass has bolts)
      const bb = await page.evaluate(() => { const r = document.querySelector("#board canvas").getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
      await page.screenshot({ path: out + "glass-closeup-locked.png", clip: bb });
    }
    if (L === 10 && full) { // undo + hint + stuck
      const m = await page.evaluate(() => { const E = PS.E, p = PS.puzzle, s = PS.state.pos; return E.glideMoves(p, s).find(x => E.distOf(p, x.pos) !== E.distOf(p, s) - 1); });
      if (m) { await swipe(page, m.pane, m.dir); await page.waitForTimeout(300); await page.screenshot({ path: out + "level10-after-wrong-move.png" }); await page.click("#btnUndo"); await idle(page); }
      const back = await page.evaluate(() => PS.state.pos.join() === PS.puzzle.start.join());
      await page.click("#btnHint"); await page.waitForTimeout(500); await page.screenshot({ path: out + "level10-hint.png" });
      console.log(tag, "L10 undo restored start:", back, "hint tip:", await page.evaluate(() => document.getElementById("rule").textContent));
    }
    await solve(page);
    await page.waitForSelector("#dlgLevel[open], #dlgMile[open]", { timeout: 4000 });
    if (L === 12 && full) { await page.waitForTimeout(1500); await page.screenshot({ path: out + "level-end-gift.png" }); }
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
  if (full) {
    await go(""); await page.click("#btnHelp"); await page.waitForTimeout(900); await page.screenshot({ path: out + "help.png" });
    await go(""); await page.screenshot({ path: out + "home-music.png" });
    await page.mouse.click(5, 5); await page.waitForTimeout(400);
    const m1 = await page.evaluate(() => PS.music);
    await page.click("#btnMusic"); await page.waitForTimeout(300);
    const m2 = await page.evaluate(() => PS.music);
    await page.screenshot({ path: out + "home-music-off.png" });
    await page.click("#btnMusic"); await page.waitForTimeout(300);
    console.log(tag, "music after first tap:", JSON.stringify(m1), "after mute:", JSON.stringify(m2), "after unmute:", JSON.stringify(await page.evaluate(() => PS.music)));
    if (!m1.playing || m2.playing || m1.vol !== 0.18) errors.push(tag + " music toggle did not behave");
    const mc = await page.evaluate(() => PS.musicCheck());
    console.log(tag, "music take (offline render):", JSON.stringify(mc));
    if (!(mc.peakDb < -1) || mc.seamPeakOrJump > 0.891 || mc.maxJump > 0.25 || !(mc.clickRatio < 3.5)) errors.push(tag + " music render failed the clipping/discontinuity check " + JSON.stringify(mc));
    await page.click("#btnHomeSettings"); await page.waitForTimeout(800); await page.screenshot({ path: out + "settings.png" });
    // coach marks (tests switch them off unless &marks=1)
    await go("&marks=1"); await page.waitForTimeout(1200);
    console.log(tag, "home mark:", await page.evaluate(() => PS.markShown)); await page.screenshot({ path: out + "tooltip-music.png" });
    await go("&level=1&marks=1"); await page.waitForTimeout(1200);
    console.log(tag, "L1 mark:", await page.evaluate(() => PS.markShown)); await page.screenshot({ path: out + "tooltip-glide.png" });
    await go("&level=12&marks=1"); await page.waitForTimeout(1200);
    let k = await page.evaluate(() => PS.markShown), guard = 0;
    while (k !== "locked" && guard++ < 10) { if (k) await page.mouse.click(30, 400); await page.waitForTimeout(900); k = await page.evaluate(() => PS.markShown); }
    console.log(tag, "L12 mark:", k); await page.screenshot({ path: out + "tooltip-locked.png" });
    if (k !== "locked") errors.push(tag + " locked-glass tip did not show");
    await page.mouse.click(30, 400); await page.waitForTimeout(600);
    console.log(tag, "after tap, mark:", await page.evaluate(() => PS.markShown), "seen:", await page.evaluate(() => JSON.parse(localStorage.getItem("ps2:prefs")).marks.join(",")));
  }
  if (full) await v8shots(page, go, tag);
  await ctx.close();
}
// v8: each new kind of glass is taught with its own tip; boss, Glass House, shop, daily gift, map teaser.
const TEACH = { 12: "locked", 18: "duo", 25: "pillar", 33: "gem", 42: "ice", 52: "sand", 64: "oneway", 78: "frost", 95: "mystery" };
async function waitMark(page, want) {
  let k = await page.evaluate(() => PS.markShown), guard = 0;
  while (k !== want && guard++ < 14) { if (k) await page.mouse.click(8, 300); await page.waitForTimeout(800); k = await page.evaluate(() => PS.markShown); }
  return k;
}
function seedProgress(unlocked, extra) {
  return `(() => { const p = JSON.parse(localStorage.getItem("ps2:levels") || "{}"); p.unlocked = ${unlocked}; p.stars = p.stars || {}; for (let i = 1; i < ${unlocked}; i++) p.stars[i] = p.stars[i] || [3, 2, 3, 3, 1][i % 5]; p.boss = []; for (let b = 20; b < ${unlocked}; b += 20) p.boss.push(b); Object.assign(p, ${JSON.stringify(extra || {})}); localStorage.setItem("ps2:levels", JSON.stringify(p)); })()`;
}
async function clearMarks(page) { for (let g = 0; g < 12 && await page.evaluate(() => PS.markShown); g++) { await page.mouse.click(8, 300); await page.waitForTimeout(700); } }
async function v8shots(page, go, tag) {
  for (const L of Object.keys(TEACH)) {
    const want = TEACH[L];
    await go("&level=" + L + "&marks=1"); await page.waitForTimeout(900);
    const info = await page.evaluate(() => ({ teach: PS.puzzle.teach, mechs: PS.puzzle.mechs }));
    const k = await waitMark(page, want);
    await page.screenshot({ path: out + "teach-" + L + "-" + want + ".png" });
    console.log(tag, "teach L" + L, JSON.stringify(info), "tip:", k);
    if (info.teach !== want) errors.push(tag + " level " + L + " should teach " + want + " but teaches " + info.teach);
    const seen = await page.evaluate(w => (JSON.parse(localStorage.getItem("ps2:prefs")).marks || []).indexOf(w) >= 0, want);
    if (k !== want && !seen) errors.push(tag + " " + want + " tip did not show on level " + L);
    await clearMarks(page);
    await solve(page); await page.waitForSelector("#dlgLevel[open], #dlgMile[open]", { timeout: 5000 });
    const gems = await page.evaluate(() => PS.puzzle.gems ? PS.state.got.length + "/" + PS.puzzle.gems.length : "-");
    if (want === "gem") { console.log(tag, "gems collected on the best route:", gems); if (!/^(\d+)\/\1$/.test(gems)) errors.push(tag + " gems not all collected on the best route: " + gems); }
  }
  // a chapter boss (golden frame), then its "window restored" card
  await go("&level=40&marks=1"); await page.waitForTimeout(900);
  const bk = await waitMark(page, "boss");
  await page.screenshot({ path: out + "boss-level40.png" });
  console.log(tag, "boss L40:", await page.evaluate(() => PS.puzzle.boss), "tip:", bk);
  await clearMarks(page);
  await solve(page); await page.waitForSelector("#dlgMile[open]", { timeout: 5000 }); await page.waitForTimeout(1600);
  await page.screenshot({ path: out + "boss-window-restored.png" });
  // a player with 47 levels unlocked, 2 bosses beaten and 150 shards
  await page.evaluate(seedProgress(47, { shards: 150, v: 8 }));
  await go("&mode=levels"); await page.waitForTimeout(700);
  await page.screenshot({ path: out + "map-teaser" + (tag === "light" ? "" : "-" + tag) + ".png" });
  console.log(tag, "map teaser:", await page.evaluate(() => document.getElementById("mapTeaser").textContent));
  await go(""); await page.screenshot({ path: out + "home-v8.png" });
  await page.evaluate(() => PS.openHouse()); await page.waitForTimeout(700); await page.screenshot({ path: out + "glass-house.png" }); await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await page.evaluate(() => PS.openShop()); await page.waitForTimeout(700); await page.screenshot({ path: out + "shop.png" });
  const s0 = await page.evaluate(() => PS.progress.shards);
  await page.click("[data-buy='skin:mint']"); await page.waitForTimeout(400);
  const s1 = await page.evaluate(() => ({ shards: PS.progress.shards, skin: PS.progress.skin }));
  console.log(tag, "shop: bought Mint board", s0, "->", JSON.stringify(s1));
  if (s1.shards !== s0 - 80 || s1.skin !== "mint") errors.push(tag + " shop purchase failed");
  await page.screenshot({ path: out + "shop-after-buy.png" }); await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await go("&level=47"); await page.waitForTimeout(600); await page.screenshot({ path: out + "skin-mint-level47.png" });
  await go(""); await page.evaluate(() => PS.openGift()); await page.waitForTimeout(700); await page.screenshot({ path: out + "daily-gift.png" });
  const g0 = await page.evaluate(() => PS.progress.shards), a0 = await page.evaluate(() => PS.progress.ach.length);
  await page.click("#btnClaim"); await page.waitForTimeout(900);
  const g1 = await page.evaluate(() => ({ shards: PS.progress.shards, login: PS.progress.login, ach: PS.progress.ach.length }));
  await page.screenshot({ path: out + "daily-gift-claimed.png" });
  console.log(tag, "gift:", g0, "->", JSON.stringify(g1));
  if (g1.shards !== g0 + 5 + 10 * (g1.ach - a0)) errors.push(tag + " daily gift did not pay 5 shards");
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await page.click("#btnStats"); await page.waitForTimeout(800); await page.screenshot({ path: out + "stats-badges.png" }); await page.keyboard.press("Escape");
  // the new music moods must render cleanly too
  for (const m of ["rain", "box"]) {
    await page.evaluate(k => { PS.progress.mood = k; }, m);
    const mc = await page.evaluate(() => PS.musicCheck());
    console.log(tag, "music mood", m, JSON.stringify(mc));
    if (!(mc.peakDb < -1) || mc.seamPeakOrJump > 0.891 || mc.maxJump > 0.25 || !(mc.clickRatio < 3.5)) errors.push(tag + " music mood " + m + " failed the render check " + JSON.stringify(mc));
  }
}
async function overflow(page, where) { // any text sticking out of its button/chip/tile, or off screen
  const bad = await page.evaluate(() => {
    const vis = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
    const root = document.querySelector("dialog[open]") || document.querySelector("main, body");
    const boxes = [...root.querySelectorAll(".cbtn, .stat, .tile, .ribbon, .tgl, .vol, .gift, .rules > div, .mixes span, .chap, .hd figcaption, .hgoal, .cm-bub, .mapbar, .badge, #status, .teaser, .shop-it, .gd, .ach, .bal, .hw, .gemct, .home-meta")].filter(vis);
    const out = [];
    boxes.forEach(b => {
      const r = b.getBoundingClientRect();
      if ((r.left < -1 || r.right > innerWidth + 1) && !(b.classList.contains("hw") && b.parentNode.scrollWidth > b.parentNode.clientWidth)) out.push("off-screen: " + (b.id || b.className) + " " + Math.round(r.left) + ".." + Math.round(r.right));
      if (b.scrollWidth > b.clientWidth + 2 && getComputedStyle(b).overflowX !== "visible") out.push("clipped: " + (b.id || b.className) + " " + b.scrollWidth + ">" + b.clientWidth);
      b.querySelectorAll("*").forEach(c => { if (!vis(c) || c.closest("svg") && c.tagName !== "svg" || c.id === "hintCount") return; /* hint count is a deliberate corner badge */ const q = c.getBoundingClientRect(); if (q.left < r.left - 1 || q.right > r.right + 1) out.push("sticks out: " + (c.className || c.tagName) + " in " + (b.id || b.className)); });
      const l = b.querySelector(".lbl"); if (l && l.scrollWidth > l.clientWidth + 1) out.push("label cut: " + (b.id || b.className) + " '" + l.textContent + "'");
    });
    return [...new Set(out)];
  });
  console.log("  overflow @", where, bad.length ? bad : "ok");
  bad.forEach(b => errors.push(where + " " + b));
}
async function sizes(browser, w, h, noFont) {
  const tag = w + "x" + h + (noFont ? "-fallbackfont" : "");
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const page = await ctx.newPage(); watch(page, "[" + tag + "]");
  if (noFont) await page.route("**/*.woff2", r => r.abort());
  const go = async q => { // the fallback run swaps in a wide font (DejaVu Sans), harsher than Roboto on Android
    await page.goto(base + "?test=1&tutorial=0" + q, { waitUntil: "load" });
    if (noFont) await page.addStyleTag({ content: '*, *::before, *::after { font-family: "DejaVu Sans", sans-serif !important; }' });
    await page.waitForTimeout(600);
  };
  await page.addInitScript(() => { if (!localStorage.getItem("ps2:prefs")) localStorage.setItem("ps2:prefs", JSON.stringify({ sound: false, tutDone: true, glideTut: true, music: false })); });
  await go(""); await overflow(page, tag + " home");
  await page.click("#btnHelp"); await page.waitForTimeout(800); await overflow(page, tag + " help");
  if (w === 360 && !noFont) await page.screenshot({ path: out + "help-360.png" });
  if (w === 412 && !noFont) await page.screenshot({ path: out + "help-412.png" });
  if (noFont) await page.screenshot({ path: out + "help-360-fallbackfont.png" });
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await page.click("#btnHomeSettings"); await page.waitForTimeout(700); await overflow(page, tag + " settings"); await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await page.click("#btnStats"); await page.waitForTimeout(700); await overflow(page, tag + " stats"); await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await go("&mode=levels"); await overflow(page, tag + " map");
  for (const L of [4, 5]) {
    await go("&level=" + L); await overflow(page, tag + " level " + L);
    await solve(page); await page.waitForSelector("#dlgLevel[open], #dlgMile[open]", { timeout: 5000 }); await page.waitForTimeout(1600);
    await overflow(page, tag + (L === 5 ? " milestone card" : " level-end card"));
  }
  await go("&mode=daily"); await solve(page); await page.waitForSelector("#dlgEnd[open]", { timeout: 5000 }); await page.waitForTimeout(1400);
  await overflow(page, tag + " daily-end card");
  await go("&level=12&marks=1"); await page.waitForTimeout(1300); await overflow(page, tag + " coach mark");
  await go("&level=33"); await overflow(page, tag + " gem level");
  await page.evaluate(seedProgress(87, { shards: 200, v: 8 }));
  await go(""); await overflow(page, tag + " home v8");
  await go("&mode=levels"); await overflow(page, tag + " map teaser");
  if (w === 360 && !noFont) await page.screenshot({ path: out + "map-teaser-360.png" });
  for (const [fn, nm] of [["openHouse", "glass house"], ["openShop", "shop"], ["openGift", "daily gift"]]) {
    await go(""); await page.evaluate(f => PS[f](), fn); await page.waitForTimeout(700); await overflow(page, tag + " " + nm);
    const fit = await page.evaluate(() => { const d = document.querySelector("dialog[open]").getBoundingClientRect(); return d.top >= -1 && d.bottom <= innerHeight + 1; });
    if (!fit) { const sc = await page.evaluate(() => { const d = document.querySelector("dialog[open]"); return d.scrollHeight > d.clientHeight; }); if (!sc) errors.push(tag + " " + nm + " dialog taller than the screen"); }
    if (w === 360 && !noFont) await page.screenshot({ path: out + fn.replace("open", "").toLowerCase() + "-360.png" });
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  }
  await page.click("#btnStats"); await page.waitForTimeout(700); await overflow(page, tag + " stats v8"); await page.keyboard.press("Escape");
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
  if (!only || only === "sizes") {
    const b0 = await pw.chromium.launch(chrome);
    await sizes(b0, 360, 740); await sizes(b0, 412, 915); await sizes(b0, 360, 740, true);
    await b0.close();
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
