---
title: A short history of sliding puzzles, from the 15 puzzle to PaneSlide
h1: A short history of sliding puzzles
desc: From the 1880 "15 puzzle" craze to Klotski, Huarong Dao and Rush Hour: how sliding puzzles developed, the maths behind them, and where PaneSlide's glass fits in.
icon: 📜
group: life
kicker: History
image: map
related: how-panes-move, colour-mixing, par-and-stars
date: 2026-10-29
---
PaneSlide is a new game, but it belongs to a family of puzzles that is more than 140 years old: **sliding puzzles**, where pieces move along a board without being lifted. Here is a short, sourced history of that family, and what PaneSlide borrows from it.

## The 15 puzzle and the craze of 1880

The best-known sliding puzzle is the **15 puzzle**: fifteen numbered square tiles in a 4×4 frame with one empty space. You slide tiles into the gap until the numbers are in order.

According to the historians Jerry Slocum and Dic Sonneveld, whose book *The 15 Puzzle* (2006) is the main source on its origins, the puzzle came from **Noyes Palmer Chapman**, a postmaster in Canastota, New York. Copies spread through New York state and New England, and by December 1879 they were being sold in Hartford and Boston. In 1880 the puzzle became a craze across the United States. Chapman applied for a patent in February 1880, but it was rejected.

For many years the puzzler **Sam Loyd** claimed to have invented it. Historians agree he did not: his first article about it was published in 1886, and he first claimed to be the inventor in 1891. Loyd did make the puzzle more famous by offering a $1,000 prize for swapping just the 14 and 15 tiles, a challenge that is impossible.

## The maths: why some puzzles can't be solved

Why impossible? In 1879, the mathematicians William Woolsey Johnson and William E. Story published a paper in the *American Journal of Mathematics* showing that **exactly half** of all possible 15-puzzle arrangements can never be solved, however many moves you make. Their argument uses *parity*: a hidden even-or-odd quantity that every legal move keeps in balance. Swapping two tiles and nothing else would break that balance, so Loyd's prize was safe.

This idea, that some positions simply cannot be reached from others, matters for every sliding puzzle. It is the reason PaneSlide checks every level with a computer search. A puzzle-maker can't just shuffle pieces and hope; the shuffle has to be reachable.

Computers have also measured the 15 puzzle exactly. The hardest positions need **80 single-tile moves** to solve.

## Different shapes: Klotski and Huarong Dao

Around the start of the 20th century, puzzle-makers began using pieces of *different* sizes. A 1909 American puzzle called the **Pennant Puzzle** asked you to move a large square block to the bottom of a 4×5 tray full of smaller blocks.

The same design is known around the world by many names:

- **Huarong Dao** (華容道, "Huarong Pass") in China, where the big block is the general Cao Cao, escaping through the Huarong pass from the novel *Romance of the Three Kingdoms*;
- **Hakoiri musume** ("daughter in the box") in Japan;
- **L'âne rouge** ("the red donkey") in France;
- and **Klotski**, from the Polish word *klocki*, "wooden blocks". That name became widely known through a 1991 Windows computer version.

Nobody knows for certain which version came first. The classic Klotski layout takes a minimum of **81 moves**, a solution published by Martin Gardner in *Scientific American* in 1964.

## Sliding on rails: Rush Hour

In the 1970s, the Japanese puzzle designer **Nob Yoshigahara** invented **Rush Hour**, first sold in the United States in 1996 and made by ThinkFun (formerly Binary Arts). Its cars and trucks sit on a 6×6 grid and can only move **forwards and backwards in a straight line**, never turning. Your job is to clear a path for the red car to drive out.

Rush Hour's big idea, that each piece has a fixed direction, is the closest relative of PaneSlide's rails. In PaneSlide, ↔ glass only moves left and right, and ↕ glass only moves up and down.

## Where PaneSlide fits

PaneSlide keeps the sliding-puzzle traditions and changes three things:

1. **Pieces overlap.** In classic sliding puzzles, pieces block each other completely. In PaneSlide, glass on crossing rails can sit on top of each other, and the overlaps mix colour like real filters.
2. **The goal is a picture.** Instead of putting numbers in order or getting one block out, you match a target picture of colours. Read how in [reading the target picture](/guides/reading-the-picture/).
3. **Glass glides and sticks.** Each swipe sends a pane as far as it can go, until it reaches an edge or a blocker, or slides onto new colour. That makes every swipe a little plan, rather than a step. See [how panes move](/guides/how-panes-move/).

Like modern puzzle-makers, PaneSlide uses a computer to check every puzzle: each level and daily has exactly one answer, and its par is the proven minimum number of swipes. It's the same question Johnson and Story answered with pencil and paper in 1879, can this position be reached, now answered by a computer search before you ever see the puzzle.

For how PaneSlide compares with Sokoban, Sudoku and nonograms, read [puzzle types compared](/guides/puzzle-types-compared/), and for slide-until-it-stops games such as Ricochet Robots, see [glide puzzles](/guides/glide-puzzles/).

## Sources

- Wikipedia, "15 puzzle" (history section citing Slocum & Sonneveld, *The 15 Puzzle*, 2006; Johnson & Story, *American Journal of Mathematics*, 1879), checked 29 October 2026.
- Wikipedia, "Klotski" (Pennant Puzzle, Huarong Dao, the 81-move solution and Martin Gardner, 1964), checked 29 October 2026.
- Wikipedia, "Rush Hour (puzzle)" (Nob Yoshigahara, 1970s; US release 1996; ThinkFun), checked 29 October 2026.
