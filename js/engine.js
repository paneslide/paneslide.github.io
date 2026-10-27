/* PaneSlide engine: puzzle model, colour mixing, seeded generator and solver.
   Works in the browser (window.PaneEngine) and in Node (require). Original code. */
(function (root) {
  "use strict";

  // Colour masks: cyan=1, magenta=2, yellow=4. Overlaps OR together.
  // 0 white, 1 cyan, 2 magenta, 3 blue (C+M), 4 yellow, 5 green (C+Y), 6 red (M+Y), 7 black.
  var BIT = { C: 1, M: 2, Y: 4 };
  var MASK_NAME = ["white", "cyan", "magenta", "blue", "yellow", "green", "red", "black"];
  var EPOCH = "2026-10-27"; // puzzle #1

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  var SHAPES = {
    I2: [[0,0],[0,1]], I3: [[0,0],[0,1],[0,2]], I4: [[0,0],[0,1],[0,2],[0,3]],
    L3: [[0,0],[1,0],[1,1]], O4: [[0,0],[0,1],[1,0],[1,1]], L4: [[0,0],[1,0],[2,0],[2,1]],
    T4: [[0,0],[0,1],[0,2],[1,1]], S4: [[0,1],[0,2],[1,0],[1,1]], P5: [[0,0],[0,1],[1,0],[1,1],[2,0]],
    U5: [[0,0],[0,2],[1,0],[1,1],[1,2]], X5: [[0,1],[1,0],[1,1],[1,2],[2,1]], L5: [[0,0],[1,0],[2,0],[3,0],[3,1]]
  };

  // Day-of-week difficulty (0 = Sunday).
  var DAYS = {
    1: { n: 4, panes: 3, shapes: ["I2","I3","L3","O4"], fits: 1, label: "Monday" },
    2: { n: 5, panes: 4, fits: 2, shapes: ["I2","I3","I4","L3","O4"], label: "Tuesday" },
    3: { n: 5, panes: 4, fits: 2, shapes: ["I3","L3","L4","T4","O4"], label: "Wednesday" },
    4: { n: 5, panes: 4, shapes: ["I2","I3","L3","O4","T4"], fits: 3, label: "Thursday" },
    5: { n: 5, panes: 4, shapes: ["L4","T4","S4","O4","P5","I4"], fits: 3, label: "Friday" },
    6: { n: 6, panes: 4, shapes: ["L4","T4","O4","P5","U5","I4"], fits: 4, label: "Saturday" },
    0: { n: 6, panes: 4, shapes: ["P5","U5","X5","L5","T4","S4"], fits: 4, label: "Sunday" }
  };

  function norm(cells) {
    var mr = Infinity, mc = Infinity;
    cells.forEach(function (x) { mr = Math.min(mr, x[0]); mc = Math.min(mc, x[1]); });
    return cells.map(function (x) { return [x[0] - mr, x[1] - mc]; })
      .sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
  }
  function rotate(cells) { return norm(cells.map(function (x) { return [x[1], -x[0]]; })); }
  function dims(cells) {
    var h = 0, w = 0;
    cells.forEach(function (x) { h = Math.max(h, x[0] + 1); w = Math.max(w, x[1] + 1); });
    return [h, w];
  }

  function parseDate(s) { var p = s.split("-").map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); }
  function fmtDate(d) { return d.toISOString().slice(0, 10); }
  function addDays(s, k) { var d = parseDate(s); d.setUTCDate(d.getUTCDate() + k); return fmtDate(d); }
  function puzzleNumber(s) { return Math.round((parseDate(s) - parseDate(EPOCH)) / 86400000) + 1; }

  // Cells covered by pane p at position pos.
  function paneCells(p, pos) {
    if (p.axis === "b") { var pr = Math.floor(pos / (p.mc + 1)), pc = pos % (p.mc + 1); return p.cells.map(function (x) { return [x[0] + pr, x[1] + pc]; }); }
    return p.cells.map(function (x) {
      return p.axis === "h" ? [x[0] + p.base, x[1] + pos] : [x[0] + pos, x[1] + p.base];
    });
  }

  function render(puz, pos) {
    var n = puz.n, img = new Array(n * n).fill(0);
    puz.panes.forEach(function (p, i) {
      paneCells(p, pos[i]).forEach(function (c) { img[c[0] * n + c[1]] |= BIT[p.color]; });
    });
    return img;
  }
  function diffCount(a, b) { var d = 0; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d; }
  function sameImg(a, b) { return diffCount(a, b) === 0; }

  // Per-row feedback after a Shine: "full" (row matches), "one" (one cell off), "none" (2+ off).
  function rowFeedback(puz, pos) {
    var img = render(puz, pos), n = puz.n, out = [];
    for (var r = 0; r < n; r++) {
      var d = 0;
      for (var c = 0; c < n; c++) if (img[r * n + c] !== puz.target[r * n + c]) d++;
      out.push(d === 0 ? "full" : d === 1 ? "one" : "none");
    }
    return out;
  }

  // Enumerate every knob combination.
  function forEachCombo(puz, fn) {
    var k = puz.panes.length, pos = new Array(k).fill(0);
    (function rec(i) {
      if (i === k) { fn(pos.slice()); return; }
      if (puz.panes[i].locked) { pos[i] = puz.solution[i]; rec(i + 1); return; }
      for (var v = 0; v <= puz.panes[i].max; v++) { pos[i] = v; rec(i + 1); }
    })(0);
  }

  // Solver: count exact solutions, near misses, and compute difficulty.
  function solve(puz) {
    var total = 0, exact = [], near = 0;
    forEachCombo(puz, function (pos) {
      total++;
      var d = diffCount(render(puz, pos), puz.target);
      if (d === 0) exact.push(pos); else if (d <= 2) near++;
    });
    var mixed = puz.target.filter(function (m) { return (m & (m - 1)) !== 0; }).length;
    var difficulty = Math.round((Math.log2(total) + 0.6 * near + 0.25 * mixed) * 10) / 10;
    return { total: total, solutions: exact, near: near, mixed: mixed, difficulty: difficulty };
  }

  function makeCandidate(cfg, rng) {
    var n = cfg.n;
    var colors = (cfg.colors || ["C", "M", "Y"]).slice();
    for (var i = colors.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = colors[i]; colors[i] = colors[j]; colors[j] = t; }
    if (cfg.dup) colors = colors.slice(0, Math.max(1, Math.min(colors.length, cfg.panes - cfg.dup))); // repeated colours make panes ambiguous
    while (colors.length < cfg.panes) colors.push(colors[Math.floor(rng() * colors.length)]);
    var panes = [];
    for (var k = 0; k < cfg.panes; k++) {
      var cells = SHAPES[cfg.shapes[Math.floor(rng() * cfg.shapes.length)]];
      var rot = Math.floor(rng() * 4);
      for (var r = 0; r < rot; r++) cells = rotate(cells);
      cells = norm(cells);
      var dm = dims(cells), h = dm[0], w = dm[1];
      var axis = rng() < 0.5 ? "h" : "v";
      var along = axis === "h" ? w : h, across = axis === "h" ? h : w;
      var max = n - along, baseMax = n - across;
      if (max < 1 || baseMax < 0) return null;
      if (n >= 5 && max < 2) return null; // rails need at least 3 stops on bigger boards
      panes.push({ color: colors[k], cells: cells, axis: axis, base: Math.floor(rng() * (baseMax + 1)), max: max, h: h, w: w });
    }
    if (cfg.free) { // one pane slides both ways
      var fp = panes[Math.floor(rng() * panes.length)], mr = n - fp.h, mc = n - fp.w;
      fp.axis = "b"; fp.base = 0; fp.mc = mc; fp.max = (mr + 1) * (mc + 1) - 1;
    }
    if (cfg.locked) { // one pane is fixed in place
      var lk = panes.filter(function (p) { return p.axis !== "b"; });
      if (!lk.length) return null;
      lk[Math.floor(rng() * lk.length)].locked = true;
    }
    var solution = panes.map(function (p) { return Math.floor(rng() * (p.max + 1)); });
    return { n: n, panes: panes, solution: solution };
  }

  function validate(puz, minFits) {
    var n = puz.n;
    puz.target = render(puz, puz.solution);
    var s = solve(puz);
    if (s.solutions.length !== 1) return { ok: false, why: "not unique (" + s.solutions.length + ")" };
    var minMixed = n <= 4 ? 3 : n === 5 ? 4 : 5;
    if (s.mixed < minMixed) return { ok: false, why: "too few mixed cells" };
    if (s.total < 8) return { ok: false, why: "too few combinations" };
    // Every pane must matter: removing it changes the picture.
    for (var i = 0; i < puz.panes.length; i++) {
      var sub = { n: n, panes: puz.panes.filter(function (_, j) { return j !== i; }) };
      var img = render(sub, puz.solution.filter(function (_, j) { return j !== i; }));
      if (sameImg(img, puz.target)) return { ok: false, why: "hidden pane" };
    }
    // No give-aways: on bigger boards some panes must "fit" the target in more than one spot,
    // so you have to reason about mixing instead of just reading positions off the picture.
    var fits = 1;
    puz.panes.forEach(function (p) {
      var k = 0;
      for (var v = 0; v <= p.max; v++) if (paneCells(p, v).every(function (c) { return puz.target[c[0] * n + c[1]] & BIT[p.color]; })) k++;
      fits *= k;
    });
    if (fits < minFits) return { ok: false, why: "solvable by just looking" };
    s.fits = fits;
    var white = puz.target.filter(function (m) { return m === 0; }).length;
    if (white < Math.ceil(n * n * 0.15)) return { ok: false, why: "too crowded" };
    return { ok: true, stats: s };
  }

  // Every pane shows at least one cell that no other pane covers, so a new player can see and grab it.
  function allVisible(puz, pos) {
    var cover = {};
    puz.panes.forEach(function (p, i) { paneCells(p, pos[i]).forEach(function (c) { var k = c[0] * puz.n + c[1]; cover[k] = (cover[k] || 0) + 1; }); });
    return puz.panes.every(function (p, i) { return paneCells(p, pos[i]).some(function (c) { return cover[c[0] * puz.n + c[1]] === 1; }); });
  }

  function movable(puz) { return puz.panes.filter(function (p) { return !p.locked; }).length; } // = par
  function pickStart(puz, rng, minDiff) {
    if (minDiff == null) minDiff = 4;
    for (var t = 0; t < 2000; t++) {
      var pos = puz.panes.map(function (p, i) { return p.locked ? puz.solution[i] : Math.floor(rng() * (p.max + 1)); });
      var moved = pos.filter(function (v, i) { return v !== puz.solution[i]; }).length;
      if (moved === movable(puz) && diffCount(render(puz, pos), puz.target) >= minDiff && allVisible(puz, pos)) return pos; // every pane starts out of place, so par = number of panes
    }
    return null; // no fair start for this layout; generate() tries another
  }

  function generate(dateStr) {
    var cfg = DAYS[parseDate(dateStr).getUTCDay()];
    var rng = mulberry32(hashStr("paneslide:v1:" + dateStr));
    for (var attempt = 0; attempt < 6000; attempt++) {
      var c = makeCandidate(cfg, rng);
      if (!c) continue;
      // After 3000 tries, relax the no-give-away rule one notch so every day still gets a puzzle.
      var v = validate(c, attempt < 3000 ? cfg.fits : Math.max(1, cfg.fits - 1));
      if (!v.ok) continue;
      c.start = pickStart(c, rng);
      if (!c.start) continue;
      if (!grabOrder(c, c.start)) continue; // par must be reachable (see grabOrder)
      c.date = dateStr;
      c.number = puzzleNumber(dateStr);
      c.day = cfg.label;
      c.stats = { total: v.stats.total, near: v.stats.near, mixed: v.stats.mixed, difficulty: v.stats.difficulty, fits: v.stats.fits, attempts: attempt + 1 };
      return c;
    }
    throw new Error("Could not generate puzzle for " + dateStr);
  }

  // Fixed 3x3 first-time tutorial: drag cyan right, then magenta up; they overlap into blue.
  function tutorial() {
    var puz = {
      n: 3, tutorial: true, number: 0, day: "Tutorial", date: "tutorial",
      panes: [
        { color: "C", cells: [[0, 0], [1, 0]], axis: "h", base: 0, max: 2, h: 2, w: 1 },
        { color: "M", cells: [[0, 0], [0, 1]], axis: "v", base: 1, max: 2, h: 1, w: 2 }
      ],
      solution: [1, 1], start: [0, 2]
    };
    puz.target = render(puz, puz.solution);
    return puz;
  }


  // ================= Levels mode =================
  // Difficulty curve v2 (27 Oct 2026). Feedback on v1: the first 40 levels felt the same and too
  // easy, because every pane fitted the picture in only one spot until about level 42.
  // v2 ramps up early and then levels off:
  //   ramp(N) = 10 * (1 - e^(-(N-3)/50)): about 1.3 at level 10, 2.9 at level 20, 4.2 at level 30,
  //   6.1 at level 50 and 8.5 at level 100, then flattening near 9.5-9.8 from level 150 to 200.
  // A sawtooth inside every 10-level block (breather, build-up, spike, breather, build-up,
  // challenge) makes the change in difficulty something you feel.
  // The main lever is ambiguity. "fits" = how many ways the panes could sit where every cell they
  // cover already has their colour in the target (plausible spots, right or wrong). "decoys" = how
  // many panes have more than one plausible spot. Higher values mean more wrong-but-plausible
  // moves, so you have to reason about the colour mixing.
  // These are hard requirements: generation never quietly lowers them. If a seed fails, it tries
  // more seeds, and only as a very last resort a slightly easier tier.
  // Shape "flavours" rotate from level to level so neighbouring levels look different.
  var FLAVOURS = { mix: ["I2", "I3", "L3", "O4"], bars: ["I2", "I3", "I4"], corners: ["L3", "L4", "T4"], blocks: ["O4", "S4", "P5", "T4"], big: ["P5", "U5", "X5", "L5", "T4"], tiny: ["I2", "L3"] };
  var FLAVOUR_UNLOCK = [["tiny", "mix"], ["mix", "bars", "corners"], ["mix", "bars", "corners", "blocks"], ["bars", "corners", "blocks", "big", "mix"]];
  // Twists: each is introduced on a fixed level and then mixed in now and then.
  var TWISTS = { locked: 12, duo: 18, free: 33 };
  var SAW = [1.0, 0.55, 0.9, 1.0, 1.1, 1.3, 0.75, 1.05, 1.15, 1.45]; // by N % 10
  function isBreather(N) { return N > 10 && (N % 10 === 1 || N % 10 === 6); }
  function isChallenge(N) { return N >= 9 && N % 10 === 9; }
  var CEIL = 10;
  function curveS(N) { return N <= 3 ? 0 : CEIL * (1 - Math.exp(-(N - 3) / 50)); }
  function effOf(N) { var m = N >= 11 || N % 10 === 9 ? SAW[N % 10] : 1; return Math.min(11, curveS(N) * m); }
  function tierFor(e, h) {
    if (e < 1.0) return { n: 4, panes: 3, dup: 1, fl: 0, fits: 2, decoys: 1, mixed: 2, diff: 3, total: 8 };
    if (e < 2.0) return { n: 4, panes: 3, dup: 1, fl: 0, fits: 3, decoys: 2, mixed: 2, diff: 3, total: 8 };
    if (e < 3.8) return { n: 4, panes: 4, dup: (h >>> 6) % 2 ? 2 : 1, fl: 1, fits: 4, decoys: 2, mixed: 3, diff: 4, total: 8 };
    var panes = e < 6.5 ? 4 : e < 8.5 ? ((h >>> 3) % 2 ? 5 : 4) : 5;
    var dup = panes === 4 ? (e >= 5.5 || (e >= 4.5 && (h >>> 6) % 2) ? 2 : 1) : 2;
    return { n: 5, panes: panes, dup: dup, fl: e < 5 ? 1 : e < 7.5 ? 2 : 3,
      fits: Math.min(panes === 4 ? (dup === 2 ? 8 : 4) : 12, Math.round(e * 1.2)), decoys: Math.min(panes - 2, 2 + Math.floor((e - 4) / 3)),
      mixed: Math.min(6, 4 + Math.floor((e - 4) / 2.5)), diff: 5, total: 8 };
  }
  function levelConfig(N, eOverride, rot) {
    var br = isBreather(N), ch = isChallenge(N), h = hashStr("paneslide:lvcfg2:" + N);
    var e = eOverride != null ? eOverride : effOf(N);
    var base = { d: N, e: Math.round(e * 100) / 100, s: Math.round(e * 100) / 100, breather: br, challenge: ch };
    function mk(o) { for (var k in base) if (!(k in o)) o[k] = base[k]; return o; }
    if (N <= 3 && eOverride == null) return mk({ n: 3, panes: 2, shapes: N === 3 ? ["I2", "L3"] : ["I2"], flavour: "tiny", fits: 1, decoys: 0, mixed: 1, total: 4, diff: 2 });
    var t = tierFor(e, h), fl = FLAVOUR_UNLOCK[t.fl], flavour = fl[(h >>> 4) % fl.length];
    if (rot) flavour = fl[((h >>> 4) + rot) % fl.length];
    var cfg = mk({ n: t.n, panes: t.panes, dup: t.dup, shapes: FLAVOURS[flavour], flavour: flavour, fits: t.fits, decoys: t.decoys, mixed: flavour === "bars" ? Math.max(2, t.mixed - 1) : t.mixed, total: t.total, diff: t.diff, trap: e >= 2 });
    if (!br) { // twists: always on their intro level, then roughly 1 level in 4
      var twist = N === TWISTS.locked ? "locked" : N === TWISTS.duo ? "duo" : N === TWISTS.free ? "free" : null;
      if (!twist && !ch) {
        var opts = []; for (var tw in TWISTS) if (N > TWISTS[tw]) opts.push(tw);
        if (opts.length && (h >>> 12) % 4 === 0) twist = opts[(h >>> 16) % opts.length];
      }
      applyTwist(cfg, twist, h);
    }
    return cfg;
  }
  function applyTwist(cfg, twist, h) {
    if (twist === "locked") { cfg.locked = true; cfg.panes += 1; cfg.dup = (cfg.dup || 0) + 1; }
    if (twist === "duo") { var pairs = [["C", "M"], ["C", "Y"], ["M", "Y"]]; cfg.colors = pairs[(h >>> 20) % 3]; cfg.mixed = Math.max(2, cfg.mixed - 2); }
    if (twist === "free") { cfg.free = true; }
    cfg.twist = twist || null;
  }
  function fitLists(puz) {
    var n = puz.n;
    return puz.panes.map(function (p, i) {
      if (p.locked) return [puz.solution[i]];
      var out = [];
      for (var v = 0; v <= p.max; v++) if (paneCells(p, v).every(function (c) { return puz.target[c[0] * n + c[1]] & BIT[p.color]; })) out.push(v);
      return out;
    });
  }
  // Ambiguity metrics for a level: fits (plausible spot combinations), decoys (panes with more
  // than one plausible spot) and traps (panes that start on a plausible but wrong spot).
  function ambiguity(puz) {
    var fl = fitLists(puz), fits = 1, decoys = 0, traps = 0;
    fl.forEach(function (l, i) { fits *= l.length; if (!puz.panes[i].locked && l.length > 1) decoys++; if (puz.start && !puz.panes[i].locked && puz.start[i] !== puz.solution[i] && l.indexOf(puz.start[i]) >= 0) traps++; });
    return { fits: fits, decoys: decoys, traps: traps };
  }
  // Fast check. A pane can only sit where every cell it covers already has its colour in the
  // target (glass never removes colour), so the solver only needs to try those "fitting" spots.
  // That gives exactly the same answer as brute force, much faster.
  function validateLevel(puz, cfg) {
    var n = puz.n;
    puz.target = render(puz, puz.solution);
    var mixed = 0, white = 0;
    puz.target.forEach(function (m) { if (m === 0) white++; else if (m & (m - 1)) mixed++; });
    if (mixed < cfg.mixed) return false;
    if (white < Math.ceil(n * n * 0.15)) return false;
    var total = 1; puz.panes.forEach(function (p) { total *= p.max + 1; });
    if (total < cfg.total) return false;
    var fitList = fitLists(puz);
    var fits = 1, decoys = 0;
    fitList.forEach(function (l, i) { fits *= l.length; if (!puz.panes[i].locked && l.length > 1) decoys++; });
    if (fits < cfg.fits || decoys < (cfg.decoys || 0)) return false;
    for (var i = 0; i < puz.panes.length; i++) {
      var sub = { n: n, panes: puz.panes.filter(function (_, j) { return j !== i; }) };
      if (sameImg(render(sub, puz.solution.filter(function (_, j) { return j !== i; })), puz.target)) return false;
    }
    var count = 0, pos = new Array(puz.panes.length);
    (function rec(i) {
      if (count > 1) return;
      if (i === puz.panes.length) { if (sameImg(render(puz, pos), puz.target)) count++; return; }
      for (var k = 0; k < fitList[i].length; k++) { pos[i] = fitList[i][k]; rec(i + 1); }
    })(0);
    if (count !== 1) return false;
    puz.fits = fits; puz.fitList = fitList;
    return true;
  }
  // Par must be reachable: there has to be an order of one slide per pane in which every pane can
  // still be grabbed when its turn comes. A pane can be hidden under a same-direction pane that was
  // moved more recently (the board picks the top one), so the order sometimes matters.
  function grabOrder(puz, start) {
    var todo = [], P = start.slice(), z = puz.panes.map(function () { return 0; });
    puz.panes.forEach(function (p, i) { if (!p.locked && start[i] !== puz.solution[i]) todo.push(i); });
    function at(c) { var o = []; puz.panes.forEach(function (p, i) { if (paneCells(p, P[i]).some(function (q) { return q[0] === c[0] && q[1] === c[1]; })) o.push(i); }); return o; }
    function grabbable(i) {
      var p = puz.panes[i], wants = p.axis === "b" ? ["h", "v"] : [p.axis];
      return paneCells(p, P[i]).some(function (c) {
        var cands = at(c).filter(function (q) { return !puz.panes[q].locked; }).sort(function (a, b) { return z[a] - z[b] || a - b; });
        return wants.some(function (w) { var m = cands.filter(function (q) { return puz.panes[q].axis === w || puz.panes[q].axis === "b"; }); return (m.length ? m : cands).slice(-1)[0] === i; });
      });
    }
    var top = 0;
    return (function rec(left) {
      if (!left.length) return [];
      for (var k = 0; k < left.length; k++) {
        var i = left[k]; if (!grabbable(i)) continue;
        var old = P[i], oz = z[i]; P[i] = puz.solution[i]; z[i] = ++top;
        var r = rec(left.filter(function (_, j) { return j !== k; }));
        P[i] = old; z[i] = oz; top--;
        if (r) return [i].concat(r);
      }
      return null;
    })(todo);
  }
  // Start position: every movable pane out of place, every pane grabbable, and from the middle of
  // the curve at least one pane starts on a wrong spot that looks right (a trap).
  function pickLevelStart(puz, rng, cfg) {
    var fl = puz.fitList;
    for (var t = 0; t < 1500; t++) {
      var pos = puz.panes.map(function (p, i) {
        if (p.locked) return puz.solution[i];
        var wrongFits = fl[i].filter(function (v) { return v !== puz.solution[i]; });
        if (cfg.trap && wrongFits.length && rng() < 0.5) return wrongFits[Math.floor(rng() * wrongFits.length)];
        return Math.floor(rng() * (p.max + 1));
      });
      if (!pos.every(function (v, i) { return puz.panes[i].locked || v !== puz.solution[i]; })) continue;
      if (cfg.trap && !pos.some(function (v, i) { return !puz.panes[i].locked && fl[i].indexOf(v) >= 0; })) continue;
      if (diffCount(render(puz, pos), puz.target) >= cfg.diff && allVisible(puz, pos) && grabOrder(puz, pos)) return pos;
    }
    return null;
  }
  function buildLevel(N, cfg, seed, deadline, maxAttempts) {
    var rng = mulberry32(hashStr(seed));
    for (var attempt = 0; attempt < (maxAttempts || 6000); attempt++) {
      if (deadline && (attempt & 63) === 0 && Date.now() > deadline) return null;
      var c = makeCandidate(cfg, rng);
      if (!c) continue;
      if (cfg.panes >= 3 && c.panes.every(function (p) { return p.axis === c.panes[0].axis; })) continue; // mix directions
      if (cfg.colors && cfg.colors.some(function (k) { return !c.panes.some(function (p) { return p.color === k; }); })) continue;
      if (!validateLevel(c, cfg)) continue;
      c.start = pickLevelStart(c, rng, cfg);
      if (!c.start) continue;
      delete c.fitList;
      c.level = N; c.breather = cfg.breather; c.challenge = cfg.challenge; c.twist = cfg.twist || null; c.flavour = cfg.flavour; c.attempts = attempt + 1;
      return c;
    }
    return null;
  }
  // Level N is always the same puzzle (seeded). If a seed runs out of attempts it tries more
  // seeds at the same difficulty. Only after that does it step down a little, keeping the twist.
  function generateLevel(N, opts) {
    var deadline = opts && opts.ms ? Date.now() + opts.ms : 0;
    var cfg = levelConfig(N), lv = null;
    for (var s = 0; !lv && s < 4; s++) {
      lv = buildLevel(N, cfg, "paneslide:level:v2:" + N + (s ? ":s" + s : ""), deadline);
      if (deadline && Date.now() > deadline) break;
    }
    for (var k = 1; !lv && k < 14; k++) {
      var fb = levelConfig(N, Math.max(0.5, cfg.e - 0.6 * Math.floor(k / 2)), k);
      fb.breather = cfg.breather; fb.challenge = cfg.challenge;
      applyTwist(fb, null, 0); applyTwist(fb, cfg.twist, hashStr("paneslide:lvcfg2:" + N));
      lv = buildLevel(N, fb, "paneslide:level:v2:" + N + ":fb" + k, 0, 4000);
      if (lv && k > 1) lv.fallback = Math.floor(k / 2); else if (lv) lv.reshaped = true;
    }
    if (!lv) throw new Error("Could not generate level " + N);
    return lv;
  }
  // Compact storage for the precomputed level file.
  function packLevel(l) { return [l.n, l.panes.map(function (p) { var q = [p.color, p.cells, p.axis, p.base, p.max]; if (p.axis === "b") q.push(p.mc); if (p.locked) q[5] = q[5] == null ? -1 : q[5], q.push(1); return q; }), l.solution, l.start, (l.breather ? 1 : 0) | (l.challenge ? 2 : 0), l.twist || 0, l.flavour]; }
  function unpackLevel(a, N) {
    var puz = { n: a[0], level: N, solution: a[2], start: a[3], breather: !!(a[4] & 1), challenge: !!(a[4] & 2), twist: a[5] || null, flavour: a[6],
      panes: a[1].map(function (q) { var dm = dims(q[1]), p = { color: q[0], cells: q[1], axis: q[2], base: q[3], max: q[4], h: dm[0], w: dm[1] }; if (q[2] === "b") p.mc = q[5]; if (q[6] === 1) p.locked = true; return p; }) };
    puz.target = render(puz, puz.solution);
    return puz;
  }

  var api = {
    BIT: BIT, MASK_NAME: MASK_NAME, EPOCH: EPOCH, SHAPES: SHAPES, DAYS: DAYS,
    generate: generate, tutorial: tutorial, allVisible: allVisible, solve: solve, render: render, rowFeedback: rowFeedback,
    paneCells: paneCells, diffCount: diffCount, curveS: curveS, movable: movable, TWISTS: TWISTS, isChallenge: isChallenge, levelConfig: levelConfig, generateLevel: generateLevel,
    validateLevel: validateLevel, ambiguity: ambiguity, effOf: effOf, grabOrder: grabOrder, packLevel: packLevel, unpackLevel: unpackLevel, isBreather: isBreather, puzzleNumber: puzzleNumber, addDays: addDays, parseDate: parseDate
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PaneEngine = api;
})(typeof window !== "undefined" ? window : this);
