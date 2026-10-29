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
    if (dateStr >= GLIDE_FROM) return generateGlideDaily(dateStr);
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

  // Fixed 3x3 first-time tutorial (glide rules): swipe cyan right, it glides to the edge; swipe
  // magenta up, it sticks the moment it slides onto the cyan glass and they mix into blue.
  function tutorial() {
    var puz = {
      n: 3, tutorial: true, number: 0, day: "Tutorial", date: "tutorial", glide: true, par: 2,
      panes: [
        { color: "C", cells: [[0, 0], [1, 0]], axis: "h", base: 0, max: 2, h: 2, w: 1 },
        { color: "M", cells: [[0, 0], [0, 1]], axis: "v", base: 1, max: 2, h: 1, w: 2 }
      ],
      solution: [2, 1], start: [1, 2]
    };
    puz.target = render(puz, puz.solution);
    return puz;
  }


  // Classic dailies (before 30 Oct 2026):
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

  // ================= Glide rules (v3, 29 Oct 2026) =================
  // Playtests of v2 (3 players, levels 1-20+): "not a single level made me think". Reason: a pane
  // could be dragged to any spot with a live colour preview, so trying spots was free, and each
  // pane needed exactly one independent move, so order never mattered. v3 changes the rules:
  //  * A swipe makes glass GLIDE. It stops at the board edge, at glass that slides the same way
  //    (same-direction glass never overlaps), or the moment it slides onto more crossing glass
  //    (it "sticks" where colours start to mix). No free placement, no preview.
  //  * So stopping a pane in the middle needs another pane as a stopper first: order matters
  //    and the shortest solution (par) is found by a full search of every board state (BFS).
  //  * "Thinking" metric: a greedy player who always makes the move that makes the board look
  //    most like the picture (trying every tie) cannot finish in par. From level 6, every level
  //    except breathers is required to beat that greedy player.
  function gData(puz) {
    if (puz._g) return puz._g;
    var n = puz.n, P = puz.panes;
    var masks = P.map(function (p) { var out = []; for (var v = 0; v <= p.max; v++) { var lo = 0, hi = 0; paneCells(p, v).forEach(function (c) { var k = c[0] * n + c[1]; if (k < 30) lo |= 1 << k; else hi |= 1 << (k - 30); }); out.push([lo, hi]); } return out; });
    var col = P.map(function (a, i) { return P.map(function (b, j) { return i !== j && (a.axis === b.axis || a.axis === "b" || b.axis === "b"); }); });
    var g = { masks: masks, col: col };
    try { Object.defineProperty(puz, "_g", { value: g, enumerable: false, configurable: true, writable: true }); } catch (e) { puz._g = g; }
    return g;
  }
  function pc32(x) { x = x - ((x >>> 1) & 0x55555555); x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24; }
  function gHits(g, i, v, pos) { var m = g.masks[i][v]; for (var j = 0; j < pos.length; j++) { if (!g.col[i][j]) continue; var o = g.masks[j][pos[j]]; if ((m[0] & o[0]) || (m[1] & o[1])) return true; } return false; }
  function gOver(g, i, v, pos) { var m = g.masks[i][v], c = 0; for (var j = 0; j < pos.length; j++) { if (j === i || g.col[i][j]) continue; var o = g.masks[j][pos[j]]; c += pc32(m[0] & o[0]) + pc32(m[1] & o[1]); } return c; }
  function validState(puz, pos) { var g = gData(puz); for (var i = 0; i < pos.length; i++) if (gHits(g, i, pos[i], pos)) return false; return true; }
  // Where pane i ends up after a swipe in direction d (-1 = left/up, +1 = right/down).
  function glideTo(puz, pos, i, d) {
    var p = puz.panes[i]; if (p.locked || p.axis === "b") return pos[i];
    var g = gData(puz), v = pos[i], ov = gOver(g, i, v, pos);
    for (;;) {
      var w = v + d; if (w < 0 || w > p.max || gHits(g, i, w, pos)) break;
      v = w; var o = gOver(g, i, w, pos); if (o > ov) break; ov = o;
    }
    return v;
  }
  function glideMoves(puz, pos) {
    var out = [];
    puz.panes.forEach(function (p, i) { if (p.locked) return; [-1, 1].forEach(function (d) { var v = glideTo(puz, pos, i, d); if (v !== pos[i]) { var q = pos.slice(); q[i] = v; out.push({ pane: i, dir: d, to: v, pos: q }); } }); });
    return out;
  }
  // Distance (in swipes) from every board state to the solution, by breadth-first search on the
  // reversed move graph. States are numbered in mixed radix; invalid states (same-direction
  // overlap) get -2, states that can never reach the solution get -1.
  function gTable(puz) {
    if (puz._t) return puz._t;
    var P = puz.panes, k = P.length, mult = [], total = 1;
    for (var i = 0; i < k; i++) { mult.push(total); total *= P[i].locked ? 1 : P[i].max + 1; }
    function code(pos) { var c = 0; for (var i = 0; i < k; i++) if (!P[i].locked) c += pos[i] * mult[i]; return c; }
    function decode(c) { var pos = new Array(k); for (var i = 0; i < k; i++) { if (P[i].locked) { pos[i] = puz.solution[i]; continue; } var r = P[i].max + 1; pos[i] = c % r; c = Math.floor(c / r); } return pos; }
    var dist = new Int16Array(total), revHead = new Int32Array(total).fill(-1), revNext = [], revFrom = [];
    for (var c = 0; c < total; c++) {
      var pos = decode(c);
      if (!validState(puz, pos)) { dist[c] = -2; continue; }
      dist[c] = -1;
      glideMoves(puz, pos).forEach(function (m) { var b = code(m.pos); revFrom.push(c); revNext.push(revHead[b]); revHead[b] = revFrom.length - 1; });
    }
    var goal = code(puz.solution), q = [goal], t = { dist: dist, code: code, decode: decode, total: total, goal: goal };
    if (dist[goal] === -2) { t.bad = true; return t; }
    dist[goal] = 0;
    for (var h = 0; h < q.length; h++) { var b = q[h]; for (var e = revHead[b]; e >= 0; e = revNext[e]) { var a = revFrom[e]; if (dist[a] === -1) { dist[a] = dist[b] + 1; q.push(a); } } }
    try { Object.defineProperty(puz, "_t", { value: t, enumerable: false, configurable: true, writable: true }); } catch (e2) { puz._t = t; }
    return t;
  }
  function distOf(puz, pos) { var t = gTable(puz); return t.dist[t.code(pos)]; }
  // Best next swipe from pos (for hints), or null if solved / stuck.
  function nextMove(puz, pos) {
    var d = distOf(puz, pos); if (d <= 0) return null;
    var ms = glideMoves(puz, pos);
    for (var i = 0; i < ms.length; i++) if (distOf(puz, ms[i].pos) === d - 1) return ms[i];
    return null;
  }
  // The thinking metric: can a greedy player (always the move that leaves the fewest wrong
  // cells, trying every tie) still finish within par? true = greedy solves it = no thinking.
  function greedySolves(puz, start, par) {
    var memo = {};
    function rec(pos, left) {
      if (diffCount(render(puz, pos), puz.target) === 0) return true;
      if (!left) return false;
      var key = pos.join(",") + "|" + left; if (key in memo) return memo[key];
      var best = 1e9, cands = [];
      glideMoves(puz, pos).forEach(function (m) { var d = diffCount(render(puz, m.pos), puz.target); if (d < best) { best = d; cands = [m]; } else if (d === best) cands.push(m); });
      var ok = false; for (var i = 0; i < cands.length && !ok; i++) ok = rec(cands[i].pos, left - 1);
      memo[key] = ok; return ok;
    }
    return rec(start, par);
  }
  // Every valid state that shows the target picture (must be exactly one: the solution).
  function glideSolutions(puz, limit) {
    var n = puz.n, out = [], fl = puz.panes.map(function (p, i) {
      if (p.locked) return [puz.solution[i]];
      var l = []; for (var v = 0; v <= p.max; v++) if (paneCells(p, v).every(function (c) { return puz.target[c[0] * n + c[1]] & BIT[p.color]; })) l.push(v); return l;
    }), pos = new Array(puz.panes.length);
    (function rec(i) {
      if (out.length >= (limit || 1e9)) return;
      if (i === pos.length) { if (sameImg(render(puz, pos), puz.target) && validState(puz, pos)) out.push(pos.slice()); return; }
      for (var k = 0; k < fl[i].length; k++) { pos[i] = fl[i][k]; rec(i + 1); }
    })(0);
    return out;
  }
  // Shared generator: a random layout whose picture has exactly one valid answer, then a start
  // exactly `par` swipes away (and, if asked, one the greedy player cannot finish in par).
  function glideCandidate(cfg, rng) {
    var c = makeCandidate(cfg, rng);
    if (!c) return null;
    if (cfg.panes >= 3 && c.panes.every(function (p) { return p.axis === c.panes[0].axis; })) return null;
    if (cfg.colors && cfg.colors.some(function (k) { return !c.panes.some(function (p) { return p.color === k; }); })) return null;
    c.target = render(c, c.solution);
    var n = c.n, mixed = 0, white = 0;
    c.target.forEach(function (m) { if (m === 0) white++; else if (m & (m - 1)) mixed++; });
    if (mixed < cfg.mixed || white < Math.ceil(n * n * 0.15)) return null;
    if (!validState(c, c.solution)) return null;
    for (var i = 0; i < c.panes.length; i++) { // every pane matters
      var sub = { n: n, panes: c.panes.filter(function (_, j) { return j !== i; }) };
      if (sameImg(render(sub, c.solution.filter(function (_, j) { return j !== i; })), c.target)) return null;
    }
    if (cfg.inside && !c.panes.some(function (p, i) { return !p.locked && c.solution[i] > 0 && c.solution[i] < p.max; })) return null;
    if (glideSolutions(c, 2).length !== 1) return null;
    return c;
  }
  // Pick a start: distance in [lo, hi] (closest to want first), board visibly different, and the
  // greedy player must fail when cfg.greedy is set. Returns null if this layout has none.
  function glideStart(c, cfg, rng) {
    var t = gTable(c); if (t.bad) return null;
    var byD = {};
    for (var s = 0; s < t.total; s++) { var d = t.dist[s]; if (d >= cfg.lo && d <= cfg.hi) (byD[d] = byD[d] || []).push(s); }
    var ds = Object.keys(byD).map(Number).sort(function (a, b) { return Math.abs(a - cfg.par) - Math.abs(b - cfg.par) || b - a; });
    for (var k = 0; k < ds.length; k++) {
      var list = byD[ds[k]];
      for (var i = list.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var x = list[i]; list[i] = list[j]; list[j] = x; }
      var tries = 0;
      for (var q = 0; q < list.length && tries < 60; q++) {
        var pos = t.decode(list[q]);
        if (diffCount(render(c, pos), c.target) < (cfg.diff || 2)) continue;
        tries++;
        if (cfg.greedy === "solve" ? !greedySolves(c, pos, ds[k]) : cfg.greedy && greedySolves(c, pos, ds[k])) continue; // "solve": an easy one, the obvious moves work
        return { pos: pos, par: ds[k] };
      }
    }
    return null;
  }
  function buildGlide(cfg, seed, deadline, maxAttempts) {
    var rng = mulberry32(hashStr(seed));
    for (var attempt = 0; attempt < (maxAttempts || 3000); attempt++) {
      if (deadline && (attempt & 15) === 0 && Date.now() > deadline) return null;
      var c = glideCandidate(cfg, rng); if (!c) continue;
      var st = glideStart(c, cfg, rng); if (!st) continue;
      c.start = st.pos; c.par = st.par; c.glide = true; c.attempts = attempt + 1;
      return c;
    }
    return null;
  }

  // Daily puzzles switch to the glide rules from this date; earlier dates stay as they were.
  var GLIDE_FROM = "2026-10-30";
  var GLIDE_DAYS = { // by weekday, 0 = Sunday. Calm Monday, toughest at the weekend.
    1: { n: 4, panes: 3, dup: 1, shapes: ["I2", "I3", "L3"], par: 4, mixed: 2, greedy: "solve", label: "Monday" },
    2: { n: 4, panes: 3, dup: 1, shapes: ["I2", "I3", "L3", "O4"], par: 5, mixed: 2, greedy: false, label: "Tuesday" },
    3: { n: 5, panes: 4, dup: 1, shapes: ["I2", "I3", "L3", "O4"], par: 5, mixed: 3, greedy: false, label: "Wednesday" },
    4: { n: 5, panes: 4, dup: 1, shapes: ["I2", "I3", "L3", "O4", "T4"], par: 6, mixed: 3, greedy: false, label: "Thursday" },
    5: { n: 5, panes: 4, dup: 2, shapes: ["I2", "I3", "L3", "O4"], par: 6, mixed: 3, greedy: true, label: "Friday" },
    6: { n: 5, panes: 5, dup: 2, shapes: ["I2", "I3", "L3", "O4", "T4"], par: 7, mixed: 4, greedy: true, label: "Saturday" },
    0: { n: 5, panes: 5, dup: 2, shapes: ["I2", "I3", "L3", "L4", "O4"], par: 7, mixed: 4, greedy: true, label: "Sunday" }
  };
  function generateGlideDaily(dateStr) {
    var base = GLIDE_DAYS[parseDate(dateStr).getUTCDay()], c = null;
    for (var k = 0; k < 6 && !c; k++) { // step the target down one swipe per round if a seed is stubborn
      var cfg = {}; for (var x in base) cfg[x] = base[x];
      cfg.par = Math.max(3, base.par - Math.floor(k / 2)); cfg.lo = cfg.par; cfg.hi = cfg.par; cfg.diff = 3;
      c = buildGlide(cfg, "paneslide:v3:" + dateStr + (k ? ":" + k : ""), 0, 1500);
    }
    if (!c) throw new Error("Could not generate puzzle for " + dateStr);
    c.date = dateStr; c.number = puzzleNumber(dateStr); c.day = base.label;
    return c;
  }

  // ================= Levels mode (v4: gentle, rewarding) =================
  // Par (swipes) per level: 1, 2, 3 for the three lesson levels, then
  //   2.6 + 1.0 * ln(N - 2), capped at 7.6 (reached around level 150): 3 at level 4, 4 at 6-10,
  //   5 at 13-30, 6 at 40-90, 7 from about 100.
  // Inside every block of 10: breathers (x1, x6) are 1-2 swipes easier and must be solvable by the
  // obvious moves; x9 (challenge, trophy on the map) is about 1 harder.
  // Only "aha" levels (x4 and x9 from level 7, and x7 from level 40) must beat the greedy player;
  // x2 levels (from 12) are also "satisfying" ones the obvious moves solve; the rest are left as
  // they come (some tricky, many just satisfying).
  // Board grows with par: 3x3 -> 4x4 -> 5x5 (never bigger). Twists: locked glass (a fixed stopper)
  // from 12, two-colour levels from 18.
  var FLAVOURS = { mix: ["I2", "I3", "L3", "O4"], bars: ["I2", "I3"], corners: ["L3", "L4", "T4", "I2"], blocks: ["O4", "S4", "T4", "I2", "L3"], tiny: ["I2", "L3"] };
  var TWISTS = { locked: 12, duo: 18 };
  // v4 (gentler, for enjoyment): par 3 at level 4, about 5 by 15, 6 by 40, levelling off at
  // about 7-8 from level ~150. Breathers (levels ending 1 and 6) are easy on purpose; "aha"
  // levels (ending 4 and 9, plus 7 from level 40) are the only ones that must beat the greedy player.
  var SAWP = [0, -1.5, -0.5, 0, 0.5, 0, -1.5, -0.5, 0, 1]; // by N % 10, from level 11
  function isBreather(N) { return N > 10 && (N % 10 === 1 || N % 10 === 6); }
  function isChallenge(N) { return N >= 9 && N % 10 === 9; }
  function isAha(N) { var d = N % 10; return N >= 7 && (d === 4 || d === 9 || (N >= 40 && d === 7)); }
  function curveS(N) { return N <= 3 ? N : Math.min(7.6, 2.6 + 1.0 * Math.log(N - 2)); }
  function effOf(N) { if (N <= 3) return N; var t = curveS(N); if (N >= 11) t += SAWP[N % 10]; else if (N === 9) t += 0.5; return Math.max(3, Math.min(10, Math.round(t))); }
  function levelConfig(N) {
    var br = isBreather(N), ch = isChallenge(N), h = hashStr("paneslide:lvcfg3:" + N), par = effOf(N);
    var cfg = { d: N, par: par, lo: par, hi: par, breather: br, challenge: ch, greedy: (br || (N > 10 && N % 10 === 2)) ? "solve" : isAha(N) ? true : false, diff: N <= 3 ? 2 : 3 };
    if (N === 1) { cfg.n = 3; cfg.panes = 2; cfg.shapes = ["I2"]; cfg.mixed = 1; cfg.flavour = "tiny"; return cfg; }
    if (N <= 3) { cfg.n = N === 2 ? 3 : 4; cfg.panes = N === 2 ? 2 : 3; cfg.dup = N === 3 ? 1 : 0; cfg.shapes = ["I2", "L3"]; cfg.mixed = 1; cfg.flavour = "tiny"; cfg.inside = true; return cfg; }
    var fls = par <= 4 ? ["tiny", "mix"] : par <= 6 ? ["mix", "bars", "corners"] : ["mix", "bars", "corners", "blocks"];
    cfg.flavour = fls[(h >>> 4) % fls.length]; cfg.shapes = FLAVOURS[cfg.flavour];
    if (par <= 5) { cfg.n = 4; cfg.panes = par <= 4 ? 3 : 3 + ((h >>> 6) & 1); cfg.dup = 1; cfg.mixed = 2; }
    else if (par <= 7) { cfg.n = 5; cfg.panes = 4; cfg.dup = (h >>> 6) % 2 ? 2 : 1; cfg.mixed = 3; }
    else { cfg.n = 5; cfg.panes = par >= 10 ? 5 + ((h >>> 7) & 1) : 5; cfg.dup = 2; cfg.mixed = 4; }
    if (!br) {
      var twist = N === TWISTS.locked ? "locked" : N === TWISTS.duo ? "duo" : null;
      if (!twist && !ch) { var opts = []; for (var tw in TWISTS) if (N > TWISTS[tw]) opts.push(tw); if (opts.length && (h >>> 12) % 4 === 0) twist = opts[(h >>> 16) % opts.length]; }
      if (twist === "locked") { cfg.locked = true; cfg.panes += 1; cfg.dup = (cfg.dup || 0) + 1; }
      if (twist === "duo") { var pairs = [["C", "M"], ["C", "Y"], ["M", "Y"]]; cfg.colors = pairs[(h >>> 20) % 3]; cfg.mixed = Math.max(2, cfg.mixed - 1); }
      cfg.twist = twist || null;
    }
    return cfg;
  }
  // Level N is always the same puzzle (seeded, deterministic). If a seed is stubborn it tries more
  // seeds, then accepts par one swipe either side, then the next-smaller board size. Never
  // gives up the greedy rule except on the last-resort fallback (counted by the validator).
  function generateLevel(N, opts) {
    var deadline = opts && opts.ms ? Date.now() + opts.ms : 0, cfg = levelConfig(N), lv = null, seed = "paneslide:level:v4:" + N;
    for (var s = 0; !lv && s < 4; s++) { lv = buildGlide(cfg, seed + (s ? ":s" + s : ""), deadline, 2500); if (deadline && Date.now() > deadline) break; }
    if (!lv) { var c2 = {}; for (var x in cfg) c2[x] = cfg[x]; c2.lo = Math.max(1, cfg.par - 1); c2.hi = cfg.par + 1; c2.shapes = FLAVOURS.mix; if (cfg.n === 5 && cfg.par >= 7) c2.panes = Math.max(cfg.panes, 5); lv = buildGlide(c2, seed + ":w", 0, 5000); if (lv) lv.fallback = 1; }
    if (!lv) { var c3 = {}; for (var y in cfg) c3[y] = cfg[y]; c3.lo = 3; c3.hi = cfg.par; c3.greedy = false; c3.panes = Math.max(3, cfg.panes - 1); lv = buildGlide(c3, seed + ":f", 0, 6000); if (lv) lv.fallback = 2; }
    if (!lv) throw new Error("Could not generate level " + N);
    lv.level = N; lv.breather = cfg.breather; lv.challenge = cfg.challenge; lv.twist = cfg.twist || null; lv.flavour = cfg.flavour;
    return lv;
  }
  // Compact storage for the precomputed level file. Item 7 = par, item 8 = 1 for glide rules.
  function packLevel(l) { return [l.n, l.panes.map(function (p) { var q = [p.color, p.cells, p.axis, p.base, p.max]; if (p.axis === "b") q.push(p.mc); if (p.locked) q[5] = q[5] == null ? -1 : q[5], q.push(1); return q; }), l.solution, l.start, (l.breather ? 1 : 0) | (l.challenge ? 2 : 0), l.twist || 0, l.flavour, l.par || 0, l.glide ? 1 : 0]; }
  function unpackLevel(a, N) {
    var puz = { n: a[0], level: N, solution: a[2], start: a[3], breather: !!(a[4] & 1), challenge: !!(a[4] & 2), twist: a[5] || null, flavour: a[6],
      panes: a[1].map(function (q) { var dm = dims(q[1]), p = { color: q[0], cells: q[1], axis: q[2], base: q[3], max: q[4], h: dm[0], w: dm[1] }; if (q[2] === "b") p.mc = q[5]; if (q[6] === 1) p.locked = true; return p; }) };
    if (a[8]) { puz.glide = true; puz.par = a[7]; }
    puz.target = render(puz, puz.solution);
    return puz;
  }

  var api = {
    BIT: BIT, MASK_NAME: MASK_NAME, EPOCH: EPOCH, SHAPES: SHAPES, DAYS: DAYS,
    generate: generate, tutorial: tutorial, allVisible: allVisible, solve: solve, render: render, rowFeedback: rowFeedback,
    paneCells: paneCells, diffCount: diffCount, curveS: curveS, movable: movable, TWISTS: TWISTS, isChallenge: isChallenge, levelConfig: levelConfig, generateLevel: generateLevel,
    effOf: effOf, grabOrder: grabOrder, GLIDE_FROM: GLIDE_FROM, glideTo: glideTo, glideMoves: glideMoves, validState: validState, distOf: distOf, nextMove: nextMove,
    greedySolves: greedySolves, glideSolutions: glideSolutions, buildGlide: buildGlide, parOf: function (p) { return p.par || movable(p); }, packLevel: packLevel, unpackLevel: unpackLevel, isBreather: isBreather, isAha: isAha, puzzleNumber: puzzleNumber, addDays: addDays, parseDate: parseDate
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PaneEngine = api;
})(typeof window !== "undefined" ? window : this);
