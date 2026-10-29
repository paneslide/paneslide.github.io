---
title: One-way glass in PaneSlide: plan before you swipe
h1: One-way glass: no going back
desc: One-way glass arrives at level 64 in PaneSlide. It only glides the way its arrow points, so every swipe is permanent. Learn how to plan the order of one-way moves.
icon: ➡️
group: mechanic
kicker: Special glass
image: level-64
related: plan-your-swipes, undo-hints-stuck, stone-pillars
date: 2026-10-29
---
At **level 64**, some panes show a single arrow instead of the usual double arrow. This is one-way glass. It glides only in the direction its arrow points: right, left, down or up. A swipe the other way does nothing.

::shot level-64 | PaneSlide level 64 with a one-way pane showing a single arrow | Level 64 introduces one-way glass. The single arrow shows the only direction it can glide.

## The rule

- A one-way pane keeps its normal rail (↔ or ↕), but can only glide **one way** along it.
- Swiping it the wrong way is a free bump: the pane wiggles, a small "One way only" tip appears, and the move counter does not change.
- In every other way it is normal glass. It stops at edges, pillars and same-rail panes, sticks on new colour and mixes as usual.
- Locked glass is never one-way, and each one-way level (so far) has exactly one one-way pane.

With a screen reader, the pane's label says "one way" and names the direction, for example "slides right only".

## Why one-way glass is tricky

On other boards, a pane that overshoots can usually come back. One-way glass can't. If it glides past its target, the only fix is undo (and the swipe still counts), or a restart.

That makes **timing** the whole puzzle. A one-way pane can only stop where something stops it. So before you swipe it, the stopper must already be in place: a crossing pane to stick on, a same-rail pane to stop before, a pillar, sand, or the edge.

::fig oneway

## How to plan one-way moves

1. **Find the one-way pane** and look at the arrow. Follow it to see the cells the pane can still reach. Its target must be among them.
2. **Find its stopper.** For the target cell, what will stop the pane exactly there? If nothing on the board would stop it now, another pane has to move first.
3. **Order your moves.** Move the stopper into place, then swipe the one-way pane. The usual rule from [plan your swipes](/guides/plan-your-swipes/) applies even more strongly here: *stoppers before the panes they stop.*
4. **Be careful when moving its stopper later.** Once a one-way pane is in position, moving the pane it stuck on doesn't move it. But if you need that stopper elsewhere, check first that nothing else depends on it.

> **Tip.** A one-way pane that only needs to reach the edge in its arrow's direction is the easiest move on the board. You can do it at any time, unless it would stick on glass on the way. Then do it *before* that glass arrives.

## One-way glass and the edge

Panes that point toward an edge with nothing in between are often finished in one swipe. Panes that need to stop in the middle are the hard ones. If the one-way pane needs a mid-board stop, expect the level to be about getting that stopper ready in time.

## One-way glass and dead ends

PaneSlide watches for dead ends. If a swipe makes the target picture impossible to reach (for example, a one-way pane has glided beyond its target), the game shows a short **"Stuck! Undo"** tip. With one-way glass this happens more than with any other kind, so do not worry when you see it: undo and think about the order. See [undo, hints and getting unstuck](/guides/undo-hints-stuck/).

## How one-way levels are made

When a one-way level is generated, the game makes sure the arrows matter: the one-way rule must actually remove a move from the board's shortest route, or make the puzzle longer. So a one-way pane is never just decoration, and its arrow is always part of the challenge. As with every PaneSlide puzzle, a solver also proves par is the true minimum and the picture has only one answer.

## One-way glass in later chapters

After level 64, one-way glass returns in most chapters, often paired with [stone pillars](/guides/stone-pillars/), which give one-way panes a stopping point in the middle of the board. Pillars plus one-way glass are some of the most satisfying combinations in the game, because once you see the order, the solution falls into place.

Play from level 64 on the [level map](/?mode=levels).
