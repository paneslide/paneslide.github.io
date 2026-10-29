// Screenshots of the real game for the guides (img/guides/*.webp). Usage:
//   PW=$(npm root -g)/playwright-core node tools/capture-guides.js [base=http://127.0.0.1:8765]
// Needs python3 with Pillow to convert PNG -> WebP. Writes img/guides/shots.json (sizes).
const pw = require(process.env.PW || "playwright-core"), fs = require("fs"), path = require("path"), cp = require("child_process");
const BASE = process.argv[2] || "http://127.0.0.1:8765", OUT = path.join(__dirname, "../img/guides"), TMP = "/tmp/ps-shots";
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(TMP, { recursive: true });
const SHOTS = [
  ["level-1", "level=1"], ["level-2", "level=2"], ["level-3", "level=3"], ["level-12", "level=12"], ["level-18", "level=18"], ["level-25", "level=25"],
  ["level-33", "level=33"], ["level-42", "level=42"], ["level-52", "level=52"], ["level-64", "level=64"], ["level-78", "level=78"], ["level-95", "level=95"],
  ["level-40-boss", "level=40"], ["level-10-hint", "level=10", "hint"], ["daily", "mode=daily"], ["home", "", "home"], ["map", "mode=levels", "page"]
];
(async () => {
  const b = await pw.chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome" });
  const sizes = {};
  for (const [name, q, how] of SHOTS) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await ctx.addInitScript(() => { localStorage.setItem("ps2:prefs", JSON.stringify({ sound: false, music: false, musicVol: .18, patterns: false, tutDone: true, glideTut: true, mixSeen: ["3", "5", "6", "7"], marks: [], vibe: false }));
      if (!localStorage.getItem("ps2:levels")) localStorage.setItem("ps2:levels", JSON.stringify({ unlocked: 41, stars: {}, best: {}, hints: 3, perf: 0, bestPerf: 0, mile: [5, 10, 20, 30, 40], threeSince: 0, tips: [], v: 8, shards: 40 })); });
    const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
    await p.goto(`${BASE}/?test=1&tutorial=0${q ? "&" + q : ""}`); await p.waitForTimeout(1400);
    if (how === "hint") { await p.evaluate(() => window.PS.hint()); await p.waitForTimeout(900); }
    let clip;
    if (how === "home" || how === "page") clip = { x: 0, y: 0, width: 390, height: 844 };
    else clip = await p.evaluate(() => { const els = [document.querySelector(".goal"), document.getElementById("board"), document.getElementById("status")].filter(Boolean).map(e => e.getBoundingClientRect());
      const x0 = Math.min(...els.map(r => r.left)), y0 = Math.min(...els.map(r => r.top)), x1 = Math.max(...els.map(r => r.right)), y1 = Math.max(...els.map(r => r.bottom));
      return { x: Math.max(0, x0 - 10), y: Math.max(0, y0 - 10), width: Math.min(390, x1 + 10) - Math.max(0, x0 - 10), height: y1 - y0 + 20 }; });
    const png = path.join(TMP, name + ".png"); await p.screenshot({ path: png, clip });
    if (errs.length) console.log(name, "ERRORS", errs);
    const w = 360, h = Math.round(clip.height * w / clip.width);
    cp.execFileSync("python3", ["-c", `from PIL import Image; im=Image.open("${png}").convert("RGB").resize((${w * 2},${h * 2}), Image.LANCZOS); im.save("${path.join(OUT, name + ".webp")}", "WEBP", quality=78, method=6)`]);
    sizes[name] = { w, h }; console.log(name, w + "x" + h, fs.statSync(path.join(OUT, name + ".webp")).size + " bytes");
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "shots.json"), JSON.stringify(sizes, null, 1) + "\n");
  await b.close();
})();
