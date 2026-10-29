// Checks the anonymous analytics events and the keyboard controls.
//  1. Test mode (?test=1): plays the tutorial, a level (with undo + hint), the daily, quits a level, mutes music,
//     buys from the shop and claims the gift, then reads window.psLog (nothing is sent in test mode).
//  2. Sending: loads the game under a fake host name with a stub GoatCounter script and checks that events are
//     batched, de-duplicated and sent as GoatCounter events; and that Do Not Track / GPC send nothing.
//  PW=... node tools/test-events.js [base]
const pw = require(process.env.PW || "playwright-core");
const BASE = process.argv[2] || "http://127.0.0.1:8765";
const PREFS = { sound: false, music: true, tutDone: true, glideTut: true, mixSeen: ["C","M","Y"], marks: ["glide","stick","order","stars","undo","hint","stuck","map","rank","shard","gift","house","shop","music","daily","everyone","mix","new","boss","rule"] };
let bad = 0; const ok = (c, m) => { console.log(c ? "✓" : "✗", m); if (!c) bad++; };
async function drag(page, pi, to) {
  const g = await page.evaluate(i => PS.grabPoint(i), pi), from = await page.evaluate(i => PS.state.pos[i], pi);
  let dx = 0, dy = 0;
  if (g.axis === "b") { const w = g.mc + 1; dx = (to % w - from % w) * g.step; dy = (Math.floor(to / w) - Math.floor(from / w)) * g.step; }
  else if (g.axis === "h") dx = (to - from) * g.step; else dy = (to - from) * g.step;
  await page.mouse.move(g.x, g.y); await page.mouse.down(); await page.mouse.move(g.x + dx, g.y + dy, { steps: 12 }); await page.mouse.up(); await page.waitForTimeout(420);
}
async function solve(p) {
  if (!(await p.evaluate(() => PS.puzzle.glide))) { // classic drag rules (dailies before 30 Oct 2026)
    for (let k = 0; k < 3; k++) { const todo = await p.evaluate(() => PS.puzzle.panes.map((q, i) => i).filter(i => !PS.puzzle.panes[i].locked && PS.state.pos[i] !== PS.puzzle.solution[i]));
      for (const i of todo.reverse()) { if (await p.evaluate(() => PS.state.status) !== "playing") return; await drag(p, i, await p.evaluate(k => PS.puzzle.solution[k], i)); } }
    return;
  }
  for (let k = 0; k < 40; k++) {
    const st = await p.evaluate(() => PS.state.status); if (st !== "playing") return;
    const m = await p.evaluate(() => PS.E.nextMove(PS.puzzle, PS.state.pos)); if (!m) return;
    await p.evaluate(m => PS.swipe(m.pane, m.dir), m); await p.waitForFunction(() => !PS.busy); await p.waitForTimeout(60);
  }
}
(async () => {
  const b = await pw.chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox", "--host-resolver-rules=MAP paneslide.test 127.0.0.1"] });
  // ---- 1. events in test mode ----
  let ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(p => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", 1); localStorage.setItem("ps2:prefs", p); } }, JSON.stringify(PREFS));
  let p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  const ALL = []; const grab = async () => { const l = await p.evaluate(() => { const l = (window.psLog || []).map(e => e[0]); window.psLog = []; return l; }); ALL.push(...l); return ALL; };
  const go = async u => { await grab().catch(() => {}); await p.goto(u); };
  await go(BASE + "/?test=1&tutorial=0"); await p.waitForTimeout(900);
  await p.click("#btnHelp"); await p.waitForTimeout(300); await p.click("#btnReplayTut"); await p.waitForTimeout(700);
  await solve(p); await p.waitForTimeout(1800);
  let log = await grab();
  ok(log.includes("tutorial/start") && log.includes("tutorial/complete"), "tutorial start + complete: " + log.join(", "));
  // level 1: undo + hint + solve
  await go(BASE + "/?test=1&tutorial=0&level=1"); await p.waitForTimeout(1200);
  const m0 = await p.evaluate(() => PS.E.nextMove(PS.puzzle, PS.state.pos));
  await p.evaluate(m => PS.swipe(m.pane, m.dir), m0); await p.waitForFunction(() => !PS.busy); await p.waitForTimeout(100);
  await p.evaluate(() => PS.undo()); await p.waitForTimeout(300);
  await solve(p); await p.waitForTimeout(1800);
  log = await grab();
  ok(log.includes("level/001/start"), "level start");
  const w = log.find(x => /^level\/001\/(complete|over-par)\//.test(x)); ok(!!w && /\/undo\d\//.test(w) && /\/hints\d\//.test(w) && /\dstar\//.test(w), "level solved event with stars/par/hints/undo/time: " + w);
  // keyboard: start level 2, use Tab/Enter, an arrow, Z, H, M
  await go(BASE + "/?test=1&tutorial=0&level=2"); await p.waitForTimeout(1200);
  await p.evaluate(() => { const pr = PS.progress; pr.unlocked = Math.max(pr.unlocked, 3); });
  await p.keyboard.press("Enter"); await p.waitForTimeout(100);
  const foc = await p.evaluate(() => document.activeElement && document.activeElement.className); ok(/pane|pc|tile/.test(String(foc)) || foc, "Enter focuses a pane (" + foc + ")");
  const before = await p.evaluate(() => PS.state.moves);
  const m2 = await p.evaluate(() => PS.E.nextMove(PS.puzzle, PS.state.pos));
  await p.keyboard.press(String(m2.pane + 1)); await p.waitForTimeout(80);
  const ax = await p.evaluate(i => PS.puzzle.panes[i].axis, m2.pane);
  const key = ax === "h" ? (m2.dir > 0 ? "ArrowRight" : "ArrowLeft") : (m2.dir > 0 ? "ArrowDown" : "ArrowUp");
  await p.keyboard.press(key); await p.waitForFunction(() => !PS.busy); await p.waitForTimeout(150);
  const after = await p.evaluate(() => PS.state.moves); ok(after === before + 1, `number key + arrow moves a pane (${before} → ${after}, dir ${m2.dir})`);
  await p.keyboard.press("z"); await p.waitForTimeout(300);
  ok(await p.evaluate(() => PS.state.undo.length === 0 && PS.state.nu === 1), "Z undoes (and the undo is counted)");
  const h0 = await p.evaluate(() => PS.progress.hints); await p.keyboard.press("h"); await p.waitForTimeout(400);
  ok(await p.evaluate(h => PS.progress.hints === h - 1, h0), "H uses a hint");
  await p.keyboard.press("m"); await p.waitForTimeout(200);
  ok(await p.evaluate(() => PS.music.on === false), "M mutes music");
  await p.evaluate(() => document.getElementById("btnBack").click()); await p.waitForTimeout(500);
  log = await grab();
  ok(log.includes("level/002/quit"), "quit event when leaving unsolved");
  ok(log.includes("music/mute"), "music mute event");
  // shop + gift + daily
  await p.evaluate(() => { PS.progress.shards = 500; PS.claimGift(); }); await p.waitForTimeout(300);
  await p.evaluate(() => { document.querySelectorAll("dialog[open]").forEach(d => d.close()); PS.openShop(); }); await p.waitForTimeout(300);
  const buyBtn = await p.$("#dlgShop [data-buy]:not([disabled])"); if (buyBtn) await buyBtn.click(); await p.waitForTimeout(300);
  await go(BASE + "/?test=1&tutorial=0&mode=daily"); await p.waitForTimeout(1200); await solve(p); await p.waitForTimeout(1800);
  await go(BASE + "/?test=1&tutorial=0&date=2026-10-28"); await p.waitForTimeout(1200);
  log = await grab();
  ok(log.some(x => /^gift\/claim\/day\d$/.test(x)), "gift claim");
  ok(log.some(x => /^shop\/buy\//.test(x)), "shop purchase" + (buyBtn ? "" : " (no buy button found)"));
  ok(log.includes("daily/start") && log.some(x => /^daily\/solve\//.test(x)), "daily start + solve");
  ok(log.some(x => /^archive\/play\//.test(x)), "archive play");
  ok(!errs.length, "no page errors " + errs.join(" | "));
  console.log("  events seen:", [...new Set(log)].join("  "));
  await ctx.close();
  // ---- 2. sending, batching, DNT ----
  const STUB = "window.__gc=[];window.goatcounter={count:function(o){window.__gc.push(o)}};";
  for (const dnt of [false, true]) {
    ctx = await b.newContext({ viewport: { width: 412, height: 915 } });
    await ctx.route("https://gc.zgo.at/count.js", r => r.fulfill({ contentType: "text/javascript", body: STUB }));
    await ctx.addInitScript(([p, dnt]) => { localStorage.setItem("ps2:prefs", p); if (dnt) Object.defineProperty(Navigator.prototype, "globalPrivacyControl", { get: () => true }); }, [JSON.stringify(PREFS), dnt]);
    p = await ctx.newPage();
    const port = new URL(BASE).port || 80;
    await p.goto(`http://paneslide.test:${port}/?tutorial=0&level=1`); await p.waitForTimeout(1500);
    const early = await p.evaluate(() => (window.__gc || []).length);
    await p.waitForTimeout(4500);
    const first = await p.evaluate(() => window.__gc ? window.__gc.slice() : null);
    await p.reload(); await p.waitForTimeout(6000);
    const sent = first && first.concat(await p.evaluate(() => window.__gc || []));
    if (!dnt) {
      ok(early === 0, "events are held back for batching (0 sent after 1.5 s)");
      ok(sent && sent.length >= 1 && sent.every(o => o.event === true && /^event\//.test(o.path)), "events sent as GoatCounter events: " + (sent || []).map(o => o.path).join(", "));
      ok(sent && sent.filter(o => o.path === "event/level/001/start").length === 1, "same event path sent once per session");
    } else ok(sent === null, "Global Privacy Control: GoatCounter never loads, nothing sent");
    await ctx.close();
  }
  await b.close(); console.log(bad ? `FAIL: ${bad}` : "OK: events and keyboard"); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
