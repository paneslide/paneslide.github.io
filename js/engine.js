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
    var colors = ["C", "M", "Y"];
    for (var i = colors.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = colors[i]; colors[i] = colors[j]; colors[j] = t; }
    while (colors.length < cfg.panes) colors.push(colors[Math.floor(rng() * 3)]);
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
    // Keep rails readable: sort panes h-first then v, stable by colour order.
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

  function pickStart(puz, rng) {
    for (var t = 0; t < 2000; t++) {
      var pos = puz.panes.map(function (p) { return Math.floor(rng() * (p.max + 1)); });
      var moved = pos.filter(function (v, i) { return v !== puz.solution[i]; }).length;
      if (moved === puz.panes.length && diffCount(render(puz, pos), puz.target) >= 4 && allVisible(puz, pos)) return pos; // every pane starts out of place, so par = number of panes
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

  var api = {
    BIT: BIT, MASK_NAME: MASK_NAME, EPOCH: EPOCH, SHAPES: SHAPES, DAYS: DAYS,
    generate: generate, tutorial: tutorial, allVisible: allVisible, solve: solve, render: render, rowFeedback: rowFeedback,
    paneCells: paneCells, diffCount: diffCount, puzzleNumber: puzzleNumber, addDays: addDays, parseDate: parseDate
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PaneEngine = api;
})(typeof window !== "undefined" ? window : this);
