// Opens every popup at phone, tablet and desktop sizes and fails if a ribbon title or the ✕ is cut off,
// or if the panel runs off the screen. Saves screenshots of Stats.  PW=... node tools/check-popups.js [base]
const pw = require(process.env.PW || "playwright-core"), path = require("path");
const BASE = process.argv[2] || "http://127.0.0.1:8765", OUT = path.join(__dirname, "../screenshots");
const SIZES = [[360, 640], [360, 740], [412, 915], [768, 1024], [1280, 800], [1920, 1080]];
const OPEN = { dlgStats: "#btnStats", dlgSettings: "#btnHomeSettings", dlgHelp: "#btnHelp", dlgShop: "#btnShop", dlgHouse: "#btnHouse", dlgGift: "#btnGift" };
(async () => {
  const b = await pw.chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
  let bad = 0;
  for (const [w, h] of SIZES) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: w < 800 });
    await ctx.addInitScript(() => {
      localStorage.setItem("ps2:prefs", JSON.stringify({ sound: false, music: false, tutDone: true, glideTut: true, mixSeen: ["C","M","Y"], marks: ["glide","stick","order","stars","undo","hint","stuck","map","rank","shard","gift","house","shop"] }));
      localStorage.setItem("ps2:stats", JSON.stringify({ played: 9, streak: 2, best: 5, lastWin: null, dist: [3, 1, 4, 1] }));
    });
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
    await p.goto(BASE + "/?test=1&tutorial=0"); await p.waitForTimeout(800);
    for (const [id, btn] of Object.entries(OPEN)) {
      const ok = await p.$(btn + ":visible"); if (ok) await p.click(btn); else await p.evaluate(i => document.getElementById(i).showModal(), id);
      await p.waitForTimeout(550);
      const r = await p.evaluate(i => { const d = document.getElementById(i), rb = d.querySelector(".ribbon"), x = d.querySelector(".x"), q = e => e && e.getBoundingClientRect();
        const R = q(rb), X = q(x), D = q(d); return { open: d.open, rb: R && [R.top, R.bottom, R.left, R.right], x: X && [X.top, X.right], d: [D.top, D.bottom], vh: innerHeight, vw: innerWidth,
          overlap: R && X ? !(X.left >= R.right || X.right <= R.left || X.top >= R.bottom || X.bottom <= R.top) : false }; }, id);
      const probs = [];
      if (!r.open) probs.push("did not open");
      if (r.rb && (r.rb[0] < 0 || r.rb[2] < 0 || r.rb[3] > r.vw)) probs.push("ribbon cut off " + JSON.stringify(r.rb));
      if (r.x && (r.x[0] < 0 || r.x[1] > r.vw)) probs.push("close button cut off");
      if (r.overlap) probs.push("close button overlaps ribbon");
      if (r.d[0] < 0 || r.d[1] > r.vh + 1) probs.push("panel off screen " + JSON.stringify(r.d));
      if (id === "dlgStats") { await p.screenshot({ path: path.join(OUT, `popup-stats-${w}x${h}.png`) });
        await p.evaluate(() => { const s = document.querySelector("#dlgStats .pscroll"); s.scrollTop = s.scrollHeight; }); await p.waitForTimeout(150);
        const st = await p.evaluate(() => document.querySelector("#dlgStats .ribbon").getBoundingClientRect().top); if (st < 0) probs.push("ribbon scrolls away");
        if (w === 412) await p.screenshot({ path: path.join(OUT, `popup-stats-${w}x${h}-scrolled.png`) }); }
      console.log(probs.length ? "✗" : "✓", `${w}x${h}`, id, probs.join("; ")); bad += probs.length;
      await p.evaluate(i => document.getElementById(i).close(), id); await p.waitForTimeout(200);
    }
    if (errs.length) { console.log("✗ page errors", errs); bad++; }
    await ctx.close();
  }
  await b.close(); console.log(bad ? `FAIL: ${bad}` : "OK: every popup fits"); process.exit(bad ? 1 : 0);
})();
