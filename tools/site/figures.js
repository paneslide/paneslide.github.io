// The guide and page illustrations: original SVG diagrams drawn with board-svg.js.
// render(id) returns a <figure> block. Every diagram follows the real game rules.
const S = require("./board-svg.js");
const P = (c, r, col, w, h, axis, x) => Object.assign({ c, r, col, w, h, axis }, x || {});
const G = (c, r, col, w, h, axis) => P(c, r, col, w, h, axis, { ghost: 1 });
function panel(svg, label) { return `<div>${svg}${label ? `<small>${label}</small>` : ""}</div>`; }
function row(...items) { return `<div class="s-figrow">${items.join("")}</div>`; }
function fig(body, cap) { return `<figure class="s-fig">${body}${cap ? `<figcaption>${cap}</figcaption>` : ""}</figure>`; }
const B = (o) => S.board(Object.assign({ size: 220 }, o));

const FIGS = {
  "hero-mix": () => fig(row(
    panel(B({ n: 3, size: 240, arrows: false, alt: "A 3 by 3 board: a cyan bar across the middle row crosses a magenta bar and a yellow bar that run down two columns, making blue and green where they overlap", panes: [P("C", 1, 0, 3, 1, "h"), P("M", 0, 1, 1, 3, "v"), P("Y", 1, 2, 1, 2, "v")] }), "The board"),
    panel(S.target([".M.", "CBG", ".MY"], { size: 160, alt: "The matching target picture: magenta, cyan, blue, green, magenta and yellow cells" }), "The target picture")),
    "Glass panes slide on rails. Where they overlap, the colours mix: cyan + magenta makes blue, cyan + yellow makes green."),

  "glide-edge": () => fig(row(
    panel(B({ n: 4, alt: "A yellow pane that moves up and down glides from the top to the bottom edge", panes: [P("Y", 0, 1, 1, 2, "v"), G("Y", 2, 1, 1, 2, "v")], moves: [[[0, 1], [2, 1]]] }), "Free run: to the edge"),
    panel(B({ n: 4, alt: "A cyan pane gliding right stops just before a magenta pane on the same kind of rail", panes: [P("C", 1, 0, 1, 1, "h"), P("M", 1, 3, 1, 1, "h"), G("C", 1, 2, 1, 1, "h")], moves: [[[1, 0], [1, 2]]] }), "Stops before same-rail glass"),
    panel(B({ n: 4, alt: "A yellow pane gliding right stops just before a grey stone pillar", walls: [[2, 3]], panes: [P("Y", 2, 0, 1, 1, "h"), G("Y", 2, 2, 1, 1, "h")], moves: [[[2, 0], [2, 2]]] }), "Stops before a pillar")),
    "A swipe sends glass as far as it can go along its rail. Dashed outlines show where each pane stops."),

  "stick": () => fig(row(
    panel(B({ n: 4, alt: "A cyan pane glides right towards a magenta pane on a crossing rail", panes: [P("M", 0, 2, 1, 2, "v"), P("C", 1, 0, 1, 1, "h"), G("C", 1, 2, 1, 1, "h")], moves: [[[1, 0], [1, 2]]] }), "1. Swipe cyan right"),
    panel(B({ n: 4, alt: "The cyan pane has stopped on top of the magenta pane, making a blue cell", panes: [P("M", 0, 2, 1, 2, "v"), P("C", 1, 2, 1, 1, "h")] }), "2. It sticks on the new colour: blue"),
    panel(B({ n: 4, alt: "Swiping the cyan pane left from on top of the magenta pane, it slides off and glides to the left edge", panes: [P("M", 0, 2, 1, 2, "v"), P("C", 1, 2, 1, 1, "h"), G("C", 1, 0, 1, 1, "h")], moves: [[[1, 2], [1, 0]]] }), "3. Sliding off never sticks")),
    "Glass stops the moment it slides onto glass it wasn't already overlapping, and shows the mixed colour."),

  "three-examples": () => fig(row(
    panel(B({ n: 4, alt: "Free run: a vertical magenta pane glides down an empty column to the bottom edge", panes: [P("M", 0, 0, 1, 1, "v"), G("M", 3, 0, 1, 1, "v")], moves: [[[0, 0], [3, 0]]] }), "Free run"),
    panel(B({ n: 4, alt: "Bump: a cyan pane slides right and stops next to a yellow pane on the same kind of rail", panes: [P("C", 2, 0, 1, 1, "h"), P("Y", 2, 3, 1, 1, "h"), G("C", 2, 2, 1, 1, "h")], moves: [[[2, 0], [2, 2]]] }), "Bump"),
    panel(B({ n: 4, alt: "Stick: a yellow pane slides right and stops on top of a vertical cyan pane, making green", panes: [P("C", 0, 2, 1, 3, "v"), P("Y", 1, 0, 1, 1, "h"), G("Y", 1, 2, 1, 1, "h")], moves: [[[1, 0], [1, 2]]] }), "Stick")),
    "The three ways a swipe usually ends."),

  "plan-target": () => fig(row(
    panel(S.target(["....", "....", ".CCC", "...."], { size: 160, alt: "A target picture with three cyan cells at the right of the third row" }), "Target: three cyan cells in row 3"),
    panel(B({ n: 4, alt: "A cyan bar three cells long in the third row; its only matching position is one cell to the right", panes: [P("C", 2, 0, 3, 1, "h"), G("C", 2, 1, 3, 1, "h")], moves: [[[2, 1], [2, 3]]] }), "The ↔ bar can only end one place")),
    "A pane can only finish on its own rail, so the picture usually pins down its final spot."),

  "order": () => fig(row(
    panel(B({ n: 4, alt: "Step 1: the magenta bar in row 3 glides right to the edge", panes: [P("M", 2, 0, 2, 1, "h"), P("Y", 0, 2, 1, 1, "v"), G("M", 2, 2, 2, 1, "h")], moves: [[[2, 1], [2, 3]]] }), "1. Magenta first"),
    panel(B({ n: 4, alt: "Step 2: the yellow pane glides down and sticks on the magenta bar", panes: [P("M", 2, 2, 2, 1, "h"), P("Y", 0, 2, 1, 1, "v"), G("Y", 2, 2, 1, 1, "v")], moves: [[[0, 2], [2, 2]]] }), "2. Yellow sticks on it"),
    panel(S.target(["....", "....", "..RM", "...."], { size: 150, alt: "The target picture: a red cell and a magenta cell in row 3" }), "Target")),
    "Swipe yellow first and it would glide to the bottom edge. The magenta bar has to be in place to stop it."),

  "mix-both": () => fig(row(
    panel(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 200" width="220" height="200" role="img" aria-label="Additive mixing: red, green and blue light overlap to make yellow, cyan, magenta and white in the middle"><rect width="220" height="200" rx="18" fill="#1E1438"/><g style="isolation:isolate"><circle cx="85" cy="80" r="52" fill="#FF0000" style="mix-blend-mode:screen"/><circle cx="135" cy="80" r="52" fill="#00FF00" style="mix-blend-mode:screen"/><circle cx="110" cy="122" r="52" fill="#0000FF" style="mix-blend-mode:screen"/></g></svg>`, "Light adds up (RGB): overlaps get brighter"),
    panel(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 200" width="220" height="200" role="img" aria-label="Subtractive mixing: cyan, magenta and yellow filters overlap to make blue, green, red and black in the middle"><rect width="220" height="200" rx="18" fill="#FFFFFF" stroke="#D9CCF7" stroke-width="2"/><g style="isolation:isolate"><circle cx="85" cy="80" r="52" fill="#00FFFF" style="mix-blend-mode:multiply"/><circle cx="135" cy="80" r="52" fill="#FF00FF" style="mix-blend-mode:multiply"/><circle cx="110" cy="122" r="52" fill="#FFFF00" style="mix-blend-mode:multiply"/></g></svg>`, "Filters take away (CMY): overlaps get darker")),
    "Additive and subtractive mixing go in opposite directions. PaneSlide's glass works like filters."),

  "mix-chart": () => fig(`<div class="s-figrow" style="flex-direction:column;align-items:center;gap:6px">${[
    [[1, "cyan"], "+", [2, "magenta"], "=", [3, "blue"]],
    [[1, "cyan"], "+", [4, "yellow"], "=", [5, "green"]],
    [[2, "magenta"], "+", [4, "yellow"], "=", [6, "red"]],
    [[1, "cyan"], "+", [2, "magenta"], "+", [4, "yellow"], "=", [7, "black"]]
  ].map(l => S.swatches(l, { alt: l.filter(x => typeof x !== "string").map(x => x[1]).join(l.length > 5 ? ", " : " and ").replace(/, (\w+)$/, " makes $1").replace(/ and (\w+)$/, " makes $1") })).join("")}</div>`,
    "The four mixes. A mixed cell always needs one pane of each colour in it."),

  "read-steps": () => fig(row(
    panel(S.target(["CB..", ".M..", ".RYY", "...."], { size: 160, alt: "A target picture with cyan, blue, magenta, red and yellow cells" }), "Target"),
    panel(B({ n: 4, alt: "The solved board: a cyan bar in row 1, a magenta bar down column 2 and a yellow bar in row 3", panes: [P("C", 0, 0, 2, 1, "h"), P("M", 0, 1, 1, 3, "v"), P("Y", 2, 1, 3, 1, "h")] }), "The answer")),
    "Blue needs cyan + magenta and red needs magenta + yellow, so the ↕ magenta bar must run through both. The rest follows."),

  "locked-stick": () => fig(row(
    panel(B({ n: 4, alt: "A locked magenta pane in the third column. A cyan pane glides right and sticks on it", panes: [P("M", 1, 2, 1, 2, "v", { locked: 1 }), P("C", 1, 0, 1, 1, "h"), G("C", 1, 2, 1, 1, "h")], moves: [[[1, 0], [1, 2]]] }), "Crossing glass sticks on it"),
    panel(B({ n: 4, alt: "A yellow pane in the same column as the locked pane glides up and stops just below it", panes: [P("M", 0, 2, 1, 2, "v", { locked: 1 }), P("Y", 3, 2, 1, 1, "v"), G("Y", 2, 2, 1, 1, "v")], moves: [[[3, 2], [2, 2]]] }), "Same-rail glass stops before it")),
    "Locked glass never moves, so it's a stopper you can rely on."),

  "duo": () => fig(row(
    panel(S.target(["CB..", ".M..", "CB..", "...."], { size: 160, alt: "A two-colour target: cyan, blue and magenta cells only" }), "Only cyan, magenta and blue"),
    panel(B({ n: 4, alt: "The answer: two cyan bars of two cells each cross one long magenta bar", panes: [P("C", 0, 0, 2, 1, "h"), P("M", 0, 1, 1, 3, "v"), P("C", 2, 0, 2, 1, "h")] }), "Two cyan bars, one magenta")),
    "Cells containing cyan: 4 (2 cyan + 2 blue). That's exactly two cyan bars of two."),

  "pillar": () => fig(B({ n: 4, size: 240, alt: "A stone pillar in the middle of the board. A cyan pane gliding right stops before it, and a yellow pane gliding up stops below it", walls: [[1, 2]], panes: [P("C", 1, 0, 1, 1, "h"), G("C", 1, 1, 1, 1, "h"), P("Y", 3, 2, 1, 1, "v"), G("Y", 2, 2, 1, 1, "v")], moves: [[[1, 0], [1, 1]], [[3, 2], [2, 2]]] }),
    "A pillar stops every pane, from any direction, like a piece of the board's edge."),

  "gems": () => fig(B({ n: 4, size: 240, alt: "Two gems in the third row. A cyan pane glides across them to the right edge, collecting both", gems: [[2, 1], [2, 2]], panes: [P("C", 2, 0, 1, 1, "h"), G("C", 2, 3, 1, 1, "h")], moves: [[[2, 0], [2, 3]]] }),
    "Any glass that passes over a gem collects it. Gems lie along the shortest route."),

  "ice": () => fig(row(
    panel(B({ n: 4, alt: "Normal cell: a cyan pane gliding right sticks on a magenta pane", panes: [P("M", 0, 2, 1, 3, "v"), P("C", 1, 0, 1, 1, "h"), G("C", 1, 2, 1, 1, "h")], moves: [[[1, 0], [1, 2]]] }), "Normal cell: sticks"),
    panel(B({ n: 4, alt: "Ice cell: the same swipe glides across the magenta pane on ice to the right edge", ice: [[1, 2]], panes: [P("M", 0, 2, 1, 3, "v"), P("C", 1, 0, 1, 1, "h"), G("C", 1, 3, 1, 1, "h")], moves: [[[1, 0], [1, 3]]] }), "On ice: keeps gliding")),
    "Overlaps on ice don't count, so the crossing on ice no longer stops the cyan pane."),

  "sand": () => fig(row(
    panel(B({ n: 4, alt: "A cyan pane glides right and stops on a sand cell", sand: [[1, 2]], panes: [P("C", 1, 0, 1, 1, "h"), G("C", 1, 2, 1, 1, "h")], moves: [[[1, 0], [1, 2]]] }), "1st swipe: stops on sand"),
    panel(B({ n: 4, alt: "Swiping right again, the pane slides off the sand to the edge", sand: [[1, 2]], panes: [P("C", 1, 2, 1, 1, "h"), G("C", 1, 3, 1, 1, "h")], moves: [[[1, 2], [1, 3]]] }), "2nd swipe: slides off")),
    "Glass stops when it slides onto more sand. Sliding off sand never stops it."),

  "oneway": () => fig(row(
    panel(B({ n: 4, alt: "Wrong order: the one-way cyan pane glides right to the edge because nothing stops it", panes: [P("C", 1, 0, 1, 1, "h", { one: 1 }), P("M", 2, 2, 1, 2, "v"), G("C", 1, 3, 1, 1, "h")], moves: [[[1, 0], [1, 3]]], stops: [] }), "Too early: it overshoots"),
    panel(B({ n: 4, alt: "Right order: with the magenta pane moved up first, the one-way cyan pane sticks on it", panes: [P("C", 1, 0, 1, 1, "h", { one: 1 }), P("M", 0, 2, 1, 2, "v"), G("C", 1, 2, 1, 1, "h")], moves: [[[1, 0], [1, 2]]] }), "Stopper first, then swipe")),
    "One-way glass can't come back, so its stopper must be ready before you swipe it."),

  "frost": () => fig(row(
    panel(B({ n: 4, alt: "A frosted bar with its colour hidden, and a cyan pane", panes: [P("Y", 0, 0, 2, 1, "h", { frost: 1 }), P("C", 1, 3, 1, 2, "v")] }), "The bar is frosted"),
    panel(S.target(["..YG", "...C", "....", "...."], { size: 150, alt: "The target picture shows a yellow cell and a green cell" }), "Target")),
    "The picture needs yellow (yellow and green cells) but no visible pane is yellow. So the frosted bar must be yellow."),

  "mystery": () => fig(row(
    panel(S.target(["C??.", "?M?.", ".?Y?", ".???"], { size: 140, alt: "A mystery picture at the start, with many cells hidden behind question marks" }), "At the start"),
    panel(S.target(["CB?.", "?M..", ".RY?", ".?.."], { size: 140, alt: "The mystery picture after a few swipes, with fewer question marks" }), "After a few swipes"),
    panel(S.target(["CB..", ".M..", ".RYY", "...."], { size: 140, alt: "The full picture, revealed" }), "All revealed")),
    "Each swipe reveals more of the picture. By your second-to-last perfect swipe, you can see it all."),

  "lost": (small) => fig(B({ n: 3, size: small ? 180 : 220, alt: "An empty board with dashed outlines where the glass should be", panes: [G("C", 1, 0, 3, 1, "h"), G("M", 0, 1, 1, 3, "v")] }),
    "This page has slid right off the board.")
};
function render(id, opt) { const f = FIGS[id]; if (!f) throw new Error("Unknown figure: " + id); return f(opt); }
module.exports = { render, ids: Object.keys(FIGS) };
