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

  function startDaily() {
    mode = "daily"; puz = E.generate(date); n = puz.n; GKEY = "ps2:game:" + date;
    state = load(GKEY, null);
    if (!state || !Array.isArray(state.pos) || state.pos.length !== puz.panes.length) state = { pos: puz.start.slice(), moves: 0, hist: [], status: "playing" };
    locked = state.status !== "playing";
    setRule(practice ? "Practice puzzle. Slide the glass to copy the picture." : "Slide the glass to copy the picture. Where glass overlaps, colours mix.");
    $("btnSkip").hidden = true; $("status").hidden = false;
    build();
    if (state.status === "won") { $("board").classList.add("won"); setTimeout(openEnd, 500); }
  }
  function startTutorial() {
    mode = "tutorial"; puz = E.tutorial(); n = puz.n; GKEY = null;
    state = { pos: puz.start.slice(), moves: 0, hist: [], status: "playing" }; locked = false;
    setRule("Quick tutorial: copy the little picture.");
    $("btnSkip").hidden = false; $("status").hidden = true;
    build(); setTimeout(coachTutorial, 350);
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
    var maxH = window.innerHeight - 380; // keep the whole game on one phone screen
    CELL = Math.max(40, Math.min(n <= 3 ? 84 : 76, Math.floor(avail / n), Math.floor((maxH - PAD * 2 - GAP * (n - 1)) / n)));
    GAP = CELL >= 56 ? 6 : 5; STEP = CELL + GAP;
    var r = document.documentElement.style;
    r.setProperty("--cell", CELL + "px"); r.setProperty("--gap", GAP + "px"); r.setProperty("--pad", PAD + "px");
  }
  function offset(p, pos) { return p.axis === "h" ? [pos * STEP, p.base * STEP] : [p.base * STEP, pos * STEP]; }
  function arrowSVG(axis) {
    return axis === "h"
      ? '<svg viewBox="0 0 24 24"><path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/></svg>';
  }

  function build() {
    measure();
    document.body.classList.toggle("patterns", !!prefs.patterns);
    $("meta").textContent = mode === "tutorial" ? "Tutorial" : (practice ? "Practice · " + date : "#" + puz.number + " · " + puz.day);
    $("par").textContent = puz.panes.length;
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
      pe.setAttribute("aria-label", NAME[p.color] + " glass, slides " + (p.axis === "h" ? "left and right" : "up and down") + ". Use arrow keys.");
      pe.style.setProperty("--pc", HEX[p.color]);
      p.cells.forEach(function (c) { var g = el("div", "g " + p.color, pe); g.style.left = c[1] * STEP + "px"; g.style.top = c[0] * STEP + "px"; });
      pe.addEventListener("keydown", function (e) { keyMove(e, pi); });
      paneEls.push(pe);
      var gr = el("div", "grip", boardEl); gr.innerHTML = arrowSVG(p.axis); gripEls.push(gr);
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
    if (p.axis === "h") { trackEl.style.left = PAD - 3 + "px"; trackEl.style.top = PAD + p.base * STEP - 3 + "px"; trackEl.style.width = full + 6 + "px"; trackEl.style.height = p.h * STEP - GAP + 6 + "px"; }
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
      var match = drag.cands.filter(function (pi) { return puz.panes[pi].axis === want; });
      drag.pi = (match.length ? match : drag.cands).slice(-1)[0];
      drag.start = state.pos[drag.pi]; drag.last = drag.start;
      paneEls[drag.pi].classList.add("dragging", "lifted"); gripEls[drag.pi].classList.add("dragging");
      paneEls[drag.pi].style.zIndex = ++zTop; showTrack(drag.pi, true); hideCoach(false);
    }
    var p = puz.panes[drag.pi], d = (p.axis === "h" ? dx : dy) / STEP;
    var f = Math.max(-0.25, Math.min(p.max + 0.25, drag.start + d));
    var o = offset(p, 0), fo = p.axis === "h" ? [f * STEP, o[1]] : [o[0], f * STEP];
    paneEls[drag.pi].style.transform = "translate(" + fo[0] + "px," + fo[1] + "px)";
    var hc = p.cells[gripAt[drag.pi]] || gripCell(p);
    gripEls[drag.pi].style.transform = "translate(" + (PAD + fo[0] + hc[1] * STEP) + "px," + (PAD + fo[1] + hc[0] * STEP) + "px)";
    var snap = Math.max(0, Math.min(p.max, Math.round(f)));
    if (snap !== drag.last) { drag.last = snap; sfx.step(); }
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag; drag = null;
    if (d.pi === null) { nudgeHint(d.cands[d.cands.length - 1]); return; }
    paneEls[d.pi].classList.remove("dragging", "lifted"); gripEls[d.pi].classList.remove("dragging"); showTrack(d.pi, false);
    commit(d.pi, d.last);
  }
  function keyMove(e, pi) {
    if (locked) return; var p = puz.panes[pi], k = e.key, v = state.pos[pi];
    if (p.axis === "h" && (k === "ArrowLeft" || k === "ArrowRight")) v += k === "ArrowRight" ? 1 : -1;
    else if (p.axis === "v" && (k === "ArrowUp" || k === "ArrowDown")) v += k === "ArrowDown" ? 1 : -1;
    else return;
    e.preventDefault(); paneEls[pi].style.zIndex = ++zTop; commit(pi, Math.max(0, Math.min(p.max, v)));
  }
  function nudgeHint(pi) { // a tap without a drag: wiggle the pane along its track
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
    if (mode === "daily") { save(GKEY, state); recordStats(); }
    setTimeout(function () { boardEl.classList.add("won"); sfx.win(); buzz([10, 40, 20]); confetti(); }, 280);
    setTimeout(openEnd, 1500);
  }
  function recordStats() {
    if (practice || state.recorded) return;
    var over = Math.min(3, state.moves - puz.panes.length);
    stats.played++; stats.dist[over]++;
    stats.streak = stats.lastWin === E.addDays(date, -1) ? stats.streak + 1 : 1;
    stats.lastWin = date; stats.best = Math.max(stats.best, stats.streak);
    state.recorded = true; save(GKEY, state); save("ps2:stats", stats);
  }
  function currentStreak() { return (stats.lastWin === today || stats.lastWin === E.addDays(today, -1)) ? stats.streak : 0; }
  function shareText() {
    var par = puz.panes.length, perfect = state.moves === par;
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
      $("btnShare").textContent = "Play today's puzzle"; d.showModal(); return;
    }
    var par = puz.panes.length, over = state.moves - par;
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
    $("btnSkip").addEventListener("click", function () { prefs.tutDone = true; save("ps2:prefs", prefs); hideCoach(true); startDaily(); });
    var rz; window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(function () { build(); if (mode === "tutorial") coachTutorial(); }, 150); });
  }

  wire();
  if (!prefs.tutDone && !practice && qs.get("tutorial") !== "0") startTutorial(); else startDaily();

  if (TEST) window.PS = {
    get puzzle() { return puz; }, get state() { return state; }, get mode() { return mode; }, shareText: shareText,
    grabPoint: function (pi) { // centre of a cell of pane pi that no other same-axis pane covers
      var p = puz.panes[pi], r = boardEl.getBoundingClientRect(), cells = E.paneCells(p, state.pos[pi]);
      var free = cells.filter(function (c) { return panesAt(c).every(function (q) { return q === pi || puz.panes[q].axis !== p.axis; }); });
      var c = (free[0] || cells[0]);
      return { x: r.left + PAD + c[1] * STEP + CELL / 2, y: r.top + PAD + c[0] * STEP + CELL / 2, step: STEP, axis: p.axis };
    }
  };
})();
