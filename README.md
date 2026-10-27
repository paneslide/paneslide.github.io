# PaneSlide

A free daily puzzle. **Slide the glass to copy the picture. Where glass overlaps, colours mix.**

- Each pane slides along its own rail. The arrow on the pane shows which way: ↔ or ↕.
- Cyan, magenta and yellow glass mix like real filters: C+M = blue, C+Y = green, M+Y = red, all three = black.
- You win the moment the board matches the picture. You can't lose. Try to finish in **par**, which is one move per pane.
- There is one new puzzle a day (#1 = 2026-10-27). Monday is the easiest and the weekend is the hardest. Every puzzle has exactly one solution.
- First-time players get a 20-second 3×3 tutorial. Press "?" any time for help.
- The share result is spoiler-free: one coloured square per move.

Static site: no build step, no server, no accounts. To host it, publish this folder on GitHub Pages.

Tests (Node 20):
- `node tools/validate.js 2026-10-27 365` checks uniqueness, fair starts and the tutorial.
- `PW=$(npm root -g)/playwright-core node tools/screens-game.js` plays tutorial → daily → levels → win → milestone headless at 390×844, in light, `prefers-color-scheme: dark` and Chrome forced dark (`ONLY=light|dark|forcedark` runs one). It saves `screenshots/game-*.png` and fails on any console error. It needs `python3 -m http.server 8765` running in this folder.

All art, colours, icons and sounds (WebAudio) are original and made in code. The one exception is the font, Fredoka, which is self-hosted under the SIL OFL. See credits.txt.

## Look and dark mode

- The UI is built to feel like a game rather than a website: an illustrated scene for each chapter (sky, light rays, hills, floating motes), chunky candy buttons, icons in place of text, a level map, star pops, confetti and medals.
- Dark mode: phone browsers with auto dark mode (Chrome's "darken websites" / Auto Dark Theme, Samsung Internet) used to invert the old light page. The page now declares `<meta name="color-scheme" content="only light">` and `:root{color-scheme: only light}`, which opts out of Chrome's Auto Dark Theme. It also uses one deliberate, saturated palette with explicit colours on every surface, so the game looks the same in light or dark system mode.

## Levels mode (endless)

- From home, **PLAY** opens the level map and **DAILY** opens the shared puzzle of the day.
- Levels 1–300 are precomputed in `js/levels.js`, and each one is checked to have exactly one solution. Levels above 300 are built on the device from a fixed seed (`paneslide:level:v2:N`), so every player gets the same level N. A time cap and a fallback one notch easier keep generation fast.
- Difficulty (v2): levels 1–3 are gentle 3×3 lessons, 4×4 starts at level 4 and 5×5 around level 19–25 (the cap). From level 4 every level must be ambiguous: at least one pane has 2+ plausible spots that match the target colours (decoys), and harder levels start panes on a plausible but wrong spot (traps). Panes, decoys and overlaps rise on a curve that plateaus around level 150–200. A sawtooth gives a breather at levels ending in 1 and 6, and a challenge at levels ending in 9. `tools/validate-levels.js` fails any level from 4 up that has no decoy.
- For variety, each 20-level chapter has its own name and colours, with a mix of layout flavours (bars, corners, blocks, big shapes). Twists: locked glass from 12, two-colour levels from 18, and glass that slides any direction from 33. Each twist gets a one-line tip the first time it appears.
- Stars: 3 = solved in par (par = the optimal move count, which the generator checks is reachable), 2 = within par+1 (par+2 once par is 4 or more), 1 = solved. Using a hint caps the level at 2 stars. Panes blend with `darken`, so the same colour over itself stays the same colour.
- Hints: you start with 3 and can hold at most 5. You earn +1 per milestone and +1 for every three 3-star levels.
- Milestones come at level 5 and every 10 levels. They show a rank badge and your real stats from this device, plus spoiler-free share text.
- Progress is saved in localStorage (`ps2:levels`).

Tools: `node tools/build-levels.js 300`, `node tools/validate-levels.js 1000`, `node tools/screens-game.js` (needs playwright-core + Chrome).
