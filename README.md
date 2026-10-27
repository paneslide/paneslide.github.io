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
- `PW=$(npm root -g)/playwright-core node tools/screens.js` takes headless screenshots at 390×844. It needs `python3 -m http.server 8765` running in this folder.

All art, colours, icons and sounds (WebAudio) are original and made in code. See credits.txt.

## Levels mode (endless)

- Switch between **Daily** (one shared puzzle a day) and **Levels** at the top.
- Levels 1–300 are precomputed in `js/levels.js`, and each one is checked to have exactly one solution. Levels above 300 are built on the device from a fixed seed (`paneslide:level:v1:N`), so every player gets the same level N. A time cap and an easier fallback seed keep generation fast.
- The board grows from 3×3 to 4×4 to 5×5 and stops at 5×5 around level 23. After that, difficulty comes from other levers: more panes, more overlapping colours, more ways each pane could fit, and new pane shapes. These rise on a gentle log curve that plateaus around level 200, so later levels stay "hard but fair".
- For variety, each 20-level chapter has its own name and colours. Some levels are easy breathers, every 20th level from 15 is a challenge, and twists appear over time: locked glass (from 30), two-colour levels (from 45) and glass that slides any direction (from 70). Each twist gets a one-line tip the first time it appears.
- Stars: 3 = solved in par, 2 = within par+2, 1 = solved. Using a hint caps the level at 2 stars.
- Hints: you start with 3 and can hold at most 5. You earn +1 per milestone and +1 for every three 3-star levels.
- Milestones come at level 5 and every 10 levels. They show a rank badge and your real stats from this device, plus spoiler-free share text.
- Progress is saved in localStorage (`ps2:levels`).

Tools: `node tools/build-levels.js 300`, `node tools/validate-levels.js 1000`, `node tools/screens-levels.js` (needs playwright-core + Chrome).
