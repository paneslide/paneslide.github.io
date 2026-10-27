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
  var stats = load("ps2:stats", { played: 0, streak: 0, best: 0, lastWin: null, dist: [0, 0, 0, 0] });
  var mode, puz, n, state, GKEY, zTop = 10, locked = false;
  var prog = load("ps2:levels", null) || { unlocked: 1, stars: {}, best: {}, hints: 3, perf: 0, bestPerf: 0, mile: [], threeSince: 0, tips: [] };
  ["stars", "best"].forEach(function (k) { prog[k] = prog[k] || {}; }); prog.mile = prog.mile || []; prog.tips = prog.tips || [];
  if (typeof prog.hints !== "number") prog.hints = 3;
  function lvSave() { save("ps2:levels", prog); }
  var HINT_MAX = 5;
  function parOf(p) { return E.movable(p); }

  // ---------- chapters, ranks, tips ----------
  var CHAPTERS = [
    { name: "Sunroom", icon: "☀️", bg: "#F5EFE4", frame: "#E9E0CF" },
    { name: "Greenhouse", icon: "🌿", bg: "#EAF2E4", frame: "#D3E4CB" },
    { name: "Lighthouse", icon: "🌊", bg: "#E5EFF4", frame: "#CDDEE8" },
    { name: "Tea Garden", icon: "🍵", bg: "#F1EEDD", frame: "#E0DAC0" },
    { name: "Lantern Market", icon: "🏮", bg: "#F7E8E2", frame: "#EBD2C8" },
    { name: "Lavender Loft", icon: "💜", bg: "#EEE9F5", frame: "#DBD2EA" },
    { name: "Desert Dunes", icon: "🏜️", bg: "#F6ECDC", frame: "#E8D6BA" },
    { name: "Snow Cabin", icon: "❄️", bg: "#EDF1F6", frame: "#D7DFEA" }
  ];
  var ROMAN = ["", " II", " III", " IV", " V", " VI", " VII", " VIII", " IX", " X"];
  function chapterOf(N) {
    var k = Math.floor((N - 1) / 20), c = CHAPTERS[k % CHAPTERS.length], cyc = Math.floor(k / CHAPTERS.length);
    return { index: k + 1, name: c.name + (cyc < ROMAN.length ? ROMAN[cyc] : " " + (cyc + 1)), icon: c.icon, bg: c.bg, frame: c.frame };
  }
  function applyTheme(ch) {
    var r = document.documentElement.style;
    if (ch) { r.setProperty("--bg", ch.bg); r.setProperty("--frame", ch.frame); } else { r.removeProperty("--bg"); r.removeProperty("--frame"); }
  }
  var RANKS = [[5, "Glass Spark"], [10, "Glass Apprentice"], [20, "Pane Pusher"], [30, "Colour Mixer"], [50, "Glass Master"], [75, "Prism Pro"], [100, "Window Wizard"], [150, "Stained-Glass Sage"], [200, "Lightkeeper"], [300, "Grand Glazier"], [500, "PaneSlide Legend"]];
  function rankIndex(cleared) { var i = -1; RANKS.forEach(function (r, k) { if (cleared >= r[0]) i = k; }); return i; }
  function isMilestone(N) { return N === 5 || N % 10 === 0; }
  var TIPS = {
    locked: "New: 🔒 locked glass can't move. Plan around it.",
    duo: "New: only two colours this time. Fewer mixes, trickier spots.",
    free: "New: ✥ this glass slides any direction.",
    challenge: "🏆 Challenge level: a tougher one. You still can't lose.",
    breather: "🌿 Breather: an easier one to relax."
  };

  function showView(v) {
    $("mapView").hidden = v !== "map"; $("playView").hidden = v !== "play";
    $("tabs").hidden = v === "tutorial";
    $("tabDaily").classList.toggle("on", mode === "daily"); $("tabLevels").classList.toggle("on", mode === "level" || v === "map");
    if (v === "tutorial") $("playView").hidden = false;
  }
  function levelUI(on) { $("btnHint").hidden = !on; $("starLine").hidden = !on; $("btnToMap").hidden = !on; }
  function startDaily() {
    hideCoach(true); applyTheme(null); levelUI(false);
    mode = "daily"; puz = E.generate(date); n = puz.n; GKEY = "ps2:game:" + date;
    state = load(GKEY, null);
    if (!state || !Array.isArray(state.pos) || state.pos.length !== puz.panes.length) state = { pos: puz.start.slice(), moves: 0, hist: [], status: "playing" };
    locked = state.status !== "playing";
    setRule(practice ? "Practice puzzle. Slide the glass to copy the picture." : "Slide the glass to copy the picture. Where glass overlaps, colours mix.");
    $("btnSkip").hidden = true; $("status").hidden = false;
    showView("play"); build();
    if (state.status === "won") { $("board").classList.add("won"); setTimeout(openEnd, 500); }
  }
  function startTutorial() {
    mode = "tutorial"; puz = E.tutorial(); n = puz.n; GKEY = null;
    state = { pos: puz.start.slice(), moves: 0, hist: [], status: "playing" }; locked = false;
    setRule("Quick tutorial: copy the little picture.");
    $("btnSkip").hidden = false; $("status").hidden = true; levelUI(false); applyTheme(null);
    showView("tutorial"); build(); setTimeout(coachTutorial, 350);
  }
  function ensureLevels(cb) {
    if (window.PANESLIDE_LEVELS) return cb();
    var sc = document.createElement("script"); sc.src = "js/levels.js?v=2"; sc.onload = cb; sc.onerror = cb; document.head.appendChild(sc);
  }
  function getLevel(N) {
    var D = window.PANESLIDE_LEVELS;
    if (D && N <= D.length) return E.unpackLevel(D[N - 1], N);
    return E.generateLevel(N, { ms: 2500 }); // beyond the precomputed file: same rules, made on the phone
  }
  var tipShown = null;
  function startLevel(N) {
    ensureLevels(function () {
      hideCoach(true);
      mode = "level"; puz = getLevel(N); n = puz.n; GKEY = null; locked = false;
      state = { pos: puz.start.slice(), moves: 0, hist: [], status: "playing", hinted: false };
      var ch = chapterOf(N); applyTheme(ch);
      $("btnSkip").hidden = true; $("status").hidden = false; levelUI(true);
      showView("play"); build(); updateHint(); updateStarLine();
      tipShown = null;
      var key = puz.twist && prog.tips.indexOf(puz.twist) < 0 ? puz.twist : puz.challenge && prog.tips.indexOf("challenge") < 0 ? "challenge" : puz.breather && prog.tips.indexOf("breather") < 0 ? "breather" : null;
      var tip = key ? TIPS[key] : (N % 20 === 1 && N > 1) ? "Chapter " + ch.index + ": " + ch.name + " " + ch.icon : null;
      if (key) { prog.tips.push(key); lvSave(); }
      if (tip) { tipShown = tip; setTimeout(function () { var r = $("rule"); r.textContent = tip; r.classList.add("coaching"); }, 200); }
      else setRule("Level " + N + ": slide the glass to copy the picture.");
    });
  }
  function setRule(t) { var r = $("rule"); r.classList.add("swap"); setTimeout(function () { r.textContent = t; r.classList.remove("swap"); }, 180); }

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
    win: function () { [659.25, 783.99, 987.77, 1318.5].forEach(function (f, i) { tone(f, 0.6, "triangle", 0.06, i * 0.08); }); tone(1975.5, 0.9, "sine", 0.03, 0.4); }
  };
  function buzz(ms) { if (navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {} }

  // ---------- layout ----------
  var CELL = 64, GAP = 6, PAD = 10, STEP = 70, paneEls = [], gripEls = [], trackEl, boardEl;
  function measure() {
    var avail = Math.min(window.innerWidth, 520) - 32 - PAD * 2 - GAP * (n - 1);
    var maxH = window.innerHeight - 440; // keep the whole game on one phone screen
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
    $("meta").textContent = mode === "tutorial" ? "Tutorial" : mode === "level" ? "Level " + puz.level + " · " + (puz.challenge ? "🏆 Challenge" : puz.breather ? "🌿 Breather" : chapterOf(puz.level).name) : (practice ? "Practice · " + date : "#" + puz.number + " · " + puz.day);
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
      if (!free.length) { drag = null; toast("This glass is locked in place"); return; }
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
    if (puz.panes[pi].locked) { toast("This glass is locked in place"); return; }
    if (puz.panes[pi].axis === "b") { toast("Drag it any direction"); return; }
    var p = puz.panes[pi], o = offset(p, state.pos[pi]), dx = p.axis === "h" ? 8 : 0, dy = p.axis === "v" ? 8 : 0;
    paneEls[pi].animate([{ transform: "translate(" + o[0] + "px," + o[1] + "px)" }, { transform: "translate(" + (o[0] + dx) + "px," + (o[1] + dy) + "px)" }, { transform: "translate(" + (o[0] - dx) + "px," + (o[1] - dy) + "px)" }, { transform: "translate(" + o[0] + "px," + o[1] + "px)" }], { duration: 360 });
    toast(p.axis === "h" ? "Drag it left or right" : "Drag it up or down");
  }
  function commit(pi, pos) {
    var moved = pos !== state.pos[pi];
    state.pos[pi] = pos; place(pi, pos);
    if (!moved) return;
    sfx.drop(); buzz(8);
    boardEl.classList.remove("bump"); void boardEl.offsetWidth; boardEl.classList.add("bump");
    state.moves++; state.hist.push(puz.panes[pi].color);
    updateMoves(true);
    if (mode === "daily") save(GKEY, state);
    if (mode === "level") {
      if (tipShown) { tipShown = null; $("rule").classList.remove("coaching"); setRule("Level " + puz.level + ": slide the glass to copy the picture."); }
      if (hintPi === pi) clearHint(); updateStarLine();
    }
    var img = E.render(puz, state.pos);
    showNewMix(img);
    if (E.diffCount(img, puz.target) === 0) win();
    else if (mode === "tutorial") setTimeout(coachTutorial, 250);
  }
  function updateMoves(bounce) {
    var m = $("moves"); m.textContent = state.moves;
    if (bounce) { m.classList.remove("bounce"); void m.offsetWidth; m.classList.add("bounce"); }
  }

  // ---------- contextual mixing hint ----------
  var chipT;
  function showNewMix(img) {
    var seen = prefs.mixSeen || [], found = null;
    img.forEach(function (m) { if (MIXNAME[m] && seen.indexOf(m) < 0 && !found) found = m; });
    if (!found) return;
    seen.push(found); prefs.mixSeen = seen; save("ps2:prefs", prefs);
    var chip = $("mixChip"), parts = bitsOf(found);
    chip.innerHTML = parts.map(function (k) { return "<i style='background:" + HEX[k] + "'></i>"; }).join(" + ") + " = <i style='background:" + maskColor(found) + "'></i> <span>" + parts.map(function (k) { return NAME[k]; }).join(" + ") + " make " + MIXNAME[found].toLowerCase() + "</span>";
    chip.hidden = false; clearTimeout(chipT); chipT = setTimeout(function () { chip.hidden = true; }, 3200);
  }

  // ---------- tutorial coach ----------
  var handEl = null, handAnim = null;
  function coachAt(pi, text) {
    var p = puz.panes[pi], o = offset(p, state.pos[pi]), hc = p.cells[gripAt[pi]] || gripCell(p);
    var x = PAD + o[0] + hc[1] * STEP + CELL / 2, y = PAD + o[1] + hc[0] * STEP;
    $("rule").textContent = text; $("rule").classList.add("coaching");
    if (!handEl) { handEl = el("div", "hand", document.querySelector(".stage-wrap")); handEl.textContent = "👆"; }
    handEl.hidden = false;
    var dir = state.pos[pi] < puz.solution[pi] ? 1 : -1, dist = STEP * Math.abs(puz.solution[pi] - state.pos[pi]);
    handEl.style.left = (x - 14) + "px"; handEl.style.top = (y + CELL / 2 - 6) + "px";
    if (handAnim) handAnim.cancel();
    var to = p.axis === "h" ? "translate(" + dir * dist + "px,0)" : "translate(0," + dir * dist + "px)";
    handAnim = handEl.animate([{ transform: "translate(0,0)", opacity: 0 }, { transform: "translate(0,0)", opacity: 1, offset: 0.15 }, { transform: to, opacity: 1, offset: 0.75 }, { transform: to, opacity: 0 }], { duration: 1600, iterations: Infinity, easing: "ease-in-out" });
  }
  function hideCoach(all) { $("rule").classList.remove("coaching"); if (handEl) handEl.hidden = true; if (handAnim) handAnim.cancel(); if (all) handAnim = null; }
  function coachTutorial() {
    if (mode !== "tutorial" || state.status !== "playing") return;
    if (state.pos[0] !== 1) coachAt(0, state.pos[0] < 1 ? "Drag the blue glass one step right →" : "Oops, one step back ←");
    else if (state.pos[1] !== 1) coachAt(1, state.pos[1] > 1 ? "Now drag the pink glass up ↑ and watch the colours mix" : "One step down ↓");
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
  function openEnd() {
    var d = $("dlgEnd");
    if (mode === "tutorial") {
      $("endMedal").textContent = "🎉"; $("endTitle").textContent = "You've got it!";
      $("endSub").innerHTML = "Cyan + magenta made <b style='color:" + maskColor(3) + "'>blue</b>. That's the whole game: copy the picture, in as few moves as you can.";
      $("endShare").hidden = true; $("endStats").innerHTML = ""; $("countdown").textContent = "";
      $("btnShare").textContent = "Play today's puzzle"; $("btnToLevels").hidden = true; d.showModal(); return;
    }
    $("btnToLevels").hidden = false;
    var par = parOf(puz), over = state.moves - par;
    $("endMedal").textContent = over <= 0 ? "⭐" : over === 1 ? "🎉" : "👏";
    $("endTitle").textContent = over <= 0 ? "Perfect! Solved in par" : "Solved in " + state.moves + " moves";
    $("endSub").textContent = over <= 0 ? "Every pane went straight to its spot." : "Par was " + par + ". Tomorrow's picture is waiting.";
    $("endShare").hidden = false; $("endShare").textContent = shareText();
    $("btnShare").textContent = "Share result";
    $("endStats").innerHTML = practice ? "<div class='dist small'>Practice puzzles don't change your stats.</div>" : statsHTML(Math.min(3, over));
    tickCountdown(); d.showModal();
  }
  function statsHTML(hl) {
    var parPct = stats.played ? Math.round(stats.dist[0] / stats.played * 100) : 0, max = Math.max.apply(null, stats.dist.concat([1]));
    var h = [["Played", stats.played], ["Streak", currentStreak()], ["Best", stats.best], ["In par", parPct + "%"]].map(function (x) { return "<div><div class='num'>" + x[1] + "</div><div class='lab'>" + x[0] + "</div></div>"; }).join("");
    var labels = ["Par ⭐", "+1", "+2", "+3"];
    return h + "<div class='dist'>" + stats.dist.map(function (v, i) { return "<div class='bar" + (hl === i ? " me" : "") + "'><span>" + labels[i] + "</span><b style='width:" + Math.max(8, Math.round(v / max * 100)) + "%'>" + v + "</b></div>"; }).join("") + "</div>";
  }
  function tickCountdown() {
    var now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
    var s = Math.floor((mid - now) / 1000);
    $("countdown").textContent = "Next picture in " + Math.floor(s / 3600) + "h " + String(Math.floor(s % 3600 / 60)).padStart(2, "0") + "m";
  }
  function copyText(t) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t);
    return new Promise(function (res, rej) { var ta = document.createElement("textarea"); ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy") ? res() : rej(); } catch (e) { rej(e); } document.body.removeChild(ta); });
  }
  function onShareBtn() {
    if (mode === "tutorial") { prefs.tutDone = true; save("ps2:prefs", prefs); $("dlgEnd").close(); startDaily(); return; }
    var t = shareText();
    if (window.matchMedia && matchMedia("(pointer: coarse)").matches && navigator.share) { navigator.share({ text: t }).catch(function () {}); return; }
    copyText(t).then(function () { toast("Copied! Paste it anywhere"); }, function () { toast("Couldn't copy. Select the text above."); });
  }
  function toast(msg) { var t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 1700); }

  // ---------- levels: stars, hints, win, milestones, map ----------
  function starsFor(moves, hinted) { var par = parOf(puz), st = moves <= par ? 3 : moves <= par + 2 ? 2 : 1; return hinted ? Math.min(2, st) : st; }
  function misplaced() { return puz.panes.filter(function (p, i) { return state.pos[i] !== puz.solution[i]; }).length; }
  var STAR = '<svg viewBox="0 0 24 24"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';
  function starsHTML(k, cls) { var h = ""; for (var i = 0; i < 3; i++) h += "<i class='st" + (i < k ? " on" : "") + (cls ? " " + cls : "") + "' style='--i:" + i + "'>" + STAR + "</i>"; return h; }
  function updateStarLine() {
    if (mode !== "level") return;
    var k = starsFor(state.moves + misplaced(), state.hinted);
    $("starLine").innerHTML = starsHTML(k) + "<span>" + (k === 3 ? "3 stars if every move counts" : k + (k === 1 ? " star" : " stars") + " still possible") + "</span>";
  }
  function updateHint() { $("hintCount").textContent = prog.hints; $("btnHint").classList.toggle("empty", prog.hints <= 0); }
  var hintPi = null, ghostEl = null;
  function clearHint() { hintPi = null; if (ghostEl) { ghostEl.remove(); ghostEl = null; } paneEls.forEach(function (e) { e.classList.remove("hinted"); }); }
  function useHint() {
    if (mode !== "level" || locked) return;
    if (hintPi !== null) return;
    if (prog.hints <= 0) { toast("No hints left. Earn them at milestones and with 3-star levels"); return; }
    var cand = puz.panes.map(function (p, i) { return i; }).filter(function (i) { return !puz.panes[i].locked && state.pos[i] !== puz.solution[i]; });
    if (!cand.length) return;
    var pi = cand[0], p = puz.panes[pi];
    prog.hints--; lvSave(); updateHint();
    state.hinted = true; hintPi = pi; updateStarLine();
    ghostEl = el("div", "ghost", boardEl);
    var o = offset(p, puz.solution[pi]);
    p.cells.forEach(function (c) { var g = el("div", "gc", ghostEl); g.style.left = PAD + o[0] + c[1] * STEP + "px"; g.style.top = PAD + o[1] + c[0] * STEP + "px"; g.style.borderColor = HEX[p.color]; });
    paneEls[pi].classList.add("hinted"); paneEls[pi].style.zIndex = ++zTop;
    tipShown = "hint"; var r = $("rule"); r.textContent = "💡 Move the glowing glass to the dotted spot"; r.classList.add("coaching");
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
  function openLevelEnd(st, gained) {
    var par = parOf(puz);
    $("lvStars").innerHTML = starsHTML(st, "pop");
    $("lvTitle").textContent = st === 3 ? "Perfect! Level " + puz.level : "Level " + puz.level + " complete";
    $("lvSub").textContent = state.moves + " moves · par " + par + (state.hinted ? " · hint used" : "") + (gained.length ? " · +1 hint 💡" : "");
    $("btnNext").textContent = "Next level " + (puz.level + 1) + " ▶";
    $("dlgLevel").showModal();
  }
  function badgeSVG(N, ri) {
    var rim = ["#C98B4B", "#AEB7C4", "#E2B22C", "#8E6CF0"][Math.max(0, Math.min(3, Math.floor(ri / 3)))];
    return '<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="56" fill="' + rim + '"/><circle cx="60" cy="60" r="47" fill="#FFFDF8"/>' +
      '<g style="isolation:isolate"><circle cx="50" cy="50" r="19" fill="' + HEX.C + '" style="mix-blend-mode:multiply"/><circle cx="70" cy="50" r="19" fill="' + HEX.M + '" style="mix-blend-mode:multiply"/><circle cx="60" cy="67" r="19" fill="' + HEX.Y + '" style="mix-blend-mode:multiply"/></g>' +
      '<rect x="30" y="88" width="60" height="22" rx="11" fill="#2B2840"/><text x="60" y="104" text-anchor="middle" font-size="14" font-weight="800" fill="#fff" font-family="system-ui,sans-serif">L' + N + '</text></svg>';
  }
  function mileShareText(N, rank) {
    var lines = ["PaneSlide Levels 🏅", rank + " · level " + N, "⭐ " + totalStars() + " stars so far"];
    if (prog.perf > 1) lines.push("✨ " + prog.perf + " perfect levels in a row");
    lines.push(SITE); return lines.join("\n");
  }
  function openMilestone(N, gained) {
    var ri = rankIndex(N), rank = ri >= 0 ? RANKS[ri][1] : "Glass Spark", newRank = ri >= 0 && RANKS[ri][0] === N;
    $("mileBadge").innerHTML = badgeSVG(N, ri);
    $("mileKicker").textContent = newRank ? "New rank unlocked" : "Milestone · level " + N;
    $("mileTitle").textContent = newRank ? rank : "Level " + N + " cleared!";
    var next = RANKS.filter(function (r) { return r[0] > N; })[0];
    $("mileSub").textContent = (newRank ? "You cleared level " + N + "." : "Rank: " + rank + ".") + (gained.indexOf("milestone") >= 0 ? " +1 hint 💡" : "") + (next ? " Next rank at level " + next[0] + "." : "");
    var h = [["Stars", totalStars() + "/" + (3 * (prog.unlocked - 1))], ["Perfect run", prog.perf], ["Best run", prog.bestPerf], ["Hints", prog.hints]];
    $("mileStats").innerHTML = h.map(function (x) { return "<div><div class='num'>" + x[1] + "</div><div class='lab'>" + x[0] + "</div></div>"; }).join("");
    $("mileShare").textContent = mileShareText(N, rank);
    $("dlgMile").showModal(); confetti();
  }
  function renderMap() {
    var path = $("mapPath"); path.innerHTML = "";
    var last = Math.ceil(Math.max(prog.unlocked + 8, 20) / 20) * 20, cur = null;
    for (var N = 1; N <= last; N++) {
      if ((N - 1) % 20 === 0) {
        var ch = chapterOf(N), got = 0; for (var k = N; k < N + 20; k++) got += prog.stars[k] || 0;
        var hd = el("div", "chap", path); hd.style.background = ch.frame;
        hd.innerHTML = "<span class='ci'>" + ch.icon + "</span><div><b>Chapter " + ch.index + " · " + ch.name + "</b><small>Levels " + N + "–" + (N + 19) + " · ⭐ " + got + "/60</small></div>";
      }
      var x = Math.round(Math.sin(N * 0.75) * 90);
      if ((N - 1) % 20 !== 0) { var dt = el("div", "dot", path); dt.style.transform = "translateX(" + Math.round(Math.sin((N - 0.5) * 0.75) * 90) + "px)"; }
      var st = N < prog.unlocked ? "done" : N === prog.unlocked ? "current" : "locked";
      var b = el("button", "node " + st + (isMilestone(N) ? " mile" : "") + (E.isChallenge(N) ? " chal" : ""), path);
      b.style.marginLeft = (2 * x) + "px";
      b.innerHTML = "<span class='nb'>" + (st === "locked" ? LOCK_SVG : N) + "</span>" + (E.isChallenge(N) ? "<span class='tag'>🏆</span>" : isMilestone(N) ? "<span class='tag'>🏅</span>" : "") + (st === "done" ? "<span class='ns'>" + starsHTML(prog.stars[N] || 0) + "</span>" : "");
      b.setAttribute("aria-label", "Level " + N + (st === "locked" ? ", locked" : st === "done" ? ", " + (prog.stars[N] || 0) + " stars" : ", next"));
      if (st === "locked") b.disabled = true;
      else (function (L) { b.addEventListener("click", function () { startLevel(L); }); })(N);
      if (st === "current") cur = b;
    }
    var ri = rankIndex(prog.unlocked - 1);
    $("mapStars").textContent = totalStars(); $("mapRank").textContent = ri >= 0 ? RANKS[ri][1] : "New"; $("mapHints").textContent = prog.hints;
    $("btnPlayNext").textContent = "Play level " + prog.unlocked + " ▶";
    if (cur) setTimeout(function () { var r = cur.getBoundingClientRect(); window.scrollTo(0, Math.max(0, window.scrollY + r.top - window.innerHeight * 0.55)); }, 30);
  }
  function openMap() {
    hideCoach(true); clearHint(); mode = "map"; locked = true;
    applyTheme(chapterOf(prog.unlocked)); $("meta").textContent = "Levels · chapter " + chapterOf(prog.unlocked).index;
    showView("map"); renderMap();
  }

  function confetti() {
    var cv = $("confetti"), c = cv.getContext("2d"); cv.width = innerWidth; cv.height = innerHeight;
    var cols = [HEX.C, HEX.M, HEX.Y, maskColor(3), maskColor(5), maskColor(6)], parts = [], r = boardEl.getBoundingClientRect();
    for (var i = 0; i < 110; i++) parts.push({ x: r.left + r.width / 2, y: r.top + r.height / 2, vx: (Math.random() - .5) * 14, vy: -Math.random() * 13 - 4, s: 7 + Math.random() * 8, a: Math.random() * 6, va: (Math.random() - .5) * .3, c: cols[i % cols.length] });
    var t0 = performance.now();
    (function frame(t) {
      var k = t - t0; c.clearRect(0, 0, cv.width, cv.height);
      parts.forEach(function (p) { p.vy += .38; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va; c.save(); c.globalAlpha = Math.max(0, 1 - k / 2000) * .9; c.translate(p.x, p.y); c.rotate(p.a); c.fillStyle = p.c; c.beginPath(); c.roundRect ? c.roundRect(-p.s / 2, -p.s / 2, p.s, p.s, 2) : c.rect(-p.s / 2, -p.s / 2, p.s, p.s); c.fill(); c.restore(); });
      if (k < 2000) requestAnimationFrame(frame); else c.clearRect(0, 0, cv.width, cv.height);
    })(t0);
  }

  // ---------- wiring ----------
  function wire() {
    var b = $("board");
    b.addEventListener("pointerdown", onDown); b.addEventListener("pointermove", onMove);
    b.addEventListener("pointerup", onUp); b.addEventListener("pointercancel", onUp);
    document.querySelectorAll("dialog [data-close]").forEach(function (x) { x.addEventListener("click", function () { x.closest("dialog").close(); }); });
    document.querySelectorAll("dialog").forEach(function (d) { d.addEventListener("click", function (e) { if (e.target === d) d.close(); }); });
    $("dlgEnd").addEventListener("close", function () { if (mode === "tutorial" && state.status === "won") { prefs.tutDone = true; save("ps2:prefs", prefs); startDaily(); } });
    $("btnHelp").addEventListener("click", function () {
      $("mixList").innerHTML = [3, 6, 5, 7].map(function (m) { return "<span>" + bitsOf(m).map(function (k) { return "<i style='background:" + HEX[k] + "'></i>"; }).join("+") + "=<i style='background:" + maskColor(m) + "'></i> " + MIXNAME[m] + "</span>"; }).join("");
      $("dlgHelp").showModal();
    });
    $("btnReplayTut").addEventListener("click", function () { $("dlgHelp").close(); startTutorial(); });
    $("btnStats").addEventListener("click", function () { $("statsBody").innerHTML = statsHTML(-1); $("dlgStats").showModal(); });
    $("btnSettings").addEventListener("click", function () { $("optSound").checked = !!prefs.sound; $("optPatterns").checked = !!prefs.patterns; $("dlgSettings").showModal(); });
    $("optSound").addEventListener("change", function () { prefs.sound = this.checked; save("ps2:prefs", prefs); if (prefs.sound) sfx.drop(); });
    $("optPatterns").addEventListener("change", function () { prefs.patterns = this.checked; save("ps2:prefs", prefs); document.body.classList.toggle("patterns", prefs.patterns); });
    $("btnShare").addEventListener("click", onShareBtn);
    $("tabDaily").addEventListener("click", function () { if (mode !== "daily") startDaily(); });
    $("tabLevels").addEventListener("click", function () { openMap(); });
    $("btnPlayNext").addEventListener("click", function () { startLevel(prog.unlocked); });
    $("btnToMap").addEventListener("click", openMap);
    $("btnHint").addEventListener("click", useHint);
    $("btnToLevels").addEventListener("click", function () { $("dlgEnd").close(); openMap(); });
    $("btnNext").addEventListener("click", function () { $("dlgLevel").close(); startLevel(puz.level + 1); });
    $("btnReplay").addEventListener("click", function () { $("dlgLevel").close(); startLevel(puz.level); });
    $("btnMap2").addEventListener("click", function () { $("dlgLevel").close(); openMap(); });
    $("btnMileNext").addEventListener("click", function () { $("dlgMile").close(); startLevel(puz.level + 1); });
    $("btnMileShare").addEventListener("click", function () {
      var t = $("mileShare").textContent;
      if (window.matchMedia && matchMedia("(pointer: coarse)").matches && navigator.share) { navigator.share({ text: t }).catch(function () {}); return; }
      copyText(t).then(function () { toast("Copied! Paste it anywhere"); }, function () { toast("Couldn't copy. Select the text above."); });
    });
    $("btnSkip").addEventListener("click", function () { prefs.tutDone = true; save("ps2:prefs", prefs); hideCoach(true); startDaily(); });
    var rz; window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(function () { if (mode === "map") return; clearHint(); build(); if (mode === "tutorial") coachTutorial(); }, 150); });
  }

  wire();
  var qLevel = parseInt(qs.get("level"), 10);
  if (!prefs.tutDone && !practice && qs.get("tutorial") !== "0") startTutorial();
  else if (qLevel >= 1 && (qLevel <= prog.unlocked || TEST)) startLevel(qLevel);
  else if (qs.get("mode") === "levels" || qLevel) openMap();
  else startDaily();

  if (TEST) window.PS = {
    get puzzle() { return puz; }, get state() { return state; }, get mode() { return mode; }, shareText: shareText,
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
