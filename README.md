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
  - New kinds of glass (v8). Each one first appears alone on a "teach" level, which is a little easier (par − 1) and has a ✨ tip. Then it keeps coming back:

    | Level | New glass | What it does |
    |---|---|---|
    | 12 | 🔩 Locked glass | can't move; a stopper |
    | 18 | 🎨 Two colours | the picture uses two-colour mixes |
    | 25 | 🧱 Pillars | stone blocks that glass can't pass |
    | 33 | 💎 Gems | slide glass over them for bonus shards (they sit on the best route) |
    | 42 | ❄️ Ice | glass never sticks on ice, it keeps gliding |
    | 52 | 🏖️ Sand | glass stops as soon as it reaches more sand |
    | 64 | ➡️ One-way glass | glides only the way its arrow points |
    | 78 | 🌫️ Frosted glass | hides its colour until you move it |
    | 95 | ❓ Mystery picture | the target shows itself bit by bit as you swipe |

  - Rotation: each chapter of 20 levels features the two kinds that were featured least recently (about 6–7 levels each) and brings every other known kind back once. A level has at most 2 kinds; 3 only on rare challenge levels after 100. Every kind returns in every chapter after it is taught (checked for 1–1000).
  - Chapter bosses: every level 20, 40, 60 … has a golden frame and a 👑 badge. Beating it restores the chapter's stained-glass window (+15 shards).
  - Dailies (glide rules from 2026-10-30) run par 4 on Monday, 5 on Tuesday and Wednesday, 6 on Thursday and Friday, and 7 at the weekend. The weekend dailies (and Friday's) must defeat greedy.
- Stars (generous): 3 stars when you solve within par + 1 (exactly par when par is 1–2). 2 stars when you solve within par + max(3, ⌈par/2⌉+1). Otherwise 1 star. Solving in exactly par shows "✨ Perfect!". Hints never cost stars, and a hint shows the next best swipe.
- Next-gift bar: the level-end card shows a 🎁 bar counting down to the next milestone (level 5, then every 10). Each milestone gives +1 hint and a rank step.
- Coach marks: the first time a player meets something new, a short tip points at it. Each tip has an icon, one sentence, and a pulsing ring, and a tap closes it. Tips cover glide, stick, order, stars/par, undo, hint, stuck, locked glass, two colours, challenge, breather, map, rank, gift, music, and daily. Each shows once (`ps2:prefs.marks`), and **TIPS** in the ? help shows them all again.
- Glass look (v7): everything is drawn on one canvas, so Dark Reader and forced dark can't recolour it. Empty cells are recessed slots. Each pane is a separate piece with a thick light outline around its outer edge, a thin darker line of its own colour, faint grooves between its cells, a small gloss strip on each cell, a drop shadow, and a soft shimmer every few seconds. The colour bodies mix like real filters ("darken" on a separate glass layer); the outlines are drawn on top of all panes, so where glass overlaps you see the mixed colour and both outlines. The arrow sits at the centre of the pane where possible. The target picture uses the same mixed colours with a white inner edge, so it ties to the board. A one-time tip ("🌈 Glass over glass mixes colours") points at the first overlap.
- Help (v7): mostly pictures. Two small looping demos (glide to the edge, stick on colour), the colour-mix chips and the star chips, with a few words each. **TUTORIAL** and **TIPS** go into detail.
- Background music: made in the browser with Web Audio, with no audio files and nothing to license.
  - It is a calm "puzzle café" style at about 70 bpm: soft detuned chord pads wander at random between Cmaj7, Am7, Fmaj7, G6, Dm9, and Em7. On top sit a sparse marimba-like pentatonic melody, an occasional bell, and a reverb.
  - v7 (no crackle): the music is pre-rendered once in the background with an `OfflineAudioContext` (22 050 Hz stereo, 9 bars ≈ 62 s plus a 3.5 s tail). Each take is normalised to −3 dBFS and has an envelope on every note. Two random takes alternate, scheduled on the audio clock, with each tail ringing over the next start. While playing, the live audio graph is just buffer → gain → limiter, so slow phones no longer drop audio (that is what the "short circuit" crackle was). All sound effects and music go through one limiter (DynamicsCompressor). Finished effect nodes are disconnected. The music fades out when the tab is hidden.
  - It is on by default at 18% volume and starts only after the first tap (autoplay rules).
  - Mute it with the ♪ button on the home screen, or use the Music toggle and volume slider in Settings. Music is separate from sound effects (`ps2:prefs.music`, `ps2:prefs.musicVol`).
- Hints: you start with 3 and can hold at most 5. You earn +1 per milestone and +1 for every three 3-star levels.
- Rewards (v8): 💠 **shards** are the one currency.
  - Earned: 2 per new star, 3 for the first perfect solve of a level, 1 per gem, 15 per boss, 5 for each day's first daily solve, 10 per badge, and the daily gift.
  - Existing players get shards back-dated once: 2 × stars already earned + 15 per boss level already passed.
  - **Shop**: +1 hint (15), boards Oak 60 / Mint 80 / Rose 80 / Midnight 120, music moods Rain 60 / Music box 90. Classic and Café are free.
  - **Glass House**: one round stained-glass window per chapter; each level you clear lights a piece (20 per window), and the boss restores it.
  - **Daily gift**: claim once a day from home; days 1–7 pay 5, 5, 10, 10, 15, 15, 30 (+1 hint). Missing a day starts a fresh week. A dot on the 🎁 shows when it is ready.
  - **Badges** (12) and **records** (perfect levels, gems, bosses, shards, best gift streak, best perfect run) in Stats.
  - **Next unlock**: the map bar and the level-end card always say what comes next ("8 levels to Mystery picture" or "5 to the boss · window 15/20").
- Progress is saved in localStorage under the same `ps2:*` keys as before, so old progress stays valid.

## Tests (Node 20)

- `node tools/validate.js 2026-10-28 367` checks every daily and the tutorial: exactly one solution, par = shortest path, and deterministic output. It also reports how many dailies greedy fails.
- `node tools/validate-levels.js 1000` checks every precomputed level:
  - it matches the seeded generator;
  - it has exactly one solution;
  - an independent forward search finds par;
  - the board is at most 5×5;
  - (v8) the mechanic schedule matches, no kind appears before it is taught, teach levels have exactly one kind, at most 2 kinds (3 only on challenge levels after 100), pillars never sit under the answer, frosted panes must move, gems lie on the hint route, and every kind returns in every chapter.
  
  It also prints a per-tier table of par and greedy failures.
- `node tools/build-levels.js 1000` rebuilds `js/levels.js`.
- `PW=$(npm root -g)/playwright-core node tools/screens-game.js` plays the game headless at 390×844 with real swipes along the shortest route:
  - it runs tutorial → daily → map → levels 1, 5, 9, 10, 12, 20 → undo/hint → map bottom;
  - it covers Chromium light, `prefers-color-scheme: dark`, Chrome forced dark, a Dark Reader simulation and Firefox dark (`ONLY=light|dark|darkreader|forcedark|firefox` runs one);
  - `ONLY=sizes` runs at 360×740 and 412×915, plus once with a wide fallback font. It opens home, help, settings, stats, map, levels, the level-end, milestone and daily-end cards, and a coach mark, and fails if any text sticks out of its button, chip or card, or off screen;
  - (v8) it opens every teach level (12, 18, 25, 33, 42, 52, 64, 78, 95) with its tip, plays boss level 40 to the "window restored" card, and checks the map teaser, Glass House, shop (a real purchase), daily gift (a real claim), and badges. At 360×740 and 412×915 it also checks the new dialogs for overflow;
  - it renders a music take (Café, Rain and Music box) and fails if it peaks above −1 dBFS or has a click (a burst of treble far above the frames around it);
  - it fails on any console error or if the PLAY bar covers a map node;
  - it needs `python3 -m http.server 8765` running in this folder, and Firefox via `npx playwright-core install firefox`.
- `node tools/darkreader-check.js` checks two things: that Dark Reader honours the lock, and that the canvas board keeps its colours even when the lock is removed. It needs `npm i --prefix /tmp/dr darkreader@4`.

All art, colours, icons and sounds (WebAudio) are original and made in code. The one exception is the font, Fredoka, which is self-hosted under the SIL OFL. See credits.txt.
