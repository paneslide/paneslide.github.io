#!/usr/bin/env node
/* Makes the CrazyGames listing covers from real PaneSlide boards.
   Needs the CrazyGames build served over http (see test-crazygames.js), e.g.
     cd /workspace/paneslide-builds && python3 -m http.server 8783
     PW=$(npm root -g)/playwright-core GAME=http://game.test:8783/crazygames/ node tools/make-crazygames-covers.js
   Writes landscape 1920x1080, portrait 800x1200 and square 800x800 PNGs (plus JPG copies)
   to OUT (default /workspace/paneslide-builds/crazygames-assets). Only text on a cover: the title. */
"use strict";
const fs = require("fs"), path = require("path");
const pw = require(process.env.PW || "playwright-core");
const GAME = process.env.GAME || "http://game.test:8783/crazygames/";
const OUT = process.env.OUT || "/workspace/paneslide-builds/crazygames-assets";
const BUILD = process.env.BUILD || "/workspace/paneslide-builds/crazygames";
const CHROME = process.env.CHROME || "/usr/bin/google-chrome";
const PREFS = { tutDone: true, glideTut: true, music: false, sound: false, mixSeen: ["C", "M", "Y"] };

async function boardPng(ctx, level, moves) {
  const p = await ctx.newPage();
  await p.goto(GAME + "index.html?test=1&tutorial=0&level=" + level);
  await p.waitForFunction(() => window.PS && PS.puzzle && document.querySelector("#board canvas, #board .pane"));
  for (let i = 0; i < (moves || 0); i++) { await p.evaluate(() => { const m = PS.E.nextMove(PS.puzzle, PS.state.pos); if (m) PS.swipe(m.pane, m.dir); }); await p.waitForTimeout(700); }
  await p.addStyleTag({ content: "html,body{background:transparent!important}.scene{display:none!important}body *{visibility:hidden!important}#board,#board *{visibility:visible!important}#board .ghost,#board .hand{display:none!important}" });
  await p.waitForTimeout(300);
  const r = await p.evaluate(() => { const b = document.getElementById("board").getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; });
  const m = 24, clip = { x: r.x - m, y: r.y - m, width: r.width + 2 * m, height: r.height + 2 * m + 12 };
  const buf = await p.screenshot({ clip, omitBackground: true });
  await p.close();
  return "data:image/png;base64," + buf.toString("base64");
}

function coverHtml(kind, a, b) {
  // kind: land | port | square. a = main board (boss), b = second board.
  const L = {
    land:   { title: "left:120px;top:300px;", logo: 1.7, tsize: 168, sub: 92, a: "right:120px;top:120px;width:820px;transform:rotate(5deg)", b: "right:-30px;top:610px;width:420px;transform:rotate(12deg)" },
    port:   { title: "left:0;right:0;top:110px;text-align:center;", logo: 1.2, tsize: 128, sub: 70, a: "left:70px;top:560px;width:680px;transform:rotate(-5deg)", b: "left:-60px;top:900px;width:340px;transform:rotate(10deg)", center: true },
    square: { title: "left:0;right:0;top:70px;text-align:center;", logo: 0.95, tsize: 104, sub: 58, a: "left:170px;top:400px;width:560px;transform:rotate(-5deg)", b: "left:-40px;top:520px;width:300px;transform:rotate(10deg)", center: true }
  }[kind];
  return `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="css/style.css">
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;display:block}
.scene{z-index:0}.scene .rays,.scene .motes i{animation:none!important}.scene .rays{top:${kind === "land" ? "40%" : "20%"}}
.scene .hills{height:${kind === "land" ? "30vh" : "22vh"}}
.cv{position:absolute;inset:0;z-index:1}
.bd{position:absolute;filter:drop-shadow(0 26px 34px rgba(20,0,60,.45))}
.ttl{position:absolute;${L.title}}
.ttl .logo-big{animation:none;zoom:${L.logo};${L.center ? "margin:0 auto 26px;" : "margin:0 0 34px 18px;"}}
.ttl .logo-big .lg{animation:none}.ttl .logo-big .shine{display:none}
.ttl .title{font-size:${L.tsize}px;margin:0;line-height:.95;-webkit-text-stroke:${Math.round(L.tsize / 24)}px #4630A8;text-shadow:0 ${Math.round(L.tsize / 14)}px 0 #4630A8,0 ${Math.round(L.tsize / 7)}px ${Math.round(L.tsize / 4)}px rgba(20,0,60,.5)}
.ttl .title small{display:block;font-size:${L.sub}px;letter-spacing:${Math.round(L.sub / 7)}px;color:#fff;margin-top:${Math.round(L.sub / 5)}px;-webkit-text-stroke:${Math.round(L.sub / 22)}px #4630A8}
</style></head><body>
<div class="scene"><div class="rays"></div><div class="sun" style="width:${kind === "land" ? 900 : 700}px;height:${kind === "land" ? 900 : 700}px;margin:-${kind === "land" ? 450 : 350}px 0 0 -${kind === "land" ? 450 : 350}px;top:${kind === "land" ? "40%" : "20%"}"></div>
<svg class="hills" viewBox="0 0 400 160" preserveAspectRatio="none"><path class="h1" d="M0 70 C60 30 120 40 180 70 S300 110 400 60 V160 H0Z"/><path class="h2" d="M0 110 C80 80 150 90 220 112 S340 140 400 104 V160 H0Z"/></svg></div>
<div class="cv">
<img class="bd" src="${b}" style="${L.b}">
<img class="bd" src="${a}" style="${L.a}">
<div class="ttl"><div class="logo-big"><i class="lg c"></i><i class="lg m"></i><i class="lg y"></i><i class="shine"></i></div>
<h1 class="title">Pane<span>Slide</span><small>LEVELS</small></h1></div>
</div></body></html>`;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const host = new URL(GAME).hostname;
  const browser = await pw.chromium.launch({ executablePath: CHROME, args: ["--host-resolver-rules=MAP " + host + " 127.0.0.1"] });
  const bctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 3 });
  await bctx.addInitScript(p => localStorage.setItem("ps2:prefs", JSON.stringify(p)), PREFS);
  const boss = await boardPng(bctx, +(process.env.BOARD_A || 40), +(process.env.MOVES_A || 0));
  const other = await boardPng(bctx, +(process.env.BOARD_B || 13), +(process.env.MOVES_B || 2));
  await bctx.close();
  const sizes = { land: [1920, 1080, "landscape"], port: [800, 1200, "portrait"], square: [800, 800, "square"] };
  for (const k of Object.keys(sizes)) {
    const [w, h, name] = sizes[k];
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    // The cover page is a temp file next to a copy of the build's css + fonts (file:// keeps relative paths simple).
    const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "cgcover-"));
    for (const d of ["css", "fonts"]) fs.cpSync(path.join(BUILD, d), path.join(tmp, d), { recursive: true });
    fs.writeFileSync(path.join(tmp, "cover.html"), coverHtml(k, boss, other));
    await p.goto("file://" + path.join(tmp, "cover.html"));
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(400);
    const file = path.join(OUT, "cover-" + name + "-" + w + "x" + h + ".png");
    await p.screenshot({ path: file });
    await p.screenshot({ path: file.replace(/\.png$/, ".jpg"), type: "jpeg", quality: 92 });
    console.log("wrote", file);
    await ctx.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  if (process.env.FRAME_DIR) { // full-res first frames for the 2:3 portrait video (1080x1620) and 1080p landscape
    fs.mkdirSync(process.env.FRAME_DIR, { recursive: true });
    for (const [k, w, h, dpr, name] of [["port", 800, 1200, 1.35, "frame-portrait-1080x1620.png"], ["land", 1920, 1080, 1, "frame-landscape-1920x1080.png"]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
      const p = await ctx.newPage();
      const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "cgcover-"));
      for (const d of ["css", "fonts"]) fs.cpSync(path.join(BUILD, d), path.join(tmp, d), { recursive: true });
      fs.writeFileSync(path.join(tmp, "cover.html"), coverHtml(k, boss, other));
      await p.goto("file://" + path.join(tmp, "cover.html"));
      await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
      await p.screenshot({ path: path.join(process.env.FRAME_DIR, name) });
      console.log("wrote", path.join(process.env.FRAME_DIR, name));
      await ctx.close(); fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
