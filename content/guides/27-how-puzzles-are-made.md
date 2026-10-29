---
title: How PaneSlide puzzles are made: one answer, proven par
h1: How PaneSlide puzzles are made
desc: Behind the scenes of PaneSlide levels: how a seeded generator builds every puzzle, why each level has exactly one answer, how par is proven to be the minimum, and what the "aha" and boss checks do.
icon: 🛠️
group: strategy
kicker: Behind the scenes
related: advanced-strategy, par-and-stars, boss-levels
date: 2026-10-29
---
Every PaneSlide level, from level 1 to level 1,000 and beyond, is built by a small program inside the game rather than drawn by hand. This page explains how that works in plain language, and why it means every level is fair: one answer, and a par that really is the minimum.

## A seed for every level

Each level has a fixed **seed**, a short piece of text built from the level number. The generator turns the seed into a stream of numbers that look random but are always the same for the same seed. That is why level 37 is the same puzzle for everyone, on every device, every time.

Daily puzzles work the same way, with a seed built from the date. Everyone who plays on the same day gets the same daily.

Levels 1 to 1,000 are generated in advance and shipped with the game, so they load instantly. From level 1,001 your device runs the same generator itself, with the same rules and the same checks.

## Step 1: choose the board and the panes

Each level number has a recipe: board size (from 3×3 up to 5×5, never bigger), how many panes, how long a par to aim for, and which special glass or cells to include. The recipe grows slowly through the chapters, with breathers every few levels so the difficulty does not just climb.

The generator then places panes in their **final** positions: each pane gets a colour (cyan, magenta or yellow), a shape and a rail. Where panes overlap, their colours mix. The result is the target picture.

## Step 2: make sure there is only one answer

A picture is only fair if exactly one arrangement of the panes makes it. The generator checks every possible combination of pane positions and counts how many match the picture. If more than one does, the candidate is thrown away and it tries again.

This is why you can always reason your way to the answer. If a pane's position looks uncertain, something in the picture decides it.

## Step 3: add special cells without breaking anything

Special cells and glass are added once the final picture is fixed:

- **Pillars** only go on cells that are empty in the finished picture, so a pillar is never in the way of the answer.
- **Ice** goes on cells where panes cross in the finished picture, so it changes how glass stops there.
- **Sand** goes on cells that panes travel through.
- **One-way glass** gets an allowed direction.

After each addition, the game checks again that the answer is still possible and still unique. A mechanic only appears after the level that teaches it, and most levels use no more than two at once.

## Step 4: pick a start and prove par

Next, the generator chooses where the panes **start**. It searches outwards from the answer to find starting arrangements that need a particular number of swipes, using the real glide and stick rules. The number of swipes in the shortest route from the start to the answer is the level's **par**.

Because par comes from a complete search of the shortest routes, it is a proof, not a guess. Nobody can solve the level in fewer swipes. The in-game hint follows one of those shortest routes, which is why "Hint" always shows a swipe that keeps you on a par path.

## Step 5: the "aha" and boss checks

Some levels get an extra test. On aha levels (ending in 4, 7 or 9 at the right stages) and bosses, the game simulates a "greedy" player who always makes the swipe that fixes the most cells right now. If the greedy player reaches par, the level is too obvious for that slot and gets rebuilt. This is what makes those levels feel like they have a trick.

Special glass also gets checked for purpose. For example, on a level that features ice, the game checks that at least one swipe on the shortest route would end differently without the ice. The mechanic has to matter, not just decorate.

## Step 6: checked again, independently

Before every release, a separate test program re-checks every precomputed level:

- the level is identical to what the generator produces from its seed;
- exactly one arrangement shows the picture;
- an independent search from the start finds the answer in exactly par swipes;
- the board is no bigger than 5×5;
- a second, separately written copy of the glide rules agrees with the game on every move.

The daily puzzles for the coming year are checked in the same way.

## What this means for you

- **Every level is solvable.** There are no impossible boards.
- **There is only one answer.** If you are stuck, the picture holds the clue.
- **Par is fair.** It is the true minimum, so three stars (par or par + 1) are always within reach.
- **Hints are honest.** They show a real next step on a shortest route.

If you enjoy this side of puzzles, the guide to [puzzle types compared](/guides/puzzle-types-compared/) looks at how other classic puzzles are built, and [advanced strategy](/guides/advanced-strategy/) shows how to use them when you play.
