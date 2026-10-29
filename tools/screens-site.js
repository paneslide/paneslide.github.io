// Screenshots of the website layer for the README / handover:
//   PW=$(npm root -g)/playwright-core node tools/screens-site.js [base]
const pw = require(process.env.PW || "playwright-core"), path = require("path");
const BASE = process.argv[2] || "http://127.0.0.1:8765", OUT = path.join(__dirname, "../screenshots");
(async () => {
  const b = await pw.chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { localStorage.setItem("ps2:prefs", JSON.stringify({ sound: false, music: false, tutDone: true, glideTut: true, marks: [] })); });
  const p = await ctx.newPage();
  const shot = async (u, name, full, fn) => { await p.goto(BASE + u); await p.waitForTimeout(700); if (fn) await fn(); await p.screenshot({ path: path.join(OUT, name), fullPage: !!full }); console.log("wrote", name); };
  await shot("/guides/", "site-guides-index.png");
  await shot("/guides/how-panes-move/", "site-guide-article.png");
  await shot("/privacy/", "site-privacy.png");
  await shot("/archive/", "site-archive.png");
  await shot("/how-to-play/", "site-how-to-play.png");
  await shot("/guides/stone-pillars/", "site-footer.png", false, async () => { await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(300); });
  // install prompt: fire a fake beforeinstallprompt, then open Settings
  await shot("/?test=1&tutorial=0", "site-install-prompt.png", false, async () => {
    await p.evaluate(() => { const e = new Event("beforeinstallprompt"); e.prompt = () => Promise.resolve(); e.userChoice = Promise.resolve({ outcome: "dismissed" }); window.dispatchEvent(e); });
    await p.click("#btnSettings"); await p.waitForTimeout(500);
  });
  await shot("/?test=1&tutorial=0", "site-home-intro.png", false, async () => { await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(300); });
  await b.close();
})();
