#!/usr/bin/env node
/* Records the CrazyGames gameplay videos (silent H.264 MP4, no cursor):
     landscape 1920x1080 and portrait 1080x1620 (2:3), each ~18 s, opening on the static cover.
   Real-time capture: headful Chrome on its own Xvfb display, grabbed with ffmpeg x11grab -draw_mouse 0.
   Moves are made through the test hook (?test=1 -> PS.swipe), so no pointer is ever shown.
   Needs: Xvfb, ffmpeg, Chrome, the build served over http, and the cover frames from
   make-crazygames-covers.js (FRAME_DIR=/tmp/cgframes).
     PW=$(npm root -g)/playwright-core GAME=http://game.test:8783/crazygames/ node tools/make-crazygames-video.js */
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");
const pw = require(process.env.PW || "playwright-core");
const GAME = process.env.GAME || "http://game.test:8783/crazygames/";
const OUT = process.env.OUT || "/workspace/paneslide-builds/crazygames-assets";
const FRAMES = process.env.FRAME_DIR || "/tmp/cgframes";
const CHROME = process.env.CHROME || "/usr/bin/google-chrome";
const LEN = +(process.env.LEN || 18);
const START = +(process.env.LEVEL || 11);
const PREFS = { tutDone: true, glideTut: true, music: false, sound: false, mixSeen: ["C", "M", "Y"] };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function record(kind) {
  const [W, H, dpr, frame] = kind === "landscape" ? [1920, 1080, 1.5, "frame-landscape-1920x1080.png"] : [1080, 1620, 2, "frame-portrait-1080x1620.png"];
  const disp = ":" + (kind === "landscape" ? 77 : 78);
  const xvfb = cp.spawn("Xvfb", [disp, "-screen", "0", W + "x" + H + "x24", "-nolisten", "tcp"], { stdio: "ignore" });
  await sleep(800);
  const host = new URL(GAME).hostname;
  const browser = await pw.chromium.launch({
    executablePath: CHROME, headless: false, env: Object.assign({}, process.env, { DISPLAY: disp }),
    ignoreDefaultArgs: ["--enable-automation"],
    args: ["--host-resolver-rules=MAP " + host + " 127.0.0.1", "--kiosk", "--start-fullscreen", "--force-device-scale-factor=" + dpr,
      "--window-position=0,0", "--window-size=" + Math.round(W / dpr) + "," + Math.round(H / dpr),
      "--hide-scrollbars", "--noerrdialogs", "--disable-infobars", "--no-first-run", "--autoplay-policy=no-user-gesture-required"]
  });
  const ctx = await browser.newContext({ viewport: null });
  await ctx.addInitScript(p => localStorage.setItem("ps2:prefs", JSON.stringify(p)), PREFS);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(GAME + "index.html?test=1&tutorial=0&level=" + START);
  await page.waitForFunction(() => window.PS && PS.puzzle && PS.state);
  { // make the window truly fullscreen (no tab strip / address bar) via CDP
    const cdp = await ctx.newCDPSession(page);
    const { windowId } = await cdp.send("Browser.getWindowForTarget");
    await cdp.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "fullscreen" } });
  }
  let css = [];
  for (let i = 0; i < 40; i++) { css = await page.evaluate(() => [innerWidth, innerHeight]); if (css[1] === Math.round(H / dpr)) break; await sleep(100); }
  if (css[0] !== Math.round(W / dpr) || css[1] !== Math.round(H / dpr)) { await browser.close(); xvfb.kill(); throw new Error(kind + ": window is " + css + ", expected " + [W / dpr, H / dpr]); }
  const img = "data:image/png;base64," + fs.readFileSync(path.join(FRAMES, frame)).toString("base64");
  await page.evaluate(src => { const i = document.createElement("img"); i.id = "__cover"; i.src = src;
    i.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483647;transition:opacity .35s ease;pointer-events:none"; document.documentElement.appendChild(i); return i.decode(); }, img);
  await page.mouse.move(W / dpr - 1, H / dpr - 1); // park the (hidden) pointer away from any hover state
  await sleep(600);
  const raw = path.join("/tmp", "cg-" + kind + "-raw.mp4");
  const ff = cp.spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "x11grab", "-draw_mouse", "0", "-framerate", "30", "-video_size", W + "x" + H,
    "-i", disp + ".0+0,0", "-t", String(LEN + 2), "-c:v", "libx264", "-preset", "ultrafast", "-crf", "12", "-pix_fmt", "yuv444p", raw], { stdio: ["ignore", "inherit", "inherit"] });
  const ffDone = new Promise(r => ff.on("exit", r));
  const t0 = Date.now();
  await sleep(1800);                                                     // static cover
  await page.evaluate(() => { document.getElementById("__cover").style.opacity = "0"; });
  await sleep(700);
  const solve = async () => {
    for (let k = 0; k < 30; k++) {
      const done = await page.evaluate(() => { if (!PS.state || PS.state.status !== "playing") return true; if (PS.busy) return null; const m = PS.E.nextMove(PS.puzzle, PS.state.pos); if (!m) return true; PS.swipe(m.pane, m.dir); return false; });
      if (done === true) break;
      await sleep(done === null ? 80 : 620);
    }
  };
  while (Date.now() - t0 < (LEN + 1) * 1000) {
    await solve();
    await page.waitForSelector("dialog[open] #btnNext", { timeout: 8000 });
    await sleep(2100);                                                   // let the win popup play
    if (Date.now() - t0 > (LEN - 1.5) * 1000) break;
    await page.evaluate(() => document.getElementById("btnNext").click());
    await sleep(700);
  }
  await ffDone;
  await browser.close(); xvfb.kill();
  // final: trim to LEN s, H.264 yuv420p, no audio, faststart
  const out = path.join(OUT, "gameplay-" + kind + "-" + W + "x" + H + ".mp4");
  cp.execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", raw, "-t", String(LEN), "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "18",
    "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", "30", "-movflags", "+faststart", out]);
  console.log("wrote", out, errors.length ? "ERRORS: " + errors.join(" | ") : "(no page errors)");
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const k of (process.env.KINDS || "landscape,portrait").split(",")) await record(k);
})().catch(e => { console.error(e); process.exit(1); });
