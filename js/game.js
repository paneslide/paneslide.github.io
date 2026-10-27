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
    ["C", "M", "Y"].forEach(function (k) { if (m & E.BIT[k]) { var x = rgb(HEX[k]); c = c.map(function (v, i) { return Math.round(v * x[i] / 255); }); } });
    return "rgb(" + c.join(",") + ")";
  }
  function bitsOf(m) { return ["C", "M", "Y"].filter(function (k) { return m & E.BIT[k]; }); }

  // ---------- state ----------
  var today = localDate();
  var date = /^\d{4}-\d{2}-\d{2}$/.test(qs.get("date") || "") ? qs.get("date") : today;
  var practice = date !== today;
  var prefs = load("ps2:prefs", { sound: true, patterns: false, tutDone: false, mixSeen: [] });
  if (typeof prefs.vibe !== "boolean") prefs.vibe = true;
  var stats = load("ps2:stats", { played: 0, streak: 0, best: 0, lastWin: null, dist: [0, 0, 0, 0] });
  var mode, puz, n, state, GKEY, zTop = 10, locked = false;
  var prog = load("ps2:levels", null) || { unlocked: 1, stars: {}, best: {}, hints: 3, perf: 0, bestPerf: 0, mile: [], threeSince: 0, tips: [] };
  ["stars", "best"].forEach(function (k) { prog[k] = prog[k] || {}; }); prog.mile = prog.mile || []; prog.tips = prog.tips || [];
  if (typeof prog.hints !== "number") prog.hints = 3;
  function lvSave() { save("ps2:levels", prog); }
  var HINT_MAX = 5;
  function parOf(p) { return E.movable(p); }

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
  var TIPS = { locked: "🔒 Locked glass!", duo: "🎨 Only 2 colours!", free: "✥ Slides any way!", challenge: "🏆 Challenge!", breather: "🌿 Easy one!" };

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
  function levelUI(on) { $("btnHint").hidden = !on; $("btnRestart").hidden = !on; $("starLine").hidden = false; }
  function startHome() {
    hideCoach(true); clearHint(); mode = "home"; locked = true; applyTheme(null);
    var lv = $("playLv"); lv.textContent = "Level " + prog.unlocked;
    var d = new Date(); $("calMon").textContent = d.toLocaleString("en", { month: "short" }).toUpperCase(); $("calDay").textContent = d.getDate();
    var st = load("ps2:game:" + today, null), ds = $("dailyStat");
    if (st && st.status === "won") ds.innerHTML = "<span class='done'>✔</span>";
    else if (currentStreak() > 0) ds.innerHTML = "<i class='ico fire'></i>" + currentStreak();
    else ds.innerHTML = "<span class='new'>NEW</span>";
    showView("home");
  }
  function startDaily() {
    hideCoach(true); applyTheme(null); levelUI(false);
    mode = "daily"; puz = E.generate(date); n = puz.n; GKEY = "ps2:game:" + date;
    state = load(GKEY, null);
    if (!state || !Array.isArray(state.pos) || state.pos.length !== puz.panes.length) state = { pos: puz.start.slice(), moves: 0, hist: [], status: "playing" };
    locked = state.status !== "playing";
    setRule("");
    $("btnSkip").hidden = true; $("status").hidden = false;
    setBadge(CAL_SVG, practice ? "Practice" : "Daily", practice ? date.slice(5) : "#" + puz.number);
    showView("play"); build();
    if (state.status === "won") { $("board").classList.add("won"); setTimeout(openEnd, 500); }
  }
  function startTutorial() {
    mode = "tutorial"; puz = E.tutorial(); n = puz.n; GKEY = null;
    state = { pos: puz.start.slice(), moves: 0, hist: [], status: "playing" }; locked = false;
    setRule("");
    $("btnSkip").hidden = false; $("status").hidden = true; levelUI(false); applyTheme(null);
    setBadge("👆", "Tutorial", "1 / 2");
    showView("tutorial"); build(); setTimeout(coachTutorial, 350);
  }
  function ensureLevels(cb) {
    if (window.PANESLIDE_LEVELS) return cb();
    var sc = document.createElement("script"); sc.src = "js/levels.js?v=4"; sc.onload = cb; sc.onerror = cb; document.head.appendChild(sc);
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
      state = { pos: puz.start.slice(), moves: 0, hist: [], status: "playing", hinted: false };
      var ch = chapterOf(N); applyTheme(ch);
      $("btnSkip").hidden = true; $("status").hidden = false; levelUI(true);
      setBadge(puz.challenge ? "🏆" : puz.breather ? "🌿" : ch.icon, "Level", N);
      showView("play"); build(); updateHint(); updateStarLine();
      tipShown = null; setRule("");
      var key = puz.twist && prog.tips.indexOf(puz.twist) < 0 ? puz.twist : puz.challenge && prog.tips.indexOf("challenge") < 0 ? "challenge" : puz.breather && prog.tips.indexOf("breather") < 0 ? "breather" : null;
      var tip = key ? TIPS[key] : (N % 20 === 1) ? ch.icon + " " + ch.name + "!" : null;
      if (key) { prog.tips.push(key); lvSave(); }
      if (tip) setTimeout(function () { flashTip(tip, 2800); }, 350);
    });
  }
  function setRule(t) { var r = $("rule"); r.textContent = t; r.classList.toggle("coaching", !!t); }

  // ---------- audio (synthesised, self-made) ----------
  var ac = null;
  function actx() { if (!ac) { var A = window.AudioContext || window.webkitAudioContext; if (A) ac = new A(); } if (ac && ac.state === "suspended") ac.resume(); return ac; }
  function tone(f, dur, type, vol, when) {
    if (!prefs.sound) return; var a = actx(); if (!a) return;
    var t = a.currentTime + (when || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type || "sine"; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
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

  function build() {
    measure();
    document.body.classList.toggle("patterns", !!prefs.patterns);
    $("par").textContent = parOf(puz);
    // target
    var t = $("target"); t.innerHTML = "";
    var tc = n <= 3 ? 28 : n === 4 ? 24 : n === 5 ? 21 : 18;
    t.style.gridTemplateColumns = "repeat(" + n + ", " + tc + "px)";
    puz.target.forEach(function (m) {
      var c = el("div", "c", t); c.style.width = c.style.height = tc + "px";
      bitsOf(m).forEach(function (k) { var l = el("i", "lay " + k, c); l.style.backgroundColor = HEX[k]; });
    });
    // board
    boardEl = $("board"); boardEl.innerHTML = ""; boardEl.classList.remove("won");
    var wells = el("div", "wells", boardEl); wells.style.gridTemplateColumns = "repeat(" + n + ", " + CELL + "px)";
    for (var i = 0; i < n * n; i++) el("div", "well", wells);
    trackEl = el("div", "track", boardEl);
    paneEls = []; gripEls = [];
    puz.panes.forEach(function (p, pi) {
      var pe = el("div", "pane", boardEl); pe.tabIndex = 0; pe.dataset.pane = pi;
      pe.setAttribute("role", "button");
      pe.setAttribute("aria-label", NAME[p.color] + " glass, " + (p.locked ? "locked in place" : "slides " + (p.axis === "h" ? "left and right" : p.axis === "v" ? "up and down" : "any direction") + ". Use arrow keys."));
      if (p.locked) pe.classList.add("locked");
      pe.style.setProperty("--pc", HEX[p.color]);
      p.cells.forEach(function (c) { var g = el("div", "g " + p.color, pe); g.style.left = c[1] * STEP + "px"; g.style.top = c[0] * STEP + "px"; });
      pe.addEventListener("keydown", function (e) { keyMove(e, pi); });
      paneEls.push(pe);
      var gr = el("div", "grip" + (p.locked ? " lock" : ""), boardEl); gr.innerHTML = p.locked ? LOCK_SVG : arrowSVG(p.axis); gripEls.push(gr);
    });
    puz.panes.forEach(function (p, pi) { place(pi, state.pos[pi]); });
    el("div", "sparkle", boardEl);
    updateMoves(false);
  }
  var gripAt = []; // shape-cell index each pane's arrow sits on
  function place(pi, pos) {
    var p = puz.panes[pi], o = offset(p, pos);
    paneEls[pi].style.transform = "translate(" + o[0] + "px," + o[1] + "px)";
    placeGrips();
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
      var j = order[0], c = cells[j]; taken[c[0] * n + c[1]] = 1; gripAt[i] = j;
      gripEls[i].style.transform = "translate(" + (PAD + c[1] * STEP) + "px," + (PAD + c[0] * STEP) + "px)";
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
    var p = puz.panes[pi], o = offset(p, state.pos[pi]), dx = p.axis === "h" ? 8 : 0, dy = p.axis === "v" ? 8 : 0;
    paneEls[pi].animate([{ transform: "translate(" + o[0] + "px," + o[1] + "px)" }, { transform: "translate(" + (o[0] + dx) + "px," + (o[1] + dy) + "px)" }, { transform: "translate(" + (o[0] - dx) + "px," + (o[1] - dy) + "px)" }, { transform: "translate(" + o[0] + "px," + o[1] + "px)" }], { duration: 360 });
    toast(p.axis === "h" ? "↔ Drag" : "↕ Drag");
  }
  function commit(pi, pos) {
    var moved = pos !== state.pos[pi], before = E.render(puz, state.pos);
    state.pos[pi] = pos; place(pi, pos);
    if (!moved) return;
    sfx.drop(); buzz(8);
    var pe = paneEls[pi]; pe.classList.remove("squish"); void pe.offsetWidth; pe.classList.add("squish");
    boardEl.classList.remove("bump"); void boardEl.offsetWidth; boardEl.classList.add("bump");
    state.moves++; state.hist.push(puz.panes[pi].color);
    updateMoves(true);
    if (mode === "daily") save(GKEY, state);
    if (mode === "level") {
      if (tipShown) { tipShown = null; setRule(""); }
      if (hintPi === pi) clearHint(); updateStarLine();
    }
    var img = E.render(puz, state.pos);
    sparkleMixes(before, img);
    showNewMix(img);
    if (E.diffCount(img, puz.target) === 0) win();
    else if (mode === "tutorial") setTimeout(coachTutorial, 250);
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
    chip.innerHTML = parts.map(function (k) { return "<i style='background:" + HEX[k] + "'></i>"; }).join("+") + "=<i class='res' style='background:" + maskColor(found) + "'></i>";
    chip.setAttribute("aria-label", parts.map(function (k) { return NAME[k]; }).join(" + ") + " make " + MIXNAME[found].toLowerCase());
    chip.hidden = false; clearTimeout(chipT); chipT = setTimeout(function () { chip.hidden = true; }, 3200);
  }

  // ---------- tutorial coach ----------
  var handEl = null, handAnim = null;
  function coachAt(pi, text) {
    var p = puz.panes[pi], o = offset(p, state.pos[pi]), hc = p.cells[gripAt[pi]] || gripCell(p);
    var x = PAD + o[0] + hc[1] * STEP + CELL / 2, y = PAD + o[1] + hc[0] * STEP;
    setRule(text);
    if (!handEl) { handEl = el("div", "hand", document.querySelector(".stage-wrap")); handEl.textContent = "👆"; }
    handEl.hidden = false;
    var dir = state.pos[pi] < puz.solution[pi] ? 1 : -1, dist = STEP * Math.abs(puz.solution[pi] - state.pos[pi]);
    handEl.style.left = (x - 14) + "px"; handEl.style.top = (y + CELL / 2 - 6) + "px";
    if (handAnim) handAnim.cancel();
    var to = p.axis === "h" ? "translate(" + dir * dist + "px,0)" : "translate(0," + dir * dist + "px)";
    handAnim = handEl.animate([{ transform: "translate(0,0)", opacity: 0 }, { transform: "translate(0,0)", opacity: 1, offset: 0.15 }, { transform: to, opacity: 1, offset: 0.75 }, { transform: to, opacity: 0 }], { duration: 1600, iterations: Infinity, easing: "ease-in-out" });
  }
  function hideCoach(all) { setRule(""); if (handEl) handEl.hidden = true; if (handAnim) handAnim.cancel(); if (all) handAnim = null; }
  function coachTutorial() {
    if (mode !== "tutorial" || state.status !== "playing") return;
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
  function dailyStars() { var over = state.moves - parOf(puz); return over <= 0 ? 3 : over <= 2 ? 2 : 1; }
  function openEnd() {
    var d = $("dlgEnd");
    if (mode === "tutorial") {
      $("endTitle").textContent = "You got it!";
      $("endStars").innerHTML = starsHTML(3, "pop"); playStars(3);
      $("endStats").innerHTML = "<span class='stat'><i class='mx' style='background:" + HEX.C + "'></i>+<i class='mx' style='background:" + HEX.M + "'></i>=<i class='mx' style='background:" + maskColor(3) + "'></i></span>";
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
    if (mode === "tutorial") { prefs.tutDone = true; save("ps2:prefs", prefs); $("dlgEnd").close(); startDaily(); return; }
    $("dlgEnd").close(); openMap();
  }
  function toast(msg) { var t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 1700); }

  // ---------- levels: stars, hints, win, milestones, map ----------
  function starsFor(moves, hinted) { var par = parOf(puz), st = moves <= par ? 3 : moves <= par + (par >= 4 ? 2 : 1) ? 2 : 1; return hinted ? Math.min(2, st) : st; } // 3 = optimal (one slide per pane), 2 = 1-2 extra slides
  function misplaced() { return puz.panes.filter(function (p, i) { return state.pos[i] !== puz.solution[i]; }).length; }
  var STAR = '<svg viewBox="0 0 24 24"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';
  function starsHTML(k, cls) { var h = ""; for (var i = 0; i < 3; i++) h += "<i class='st" + (i < k ? " on" : "") + (cls ? " " + cls : "") + "' style='--i:" + i + "'>" + STAR + "</i>"; return h; }
  function updateStarLine() {
    if (mode !== "level" && mode !== "daily") return;
    var k = mode === "daily" ? (function () { var over = state.moves + misplaced() - parOf(puz); return over <= 0 ? 3 : over <= 2 ? 2 : 1; })() : starsFor(state.moves + misplaced(), state.hinted);
    var sl = $("starLine"), prev = +sl.dataset.k || 3; sl.dataset.k = k;
    sl.innerHTML = starsHTML(k); sl.setAttribute("aria-label", k + " stars possible");
    if (k < prev) { var lost = sl.children[k]; if (lost) lost.classList.add("lose"); }
  }
  function updateHint() { $("hintCount").textContent = prog.hints; $("btnHint").classList.toggle("empty", prog.hints <= 0); }
  var hintPi = null, ghostEl = null;
  function clearHint() { hintPi = null; if (ghostEl) { ghostEl.remove(); ghostEl = null; } paneEls.forEach(function (e) { e.classList.remove("hinted"); }); }
  function useHint() {
    if (mode !== "level" || locked) return;
    if (hintPi !== null) return;
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
  function recordLevel() {
    var N = puz.level, st = starsFor(state.moves, state.hinted), prev = prog.stars[N] || 0, firstClear = N >= prog.unlocked, gained = [];
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
    $("lvTitle").textContent = "Level " + puz.level;
    $("lvSub").innerHTML = chipHTML("foot", state.moves + " <small>/</small> <i class='ico flag'></i>" + parOf(puz)) + (gained.length ? chipHTML("bulb", "+" + gained.length, "plus") : "");
    $("dlgLevel").showModal(); setTimeout(function () { confetti(true); }, 200);
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
    $("dlgMile").showModal();
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
    requestAnimationFrame(function () { drawRoad(path, nodes); if (cur) { var r = cur.getBoundingClientRect(); window.scrollTo(0, Math.max(0, window.scrollY + r.top - window.innerHeight * 0.5)); } });
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
    showView("map"); renderMap();
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

  // ---------- wiring ----------
  function openHelp() {
    $("mixList").innerHTML = [3, 6, 5, 7].map(function (m) { return "<span aria-label='" + MIXNAME[m] + "'>" + bitsOf(m).map(function (k) { return "<i style='background:" + HEX[k] + "'></i>"; }).join("+") + "=<i class='res' style='background:" + maskColor(m) + "'></i></span>"; }).join("");
    document.querySelector("#dlgHelp .st3").innerHTML = starsHTML(3); document.querySelectorAll("#dlgHelp .st2").forEach(function (x) { x.innerHTML = starsHTML(2); });
    $("dlgHelp").showModal();
  }
  function openSettings() { $("optSound").checked = !!prefs.sound; $("optVibe").checked = !!prefs.vibe; $("optPatterns").checked = !!prefs.patterns; syncToggles(); $("dlgSettings").showModal(); }
  function syncToggles() { document.querySelectorAll(".tgl").forEach(function (l) { l.classList.toggle("on", l.querySelector("input").checked); }); }
  function wire() {
    var b = $("board");
    b.addEventListener("pointerdown", onDown); b.addEventListener("pointermove", onMove);
    b.addEventListener("pointerup", onUp); b.addEventListener("pointercancel", onUp);
    document.addEventListener("pointerdown", function (e) { var t = e.target.closest && e.target.closest(".cbtn, .tgl, .node"); if (t && !t.disabled) { actx(); sfx.tap(); buzz(6); } }, true);
    document.querySelectorAll("dialog [data-close]").forEach(function (x) { x.addEventListener("click", function () { x.closest("dialog").close(); }); });
    document.querySelectorAll("dialog").forEach(function (d) { d.addEventListener("click", function (e) { if (e.target === d) d.close(); }); });
    $("dlgEnd").addEventListener("close", function () { if (mode === "tutorial" && state.status === "won") { prefs.tutDone = true; save("ps2:prefs", prefs); startDaily(); } });
    $("btnHelp").addEventListener("click", openHelp); $("btnHelp2").addEventListener("click", openHelp);
    $("btnReplayTut").addEventListener("click", function () { $("dlgHelp").close(); startTutorial(); });
    $("btnStats").addEventListener("click", function () { $("statsBody").innerHTML = statsHTML(-1); $("dlgStats").showModal(); });
    $("btnSettings").addEventListener("click", openSettings); $("btnHomeSettings").addEventListener("click", openSettings);
    $("optSound").addEventListener("change", function () { prefs.sound = this.checked; save("ps2:prefs", prefs); syncToggles(); if (prefs.sound) sfx.drop(); });
    $("optVibe").addEventListener("change", function () { prefs.vibe = this.checked; save("ps2:prefs", prefs); syncToggles(); buzz(20); });
    $("optPatterns").addEventListener("change", function () { prefs.patterns = this.checked; save("ps2:prefs", prefs); syncToggles(); document.body.classList.toggle("patterns", prefs.patterns); });
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
    $("btnSkip").addEventListener("click", function () { prefs.tutDone = true; save("ps2:prefs", prefs); hideCoach(true); startDaily(); });
    var rz; window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(function () { if (mode === "map" || mode === "home") return; clearHint(); build(); if (mode === "tutorial") coachTutorial(); }, 150); });
  }

  wire();
  var qLevel = parseInt(qs.get("level"), 10);
  if (!prefs.tutDone && !practice && qs.get("tutorial") !== "0") startTutorial();
  else if (qLevel >= 1 && (qLevel <= prog.unlocked || TEST)) startLevel(qLevel);
  else if (qs.get("mode") === "levels" || qLevel) openMap();
  else if (qs.get("mode") === "daily" || practice) startDaily();
  else startHome();

  if (TEST) window.PS = {
    get puzzle() { return puz; }, get state() { return state; }, get mode() { return mode; }, shareText: shareText, mileShareText: function () { var N = puz.level, ri = rankIndex(N); return mileShareText(N, ri >= 0 ? RANKS[ri][1] : "Glass Spark"); },
    get progress() { return prog; }, hint: useHint,
    grabPoint: function (pi) { // centre of a cell of pane pi that no other same-axis pane covers
      var p = puz.panes[pi], r = boardEl.getBoundingClientRect(), cells = E.paneCells(p, state.pos[pi]);
      var only = cells.filter(function (c) { return panesAt(c).every(function (q) { return q === pi || puz.panes[q].locked; }); });
      var free = cells.filter(function (c) { return panesAt(c).every(function (q) { return q === pi || puz.panes[q].locked || (puz.panes[q].axis !== p.axis && puz.panes[q].axis !== "b" && p.axis !== "b"); }); });
      var c = (only[0] || free[0] || cells[0]);
      return { x: r.left + PAD + c[1] * STEP + CELL / 2, y: r.top + PAD + c[0] * STEP + CELL / 2, step: STEP, axis: p.axis, mc: p.mc };
    }
  };
})();
