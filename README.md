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
