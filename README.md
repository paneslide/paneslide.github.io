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
- Levels 1–1000 are precomputed in `js/levels.js`. Levels above 1000 are built on the device from a fixed seed (`paneslide:level:v4:N`), so every player gets the same level N.
- Difficulty (v4). The goal is enjoyment and coming back, not walls:
  - Levels 1–3 are quick lessons (glide, stick, order).
  - From level 4, par rises gently: 2.6 + ln(N−2), capped at 7.6. That gives about 4 swipes by level 6, 5 by level 15, 6 by level 40, and about 7 from level 100. Boards are at most 5×5.
  - In every block of 10, levels ending in 1 and 6 are breathers, and levels ending in 9 are a little harder (trophy on the map).
  - Breathers and levels ending in 2 must be solvable by the obvious moves (a "greedy" player), so wins come often.
  - Only the "aha" levels must defeat the greedy player, so the tricky ones are spaced out. These are the levels ending in 4 and 9 (from level 7), and in 7 (from level 40). Other levels come as they are.
  - Twists: locked glass (a stopper, shown with metal bolts) from level 12, and two-colour levels from 18.
  - Dailies (glide rules from 2026-10-30) run par 4 on Monday, 5 on Tuesday and Wednesday, 6 on Thursday and Friday, and 7 at the weekend. The weekend dailies (and Friday's) must defeat greedy.
- Stars (generous): 3 stars when you solve within par + 1 (exactly par when par is 1–2). 2 stars when you solve within par + max(3, ⌈par/2⌉+1). Otherwise 1 star. Solving in exactly par shows "✨ Perfect!". Hints never cost stars, and a hint shows the next best swipe.
- Next-gift bar: the level-end card shows a 🎁 bar counting down to the next milestone (level 5, then every 10). Each milestone gives +1 hint and a rank step.
- Coach marks: the first time a player meets something new, a short tip points at it. Each tip has an icon, one sentence, and a pulsing ring, and a tap closes it. Tips cover glide, stick, order, stars/par, undo, hint, stuck, locked glass, two colours, challenge, breather, map, rank, gift, music, and daily. Each shows once (`ps2:prefs.marks`), and **TIPS** in the ? help shows them all again.
- Glass look: everything is drawn on one canvas, so Dark Reader and forced dark can't recolour it. Empty cells are recessed slots. Each pane is one raised piece with a bright top-left rim, a darker bottom-right rim, a glossy diagonal streak, a drop shadow, and a soft shimmer every few seconds. Overlapping panes still mix like real colour filters (multiply-style "darken" on a separate glass layer). The target picture is flat colour, so it never looks like the board.
- Background music: made live in the browser with Web Audio, with no audio files and nothing to license.
  - It is a calm "puzzle café" style at about 70 bpm: soft detuned chord pads wander at random between Cmaj7, Am7, Fmaj7, G6, Dm9, and Em7. On top sit a sparse marimba-like pentatonic melody, an occasional bell, and a generated reverb. Every bar is chosen at random, so it never repeats as a loop.
  - It is on by default at 18% volume and starts only after the first tap (autoplay rules). It fades out when the tab is hidden.
  - Mute it with the ♪ button on the home screen, or use the Music toggle and volume slider in Settings. Music is separate from sound effects (`ps2:prefs.music`, `ps2:prefs.musicVol`).
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
