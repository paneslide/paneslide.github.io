---
title: Sokoban, Sudoku, nonograms and PaneSlide: puzzle types compared
h1: Puzzle types compared: where PaneSlide fits
desc: How PaneSlide compares with other classic logic puzzles: Sokoban's pushing boxes, Sudoku's number placement and nonograms' hidden pictures. What each asks of you, a little history, and which skills carry over.
icon: 🧩
group: puzzles
kicker: Puzzle world
related: history-of-sliding-puzzles, glide-puzzles, how-puzzles-are-made
date: 2026-10-29
---
If you enjoy PaneSlide, you might wonder how it relates to other puzzles you have played. This guide compares it with three well-known logic puzzles: Sokoban, Sudoku and nonograms. For the story of sliding-tile puzzles such as the 15 puzzle, Klotski and Rush Hour, see [a short history of sliding puzzles](/guides/history-of-sliding-puzzles/).

## Two big families of puzzle

Most logic puzzles fall into one of two families:

- **Placement puzzles** ask *what goes where*. You see the whole puzzle at once and fill in the answer. The order you fill it in does not matter, only the final grid. Sudoku and nonograms are placement puzzles.
- **Movement puzzles** ask *how do I get there*. You start from a fixed position and make moves, and the order matters a great deal. Sokoban and sliding puzzles are movement puzzles.

PaneSlide is unusual because it is **both**. First you work out *where* each pane must finish by reading the colours in the picture, which is placement. Then you work out *how* to get them there with gliding and sticking, which is movement.

## Sokoban: planning pushes

**What it is.** In Sokoban, a warehouse keeper pushes boxes onto marked storage spots. The keeper can push a box but never pull it, and can never shift two boxes at once.

**A little history.** Hiroyuki Imabayashi made the first Sokoban in 1981, and his company Thinking Rabbit sold it in Japan from 1982. It became known worldwide from 1988 and is still used as a test problem in artificial intelligence research. Deciding whether a Sokoban puzzle can be solved at all is known to be computationally very hard in general.

**Compared with PaneSlide.** Sokoban and PaneSlide share the fear of the irreversible move. Push a box into a corner and it is stuck for good. In PaneSlide, one-way glass works similarly, and every swipe counts towards your score even if you undo it. Both reward looking ahead before acting. The difference is that in Sokoban you know the goal squares from the start, while in PaneSlide you first have to deduce each pane's goal from the colours.

## Sudoku: pure deduction

**What it is.** Fill a 9×9 grid with the digits 1 to 9 so that each row, each column and each 3×3 box contains every digit exactly once.

**A little history.** The modern puzzle first appeared in 1979 in Dell puzzle magazines in the United States under the name Number Place. It was most likely designed by Howard Garns, a retired architect. The Japanese publisher Nikoli popularised it from 1984 and gave it the name sudoku. It spread to newspapers worldwide in 2004 and 2005, starting with *The Conway Daily Sun* in New Hampshire and *The Times* in London.

**Compared with PaneSlide.** A good Sudoku has exactly one solution, and so does every PaneSlide level. In both, if you feel you have to guess, you have probably missed a deduction. The "count the colours" method for frosted glass, or the "one possible rail position" reasoning for any pane, is very close to Sudoku's "this digit can only go here" logic. The difference is that Sudoku has no moves to plan. Once you know the answer, you have finished.

## Nonograms: pictures from logic

**What it is.** Nonograms are grid puzzles where numbers beside each row and column tell you the lengths of runs of filled cells. Solving them reveals a hidden picture.

**A little history.** Nonograms are named after Non Ishida, a Japanese graphics editor who began designing grid pictures in 1987. Tetsuya Nishio invented the same kind of puzzle independently at about the same time. The British newspaper *The Sunday Telegraph* began publishing them weekly in 1990, and by 1995 they were appearing on handheld games, including Nintendo's titles under the name Picross.

**Compared with PaneSlide.** Both build a picture on a grid, and both are about cells and runs. In nonograms you deduce which cells are filled. In PaneSlide the target picture is given, and you deduce which *panes* make each cell. Mystery levels in PaneSlide, where the picture appears bit by bit, are a gentle nod to the pleasure of a picture emerging as you work.

## Which skills carry over

| Skill | Where you use it |
|---|---|
| Spotting the forced move | Sudoku, nonograms, every PaneSlide level |
| Avoiding irreversible mistakes | Sokoban, PaneSlide one-way glass |
| Working backwards from the goal | Sokoban, sliding puzzles, PaneSlide bosses |
| Counting to narrow choices | Sudoku, nonograms, PaneSlide frosted glass |
| Planning an order of moves | Sokoban, PaneSlide |

If you are good at one of these puzzles, you already have some of the habits that help in PaneSlide. Many players find that switching between puzzle types keeps each one fresh.

## Why PaneSlide adds colour

Colour is what makes PaneSlide's placement step interesting. A cell's colour tells you exactly which panes overlap there: blue means cyan and magenta, green means cyan and yellow, and so on. That turns a picture into a set of clues, a bit like the numbers in a nonogram. The [colour mixing guide](/guides/colour-mixing/) explains the rules.

## Sources

- Wikipedia, "Sokoban" (Hiroyuki Imabayashi, 1981; Thinking Rabbit, 1982; international release 1988), checked 29 October 2026.
- Wikipedia, "Sudoku" (Dell, 1979; Howard Garns; Nikoli, 1984; newspapers in 2004), checked 29 October 2026.
- Wikipedia, "Nonogram" (Non Ishida and Tetsuya Nishio, 1987; *The Sunday Telegraph*, 1990; Picross), checked 29 October 2026.
