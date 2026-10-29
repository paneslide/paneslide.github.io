/* PaneSlide game UI. Original code. No network calls, no cookies; progress in localStorage. */
(function () {
  "use strict";
  var E = window.PaneEngine;
  var SITE = "paneslide.github.io";
  var qs = new URLSearchParams(location.search);
  var TEST = qs.get("test") === "1";
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, parent) { var e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function localDate(d) { d = d || new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

  // ---------- colours (glass multiplies like real filters) ----------
  var HEX = { C: "#3CC8F0", M: "#F0509A", Y: "#FFD84A" };
  var NAME = { C: "Cyan", M: "Magenta", Y: "Yellow" };
  var MIXNAME = { 3: "Blue", 5: "Green", 6: "Red", 7: "Black" };
  var EMOJI = { C: "🟦", M: "🟪", Y: "🟨" };
  function rgb(h) { return [1, 3, 5].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
  function maskColor(m) {
    var c = [255, 255, 255];
    ["C", "M", "Y"].forEach(function (k) { if (m & E.BIT[k]) { var x = rgb(HEX[k]); c = c.map(function (v, i) { return Math.min(v, x[i]); }); } }); // same as the board: darkest channel wins
    return "rgb(" + c.join(",") + ")";
  }
  function bitsOf(m) { return ["C", "M", "Y"].filter(function (k) { return m & E.BIT[k]; }); }

  // ---------- state ----------
  var today = localDate();
  var date = /^\d{4}-\d{2}-\d{2}$/.test(qs.get("date") || "") ? qs.get("date") : today;
  var practice = date !== today;
  var prefs = load("ps2:prefs", { sound: true, patterns: false, tutDone: false, mixSeen: [] });
  if (prefs.music === undefined) prefs.music = true; // soft background music, on by default at a low volume
  if (typeof prefs.musicVol !== "number") prefs.musicVol = 0.18;
  if (!Array.isArray(prefs.marks)) prefs.marks = []; // coach marks already shown
  if (typeof prefs.vibe !== "boolean") prefs.vibe = true;
  var stats = load("ps2:stats", { played: 0, streak: 0, best: 0, lastWin: null, dist: [0, 0, 0, 0] });
  var mode, puz, n, state, GKEY, zTop = 10, locked = false;
  var prog = load("ps2:levels", null) || { unlocked: 1, stars: {}, best: {}, hints: 3, perf: 0, bestPerf: 0, mile: [], threeSince: 0, tips: [] };
  ["stars", "best"].forEach(function (k) { prog[k] = prog[k] || {}; }); prog.mile = prog.mile || []; prog.tips = prog.tips || [];
  if (typeof prog.hints !== "number") prog.hints = 3;
  function lvSave() { save("ps2:levels", prog); }
  var HINT_MAX = 5;
  function parOf(p) { return E.parOf(p); }

  // ---------- chapters, ranks, tips ----------
  // scene: [sky top, sky mid, sky bottom, far hill, near hill, sun glow, banner light, banner dark]
  var CHAPTERS = [
    { name: "Sunroom", icon: "☀️", sc: ["#E8553D", "#FF9A4D", "#FFD36B", "#E86A2E", "#B8431E", "#FFF3B0", "#FFB347", "#F0702A"] },
    { name: "Greenhouse", icon: "🌿", sc: ["#0F5C4A", "#2E9E6B", "#9BE07A", "#2A8A57", "#17603E", "#D9FFB0", "#7ED957", "#2E9E4F"] },
    { name: "Lighthouse", icon: "🌊", sc: ["#0B2D6B", "#1F6FC4", "#5CC8F0", "#1A5AA8", "#0E3C7A", "#CFF4FF", "#5EC4FF", "#2D7FE6"] },
    { name: "Tea Garden", icon: "🍵", sc: ["#3D5A1E", "#7FA33A", "#E3D27A", "#6B8F2E", "#465F1C", "#FFF7C2", "#C8D86A", "#6F9330"] },
    { name: "Lantern Market", icon: "🏮", sc: ["#4A0F2E", "#B3204D", "#FF8A4C", "#8A1A3E", "#5A0F28", "#FFD08A", "#FF7B7B", "#C42A4A"] },
    { name: "Lavender Loft", icon: "💜", sc: ["#2B1466", "#6A2FB8", "#C38BFF", "#5A2AA0", "#371673", "#F0DCFF", "#A88BFF", "#6A46EA"] },
    { name: "Desert Dunes", icon: "🏜️", sc: ["#7A2E12", "#D9722E", "#FFC46B", "#C25E22", "#8C3D14", "#FFF0C2", "#FFB86A", "#E07A2E"] },
    { name: "Snow Cabin", icon: "❄️", sc: ["#14244F", "#3E6BB0", "#B9DCF5", "#7FA6D6", "#4E74AD", "#FFFFFF", "#8FD0FF", "#3E7FD0"] }
  ];
  var ROMAN = ["", " II", " III", " IV", " V", " VI", " VII", " VIII", " IX", " X"];
  function chapterOf(N) {
    var k = Math.floor((N - 1) / 20), c = CHAPTERS[k % CHAPTERS.length], cyc = Math.floor(k / CHAPTERS.length);
    return { index: k + 1, name: c.name + (cyc < ROMAN.length ? ROMAN[cyc] : " " + (cyc + 1)), icon: c.icon, sc: c.sc };
  }
  var SCENE_VARS = ["--sky1", "--sky2", "--sky3", "--hill1", "--hill2", "--glow"];
  function applyTheme(ch) {
    var r = document.documentElement.style;
    SCENE_VARS.forEach(function (v, i) { if (ch) r.setProperty(v, ch.sc[i]); else r.removeProperty(v); });
    var tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.setAttribute("content", ch ? ch.sc[0] : "#3B1F7A");
  }
  var RANKS = [[5, "Glass Spark"], [10, "Glass Apprentice"], [20, "Pane Pusher"], [30, "Colour Mixer"], [50, "Glass Master"], [75, "Prism Pro"], [100, "Window Wizard"], [150, "Stained-Glass Sage"], [200, "Lightkeeper"], [300, "Grand Glazier"], [500, "PaneSlide Legend"]];
  function rankIndex(cleared) { var i = -1; RANKS.forEach(function (r, k) { if (cleared >= r[0]) i = k; }); return i; }
  function isMilestone(N) { return N === 5 || N % 10 === 0; }

  var view = "home";
  function showView(v) {
    view = v; document.body.dataset.view = v;
    $("homeView").hidden = v !== "home"; $("mapView").hidden = v !== "map"; $("playView").hidden = !(v === "play" || v === "tutorial");
    $("btnBack").style.visibility = (v === "home" || v === "tutorial") ? "hidden" : "visible";
    $("lvBadge").style.visibility = v === "home" ? "hidden" : "visible";
    $("hudStars").textContent = totalStars();
    window.scrollTo(0, 0);
  }
  function setBadge(icon, top, num) {
    $("badgeIcon").innerHTML = icon; $("badgeTop").textContent = top; var b = $("badgeNum"); b.textContent = num;
    b.style.fontSize = String(num).length > 13 ? "15px" : String(num).length > 9 ? "17px" : "";
  }
  var CAL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>';
  function levelUI(on) { $("btnHint").hidden = !on; $("btnRestart").hidden = !on; $("starLine").hidden = false; $("btnUndo").hidden = !(puz && puz.glide && mode !== "tutorial"); }
  function startHome() {
    hideCoach(true); clearHint(); mode = "home"; locked = true; applyTheme(null);
    var lv = $("playLv"); lv.textContent = "Level " + prog.unlocked;
    var d = new Date(); $("calMon").textContent = d.toLocaleString("en", { month: "short" }).toUpperCase(); $("calDay").textContent = d.getDate();
    var st = load("ps2:game:" + today, null), ds = $("dailyStat");
    clearMarks(); syncMusicBtn();
    if (prefs.tutDone) { mark("music", "btnMusic", 700); mark("daily", "btnDaily"); }
    if (st && st.status === "won") ds.innerHTML = "<span class='done'>✔</span>";
    else if (currentStreak() > 0) ds.innerHTML = "<i class='ico fire'></i>" + currentStreak();
    else ds.innerHTML = "<span class='new'>NEW</span>";
    showView("home");
  }
  function startDaily() {
    hideCoach(true); applyTheme(null); levelUI(false);
    mode = "daily"; puz = E.generate(date); n = puz.n; GKEY = "ps2:game:" + date; levelUI(false);
    state = load(GKEY, null);
    if (!state || !Array.isArray(state.pos) || state.pos.length !== puz.panes.length || (puz.glide && state.status === "playing" && !E.validState(puz, state.pos))) state = { pos: puz.start.slice(), moves: 0, hist: [], status: "playing" };
    state.undo = state.undo || [];
    locked = state.status !== "playing";
    setRule("");
    $("btnSkip").hidden = true; $("status").hidden = false;
    setBadge(CAL_SVG, practice ? "Practice" : "Daily", practice ? date.slice(5) : "#" + puz.number);
    showView("play"); build(); clearMarks();
    if (state.status === "won") { $("board").classList.add("won"); setTimeout(openEnd, 500); }
    else if (!practice) { mark("everyone", "lvBadge", 600); mark("stars", "status"); }
  }
  function startTutorial() {
    mode = "tutorial"; puz = E.tutorial(); n = puz.n; GKEY = null;
    state = { pos: puz.start.slice(), moves: 0, hist: [], undo: [], status: "playing" }; locked = false;
    setRule("");
    $("btnSkip").hidden = false; $("status").hidden = true; levelUI(false); applyTheme(null);
    setBadge("👆", "Tutorial", "1 / 2");
    showView("tutorial"); build(); setTimeout(coachTutorial, 350);
  }
  function ensureLevels(cb) {
    if (window.PANESLIDE_LEVELS) return cb();
    var sc = document.createElement("script"); sc.src = "js/levels.js?v=7"; sc.onload = cb; sc.onerror = cb; document.head.appendChild(sc);
  }
  function getLevel(N) {
    var D = window.PANESLIDE_LEVELS;
    if (D && N <= D.length) return E.unpackLevel(D[N - 1], N);
    return E.generateLevel(N, { ms: 2500 }); // beyond the precomputed file: same rules, made on the phone
  }
  var tipShown = null, tipT;
  function flashTip(t, ms) { tipShown = t; var r = $("rule"); r.textContent = t; r.classList.remove("coaching"); void r.offsetWidth; r.classList.add("coaching"); clearTimeout(tipT); if (ms) tipT = setTimeout(function () { if (tipShown === t) { tipShown = null; r.classList.remove("coaching"); } }, ms); }
  function startLevel(N) {
    ensureLevels(function () {
      hideCoach(true); clearHint();
      mode = "level"; puz = getLevel(N); n = puz.n; GKEY = null; locked = false;
      state = { pos: puz.start.slice(), moves: 0, hist: [], undo: [], status: "playing", hinted: false };
      var ch = chapterOf(N); applyTheme(ch);
      $("btnSkip").hidden = true; $("status").hidden = false; levelUI(true);
      setBadge(puz.challenge ? "🏆" : puz.breather ? "🌿" : ch.icon, "Level", N);
      showView("play"); build(); updateHint(); updateStarLine();
      tipShown = null; setRule("");
      clearMarks(); levelMarks(N);
      if (N % 20 === 1 && N > 1) setTimeout(function () { flashTip(ch.icon + " " + ch.name + "!", 2800); }, 350);
    });
  }
  function setRule(t) { var r = $("rule"); r.textContent = t; r.classList.toggle("coaching", !!t); }

  // ---------- audio (synthesised, self-made) ----------
  var ac = null;
  var gestured = false; // browsers only allow sound after the player has tapped (no AudioContext before that)
  function actx() { if (!gestured) return null; if (!ac) { var A = window.AudioContext || window.webkitAudioContext; if (A) { try { ac = new A({ latencyHint: "balanced" }); } catch (e) { ac = new A(); } } } if (ac && ac.state === "suspended") { var r = ac.resume(); if (r && r.catch) r.catch(function () {}); } return ac; } // Firefox rejects a pending resume() when you leave the page
  function tone(f, dur, type, vol, when) {
    if (!prefs.sound) return; var a = actx(); if (!a) return;
    var t = a.currentTime + (when || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type || "sine"; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master()); o.start(t); o.stop(t + dur + 0.05);
    o.onended = function () { o.disconnect(); g.disconnect(); };
  }
  var masterNode = null;
  function master() { // everything goes through one soft limiter, so music + effects can never clip
    if (masterNode) return masterNode;
    var a = ac, lim = a.createDynamicsCompressor();
    lim.threshold.value = -8; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.25;
    var g = a.createGain(); g.gain.value = 0.9; lim.connect(g); g.connect(a.destination);
    masterNode = lim; return lim;
  }
  var sfx = {
    step: function () { tone(1400, 0.03, "sine", 0.025); },
    drop: function () { tone(1568, 0.12, "sine", 0.05); tone(2349, 0.18, "sine", 0.03, 0.03); },
    win: function () { [659.25, 783.99, 987.77, 1318.5].forEach(function (f, i) { tone(f, 0.6, "triangle", 0.06, i * 0.08); }); tone(1975.5, 0.9, "sine", 0.03, 0.4); },
    tap: function () { tone(520, 0.06, "sine", 0.05); tone(780, 0.05, "sine", 0.03, 0.03); },
    mix: function () { [2093, 2637, 3136].forEach(function (f, i) { tone(f, 0.25, "sine", 0.02, i * 0.05); }); },
    star: function (i) { tone([880, 1108.7, 1318.5][i] || 1318.5, 0.35, "triangle", 0.07); tone(([880, 1108.7, 1318.5][i] || 1318.5) * 2, 0.25, "sine", 0.025, 0.02); },
    medal: function () { [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(function (f, i) { tone(f, 0.5, "triangle", 0.06, i * 0.1); }); }
  };
  function buzz(ms) { if (prefs.vibe && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {} }

  // ---------- layout ----------
  var CELL = 64, GAP = 6, PAD = 10, STEP = 70, paneEls = [], gripEls = [], trackEl, boardEl;
  function measure() {
    var avail = Math.min(window.innerWidth, 520) - 32 - PAD * 2 - GAP * (n - 1);
    var maxH = window.innerHeight - (mode === "tutorial" ? 330 : 410); // keep the whole game on one phone screen
    CELL = Math.max(40, Math.min(n <= 3 ? 84 : 76, Math.floor(avail / n), Math.floor((maxH - PAD * 2 - GAP * (n - 1)) / n)));
    GAP = CELL >= 56 ? 6 : 5; STEP = CELL + GAP;
    var r = document.documentElement.style;
    r.setProperty("--cell", CELL + "px"); r.setProperty("--gap", GAP + "px"); r.setProperty("--pad", PAD + "px");
  }
  function offset(p, pos) { if (p.axis === "b") return [(pos % (p.mc + 1)) * STEP, Math.floor(pos / (p.mc + 1)) * STEP]; return p.axis === "h" ? [pos * STEP, p.base * STEP] : [p.base * STEP, pos * STEP]; }
  var LOCK_SVG = '<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>';
  function arrowSVG(axis) {
    if (axis === "b") return '<svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/></svg>';
    return axis === "h"
      ? '<svg viewBox="0 0 24 24"><path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/></svg>';
  }

  // ---------- painting (canvas) ----------
  // Every puzzle colour is painted as pixels on a canvas, never as a CSS background. Browser
  // dark modes and Dark Reader-style extensions recolour CSS backgrounds (that made the board
  // nearly black on Firefox Android) but leave canvas pixels alone.
  var boardCv = null, vis = [], glassTiles = [], paintRAF = 0, anims = [];
  function hiDPI(cv, w, h) { var k = Math.min(window.devicePixelRatio || 1, 3); cv.width = Math.round(w * k); cv.height = Math.round(h * k); cv.style.width = w + "px"; cv.style.height = h + "px"; var x = cv.getContext("2d"); x.setTransform(cv.width / w, 0, 0, cv.height / h, 0, 0); return x; }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function patternInto(ctx, mask, x, y, s) { // colour-blind patterns, one per colour
    ctx.save(); rr(ctx, x, y, s, s, s * 0.2); ctx.clip(); ctx.lineWidth = Math.max(1.5, s / 28); ctx.strokeStyle = ctx.fillStyle = "rgba(0,0,0,.28)";
    if (mask & 1) { ctx.beginPath(); for (var a = -s; a <= s; a += s / 6) { ctx.moveTo(x + a, y + s); ctx.lineTo(x + a + s, y); } ctx.stroke(); }
    if (mask & 2) { var st = s / 6; for (var py = y + st / 2; py < y + s; py += st) for (var px = x + st / 2; px < x + s; px += st) { ctx.beginPath(); ctx.arc(px, py, st * 0.2, 0, 6.3); ctx.fill(); } }
    if (mask & 4) { ctx.beginPath(); for (var b = y + s / 8; b < y + s; b += s / 7) { ctx.moveTo(x, b); ctx.lineTo(x + s, b); } ctx.stroke(); }
    ctx.restore();
  }
  function paintSwatch(cv, size, mask) { var x = hiDPI(cv, size, size); x.fillStyle = maskColor(mask); rr(x, 0, 0, size, size, size * 0.24); x.fill(); x.fillStyle = "rgba(255,255,255,.35)"; rr(x, 2, 2, size - 4, size * 0.38, size * 0.18); x.fill(); if (prefs.patterns) patternInto(x, mask, 0, 0, size); }
  function swatchHTML(mask, cls) { return "<canvas class='swatch" + (cls ? " " + cls : "") + "' data-mask='" + mask + "' aria-hidden='true'></canvas>"; }
  function paintSwatches(root) { root.querySelectorAll("canvas.swatch").forEach(function (cv) { paintSwatch(cv, cv.classList.contains("res") ? 30 : 24, +cv.dataset.mask); }); }
  function paintTarget() {
    var t = $("target"), tc = n <= 3 ? 28 : n === 4 ? 24 : n === 5 ? 21 : 18, g = 3, side = n * tc + (n - 1) * g;
    t.innerHTML = ""; t.style.gridTemplateColumns = "none";
    var cv = el("canvas", "tcv", t), x = hiDPI(cv, side + 8, side + 8);
    x.fillStyle = (getComputedStyle(document.body).getPropertyValue("--frame2") || "").trim() || "#D9CCF7"; rr(x, 0, 0, side + 8, side + 8, 10); x.fill();
    puz.target.forEach(function (m, k) {
      var cx = 4 + (k % n) * (tc + g), cy = 4 + Math.floor(k / n) * (tc + g);
      x.fillStyle = m ? maskColor(m) : WELL; rr(x, cx, cy, tc, tc, 5); x.fill(); // exactly the colours the board shows
      if (m) { x.strokeStyle = "rgba(255,255,255,.85)"; x.lineWidth = 1.5; rr(x, cx + 1, cy + 1, tc - 2, tc - 2, 4); x.stroke(); x.fillStyle = "rgba(255,255,255,.35)"; rr(x, cx + tc * 0.16, cy + tc * 0.14, tc * 0.36, Math.max(2.5, tc * 0.1), 1.5); x.fill(); }
      if (prefs.patterns && m) patternInto(x, m, cx, cy, tc);
    });
    t.setAttribute("role", "img"); t.setAttribute("aria-label", "Target picture, " + n + " by " + n);
  }
  // Glass is drawn as one raised piece per pane: coloured body, soft top light, a glossy diagonal
  // streak, a bright rim on the top-left edge, a darker rim bottom-right and a drop shadow. Empty
  // slots are recessed wells, so the glass clearly sits on top of the board.
  var WELL = "#E1D8F1", paneSprites = [], glassCv = null, shimmerT = -1, liftPi = -1;
  function rrPath(ctx, x, y, w, h, r) { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function panePath(ctx, p, ox, oy) { // the cells of a pane joined into one shape
    var R = Math.round(CELL * 0.2), on = {}; p.cells.forEach(function (c) { on[c[0] + "," + c[1]] = 1; });
    ctx.beginPath();
    p.cells.forEach(function (c) {
      var px = ox + c[1] * STEP, py = oy + c[0] * STEP, rt = on[c[0] + "," + (c[1] + 1)], dn = on[(c[0] + 1) + "," + c[1]];
      rrPath(ctx, px, py, CELL, CELL, R);
      if (rt) ctx.rect(px + CELL - R, py, GAP + 2 * R, CELL);
      if (dn) ctx.rect(px, py + CELL - R, CELL, GAP + 2 * R);
      if (rt && dn && on[(c[0] + 1) + "," + (c[1] + 1)]) ctx.rect(px + CELL - R, py + CELL - R, GAP + 2 * R, GAP + 2 * R);
    });
  }
  // v7: each pane = a flat colour body on the "darken" glass layer (so mixes are exact and match the
  // target), plus a decor layer drawn on top: a light rim around the piece's outer edge, a thin line
  // in the pane's own darker colour just inside it, soft grooves between its cells, and bolts if
  // locked. Where two panes overlap, both outlines stay visible: glass over glass.
  function shade(h, k) { return "rgb(" + rgb(h).map(function (v) { return Math.round(v * k); }).join(",") + ")"; }
  function erodeInto(p, W, H, d) { // the pane shape shrunk by d px (intersection of 16 shifted copies)
    var c = document.createElement("canvas"), x = hiDPI(c, W, H);
    x.fillStyle = "#000"; panePath(x, p, 0, 0); x.fill();
    if (d <= 0) return c;
    x.globalCompositeOperation = "destination-in";
    for (var k = 0; k < 16; k++) { var a = k * Math.PI / 8; panePath(x, p, d * Math.cos(a), d * Math.sin(a)); x.fill(); } // 16 directions: smooth inner corners
    return c;
  }
  function band(p, W, H, d0, d1, col) { // ring between insets d0 and d1, in colour col
    var c = document.createElement("canvas"), x = hiDPI(c, W, H);
    x.drawImage(erodeInto(p, W, H, d0), 0, 0, W, H);
    x.globalCompositeOperation = "destination-out"; x.drawImage(erodeInto(p, W, H, d1), 0, 0, W, H);
    x.globalCompositeOperation = "source-in"; x.fillStyle = col; x.fillRect(0, 0, W, H);
    return c;
  }
  function makeSprite(p) {
    var W = p.w * STEP - GAP, H = p.h * STEP - GAP, b = Math.max(3, CELL / 18), R = Math.round(CELL * 0.2);
    var body = document.createElement("canvas"), s = hiDPI(body, W, H);
    panePath(s, p, 0, 0); s.fillStyle = HEX[p.color]; s.fill();
    s.globalCompositeOperation = "source-atop";
    p.cells.forEach(function (c) { // a soft top light and a small gloss per cell; cells line up, so stacked glass stays clean
      var lx = c[1] * STEP, ly = c[0] * STEP, lg = s.createLinearGradient(0, ly, 0, ly + CELL * 0.55);
      lg.addColorStop(0, "rgba(255,255,255,.30)"); lg.addColorStop(1, "rgba(255,255,255,0)");
      s.fillStyle = lg; s.fillRect(lx, ly, CELL, CELL * 0.55);
      s.fillStyle = "rgba(255,255,255,.42)"; rr(s, lx + CELL * 0.14, ly + CELL * 0.12, CELL * 0.36, Math.max(4, CELL * 0.09), Math.max(2, CELL * 0.045)); s.fill();
    });
    s.globalCompositeOperation = "source-over";
    var deco = document.createElement("canvas"), d = hiDPI(deco, W, H);
    d.drawImage(band(p, W, H, 0, b, "rgba(255,255,255,.92)"), 0, 0, W, H); // light rim on the outer edge
    d.drawImage(band(p, W, H, b, b + 1.6, shade(HEX[p.color], p.locked ? 0.45 : 0.62)), 0, 0, W, H); // the pane's own colour line
    var on = {}; p.cells.forEach(function (c) { on[c[0] + "," + c[1]] = 1; });
    d.lineCap = "round";
    p.cells.forEach(function (c) { // soft grooves between the cells of one piece
      var px = c[1] * STEP, py = c[0] * STEP, gx = px + CELL + GAP / 2, gy = py + CELL + GAP / 2, m = R * 0.9;
      function groove(x1, y1, x2, y2, vx, vy) {
        d.strokeStyle = shade(HEX[p.color], 0.72); d.globalAlpha = 0.45; d.lineWidth = 1.4; d.beginPath(); d.moveTo(x1, y1); d.lineTo(x2, y2); d.stroke();
        d.strokeStyle = "#FFFFFF"; d.globalAlpha = 0.45; d.beginPath(); d.moveTo(x1 + vx, y1 + vy); d.lineTo(x2 + vx, y2 + vy); d.stroke(); d.globalAlpha = 1;
      }
      if (on[c[0] + "," + (c[1] + 1)]) groove(gx, py + m, gx, py + CELL - m, 1.4, 0);
      if (on[(c[0] + 1) + "," + c[1]]) groove(px + m, gy, px + CELL - m, gy, 0, 1.4);
    });
    if (p.locked) { // metal frame + bolts: clearly fixed in place
      d.drawImage(band(p, W, H, b + 1.6, b + 4.5, "rgba(74,59,107,.55)"), 0, 0, W, H);
      p.cells.forEach(function (c) {
        [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]].forEach(function (q) {
          var bx = c[1] * STEP + CELL * q[0], by = c[0] * STEP + CELL * q[1], r = Math.max(2.6, CELL / 20);
          var bg = d.createRadialGradient(bx - r / 3, by - r / 3, 0, bx, by, r); bg.addColorStop(0, "#FFFFFF"); bg.addColorStop(1, "#8D88A6");
          d.beginPath(); d.arc(bx, by, r, 0, 6.3); d.fillStyle = bg; d.fill(); d.strokeStyle = "rgba(40,20,80,.45)"; d.lineWidth = 1; d.stroke();
        });
      });
    }
    return { cv: body, deco: deco, W: W, H: H };
  }
  function makeTiles() { paneSprites = puz.panes.map(makeSprite); glassCv = document.createElement("canvas"); }
  function drawBoard() {
    if (!boardCv || !puz) return;
    var side = PAD * 2 + n * STEP - GAP, x = boardCv.getContext("2d"), k = boardCv.width / side;
    x.setTransform(k, 0, 0, k, 0, 0); x.globalCompositeOperation = "source-over"; x.clearRect(0, 0, side, side);
    var fr = x.createLinearGradient(0, 0, 0, side); fr.addColorStop(0, "#F6F2FF"); fr.addColorStop(1, "#D6C8F5");
    x.fillStyle = fr; rr(x, 0, 0, side, side, 24); x.fill();
    var R = Math.round(CELL * 0.2);
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) { // recessed empty slots
      var wx = PAD + c * STEP, wy = PAD + r * STEP;
      x.save(); rr(x, wx, wy, CELL, CELL, R); x.clip();
      x.fillStyle = WELL; x.fillRect(wx, wy, CELL, CELL);
      var ish = x.createLinearGradient(0, wy, 0, wy + CELL); ish.addColorStop(0, "rgba(60,30,130,.24)"); ish.addColorStop(0.22, "rgba(60,30,130,0)"); ish.addColorStop(0.85, "rgba(255,255,255,0)"); ish.addColorStop(1, "rgba(255,255,255,.75)");
      x.fillStyle = ish; x.fillRect(wx, wy, CELL, CELL); x.restore();
    }
    puz.panes.forEach(function (p, i) { // drop shadows (the glass covers its own)
      var o = vis[i], up = i === liftPi; x.save();
      x.shadowColor = "rgba(40,15,90," + (up ? 0.42 : 0.3) + ")"; x.shadowBlur = up ? 16 : 8; x.shadowOffsetY = up ? 8 : 4;
      panePath(x, p, PAD + o[0], PAD + o[1]); x.fillStyle = HEX[p.color]; x.fill(); x.restore();
    });
    // glass layer: flat bodies composited with "darken" on their own layer, so mixes are exact
    if (glassCv.width !== boardCv.width) { glassCv.width = boardCv.width; glassCv.height = boardCv.height; }
    var gx = glassCv.getContext("2d"); gx.setTransform(1, 0, 0, 1, 0, 0); gx.globalCompositeOperation = "source-over"; gx.clearRect(0, 0, glassCv.width, glassCv.height);
    gx.setTransform(k, 0, 0, k, 0, 0); gx.globalCompositeOperation = "darken";
    puz.panes.forEach(function (p, i) { var sp = paneSprites[i]; gx.drawImage(sp.cv, PAD + vis[i][0], PAD + vis[i][1], sp.W, sp.H); });
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(glassCv, 0, 0); x.restore();
    puz.panes.forEach(function (p, i) { // outlines on top, so stacked glass shows both edges
      var sp = paneSprites[i]; x.drawImage(sp.deco, PAD + vis[i][0], PAD + vis[i][1], sp.W, sp.H);
    });
    puz.panes.forEach(function (p, i) {
      var o = vis[i], focus = paneEls[i] === document.activeElement && !TEST, hinted = hintPi === i;
      if (shimmerT >= 0 && !p.locked) { // idle shimmer: a soft light sweeps over the movable glass
        var bx = PAD + o[0], by = PAD + o[1], W = paneSprites[i].W, H = paneSprites[i].H, sx = bx - CELL + shimmerT * (W + H + CELL * 2);
        x.save(); panePath(x, p, bx, by); x.clip();
        var sg = x.createLinearGradient(sx - CELL * 0.5, by, sx + CELL * 0.5, by + CELL * 0.5);
        sg.addColorStop(0, "rgba(255,255,255,0)"); sg.addColorStop(0.5, "rgba(255,255,255,.32)"); sg.addColorStop(1, "rgba(255,255,255,0)");
        x.fillStyle = sg; x.fillRect(bx, by, W, H); x.restore();
      }
      p.cells.forEach(function (cl) {
        var px = PAD + o[0] + cl[1] * STEP, py = PAD + o[1] + cl[0] * STEP;
        if (prefs.patterns) patternInto(x, E.BIT[p.color], px, py, CELL);
      });
      if (focus || hinted) { var sp = paneSprites[i], key = hinted ? "hintRim" : "focusRim"; if (!sp[key]) sp[key] = band(p, sp.W, sp.H, 0, 4.5, hinted ? "#FFB800" : "#6A46EA"); x.drawImage(sp[key], PAD + o[0], PAD + o[1], sp.W, sp.H); }
    });
  }
  var shimT = null;
  function shimmerLoop() { // every few seconds while playing, unless the player prefers less motion
    clearInterval(shimT);
    if (TEST || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    shimT = setInterval(function () {
      if (document.hidden || anims.length || shimmerT >= 0 || !puz || !state || state.status !== "playing" || (view !== "play" && view !== "tutorial")) return;
      var t0 = performance.now();
      (function fr(now) { var t = (now - t0) / 1300; shimmerT = t < 1 ? t : -1; drawBoard(); if (t < 1) requestAnimationFrame(fr); })(t0);
    }, 5200);
  }
  function paint() { if (paintRAF) return; paintRAF = requestAnimationFrame(function () { paintRAF = 0; drawBoard(); }); }
  function easeOut(t) { var c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); } // gentle overshoot, like glass settling
  // Animate pane pi's picture from its current spot to offset `to` (also moves its arrow).
  function animateTo(pi, to, ms, done, bounceBack) {
    var from = vis[pi].slice(), t0 = performance.now(), id = {};
    anims.push(id); if (!bounceBack) liftPi = pi;
    (function frame(now) {
      var t = Math.min(1, (now - t0) / ms), e = bounceBack ? Math.sin(t * Math.PI) : easeOut(t);
      vis[pi] = [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e];
      moveGrip(pi); drawBoard();
      if (t < 1) requestAnimationFrame(frame);
      else { if (bounceBack) vis[pi] = from; else vis[pi] = to.slice(); puz.panes.forEach(function (q, i) { moveGrip(i); }); drawBoard(); anims.splice(anims.indexOf(id), 1); if (liftPi === pi && !anims.length) { liftPi = -1; drawBoard(); } if (done) done(); }
    })(t0);
  }
  function moveGrip(pi) { var p = puz.panes[pi], hc = gripPos[pi] || p.cells[gripAt[pi]] || gripCell(p); gripEls[pi].style.transform = "translate(" + (PAD + vis[pi][0] + hc[1] * STEP) + "px," + (PAD + vis[pi][1] + hc[0] * STEP) + "px)"; }

  function build() {
    measure();
    document.body.classList.toggle("patterns", !!prefs.patterns);
    $("par").textContent = parOf(puz);
    paintTarget(); makeTiles();
    // board
    boardEl = $("board"); boardEl.innerHTML = ""; boardEl.classList.remove("won");
    boardEl.setAttribute("aria-label", puz.glide ? "Window. Swipe a glass pane: it glides until it bumps the edge or glass going the same way, or sticks where it slides onto new colour." : "Window. Drag the glass panes.");
    var side = PAD * 2 + n * STEP - GAP;
    boardCv = el("canvas", "bcv", boardEl); hiDPI(boardCv, side, side); boardCv.setAttribute("aria-hidden", "true");
    boardEl.style.width = boardEl.style.height = side + "px";
    vis = puz.panes.map(function (p, i) { return offset(p, state.pos[i]); });
    trackEl = el("div", "track", boardEl);
    paneEls = []; gripEls = [];
    puz.panes.forEach(function (p, pi) {
      var pe = el("div", "pane", boardEl); pe.tabIndex = 0; pe.dataset.pane = pi;
      pe.setAttribute("role", "button");
      pe.setAttribute("aria-label", NAME[p.color] + " glass, " + (p.locked ? "locked in place" : "slides " + (p.axis === "h" ? "left and right" : p.axis === "v" ? "up and down" : "any direction") + ". Use arrow keys."));
      if (p.locked) pe.classList.add("locked");
      pe.style.width = p.w * STEP - GAP + "px"; pe.style.height = p.h * STEP - GAP + "px";
      pe.addEventListener("keydown", function (e) { keyMove(e, pi); });
      pe.addEventListener("focus", paint); pe.addEventListener("blur", paint);
      paneEls.push(pe);
      var gr = el("div", "grip" + (p.locked ? " lock" : ""), boardEl); gr.innerHTML = p.locked ? LOCK_SVG : arrowSVG(p.axis); gripEls.push(gr);
    });
    puz.panes.forEach(function (p, pi) { place(pi, state.pos[pi]); });
    el("div", "sparkle", boardEl);
    updateMoves(false); updateUndo(); drawBoard();
  }
  var gripAt = [], gripPos = []; // shape-cell index each pane's arrow sits on, and its exact spot (in cells)
  function place(pi, pos, ms) {
    var p = puz.panes[pi], o = offset(p, pos);
    paneEls[pi].style.transform = "translate(" + o[0] + "px," + o[1] + "px)";
    placeGrips();
    if (ms) animateTo(pi, o, ms); else { vis[pi] = o; puz.panes.forEach(function (q, i) { moveGrip(i); }); paint(); }
  }
  // Put each pane's arrow on its least-covered cell, never on the same cell as another arrow.
  function placeGrips() {
    if (gripEls.length !== puz.panes.length) return;
    var cover = {}, taken = {};
    puz.panes.forEach(function (p, i) { E.paneCells(p, state.pos[i]).forEach(function (c) { var k = c[0] * n + c[1]; cover[k] = (cover[k] || 0) + 1; }); });
    puz.panes.forEach(function (p, i) {
      var cells = E.paneCells(p, state.pos[i]), cr = (p.h - 1) / 2, cc = (p.w - 1) / 2;
      var order = p.cells.map(function (c, j) { return j; }).sort(function (a, b) {
        var ka = cells[a][0] * n + cells[a][1], kb = cells[b][0] * n + cells[b][1];
        return ((taken[ka] ? 100 : 0) + cover[ka] * 10 + Math.abs(p.cells[a][0] - cr) + Math.abs(p.cells[a][1] - cc)) - ((taken[kb] ? 100 : 0) + cover[kb] * 10 + Math.abs(p.cells[b][0] - cr) + Math.abs(p.cells[b][1] - cc));
      });
      var j = order[0], c = cells[j]; gripAt[i] = j; gripPos[i] = p.cells[j];
      // centre the arrow on the piece when the middle of the piece is glass of this pane only
      var mr = 0, mc = 0; p.cells.forEach(function (q) { mr += q[0]; mc += q[1]; }); mr /= p.cells.length; mc /= p.cells.length;
      var rows = [Math.floor(mr), Math.ceil(mr)], cols = [Math.floor(mc), Math.ceil(mc)], ok = true, keys = [];
      rows.forEach(function (a) { cols.forEach(function (b) {
        var inShape = p.cells.some(function (q) { return q[0] === a && q[1] === b; }), base = cells[p.cells.findIndex(function (q) { return q[0] === a && q[1] === b; })];
        if (!inShape || !base) { ok = false; return; }
        var kk = base[0] * n + base[1]; if (cover[kk] > 1 || taken[kk]) ok = false; keys.push(kk);
      }); });
      if (ok) { gripPos[i] = [mr, mc]; keys.forEach(function (kk) { taken[kk] = 1; }); }
      else taken[c[0] * n + c[1]] = 1;
    });
  }
  function gripCell(p) { // the shape cell nearest the middle of the pane
    var cr = (p.h - 1) / 2, cc = (p.w - 1) / 2;
    return p.cells.slice().sort(function (a, b) { return (Math.abs(a[0] - cr) + Math.abs(a[1] - cc)) - (Math.abs(b[0] - cr) + Math.abs(b[1] - cc)); })[0];
  }
  function showTrack(pi, on) {
    if (!on) { trackEl.classList.remove("on"); return; }
    var p = puz.panes[pi], full = n * STEP - GAP;
    if (p.axis === "b") { trackEl.style.left = trackEl.style.top = PAD - 3 + "px"; trackEl.style.width = trackEl.style.height = full + 6 + "px"; }
    else if (p.axis === "h") { trackEl.style.left = PAD - 3 + "px"; trackEl.style.top = PAD + p.base * STEP - 3 + "px"; trackEl.style.width = full + 6 + "px"; trackEl.style.height = p.h * STEP - GAP + 6 + "px"; }
    else { trackEl.style.top = PAD - 3 + "px"; trackEl.style.left = PAD + p.base * STEP - 3 + "px"; trackEl.style.height = full + 6 + "px"; trackEl.style.width = p.w * STEP - GAP + 6 + "px"; }
    trackEl.classList.add("on");
  }

  // ---------- dragging ----------
  var drag = null;
  function cellAt(x, y) {
    var r = boardEl.getBoundingClientRect(), cx = x - r.left - PAD, cy = y - r.top - PAD;
    var c = Math.floor(cx / STEP), rr = Math.floor(cy / STEP);
    if (c < 0 || rr < 0 || c >= n || rr >= n) return null;
    return [rr, c];
  }
  function panesAt(cell) {
    var out = [];
    puz.panes.forEach(function (p, pi) { if (E.paneCells(p, state.pos[pi]).some(function (c) { return c[0] === cell[0] && c[1] === cell[1]; })) out.push(pi); });
    return out.sort(function (a, b) { return (+paneEls[a].style.zIndex || 0) - (+paneEls[b].style.zIndex || 0); }); // top last
  }
  function onDown(e) {
    if (locked || e.button > 0) return;
    var cell = cellAt(e.clientX, e.clientY); if (!cell) return;
    var cands = panesAt(cell); if (!cands.length) return;
    e.preventDefault(); boardEl.setPointerCapture(e.pointerId);
    drag = { x0: e.clientX, y0: e.clientY, cands: cands, pi: null, id: e.pointerId };
    actx();
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (drag.pi === null && puz.glide) { // glide rules: one swipe = one glide, no free placement
      if (Math.abs(dx) + Math.abs(dy) < 12) return;
      var wantG = Math.abs(dx) > Math.abs(dy) ? "h" : "v", dirG = (wantG === "h" ? dx : dy) > 0 ? 1 : -1, d0 = drag; drag = null;
      var freeG = d0.cands.filter(function (pi) { return !puz.panes[pi].locked; });
      if (!freeG.length) { toast("🔒"); buzz([8, 30, 8]); return; }
      var hit = freeG.filter(function (pi) { return puz.panes[pi].axis === wantG; })[0];
      if (hit == null) { nudgeHint(freeG[freeG.length - 1]); return; }
      swipe(hit, dirG); return;
    }
    if (drag.pi === null) {
      if (Math.abs(dx) + Math.abs(dy) < 6) return;
      var want = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      var free = drag.cands.filter(function (pi) { return !puz.panes[pi].locked; });
      if (!free.length) { drag = null; toast("🔒"); buzz([8, 30, 8]); return; }
      var match = free.filter(function (pi) { return puz.panes[pi].axis === want || puz.panes[pi].axis === "b"; });
      drag.pi = (match.length ? match : free).slice(-1)[0];
      drag.start = state.pos[drag.pi]; drag.last = drag.start;
      paneEls[drag.pi].classList.add("dragging", "lifted"); gripEls[drag.pi].classList.add("dragging");
      paneEls[drag.pi].style.zIndex = ++zTop; showTrack(drag.pi, true); hideCoach(false);
    }
    var p = puz.panes[drag.pi], fo, snap;
    function cl(v, a, b) { return Math.max(a, Math.min(b, v)); }
    if (p.axis === "b") {
      var mr = Math.floor(p.max / (p.mc + 1)), r0 = Math.floor(drag.start / (p.mc + 1)), c0 = drag.start % (p.mc + 1);
      var fr = cl(r0 + dy / STEP, -0.25, mr + 0.25), fc = cl(c0 + dx / STEP, -0.25, p.mc + 0.25);
      fo = [fc * STEP, fr * STEP]; snap = cl(Math.round(fr), 0, mr) * (p.mc + 1) + cl(Math.round(fc), 0, p.mc);
    } else {
      var f = cl(drag.start + (p.axis === "h" ? dx : dy) / STEP, -0.25, p.max + 0.25);
      var o = offset(p, 0); fo = p.axis === "h" ? [f * STEP, o[1]] : [o[0], f * STEP];
      snap = cl(Math.round(f), 0, p.max);
    }
    paneEls[drag.pi].style.transform = "translate(" + fo[0] + "px," + fo[1] + "px)";
    vis[drag.pi] = fo; paint();
    var hc = p.cells[gripAt[drag.pi]] || gripCell(p);
    gripEls[drag.pi].style.transform = "translate(" + (PAD + fo[0] + hc[1] * STEP) + "px," + (PAD + fo[1] + hc[0] * STEP) + "px)";
    if (snap !== drag.last) { drag.last = snap; sfx.step(); }
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag; drag = null;
    if (d.pi === null) { nudgeHint(d.cands[d.cands.length - 1]); return; }
    if (d.pi == null) return;
    paneEls[d.pi].classList.remove("dragging", "lifted"); gripEls[d.pi].classList.remove("dragging"); showTrack(d.pi, false);
    commit(d.pi, d.last);
  }
  function keyMove(e, pi) {
    if (locked) return; var p = puz.panes[pi], k = e.key, v = state.pos[pi];
    if (p.locked) return;
    if (puz.glide) {
      var d = p.axis === "h" ? (k === "ArrowRight" ? 1 : k === "ArrowLeft" ? -1 : 0) : (k === "ArrowDown" ? 1 : k === "ArrowUp" ? -1 : 0);
      if (!d) return; e.preventDefault(); swipe(pi, d); return;
    }
    if (p.axis === "b") {
      var r = Math.floor(v / (p.mc + 1)), c = v % (p.mc + 1), mr = Math.floor(p.max / (p.mc + 1));
      if (k === "ArrowLeft") c--; else if (k === "ArrowRight") c++; else if (k === "ArrowUp") r--; else if (k === "ArrowDown") r++; else return;
      e.preventDefault(); paneEls[pi].style.zIndex = ++zTop;
      commit(pi, Math.max(0, Math.min(mr, r)) * (p.mc + 1) + Math.max(0, Math.min(p.mc, c))); return;
    }
    if (p.axis === "h" && (k === "ArrowLeft" || k === "ArrowRight")) v += k === "ArrowRight" ? 1 : -1;
    else if (p.axis === "v" && (k === "ArrowUp" || k === "ArrowDown")) v += k === "ArrowDown" ? 1 : -1;
    else return;
    e.preventDefault(); paneEls[pi].style.zIndex = ++zTop; commit(pi, Math.max(0, Math.min(p.max, v)));
  }
  function nudgeHint(pi) { // a tap without a drag: wiggle the pane along its track
    if (puz.panes[pi].locked) { toast("🔒"); buzz([8, 30, 8]); return; }
    if (puz.panes[pi].axis === "b") { toast("✥ Drag"); return; }
    var p = puz.panes[pi], o = vis[pi], dx = p.axis === "h" ? 8 : 0, dy = p.axis === "v" ? 8 : 0;
    if (!anims.length) animateTo(pi, [o[0] + dx, o[1] + dy], 260, null, true);
    toast(p.axis === "h" ? (puz.glide ? "↔ Swipe" : "↔ Drag") : (puz.glide ? "↕ Swipe" : "↕ Drag"));
  }
  // One swipe: the pane glides to where the rules stop it. A blocked swipe is a free bump.
  function swipe(pi, d) {
    if (locked || anims.length) return;
    var p = puz.panes[pi], to = E.glideTo(puz, state.pos, pi, d);
    hideCoach(false);
    if (to === state.pos[pi]) {
      var o = vis[pi], b = 0.12 * STEP * d;
      animateTo(pi, p.axis === "h" ? [o[0] + b, o[1]] : [o[0], o[1] + b], 180, null, true);
      sfx.step(); buzz(6);
      if (mode === "tutorial") setTimeout(coachTutorial, 300);
      return;
    }
    var k = Math.abs(to - state.pos[pi]);
    commit(pi, to, 120 + 60 * k);
  }
  function updateUndo() { var b = $("btnUndo"); if (b) b.classList.toggle("empty", !(state && state.undo && state.undo.length) || locked); }
  function undo() {
    if (locked || anims.length || !state.undo || !state.undo.length) return;
    var prev = state.undo.pop(), pi = -1;
    prev.forEach(function (v, i) { if (v !== state.pos[i]) pi = i; });
    state.pos = prev.slice(); clearHint();
    if (pi >= 0) place(pi, prev[pi], 200);
    sfx.tap(); buzz(6); updateUndo();
    if (mode === "daily") save(GKEY, state);
    if (mode === "level" || mode === "daily") updateStarLine();
  }
  function commit(pi, pos, ms) {
    var moved = pos !== state.pos[pi], before = E.render(puz, state.pos), prevPos = state.pos.slice();
    state.pos[pi] = pos; place(pi, pos, moved ? ms : 0);
    if (!moved) return;
    if (puz.glide) { state.undo = state.undo || []; state.undo.push(prevPos); if (state.undo.length > 60) state.undo.shift(); }
    sfx.drop(); buzz(8);
    var pe = paneEls[pi]; pe.classList.remove("squish"); void pe.offsetWidth; pe.classList.add("squish");
    boardEl.classList.remove("bump"); void boardEl.offsetWidth; boardEl.classList.add("bump");
    state.moves++; state.hist.push(puz.panes[pi].color);
    updateMoves(true);
    if (mode === "daily") save(GKEY, state);
    if (mode === "level") {
      if (tipShown) { tipShown = null; setRule(""); }
      if (hintPi === pi || puz.glide) clearHint(); updateStarLine();
    }
    updateUndo();
    var img = E.render(puz, state.pos), fx = function () { sparkleMixes(before, img); showNewMix(img); };
    if (ms) setTimeout(fx, ms * 0.8); else fx();
    if (E.diffCount(img, puz.target) === 0) { if (ms) { locked = true; setTimeout(win, ms); } else win(); }
    else if (mode === "tutorial") setTimeout(coachTutorial, (ms || 0) + 250);
    else if (puz.glide && E.distOf(puz, state.pos) < 0) setTimeout(function () { if (state.status === "playing") { flashTip("↶ Stuck! Undo", 2600); mark("stuck", "btnUndo", 300); } }, (ms || 0) + 150);
  }
  function updateMoves(bounce) {
    var m = $("moves"); m.textContent = state.moves;
    if (bounce) { m.classList.remove("bounce"); void m.offsetWidth; m.classList.add("bounce"); }
    var par = parOf(puz), total = Math.max(par, state.moves), pips = $("pips"), h = "";
    for (var i = 0; i < total; i++) h += "<i class='" + (i < state.moves ? "on" : "") + (i >= par ? " over" : "") + "'></i>";
    pips.innerHTML = h;
    if (mode === "daily") updateStarLine();
  }
  function bitCount(m) { return (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1); }
  function sparkleMixes(before, img) {
    var hit = 0;
    img.forEach(function (m, k) {
      if (bitCount(m) < 2 || m === before[k]) return;
      hit++;
      var r = Math.floor(k / n), c = k % n, cx = PAD + c * STEP + CELL / 2, cy = PAD + r * STEP + CELL / 2;
      for (var j = 0; j < 3; j++) {
        var s = el("i", "spk", boardEl), a = Math.random() * 6.28, d = CELL * (0.35 + Math.random() * 0.3);
        s.style.left = cx + "px"; s.style.top = cy + "px"; s.style.setProperty("--dx", Math.cos(a) * d + "px"); s.style.setProperty("--dy", Math.sin(a) * d + "px");
        s.style.animationDelay = j * 60 + "ms";
        setTimeout(function (x) { x.remove(); }.bind(null, s), 900);
      }
    });
    if (hit) sfx.mix();
  }

  // ---------- contextual mixing hint ----------
  var chipT;
  function showNewMix(img) {
    var seen = prefs.mixSeen || [], found = null;
    img.forEach(function (m) { if (MIXNAME[m] && seen.indexOf(m) < 0 && !found) found = m; });
    if (!found) return;
    seen.push(found); prefs.mixSeen = seen; save("ps2:prefs", prefs);
    var chip = $("mixChip"), parts = bitsOf(found);
    chip.innerHTML = parts.map(function (k) { return swatchHTML(E.BIT[k]); }).join("+") + "=" + swatchHTML(found, "res"); paintSwatches(chip);
    chip.setAttribute("aria-label", parts.map(function (k) { return NAME[k]; }).join(" + ") + " make " + MIXNAME[found].toLowerCase());
    chip.hidden = false; clearTimeout(chipT); chipT = setTimeout(function () { chip.hidden = true; }, 3200);
  }

  // ---------- tutorial coach ----------
  var handEl = null, handAnim = null;
  function coachAt(pi, text, toPos) {
    var p = puz.panes[pi], o = offset(p, state.pos[pi]), hc = p.cells[gripAt[pi]] || gripCell(p);
    if (toPos == null) toPos = puz.solution[pi];
    var x = PAD + o[0] + hc[1] * STEP + CELL / 2, y = PAD + o[1] + hc[0] * STEP;
    setRule(text);
    if (!handEl) { handEl = el("div", "hand", document.querySelector(".stage-wrap")); handEl.textContent = "👆"; }
    handEl.hidden = false;
    var dir = state.pos[pi] < toPos ? 1 : -1, dist = STEP * Math.abs(toPos - state.pos[pi]);
    handEl.style.left = (x - 14) + "px"; handEl.style.top = (y + CELL / 2 - 6) + "px";
    if (handAnim) handAnim.cancel();
    var to = p.axis === "h" ? "translate(" + dir * dist + "px,0)" : "translate(0," + dir * dist + "px)";
    handAnim = handEl.animate([{ transform: "translate(0,0)", opacity: 0 }, { transform: "translate(0,0)", opacity: 1, offset: 0.15 }, { transform: to, opacity: 1, offset: 0.75 }, { transform: to, opacity: 0 }], { duration: 1600, iterations: Infinity, easing: "ease-in-out" });
  }
  function hideCoach(all) { setRule(""); if (handEl) handEl.hidden = true; if (handAnim) handAnim.cancel(); if (all) handAnim = null; }
  function coachTutorial() {
    if (mode !== "tutorial" || state.status !== "playing") return;
    if (puz.glide) {
      if (locked || anims.length) return; // a glide is still running (or the win is on its way)
      var m = E.nextMove(puz, state.pos);
      if (!m && E.distOf(puz, state.pos) === 0) return;
      if (!m) { state.pos = puz.start.slice(); state.moves = 0; state.undo = []; build(); m = E.nextMove(puz, state.pos); }
      var arrow = puz.panes[m.pane].axis === "h" ? (m.dir > 0 ? "→" : "←") : (m.dir > 0 ? "↓" : "↑");
      var sticks = m.to > 0 && m.to < puz.panes[m.pane].max;
      var step = E.distOf(puz, state.pos) >= 2 ? 1 : 2; setBadge("👆", "Tutorial", step + " / 2");
      coachAt(m.pane, sticks ? "Swipe " + arrow + " · it sticks on glass!" : "Swipe " + arrow + " · glass glides!", m.to); return;
    }
    if (state.pos[0] !== 1) { setBadge("👆", "Tutorial", "1 / 2"); coachAt(0, state.pos[0] < 1 ? "Slide →" : "Back ←"); }
    else if (state.pos[1] !== 1) { setBadge("👆", "Tutorial", "2 / 2"); coachAt(1, state.pos[1] > 1 ? "Slide ↑ to mix!" : "Down ↓"); }
  }

  // ---------- win ----------
  function win() {
    state.status = "won"; locked = true; hideCoach(true);
    clearHint();
    if (mode === "daily") { save(GKEY, state); recordStats(); }
    var after = openEnd;
    if (mode === "level") after = recordLevel();
    setTimeout(function () { boardEl.classList.add("won"); sfx.win(); buzz([10, 40, 20]); confetti(); }, 280);
    setTimeout(after, 1500);
  }
  function recordStats() {
    if (practice || state.recorded) return;
    var over = Math.min(3, state.moves - parOf(puz));
    stats.played++; stats.dist[over]++;
    stats.streak = stats.lastWin === E.addDays(date, -1) ? stats.streak + 1 : 1;
    stats.lastWin = date; stats.best = Math.max(stats.best, stats.streak);
    state.recorded = true; save(GKEY, state); save("ps2:stats", stats);
  }
  function currentStreak() { return (stats.lastWin === today || stats.lastWin === E.addDays(today, -1)) ? stats.streak : 0; }
  function shareText() {
    var par = parOf(puz), perfect = state.moves === par;
    var head = (practice ? "PaneSlide " + date : "PaneSlide #" + puz.number) + (perfect ? " ⭐" : "");
    var rows = [], h = state.hist.map(function (c) { return EMOJI[c]; });
    for (var i = 0; i < h.length; i += 8) rows.push(h.slice(i, i + 8).join(""));
    var lines = [head, state.moves + " moves · par " + par].concat(rows);
    if (!practice && currentStreak() > 1) lines.push("🔥 " + currentStreak() + "-day streak");
    lines.push(SITE);
    return lines.join("\n");
  }
  function chipHTML(ico, val, cls) { return "<span class='stat" + (cls ? " " + cls : "") + "'>" + (ico ? "<i class='ico " + ico + "'></i>" : "") + val + "</span>"; }
  function playStars(k) { for (var i = 0; i < k; i++) (function (j) { setTimeout(function () { sfx.star(j); buzz(12); }, 250 + j * 380 + 200); })(i); }
  function dailyStars() { return starsBy(state.moves, parOf(puz)); }
  function openEnd() {
    var d = $("dlgEnd");
    if (mode === "tutorial") {
      $("endTitle").textContent = "You got it!";
      $("endStars").innerHTML = starsHTML(3, "pop"); playStars(3);
      $("endStats").innerHTML = "<span class='stat'>" + swatchHTML(1, "mx") + "+" + swatchHTML(2, "mx") + "=" + swatchHTML(3, "mx") + "</span>"; paintSwatches($("endStats"));
      $("endMainLbl").textContent = "PLAY"; $("btnShare").hidden = true; $("btnEndHome").hidden = true; d.showModal(); return;
    }
    $("btnShare").hidden = false; $("btnEndHome").hidden = false; $("endMainLbl").textContent = "LEVELS";
    var k = dailyStars();
    $("endTitle").textContent = practice ? "Practice" : "Daily #" + puz.number;
    $("endStars").innerHTML = starsHTML(k, "pop"); playStars(k);
    var h = chipHTML("foot", state.moves + " <small>/</small> <i class='ico flag'></i>" + parOf(puz));
    if (!practice && currentStreak() > 0) h += chipHTML("fire", currentStreak());
    h += chipHTML("clock", countdownText());
    $("endStats").innerHTML = h;
    d.showModal();
  }
  function statsHTML(hl) {
    var parPct = stats.played ? Math.round(stats.dist[0] / stats.played * 100) : 0, max = Math.max.apply(null, stats.dist.concat([1]));
    var tile = function (ico, v, lab) { return "<div class='tile' aria-label='" + lab + "'><i class='ico " + ico + "'></i><b>" + v + "</b></div>"; };
    var ri = rankIndex(prog.unlocked - 1);
    var h = "<div class='sect'><i class='ico pad'></i>Daily</div><div class='tiles'>" + tile("pad", stats.played, "Played") + tile("fire", currentStreak(), "Streak") + tile("trophy", stats.best, "Best streak") + "</div>";
    var labels = [starsHTML(3), "<i class='ico flag'></i>+1", "<i class='ico flag'></i>+2", "<i class='ico flag'></i>+3"];
    h += "<div class='dist'>" + stats.dist.map(function (v, i) { return "<div class='bar" + (hl === i ? " me" : "") + "'><span class='lb'>" + labels[i] + "</span><b style='width:" + Math.max(10, Math.round(v / max * 100)) + "%'>" + v + "</b></div>"; }).join("") + "</div>";
    h += "<div class='sect'><i class='ico medal'></i>Levels</div><div class='tiles'>" + tile("star", totalStars(), "Stars") + tile("flag", prog.unlocked - 1, "Levels cleared") + tile("spark", prog.bestPerf || 0, "Best perfect run") + "</div>";
    if (ri >= 0) h += "<div class='tiles' style='margin-top:8px'><div class='tile wide'><i class='ico medal'></i><b>" + RANKS[ri][1] + "</b></div></div>";
    return h;
  }
  function countdownText() {
    var now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
    var s = Math.floor((mid - now) / 1000);
    return Math.floor(s / 3600) + "h " + String(Math.floor(s % 3600 / 60)).padStart(2, "0") + "m";
  }
  function copyText(t) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t);
    return new Promise(function (res, rej) { var ta = document.createElement("textarea"); ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy") ? res() : rej(); } catch (e) { rej(e); } document.body.removeChild(ta); });
  }
  function shareOut(t) {
    if (window.matchMedia && matchMedia("(pointer: coarse)").matches && navigator.share) { navigator.share({ text: t }).catch(function () {}); return; }
    copyText(t).then(function () { toast("✅ Copied!"); }, function () { toast("❌ Couldn't copy"); });
  }
  function onShareBtn() { shareOut(shareText()); }
  function onEndMain() {
    if (mode === "tutorial") { prefs.tutDone = true; prefs.glideTut = true; save("ps2:prefs", prefs); $("dlgEnd").close(); startDaily(); return; }
    $("dlgEnd").close(); openMap();
  }
  function toast(msg) { var t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 1700); }

  // ---------- levels: stars, hints, win, milestones, map ----------
  // Generous stars (v4): 3 = par or one spare swipe (par 1-2: exact), 2 = a few more, 1 = solved.
  // Hints never cost stars; solving in exactly par earns a "Perfect!" cheer.
  function starsBy(moves, par) { return moves <= par + (par >= 3 ? 1 : 0) ? 3 : moves <= par + Math.max(3, Math.ceil(par / 2) + 1) ? 2 : 1; }
  function starsFor(moves) { return starsBy(moves, parOf(puz)); }
  function misplaced() { return puz.panes.filter(function (p, i) { return state.pos[i] !== puz.solution[i]; }).length; }
  var STAR = '<svg viewBox="0 0 24 24"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';
  function starsHTML(k, cls) { var h = ""; for (var i = 0; i < 3; i++) h += "<i class='st" + (i < k ? " on" : "") + (cls ? " " + cls : "") + "' style='--i:" + i + "'>" + STAR + "</i>"; return h; }
  function updateStarLine() {
    if (mode !== "level" && mode !== "daily") return;
    var k = starsBy(state.moves + (puz.glide ? Math.max(0, E.distOf(puz, state.pos)) : misplaced()), parOf(puz));
    var sl = $("starLine"), prev = +sl.dataset.k || 3; sl.dataset.k = k;
    sl.innerHTML = starsHTML(k); sl.setAttribute("aria-label", k + " stars possible");
    if (k < prev) { var lost = sl.children[k]; if (lost) lost.classList.add("lose"); }
  }
  function updateHint() { $("hintCount").textContent = prog.hints; $("btnHint").classList.toggle("empty", prog.hints <= 0); }
  var hintPi = null, ghostEl = null;
  function clearHint() { var had = hintPi !== null; hintPi = null; if (ghostEl) { ghostEl.remove(); ghostEl = null; } paneEls.forEach(function (e) { e.classList.remove("hinted"); }); if (had) { paint(); if (tipShown && tipShown.indexOf("💡") === 0) { tipShown = null; setRule(""); } } }
  function useHint() {
    if (mode !== "level" || locked) return;
    if (hintPi !== null) return;
    if (puz.glide) return useGlideHint();
    if (prog.hints <= 0) { toast("💡 0 · earn ⭐⭐⭐"); buzz([8, 30, 8]); return; }
    var cand = puz.panes.map(function (p, i) { return i; }).filter(function (i) { return !puz.panes[i].locked && state.pos[i] !== puz.solution[i]; });
    if (!cand.length) return;
    var pi = cand[0], p = puz.panes[pi];
    prog.hints--; lvSave(); updateHint();
    state.hinted = true; hintPi = pi; updateStarLine();
    ghostEl = el("div", "ghost", boardEl);
    var o = offset(p, puz.solution[pi]);
    p.cells.forEach(function (c) { var g = el("div", "gc", ghostEl); g.style.left = PAD + o[0] + c[1] * STEP + "px"; g.style.top = PAD + o[1] + c[0] * STEP + "px"; g.style.borderColor = HEX[p.color]; });
    paneEls[pi].classList.add("hinted"); paneEls[pi].style.zIndex = ++zTop;
    flashTip("💡 Here!", 0); sfx.mix(); buzz(10);
  }
  // Glide hint: the next best swipe (from a full search), shown as a ghost where it will stop.
  function useGlideHint() {
    if (anims.length) return;
    var m = E.nextMove(puz, state.pos);
    if (!m) { if (E.distOf(puz, state.pos) < 0) { flashTip("↶ Undo first", 2200); buzz([8, 30, 8]); } return; }
    if (prog.hints <= 0) { toast("💡 0 · earn ⭐⭐⭐"); buzz([8, 30, 8]); return; }
    var p = puz.panes[m.pane];
    prog.hints--; lvSave(); updateHint();
    state.hinted = true; hintPi = m.pane; updateStarLine();
    ghostEl = el("div", "ghost", boardEl);
    var o = offset(p, m.to);
    p.cells.forEach(function (c) { var g = el("div", "gc", ghostEl); g.style.left = PAD + o[0] + c[1] * STEP + "px"; g.style.top = PAD + o[1] + c[0] * STEP + "px"; g.style.borderColor = HEX[p.color]; });
    paint();
    flashTip("💡 Swipe " + (p.axis === "h" ? (m.dir > 0 ? "→" : "←") : (m.dir > 0 ? "↓" : "↑")), 0); sfx.mix(); buzz(10);
  }
  function recordLevel() {
    var N = puz.level, st = starsFor(state.moves), prev = prog.stars[N] || 0, firstClear = N >= prog.unlocked, gained = [];
    prog.stars[N] = Math.max(prev, st); prog.best[N] = Math.min(prog.best[N] || 999, state.moves);
    if (firstClear) prog.unlocked = N + 1;
    if (st === 3) { prog.perf++; prog.threeSince = (prog.threeSince || 0) + 1; } else prog.perf = 0;
    prog.bestPerf = Math.max(prog.bestPerf || 0, prog.perf);
    function giveHint(why) { if (prog.hints < HINT_MAX) { prog.hints++; gained.push(why); } }
    if (prog.threeSince >= 3) { prog.threeSince = 0; giveHint("three 3-star levels"); }
    var mile = isMilestone(N) && prog.mile.indexOf(N) < 0;
    if (mile) { prog.mile.push(N); giveHint("milestone"); }
    lvSave(); updateHint();
    return function () { if (mile) openMilestone(N, gained); else openLevelEnd(st, gained); };
  }
  function totalStars() { var t = 0; for (var k in prog.stars) t += prog.stars[k]; return t; }
  var lastStars = 0;
  function openLevelEnd(st, gained) {
    lastStars = st; $("hudStars").textContent = totalStars();
    $("lvStars").innerHTML = starsHTML(st, "pop"); playStars(st);
    var perfect = state.moves <= parOf(puz), cheers = ["Great!", "Nice!", "Lovely!", "Well done!", "Sweet!"];
    $("lvTitle").textContent = perfect ? "✨ Perfect!" : st === 3 ? cheers[puz.level % cheers.length] : "Level " + puz.level;
    $("lvSub").innerHTML = chipHTML("foot", state.moves + " <small>/</small> <i class='ico flag'></i>" + parOf(puz)) + (gained.length ? chipHTML("bulb", "+" + gained.length, "plus") : "");
    giftBar(puz.level);
    $("dlgLevel").showModal(); setTimeout(function () { confetti(true); }, 200);
    if (perfect) setTimeout(function () { sfx.medal(); }, 1500);
    mark("gift", "giftBar", 1400);
  }
  function badgeSVG(N, ri) {
    var tier = Math.max(0, Math.min(3, Math.floor(ri / 3))), rim = [["#E0A060", "#A8642A"], ["#E3E9F2", "#8F9AAD"], ["#FFE16A", "#C98A00"], ["#C9B5FF", "#6A46EA"]][tier];
    var pts = ""; for (var i = 0; i < 16; i++) { var a = i * Math.PI / 8, r = i % 2 ? 62 : 70; pts += (85 + Math.cos(a) * r).toFixed(1) + "," + (80 + Math.sin(a) * r).toFixed(1) + " "; }
    return '<svg viewBox="0 0 170 170" aria-hidden="true"><path d="M58 120 L44 166 L64 156 L74 172 L84 128Z" fill="#EC3F94"/><path d="M112 120 L126 166 L106 156 L96 172 L86 128Z" fill="#C42A7A"/>' +
      '<polygon points="' + pts + '" fill="' + rim[1] + '"/><circle cx="85" cy="80" r="58" fill="' + rim[0] + '"/><circle cx="85" cy="80" r="47" fill="#fff" stroke="' + rim[1] + '" stroke-width="3"/>' +
      '<g style="isolation:isolate"><circle cx="74" cy="70" r="20" fill="' + HEX.C + '" style="mix-blend-mode:multiply"/><circle cx="96" cy="70" r="20" fill="' + HEX.M + '" style="mix-blend-mode:multiply"/><circle cx="85" cy="88" r="20" fill="' + HEX.Y + '" style="mix-blend-mode:multiply"/></g>' +
      '<rect x="55" y="106" width="60" height="26" rx="13" fill="#2A1B4D" stroke="#fff" stroke-width="3"/><text x="85" y="125" text-anchor="middle" font-size="17" font-weight="700" fill="#fff" font-family="Fredoka,system-ui,sans-serif">' + N + '</text></svg>';
  }
  function mileShareText(N, rank) {
    var lines = ["PaneSlide Levels 🏅", rank + " · level " + N, "⭐ " + totalStars() + " stars so far"];
    if (prog.perf > 1) lines.push("✨ " + prog.perf + " perfect levels in a row");
    lines.push(SITE); return lines.join("\n");
  }
  function openMilestone(N, gained) {
    var ri = rankIndex(N), rank = ri >= 0 ? RANKS[ri][1] : "Glass Spark", newRank = ri >= 0 && RANKS[ri][0] === N;
    $("mileBadge").innerHTML = badgeSVG(N, ri);
    $("mileKicker").textContent = newRank ? "New rank!" : "Level " + N;
    $("mileTitle").textContent = rank;
    var next = RANKS.filter(function (r) { return r[0] > N; })[0], from = ri >= 0 ? RANKS[ri][0] : 0;
    var pct = next ? Math.round((N - from) / (next[0] - from) * 100) : 100;
    $("rankFill").style.width = "0%"; $("rankBar").hidden = false;
    $("rankNext").innerHTML = "<i class='ico medal'></i>" + (next ? next[0] : "");
    $("rankBar").setAttribute("aria-label", next ? "Next rank at level " + next[0] : "Top rank");
    var h = chipHTML("star", totalStars()) + (prog.perf > 0 ? chipHTML("spark", prog.perf) : "") + chipHTML("bulb", prog.hints) + (gained.length ? chipHTML("bulb", "+" + gained.length, "plus") : "");
    $("mileStats").innerHTML = h;
    $("dlgMile").showModal(); mark("rank", "rankBar", 2400);
    var fill = $("rankFill");
    if (newRank) { // fill the bar for the rank just reached, then roll over to the next one
      $("rankNext").innerHTML = "<i class='ico medal'></i>" + N;
      setTimeout(function () { fill.style.width = "100%"; }, 30);
      setTimeout(function () {
        if (!$("dlgMile").open) return;
        $("rankBar").classList.add("done"); sfx.star(2);
        setTimeout(function () {
          fill.classList.add("snap"); fill.style.width = "0%"; $("rankBar").classList.remove("done");
          $("rankNext").innerHTML = "<i class='ico medal'></i>" + (next ? next[0] : "");
          void fill.offsetWidth; fill.classList.remove("snap"); fill.style.width = Math.max(6, pct) + "%";
        }, 700);
      }, 2100);
    } else setTimeout(function () { fill.style.width = Math.max(6, pct) + "%"; }, 30);
    setTimeout(function () { sfx.medal(); buzz([15, 40, 15]); confetti(true); }, 550);
  }
  function renderMap() {
    var path = $("mapPath"); path.innerHTML = "";
    var last = Math.ceil(Math.max(prog.unlocked + 8, 20) / 20) * 20, cur = null, nodes = [];
    for (var N = 1; N <= last; N++) {
      if ((N - 1) % 20 === 0) {
        var ch = chapterOf(N), got = 0; for (var k = N; k < N + 20; k++) got += prog.stars[k] || 0;
        var hd = el("div", "chap", path); hd.style.setProperty("--cb1", ch.sc[6]); hd.style.setProperty("--cb2", ch.sc[7]);
        hd.innerHTML = "<span class='ci'>" + ch.icon + "</span><div><b>" + ch.name + "</b><small><i class='ico star'></i>" + got + " / 60</small></div>";
      }
      var st = N < prog.unlocked ? "done" : N === prog.unlocked ? "current" : "locked";
      var b = el("button", "node " + st + (E.isChallenge(N) ? " chal" : ""), path);
      b.style.left = Math.round(Math.sin(N * 0.8) * 92) + "px";
      var tag = E.isChallenge(N) ? "trophy" : isMilestone(N) ? "medal" : "";
      b.innerHTML = "<span class='nb'>" + (st === "locked" ? LOCK_SVG : N) + "</span>" + (tag ? "<i class='ico tag " + tag + "'></i>" : "") + (st === "done" ? "<span class='ns'>" + starsHTML(prog.stars[N] || 0) + "</span>" : "") +
        (st === "current" ? "<span class='you'><i style='left:8px;top:9px;background:" + HEX.C + "'></i><i style='left:17px;top:9px;background:" + HEX.M + "'></i><i style='left:12px;top:17px;background:" + HEX.Y + "'></i></span>" : "");
      b.style.position = "relative";
      b.setAttribute("aria-label", "Level " + N + (st === "locked" ? ", locked" : st === "done" ? ", " + (prog.stars[N] || 0) + " stars" : ", next"));
      if (st === "locked") b.disabled = true;
      else (function (L) { b.addEventListener("click", function () { startLevel(L); }); })(N);
      if (st === "current") cur = b;
      nodes.push(b);
    }
    $("hudStars").textContent = totalStars();
    $("playNextN").textContent = prog.unlocked;
    requestAnimationFrame(function () {
      path.style.paddingBottom = $("mapBar").offsetHeight + 34 + "px"; // last node always clears the PLAY bar
      drawRoad(path, nodes);
      if (cur) { var r = cur.getBoundingClientRect(), bar = $("mapBar").getBoundingClientRect(), top = $("hud").getBoundingClientRect().bottom;
        window.scrollTo(0, Math.max(0, window.scrollY + r.top + r.height / 2 - (top + (bar.top - top) * 0.55))); } // middle of the visible part, above the PLAY bar
    });
  }
  function drawRoad(path, nodes) {
    var pr = path.getBoundingClientRect(), pts = nodes.map(function (b) { var r = b.getBoundingClientRect(); return [r.left - pr.left + r.width / 2, r.top - pr.top + r.height / 2]; });
    function d(list) { var s = "M" + list[0][0] + " " + list[0][1]; for (var i = 1; i < list.length; i++) { var a = list[i - 1], c = list[i], my = (a[1] + c[1]) / 2; s += " C" + a[0] + " " + my + " " + c[0] + " " + my + " " + c[0] + " " + c[1]; } return s; }
    var full = d(pts), doneN = Math.max(1, Math.min(pts.length, prog.unlocked)), dn = d(pts.slice(0, doneN));
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("class", "road");
    svg.setAttribute("width", pr.width); svg.setAttribute("height", pr.height);
    svg.innerHTML = "<path class='r1' d='" + full + "'/><path class='r2' d='" + full + "'/>" + (doneN > 1 ? "<path class='r2 done' d='" + dn + "'/>" : "") + "<path class='r3' d='" + full + "'/>";
    path.insertBefore(svg, path.firstChild);
  }
  function openMap() {
    hideCoach(true); clearHint(); mode = "map"; locked = true;
    applyTheme(chapterOf(prog.unlocked));
    var ri = rankIndex(prog.unlocked - 1);
    setBadge("<i class='ico medal' style='width:26px;height:26px'></i>", "Rank", ri >= 0 ? RANKS[ri][1] : "Rookie");
    showView("map"); renderMap(); clearMarks();
    mark("map", function () { return document.querySelector(".node.current") || $("btnPlayNext"); }, 700);
  }

  function confetti(inDialog) {
    var cv = $("confetti"), dlg = inDialog && document.querySelector("dialog[open]");
    if (dlg) { if (cv.parentNode !== dlg) dlg.appendChild(cv); var dr = dlg.getBoundingClientRect(); cv.style.position = "absolute"; cv.style.left = -dr.left - 4 + "px"; cv.style.top = -dr.top - 4 + "px"; }
    else { if (cv.parentNode !== document.body) document.body.appendChild(cv); cv.style.position = "fixed"; cv.style.left = cv.style.top = "0"; }
    var c = cv.getContext("2d"); cv.width = innerWidth; cv.height = innerHeight;
    var cols = [HEX.C, HEX.M, HEX.Y, maskColor(3), maskColor(5), maskColor(6), "#FFC62A"], parts = [], r = dlg ? dlg.getBoundingClientRect() : (boardEl || document.body).getBoundingClientRect();
    for (var i = 0; i < 110; i++) parts.push({ x: r.left + r.width / 2, y: r.top + (dlg ? 90 : r.height / 2), vx: (Math.random() - .5) * 15, vy: -Math.random() * 13 - 4, s: 7 + Math.random() * 8, a: Math.random() * 6, va: (Math.random() - .5) * .3, c: cols[i % cols.length], star: i % 5 === 0 });
    var t0 = performance.now();
    (function frame(t) {
      var k = t - t0; c.clearRect(0, 0, cv.width, cv.height);
      parts.forEach(function (p) { p.vy += .38; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va; c.save(); c.globalAlpha = Math.max(0, 1 - k / 2000) * .9; c.translate(p.x, p.y); c.rotate(p.a); c.fillStyle = p.c; c.beginPath(); if (p.star) { for (var q = 0; q < 10; q++) { var rr = q % 2 ? p.s * .45 : p.s, aa = q * Math.PI / 5; c.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } c.closePath(); } else if (c.roundRect) c.roundRect(-p.s / 2, -p.s / 2, p.s, p.s, 2); else c.rect(-p.s / 2, -p.s / 2, p.s, p.s); c.fill(); c.restore(); });
      if (k < 2000) requestAnimationFrame(frame); else c.clearRect(0, 0, cv.width, cv.height);
    })(t0);
  }

  // ---------- next-gift bar (levels end) ----------
  function giftBar(N) { // progress towards the next milestone gift (a free hint at level 5 and every 10)
    var next = N < 5 ? 5 : Math.floor(N / 10) * 10 + 10, prev = N < 5 ? 0 : N < 10 ? 5 : Math.floor(N / 10) * 10, left = next - N;
    if (isMilestone(N)) { prev = N; }
    var pct = Math.round((N - prev) / (next - prev) * 100);
    $("giftFill").style.width = "0%"; setTimeout(function () { $("giftFill").style.width = Math.max(6, pct) + "%"; }, 350);
    $("giftTxt").textContent = left === 1 ? "next level!" : left + " to go";
    $("giftBar").setAttribute("aria-label", "Next gift at level " + next + ", " + left + " to go");
  }

  // ---------- coach marks: a friendly pointer the first time you meet something new ----------
  var MARKS = {
    glide: ["👆", "Swipe the glass. It glides until it stops."],
    stick: ["🧲", "Glass stops as soon as it slides onto new colour."],
    order: ["🤔", "Which pane first? The order changes where glass stops."],
    stars: ["⭐", "Finish near par 🚩 for 3 stars."],
    undo: ["↶", "Oops? Undo takes back a swipe."],
    hint: ["💡", "Stuck? A hint shows your next swipe."],
    locked: ["🔒", "Locked glass never moves. Use it as a stopper!"],
    duo: ["🎨", "Only two colours in this picture."],
    challenge: ["🏆", "A trickier one. Take your time!"],
    breather: ["🌿", "A relaxing one. Enjoy!"],
    mix: ["🌈", "Glass over glass mixes colours, like real filters."],
    stuck: ["↶", "No way through from here. Undo a swipe!"],
    rank: ["🏅", "A new rank step and a free hint every 10 levels."],
    gift: ["🎁", "Fill the bar for a free hint!"],
    map: ["🗺️", "Your journey! Tap here for the next level."],
    music: ["🎵", "Calm music. Tap here to mute it."],
    daily: ["📅", "A fresh puzzle every day. Keep your streak!"],
    everyone: ["🌍", "Everyone gets this same puzzle today."]
  };
  var markQ = [], markEl = null, markTimer = 0;
  var markOn = !TEST || qs.get("marks") === "1"; // automated tests switch them off unless asked
  function seen(key) { return prefs.marks.indexOf(key) >= 0; }
  function mark(key, target, delay) {
    if (!markOn || seen(key) || !MARKS[key] || markQ.some(function (m) { return m.key === key; }) || (markEl && markEl.dataset.key === key)) return;
    markQ.push({ key: key, target: target, delay: delay || 250 });
    if (!markEl && !markTimer) nextMark();
  }
  function clearMarks() { markQ = []; clearTimeout(markTimer); markTimer = 0; hideMark(); }
  function nextMark() {
    var m = markQ[0]; if (!m) return;
    markTimer = setTimeout(function () { markTimer = 0; markQ.shift(); if (!showMark(m)) nextMark(); }, m.delay);
  }
  function markTarget(t) {
    if (typeof t === "function") t = t();
    if (typeof t === "string") t = $(t);
    if (!t) return null;
    if (t.getBoundingClientRect) { if (t.hidden || t.offsetParent === null && getComputedStyle(t).position !== "fixed") return null; return { r: t.getBoundingClientRect(), el: t }; }
    return { r: t, el: boardEl };
  }
  function showMark(m) {
    var tg = markTarget(m.target); if (!tg || tg.r.width < 2) return false;
    var dlg = tg.el.closest && tg.el.closest("dialog[open]"), open = document.querySelector("dialog[open]");
    if (open && open !== dlg) { markQ.unshift(m); m.delay = 900; nextMark(); return true; } // wait until the dialog is closed
    prefs.marks.push(m.key); save("ps2:prefs", prefs);
    var host = dlg || document.body, hr = dlg ? dlg.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
    if (dlg) { hr = { left: hr.left + dlg.clientLeft, top: hr.top + dlg.clientTop, width: dlg.clientWidth, height: dlg.clientHeight }; }
    var r = tg.r, x = r.left - hr.left, y = r.top - hr.top, pad = 6;
    var L = el("div", "cm-layer" + (dlg ? " in-dlg" : ""), host); L.dataset.key = m.key;
    L.setAttribute("role", "status"); L.setAttribute("aria-live", "polite");
    var ring = el("div", "cm-ring", L);
    ring.style.left = x - pad + "px"; ring.style.top = y - pad + "px"; ring.style.width = r.width + pad * 2 + "px"; ring.style.height = r.height + pad * 2 + "px";
    var below = y + r.height / 2 < hr.height * 0.55, bub = el("div", "cm-bub", L), ar = el("div", "cm-arrow " + (below ? "up" : "down"), L);
    bub.innerHTML = "<span class='cm-ico'>" + MARKS[m.key][0] + "</span><span class='cm-txt'>" + MARKS[m.key][1] + "</span><small>tap to continue</small>";
    var bw = Math.min(290, hr.width - 24); bub.style.width = bw + "px";
    var cx = x + r.width / 2, bl = Math.max(12, Math.min(hr.width - bw - 12, cx - bw / 2));
    bub.style.left = bl + "px"; ar.style.left = cx - 12 + "px";
    if (below) { ar.style.top = y + r.height + pad + 6 + "px"; bub.style.top = y + r.height + pad + 26 + "px"; }
    else { ar.style.top = y - pad - 26 + "px"; bub.style.bottom = (hr.height - (y - pad - 26)) + "px"; }
    markEl = L; sfx.mix();
    function done(e) { if (e) { e.preventDefault(); e.stopPropagation(); } hideMark(); nextMark(); }
    L.addEventListener("click", done);
    L._key = function (e) { if (e.key === "Escape" || e.key === "Enter" || e.key === " ") done(e); };
    document.addEventListener("keydown", L._key, true);
    return true;
  }
  function hideMark() { if (!markEl) return; document.removeEventListener("keydown", markEl._key, true); markEl.remove(); markEl = null; }
  function paneRect(pi) { var b = boardEl.getBoundingClientRect(), p = puz.panes[pi], o = vis[pi]; return { left: b.left + PAD + o[0], top: b.top + PAD + o[1], width: p.w * STEP - GAP, height: p.h * STEP - GAP }; }
  function levelMarks(N, again) {
    var first = function () { var m = E.nextMove(puz, state.pos); return m ? paneRect(m.pane) : boardEl.getBoundingClientRect(); };
    if (N === 1 || again) mark("glide", first, 500);
    if (N === 1 || again) mark("stars", "status");
    if (N === 2 || (again && N > 2)) { mark("stick", first, 500); mark("undo", "btnUndo"); }
    if (N === 3 || (again && N > 3)) mark("order", function () { return boardEl.getBoundingClientRect(); }, 500);
    if (N >= 4) mark("hint", "btnHint", 500);
    mark("mix", function () { // the first cell where two panes are stacked
      var cnt = {}, hit = null; puz.panes.forEach(function (p, i) { E.paneCells(p, state.pos[i]).forEach(function (c) { var kk = c[0] * n + c[1]; cnt[kk] = (cnt[kk] || 0) + 1; if (cnt[kk] === 2 && !hit) hit = c; }); });
      if (!hit) return null; var b = boardEl.getBoundingClientRect(); return { left: b.left + PAD + hit[1] * STEP, top: b.top + PAD + hit[0] * STEP, width: CELL, height: CELL };
    }, 500);
    var lk = puz.panes.map(function (p, i) { return p.locked ? i : -1; }).filter(function (i) { return i >= 0; })[0];
    if (lk !== undefined) mark("locked", function () { return paneRect(lk); }, 500);
    if (puz.twist === "duo") mark("duo", "target", 500);
    if (puz.challenge) mark("challenge", "lvBadge", 500);
    if (puz.breather) mark("breather", "lvBadge", 500);
  }

  // ---------- background music: made in the browser (no files, nothing to license) ----------
  // Calm "puzzle cafe" style: slow soft chord pads (70 bpm) wandering between Cmaj7, Am7, Fmaj7,
  // G6, Dm9 and Em7, with a sparse marimba-like pentatonic melody, a rare bell and a soft room.
  // v7: to stay glitch-free on phones, the music is rendered ONCE, off the main thread, with an
  // OfflineAudioContext into two ~62 s takes (different random melodies). Playback is then just
  // buffer sources queued on the audio clock a whole take ahead, so busy JS or a slow frame can't
  // make it crackle. Each take is normalised to -3 dBFS and the output goes through a limiter.
  var music = (function () {
    var api = { started: false, playing: false, takes: [] }, out = null, srcs = [], timer = 0, nextAt = 0, turn = 0, rendering = null;
    var BPM = 70, BEAT = 60 / BPM, BAR = BEAT * 8, BARS = 9, LOOP = BAR * BARS, TAIL = 3.5, RATE = 22050;
    var CH = [[48, 55, 64, 71], [45, 52, 60, 67], [41, 48, 57, 64], [43, 50, 59, 64], [38, 50, 57, 64], [40, 47, 55, 62]];
    var GO = [[1, 2, 4, 5], [2, 4, 3], [0, 3, 4], [0, 1, 5], [3, 2, 0], [1, 2]], PENT = [72, 74, 76, 79, 81, 84, 86, 88];
    function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
    function progression() { // starts on C, ends on a chord that leads home to C
      for (var tries = 0; tries < 50; tries++) {
        var seq = [0]; while (seq.length < BARS) { var go = GO[seq[seq.length - 1]]; seq.push(go[Math.floor(Math.random() * go.length)]); }
        if (GO[seq[BARS - 1]].indexOf(0) >= 0 && seq[BARS - 1] !== 0) return seq;
      }
      return [0, 1, 2, 3, 0, 5, 1, 4, 3];
    }
    function renderTake() {
      var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!OAC) return Promise.reject(new Error("no offline audio"));
      var len = Math.ceil((LOOP + TAIL) * RATE), o;
      try { o = new OAC(2, len, RATE); } catch (e) { return Promise.reject(e); }
      var bus = o.createBiquadFilter(); bus.type = "lowpass"; bus.frequency.value = 3200; bus.connect(o.destination);
      var irLen = Math.floor(RATE * 2.4), ir = o.createBuffer(2, irLen, RATE); // a soft room, made from fading noise
      for (var ch = 0; ch < 2; ch++) { var d = ir.getChannelData(ch); for (var i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3) * 0.5; }
      var cv = o.createConvolver(); cv.buffer = ir; var wet = o.createGain(); wet.gain.value = 0.35; wet.connect(cv); cv.connect(bus);
      function env(g, t, peak, att, hold, rel) { // every note fades in and out: no clicks
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + att); g.gain.setValueAtTime(peak, t + att + hold); g.gain.linearRampToValueAtTime(0, t + att + hold + rel);
        return t + att + hold + rel + 0.05;
      }
      function note(f, t, type, peak, att, hold, rel, toWet, detune) {
        var osc = o.createOscillator(), g = o.createGain(); osc.type = type; osc.frequency.value = f; if (detune) osc.detune.value = detune;
        osc.connect(g); g.connect(bus); if (toWet) g.connect(wet);
        osc.start(t); osc.stop(env(g, t, peak, att, hold, rel));
      }
      var seq = progression(), last = -1;
      seq.forEach(function (chord, bar) {
        var t0 = bar * BAR;
        CH[chord].forEach(function (m, i) { // pads: two detuned voices per note, slow swell
          var lp = o.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900; lp.connect(bus); lp.connect(wet);
          [-5, 5].forEach(function (cents) {
            var osc = o.createOscillator(), g = o.createGain(); osc.type = i === 0 ? "sine" : "triangle"; osc.frequency.value = hz(m); osc.detune.value = cents;
            osc.connect(g); g.connect(lp); osc.start(t0); osc.stop(env(g, t0, i === 0 ? 0.05 : 0.022, 1.8, BAR - 1.8, 2.6));
          });
        });
        for (var b = 0; b < 8; b++) for (var half = 0; half < 2; half++) {
          var t = Math.max(0.01, t0 + b * BEAT + half * BEAT / 2 + (Math.random() - 0.5) * 0.02);
          if (b < 7 && Math.random() < (half ? 0.22 : 0.42) && t < LOOP - 0.4) {
            var pool = PENT.filter(function (q) { return q !== last; }), m = pool[Math.floor(Math.random() * pool.length)];
            if (last > 0 && Math.random() < 0.6) { var near = pool.filter(function (q) { return Math.abs(q - last) <= 5; }); if (near.length) m = near[Math.floor(Math.random() * near.length)]; }
            last = m; var v = 0.05 + Math.random() * 0.03;
            note(hz(m), t, "sine", v, 0.008, 0.05, 1.3, true);           // marimba-ish body
            note(hz(m) * 4, t, "sine", v * 0.22, 0.004, 0, 0.16, false); // its quick bright partial
          }
        }
        if (Math.random() < 0.35) note(hz(PENT[4 + Math.floor(Math.random() * 3)] + 12), t0 + BEAT * 4, "sine", 0.016, 0.01, 0, 2.6, true); // a little bell
      });
      return new Promise(function (res, rej) {
        o.oncomplete = function (e) { res(e.renderedBuffer); };
        var p = o.startRendering(); if (p && p.then) p.then(res, rej);
      }).then(function (buf) { // normalise to -3 dBFS, and fade the very end of the tail to silence
        var peak = 0, k, c, d2;
        for (c = 0; c < buf.numberOfChannels; c++) { d2 = buf.getChannelData(c); for (k = 0; k < d2.length; k++) { var v = Math.abs(d2[k]); if (v > peak) peak = v; } }
        var gain = peak > 0 ? 0.708 / peak : 1, fade = Math.floor(0.5 * RATE);
        for (c = 0; c < buf.numberOfChannels; c++) { d2 = buf.getChannelData(c); for (k = 0; k < d2.length; k++) { var f = k > d2.length - fade ? (d2.length - k) / fade : 1; d2[k] *= gain * f; } }
        return buf;
      });
    }
    function ensureTakes() {
      if (api.takes.length >= 2) return Promise.resolve();
      if (rendering) return rendering;
      rendering = renderTake().then(function (b) { api.takes.push(b); rendering = null; if (api.takes.length < 2) setTimeout(ensureTakes, 4000); }, function () { rendering = null; });
      return rendering;
    }
    function level() { return 0.9 * Math.pow(prefs.musicVol, 1.3); } // even-feeling slider; 18% is a soft background
    function queue() { // keep the next take queued on the audio clock, a whole take ahead
      if (!api.playing || !api.takes.length) return;
      while (nextAt < ac.currentTime + LOOP * 0.6) {
        var b = api.takes[turn % api.takes.length]; turn++;
        var src = ac.createBufferSource(); src.buffer = b; src.connect(out);
        src.start(Math.max(nextAt, ac.currentTime + 0.05)); srcs.push(src);
        src.onended = function () { this.disconnect(); var i = srcs.indexOf(this); if (i >= 0) srcs.splice(i, 1); };
        nextAt += LOOP; // the next take starts while this one's tail rings out: seamless
      }
    }
    api.vol = function () { if (out && api.playing) out.gain.setTargetAtTime(level(), ac.currentTime, 0.15); };
    api.start = function () {
      if (api.playing || document.hidden || !actx()) return;
      api.started = api.playing = true;
      if (!out) { out = ac.createGain(); out.gain.value = 0; out.connect(master()); }
      ensureTakes().then(function () {
        if (!api.playing || srcs.length) return;
        var t = ac.currentTime + 0.1; nextAt = t;
        out.gain.cancelScheduledValues(ac.currentTime); out.gain.setValueAtTime(out.gain.value, ac.currentTime); out.gain.linearRampToValueAtTime(0, t); out.gain.linearRampToValueAtTime(level(), t + 2.5); // fade in
        queue(); clearInterval(timer); timer = setInterval(queue, 5000);
      });
    };
    api.stop = function () {
      if (!api.playing) return; api.playing = false; clearInterval(timer); timer = 0;
      if (!ac || !out) return;
      var t = ac.currentTime; out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(0, t + 0.4); // fade out, then stop
      srcs.forEach(function (sn) { try { sn.stop(t + 0.5); } catch (e) {} }); srcs = [];
    };
    api.check = function () { // test hook: render a take and measure peak + the biggest sample jump
      return renderTake().then(function (b) {
        var peak = 0, jump = 0, seam = 0, d = b.getChannelData(0), L = Math.floor(LOOP * RATE);
        for (var i = 1; i < d.length; i++) { var a = Math.abs(d[i]); if (a > peak) peak = a; var j = Math.abs(d[i] - d[i - 1]); if (j > jump) jump = j; }
        // the seam: tail of one take overlapping the start of the next
        for (i = 1; i < d.length - L; i++) { var s1 = d[L + i] + d[i], s0 = d[L + i - 1] + d[i - 1]; seam = Math.max(seam, Math.abs(s1), Math.abs(s1 - s0)); }
        // clicks: a click is a burst of treble far above the frames around it
        var F = 128, nf = Math.floor(d.length / F), hf = new Float32Array(nf), worst = 0;
        for (var f = 0; f < nf; f++) { var e = 0; for (i = Math.max(2, f * F); i < (f + 1) * F; i++) { var y = d[i] - 2 * d[i - 1] + d[i - 2]; e += y * y; } hf[f] = Math.sqrt(e / F); }
        for (f = 8; f < nf - 8; f++) { var nb = []; for (var k = -8; k <= 8; k++) if (k && Math.abs(k) > 1) nb.push(hf[f + k]); nb.sort(function (p, q) { return p - q; }); var med = nb[nb.length >> 1]; if (med > 1e-4) worst = Math.max(worst, hf[f] / med); }
        return { clickRatio: +worst.toFixed(1), seconds: +(b.length / RATE).toFixed(1), peakDb: +(20 * Math.log10(peak)).toFixed(2), maxJump: +jump.toFixed(4), seamPeakOrJump: +seam.toFixed(4), rate: RATE };
      });
    };
    return api;
  })();
  function syncMusicBtn() { var b = $("btnMusic"); b.classList.toggle("off", !prefs.music); b.setAttribute("aria-pressed", prefs.music ? "true" : "false"); b.setAttribute("aria-label", prefs.music ? "Music on, tap to mute" : "Music off, tap to play"); }
  function setMusic(on) {
    prefs.music = !!on; save("ps2:prefs", prefs); syncMusicBtn();
    var o = $("optMusic"); if (o) { o.checked = prefs.music; syncToggles(); }
    if (prefs.music) { if (prefs.musicVol < 0.03) { prefs.musicVol = 0.18; $("optMusicVol").value = 18; $("musicVolTxt").textContent = "18%"; save("ps2:prefs", prefs); } music.start(); } else music.stop();
  }

  // ---------- wiring ----------
  function openHelp() {
    $("mixList").innerHTML = [3, 6, 5, 7].map(function (m) { return "<span aria-label='" + MIXNAME[m] + "'>" + bitsOf(m).map(function (k) { return swatchHTML(E.BIT[k]); }).join("+") + "=" + swatchHTML(m, "res") + "</span>"; }).join(""); paintSwatches($("mixList"));
    document.querySelectorAll("#dlgHelp .st3").forEach(function (x) { x.innerHTML = starsHTML(3); }); document.querySelectorAll("#dlgHelp .st2").forEach(function (x) { x.innerHTML = starsHTML(2); });
    $("dlgHelp").showModal();
  }
  function openSettings() { $("optMusic").checked = !!prefs.music; $("optMusicVol").value = Math.round(prefs.musicVol * 100); $("musicVolTxt").textContent = Math.round(prefs.musicVol * 100) + "%"; $("optSound").checked = !!prefs.sound; $("optVibe").checked = !!prefs.vibe; $("optPatterns").checked = !!prefs.patterns; syncToggles(); $("dlgSettings").showModal(); }
  function syncToggles() { document.querySelectorAll(".tgl").forEach(function (l) { l.classList.toggle("on", l.querySelector("input").checked); }); }
  function wire() {
    var b = $("board");
    b.addEventListener("pointerdown", onDown); b.addEventListener("pointermove", onMove);
    b.addEventListener("pointerup", onUp); b.addEventListener("pointercancel", onUp);
    document.addEventListener("pointerdown", function (e) { var t = e.target.closest && e.target.closest(".cbtn, .tgl, .node"); if (t && !t.disabled) { actx(); sfx.tap(); buzz(6); } }, true);
    document.querySelectorAll("dialog [data-close]").forEach(function (x) { x.addEventListener("click", function () { x.closest("dialog").close(); }); });
    document.querySelectorAll("dialog").forEach(function (d) { d.addEventListener("click", function (e) { if (e.target === d) d.close(); }); });
    $("dlgEnd").addEventListener("close", function () { if (mode === "tutorial" && state.status === "won") { prefs.tutDone = true; prefs.glideTut = true; save("ps2:prefs", prefs); startDaily(); } });
    $("btnHelp").addEventListener("click", openHelp); $("btnHelp2").addEventListener("click", openHelp);
    $("btnReplayTut").addEventListener("click", function () { $("dlgHelp").close(); startTutorial(); });
    $("btnStats").addEventListener("click", function () { $("statsBody").innerHTML = statsHTML(-1); $("dlgStats").showModal(); });
    $("btnSettings").addEventListener("click", openSettings); $("btnHomeSettings").addEventListener("click", openSettings);
    $("optSound").addEventListener("change", function () { prefs.sound = this.checked; save("ps2:prefs", prefs); syncToggles(); if (prefs.sound) sfx.drop(); });
    $("optMusic").addEventListener("change", function () { setMusic(this.checked); });
    $("optMusicVol").addEventListener("input", function () { prefs.musicVol = this.value / 100; $("musicVolTxt").textContent = this.value + "%"; music.vol(); save("ps2:prefs", prefs); if (this.value > 0 && !prefs.music) setMusic(true); });
    $("btnMusic").addEventListener("click", function () { setMusic(!prefs.music); toast(prefs.music ? "🎵 Music on" : "🔇 Music off"); });
    $("btnTipsAgain").addEventListener("click", function () { prefs.marks = []; save("ps2:prefs", prefs); $("dlgHelp").close(); toast("💬 Tips will show again"); if (mode === "level") levelMarks(puz.level, true); else if (mode === "home") startHome(); else if (mode === "map") openMap(); });
    ["mousedown", "pointerup", "touchend", "click", "keydown"].forEach(function (ev) { // these count as a real tap for autoplay rules
      document.addEventListener(ev, function (e) { if (ev === "pointerup" && e.pointerType === "mouse") return; gestured = true; actx(); if (prefs.music) music.start(); }, true);
    });
    document.addEventListener("visibilitychange", function () { if (document.hidden) music.stop(); else if (prefs.music && music.started) music.start(); });
    window.addEventListener("pagehide", function () { music.stop(); });
    document.querySelectorAll("dialog").forEach(function (d) { d.addEventListener("close", function () { if (markEl && markEl.parentNode === d) hideMark(); }); });
    $("optVibe").addEventListener("change", function () { prefs.vibe = this.checked; save("ps2:prefs", prefs); syncToggles(); buzz(20); });
    $("optPatterns").addEventListener("change", function () { prefs.patterns = this.checked; save("ps2:prefs", prefs); syncToggles(); document.body.classList.toggle("patterns", prefs.patterns); if (puz && boardCv) { paintTarget(); drawBoard(); } });
    $("btnShare").addEventListener("click", onShareBtn);
    $("btnEndMain").addEventListener("click", onEndMain);
    $("btnEndHome").addEventListener("click", function () { $("dlgEnd").close(); startHome(); });
    $("btnPlay").addEventListener("click", openMap);
    $("btnDaily").addEventListener("click", startDaily);
    $("btnBack").addEventListener("click", function () { if (mode === "level") openMap(); else startHome(); });
    $("btnPlayNext").addEventListener("click", function () { startLevel(prog.unlocked); });
    $("btnRestart").addEventListener("click", function () { if (mode === "level") startLevel(puz.level); });
    $("btnHint").addEventListener("click", useHint);
    $("btnNext").addEventListener("click", function () { $("dlgLevel").close(); startLevel(puz.level + 1); });
    $("btnReplay").addEventListener("click", function () { $("dlgLevel").close(); startLevel(puz.level); });
    $("btnMap2").addEventListener("click", function () { $("dlgLevel").close(); openMap(); });
    $("btnLvShare").addEventListener("click", function () { shareOut("PaneSlide Level " + puz.level + " " + "⭐".repeat(lastStars) + "\n" + SITE); });
    $("btnMileNext").addEventListener("click", function () { $("dlgMile").close(); startLevel(puz.level + 1); });
    $("btnMileShare").addEventListener("click", function () { var N = puz.level, ri = rankIndex(N); shareOut(mileShareText(N, ri >= 0 ? RANKS[ri][1] : "Glass Spark")); });
    $("btnSkip").addEventListener("click", function () { prefs.tutDone = true; prefs.glideTut = true; save("ps2:prefs", prefs); hideCoach(true); startDaily(); });
    $("btnUndo").addEventListener("click", undo);
    var rz; window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(function () { if (mode === "map" || mode === "home" || anims.length) return; clearHint(); build(); if (mode === "tutorial") coachTutorial(); }, 150); });
  }

  wire(); syncMusicBtn(); shimmerLoop();
  var qLevel = parseInt(qs.get("level"), 10);
  if ((!prefs.tutDone || !prefs.glideTut) && !practice && qs.get("tutorial") !== "0") startTutorial(); // the new glide rules get a one-time tutorial, even for old players
  else if (qLevel >= 1 && (qLevel <= prog.unlocked || TEST)) startLevel(qLevel);
  else if (qs.get("mode") === "levels" || qLevel) openMap();
  else if (qs.get("mode") === "daily" || practice) startDaily();
  else startHome();

  if (TEST) window.PS = {
    get puzzle() { return puz; }, get state() { return state; }, get mode() { return mode; }, shareText: shareText, mileShareText: function () { var N = puz.level, ri = rankIndex(N); return mileShareText(N, ri >= 0 ? RANKS[ri][1] : "Glass Spark"); },
    get progress() { return prog; }, hint: useHint, E: E, swipe: swipe, undo: undo, cellPoint: function (r, c) { var b = boardEl.getBoundingClientRect(); return { x: b.left + PAD + c * STEP + CELL / 2, y: b.top + PAD + r * STEP + CELL / 2 }; }, get busy() { return anims.length > 0; }, get music() { return { on: prefs.music, vol: prefs.musicVol, playing: music.playing }; }, musicCheck: function () { return music.check(); }, get markShown() { return markEl ? markEl.dataset.key : null; },
    grabPoint: function (pi) { // centre of a cell of pane pi that no other same-axis pane covers
      var p = puz.panes[pi], r = boardEl.getBoundingClientRect(), cells = E.paneCells(p, state.pos[pi]);
      var only = cells.filter(function (c) { return panesAt(c).every(function (q) { return q === pi || puz.panes[q].locked; }); });
      var free = cells.filter(function (c) { return panesAt(c).every(function (q) { return q === pi || puz.panes[q].locked || (puz.panes[q].axis !== p.axis && puz.panes[q].axis !== "b" && p.axis !== "b"); }); });
      var c = (only[0] || free[0] || cells[0]);
      return { x: r.left + PAD + c[1] * STEP + CELL / 2, y: r.top + PAD + c[0] * STEP + CELL / 2, step: STEP, axis: p.axis, mc: p.mc };
    }
  };
})();
