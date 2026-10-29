// Website-layer test: every page in Chromium light, prefers-dark and forced-dark, Firefox dark,
// at 360x740 and 412x915. Checks console/page errors, failed requests, horizontal overflow,
// broken images, one <h1>, alt text, the archive (?date=) rules and the progress code.
//   PW=$(npm root -g)/playwright-core node tools/test-site.js [base=http://127.0.0.1:8765]
const pw = require(process.env.PW || "playwright-core"), fs = require("fs"), path = require("path");
const BASE = process.argv[2] || "http://127.0.0.1:8765", ROOT = path.join(__dirname, "..");
const chrome = { executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"] };
const urls = [...fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].replace(/^https?:\/\/[^/]+/, ""));
urls.push("/404.html");
const SIZES = [[360, 740], [412, 915]];
// reuse the real-swipe solvers from the game test (idle, swipe, drag, solveClassic, solve)
const GS = fs.readFileSync(path.join(__dirname, "screens-game.js"), "utf8");
eval(GS.slice(GS.indexOf("async function idle"), GS.indexOf("async function colourCheck")));
let fails = 0; const bad = (m) => { fails++; console.log("  ✗ " + m); };
async function checkPage(ctx, u, tag) {
  const p = await ctx.newPage(), errs = [];
  p.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text()); });
  p.on("pageerror", e => errs.push("pageerror: " + e.message));
  p.on("response", r => { if (r.url().startsWith(BASE) && r.status() >= 400 && !/404\.html$/.test(u)) errs.push("HTTP " + r.status() + " " + r.url()); });
  const q = u === "/" ? "/?test=1&tutorial=0" : u;
  await p.goto(BASE + q, { waitUntil: "load" }); await p.waitForTimeout(u === "/" ? 900 : 250);
  const r = await p.evaluate(() => {
    const de = document.documentElement, over = de.scrollWidth - window.innerWidth;
    const imgs = [...document.images].filter(i => i.complete && i.naturalWidth === 0 && i.getAttribute("loading") !== "lazy").map(i => i.src);
    const noAlt = [...document.images].filter(i => !i.hasAttribute("alt")).map(i => i.src);
    const svgNoLabel = [...document.querySelectorAll("main svg[role=img]")].filter(s => !s.getAttribute("aria-label")).length;
    const h1 = document.querySelectorAll("h1").length;
    const wide = over > 1 ? [...document.querySelectorAll("body *")].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 3).map(e => e.tagName + "." + e.className) : [];
    return { over, imgs, noAlt, svgNoLabel, h1, wide, title: document.title, canon: (document.querySelector("link[rel=canonical]") || {}).href, desc: (document.querySelector("meta[name=description]") || {}).content };
  });
  if (r.over > 1) bad(`${tag} ${u}: horizontal overflow ${r.over}px ${r.wide.join(" ")}`);
  if (r.imgs.length) bad(`${tag} ${u}: broken images ${r.imgs.join(" ")}`);
  if (r.noAlt.length) bad(`${tag} ${u}: images without alt ${r.noAlt.join(" ")}`);
  if (r.svgNoLabel) bad(`${tag} ${u}: ${r.svgNoLabel} svg without label`);
  if (r.h1 !== 1 && u !== "/") bad(`${tag} ${u}: ${r.h1} h1`);
  errs.forEach(e => bad(`${tag} ${u}: ${e}`));
  await p.close(); return r;
}
async function run(browser, tag, opts) {
  console.log("== " + tag);
  for (const [w, h] of SIZES) {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: w, height: h } }, opts));
    await ctx.addInitScript(() => { try { localStorage.setItem("ps2:prefs", JSON.stringify({ sound: false, music: false, tutDone: true, glideTut: true, marks: [] })); } catch (e) {} });
    const seen = {};
    for (const u of urls) { const r = await checkPage(ctx, u, `${tag} ${w}x${h}`); if (w === 360 && tag === "chromium-light") seen[u] = r; }
    if (Object.keys(seen).length) { // unique titles / descriptions, canonicals
      const t = {}, d = {}; Object.entries(seen).forEach(([u, r]) => { if (u === "/404.html") return; (t[r.title] = t[r.title] || []).push(u); (d[r.desc] = d[r.desc] || []).push(u); if (!r.canon) bad(`${u}: no canonical`); if (!r.desc) bad(`${u}: no description`); });
      Object.entries(t).forEach(([k, v]) => v.length > 1 && bad(`duplicate title "${k}": ${v.join(" ")}`));
      Object.entries(d).forEach(([k, v]) => v.length > 1 && bad(`duplicate description: ${v.join(" ")}`));
    }
    await ctx.close();
  }
}
async function gameRules(browser) {
  console.log("== archive and progress code");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", 1); localStorage.setItem("ps2:prefs", JSON.stringify({ sound: false, music: false, tutDone: true, glideTut: true, marks: [] })); } });
  const p = await ctx.newPage(), errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/?test=1&tutorial=0&mode=daily"); await p.waitForTimeout(900);
  const today = await p.evaluate(() => PS.date);
  const fut = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 3); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); });
  await p.goto(BASE + "/?test=1&tutorial=0&date=" + fut); await p.waitForTimeout(900);
  const f = await p.evaluate(() => ({ date: PS.date, practice: PS.practice }));
  if (f.date !== today) bad(`future date ${fut} was playable (got ${f.date})`); else console.log("  ✓ future date falls back to today");
  const statsBefore = await p.evaluate(() => localStorage.getItem("ps2:stats"));
  await p.goto(BASE + "/?test=1&tutorial=0&date=2026-10-28"); await p.waitForTimeout(900);
  const pr = await p.evaluate(() => ({ date: PS.date, practice: PS.practice }));
  if (pr.date !== "2026-10-28" || !pr.practice) bad(`archive date not practice: ${JSON.stringify(pr)}`); else console.log("  ✓ past date opens as practice");
  await solve(p); await p.waitForTimeout(400); const solved = await p.evaluate(() => PS.state.status);
  await p.waitForTimeout(2500);
  const statsAfter = await p.evaluate(() => localStorage.getItem("ps2:stats"));
  if (statsAfter !== statsBefore) bad("practice solve changed ps2:stats"); else console.log("  ✓ practice solve (" + solved + ") left stats unchanged");
  const code = await p.evaluate(() => PS.progressCode());
  const ok = await p.evaluate((c) => { const d = PS.readCode(c); return !!(d && d.data); }, code);
  const badc = await p.evaluate(() => PS.readCode("PS1.nonsense"));
  if (!/^PS1\./.test(code) || !ok || badc) bad("progress code round-trip failed"); else console.log("  ✓ progress code reads back; bad code rejected");
  errs.forEach(e => bad("pageerror: " + e));
  await ctx.close();
}
(async () => {
  const only = process.env.ONLY;
  if (!only || only === "light") { const b = await pw.chromium.launch(chrome); await run(b, "chromium-light", {}); await gameRules(b); await b.close(); }
  if (!only || only === "dark") { const b = await pw.chromium.launch(chrome); await run(b, "chromium-dark", { colorScheme: "dark" }); await b.close(); }
  if (!only || only === "forcedark") { const b = await pw.chromium.launch({ executablePath: chrome.executablePath, args: ["--no-sandbox", "--force-dark-mode", "--enable-features=WebContentsForceDark"] }); await run(b, "forced-dark", { colorScheme: "dark" }); await b.close(); }
  if (!only || only === "firefox") { const b = await pw.firefox.launch(); await run(b, "firefox-dark", { colorScheme: "dark" }); await b.close(); }
  console.log(fails ? `FAILED: ${fails} problem(s)` : `OK: ${urls.length} pages, no problems`);
  process.exit(fails ? 1 : 0);
})();
