# PaneSlide

A free daily puzzle. **Swipe the glass to copy the picture. Where glass overlaps, colours mix.**

- **Glide rules (v3, levels and dailies from 2026-10-30):** swipe a pane and it glides along its rail (↔ or ↕). It stops at the board edge, or just before glass that goes the same way, or it **sticks** the moment it slides onto new colour (more overlap with crossing glass). You can't place a pane wherever you like, so the order of your swipes matters and you have to plan.
- Cyan, magenta and yellow glass mix like real filters: C+M = blue, C+Y = green, M+Y = red, all three = black.
- You win the moment the board matches the picture. **Par** is the true shortest number of swipes (found by a full search). Undo is always there. Moves are not refunded, and you get a "Stuck! Undo" tip if a move makes the picture impossible.
- There is one new puzzle a day (#1 = 2026-10-27). Monday is the easiest and the weekend is the hardest. Every puzzle has exactly one solution. Dailies before 2026-10-30 keep the old drag rules, so a daily never changes on the day it is played.
- First-time players get a 20-second 3×3 tutorial. Players from before v3 see it once more for the new rules. Press "?" any time for help.
- The share result is spoiler-free: one coloured square per move.

Static site: no build step, no server, no accounts. To host it, publish this folder on GitHub Pages.

## Dark mode

- The board, target picture and colour swatches are painted on `<canvas>`. Auto-dark features recolour CSS backgrounds, but they leave canvas pixels alone. These include Chrome's "darken websites" / Auto Dark Theme, Samsung Internet and Dark Reader-style extensions; Dark Reader is what turned the board nearly black on Firefox Android.
- The page also declares `<meta name="darkreader-lock">`, which tells Dark Reader to leave the page off, plus `color-scheme: only light` and `forced-color-adjust: none`.

## Levels mode (endless)

- From home, **PLAY** opens the level map and **DAILY** opens the puzzle of the day. On the map, the PLAY button sits in a solid bar docked at the bottom. The map is padded by the bar's measured height plus the safe area, so no level node is hidden under it.
- Levels 1–1000 are precomputed in `js/levels.js`. Levels above 1000 are built on the device from a fixed seed (`paneslide:level:v3:N`), so every player gets the same level N.
- Difficulty (v3):
  - Levels 1–3 are quick lessons (glide, stick, order).
  - From level 4, par rises on a log curve that plateaus at about 9 swipes around levels 150–200. Boards are at most 5×5.
  - A sawtooth gives a breather at levels ending in 1 and 6, and a challenge at levels ending in 9.
  - From level 6, every non-breather level must defeat a "greedy" player, one who always makes the move that fixes the most cells: greedy cannot finish in par.
  - Twists: locked glass (a stopper) from level 12, and two-colour levels from 18.
- Stars: 3 = solved in par, 2 = within par+1 (par+2 once par is 4 or more), 1 = solved. Using a hint caps the level at 2 stars. A hint shows the next best swipe.
- Hints: you start with 3 and can hold at most 5. You earn +1 per milestone and +1 for every three 3-star levels.
- Progress is saved in localStorage under the same `ps2:*` keys as before, so old progress stays valid.

## Tests (Node 20)

- `node tools/validate.js 2026-10-28 367` checks every daily and the tutorial: exactly one solution, par = shortest path, and deterministic output. It also reports how many dailies greedy fails.
- `node tools/validate-levels.js 1000` checks every precomputed level:
  - it matches the seeded generator;
  - it has exactly one solution;
  - an independent forward search finds par;
  - the board is at most 5×5.
  
  It also prints a per-tier table of par and greedy failures.
- `node tools/build-levels.js 1000` rebuilds `js/levels.js`.
- `PW=$(npm root -g)/playwright-core node tools/screens-game.js` plays the game headless at 390×844 with real swipes along the shortest route:
  - it runs tutorial → daily → map → levels 1, 5, 10, 20 → undo/hint → map bottom;
  - it covers Chromium light, `prefers-color-scheme: dark`, Chrome forced dark, a Dark Reader simulation and Firefox dark (`ONLY=light|dark|darkreader|forcedark|firefox` runs one);
  - it fails on any console error or if the PLAY bar covers a map node;
  - it needs `python3 -m http.server 8765` running in this folder, and Firefox via `npx playwright-core install firefox`.
- `node tools/darkreader-check.js` checks two things: that Dark Reader honours the lock, and that the canvas board keeps its colours even when the lock is removed. It needs `npm i --prefix /tmp/dr darkreader@4`.

All art, colours, icons and sounds (WebAudio) are original and made in code. The one exception is the font, Fredoka, which is self-hosted under the SIL OFL. See credits.txt.
