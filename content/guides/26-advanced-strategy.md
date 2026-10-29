---
title: Advanced PaneSlide strategy: stoppers, sticking and counting swipes
h1: Advanced strategy: think like the solver
desc: Advanced PaneSlide strategy for experienced players: counting the swipes each pane needs, building stoppers, using sticking as a brake, the "one swipe per pane" check, and how special cells change the plan.
icon: 🧠
group: strategy
kicker: Advanced
related: plan-your-swipes, how-puzzles-are-made, boss-levels
date: 2026-10-29
---
Once you can read the picture and predict where a pane will stop, PaneSlide becomes a game of **order and economy**: doing the right swipes in the right sequence, with nothing wasted. This guide collects the ideas that help most on aha levels, challenges and bosses. It assumes you know the [glide and stick rules](/guides/how-panes-move/).

## Count before you move

Par is the proven minimum number of swipes. It tells you a lot before you touch the board.

- **Panes that need to move.** Compare the board with the picture and count the panes not yet in their final spot. Call this *m*.
- **If par equals m**, every one of those panes reaches its final spot in exactly one swipe. Your job is purely to find the order in which each single swipe lands correctly.
- **If par is bigger than m**, some panes need two or more swipes, or a pane that is already right must move out of the way and come back. Find out which. The difference, par minus *m*, is the number of "extra" swipes the solution uses.

This one check often tells you which kind of puzzle you are facing within seconds.

## Every pane needs a reason to stop

A pane can only stop in a cell for a reason. List them, in this order of reliability:

1. **The edge of the board.** Always there.
2. **A stone pillar** on the rail, or **sand** on the path. Fixed for the whole puzzle.
3. **Locked glass.** It never moves, so it is a fixed same-rail blocker or crossing stopper.
4. **A same-rail pane** in the next cell. Two ↔ panes cannot overlap, and neither can two ↕ panes.
5. **A crossing pane it will stick on.** The pane stops on the first step that increases its overlap with crossing glass, except on ice, where overlaps do not count.

For each pane that needs to move, write down which reason will stop it in its final spot. If the reason is a pane that is not yet in position, you have found an ordering constraint: that stopper must move first.

## Sticking is a brake you can place

Sticking is the most flexible stopper in the game, because you choose where the crossing glass is. If a ↔ pane needs to stop in column 3, move a ↕ pane into column 3 of that row first. Your ↔ pane will then stick on it.

Two consequences are worth remembering:

- **Sticking only happens on new overlap.** A pane that starts on top of other glass slides off it freely. So moving a pane *away* from a mix never makes it stick on that mix.
- **Sticking can stop a pane too early.** If there is crossing glass between a pane and its target, it will stop on that glass. That crossing pane must move away first, or the pane needs a second swipe.

## Work backwards from the last swipe

The last swipe of any solution moves a pane into its final spot from somewhere else, with its stopper already in place. Ask: which pane could go last? Often only one or two panes qualify, because the others would be blocked or would stick early in the finished arrangement. Then ask the same about the second-to-last swipe, and so on.

Working backwards is especially strong on bosses and aha levels, where the obvious first swipe is designed to be wrong.

## Watch what each swipe takes away

Every swipe changes the stoppers available to every other pane. Before you swipe, ask two questions:

- **Does this move remove a stopper that another pane still needs?** If so, it is too early.
- **Does this move put glass in another pane's path, where it would stick early?** If so, that other pane may need to go first.

## How special cells change the plan

- **Ice** removes sticking on that cell. A crossing pane cannot catch your glass there, so stopping on ice needs an edge, pillar, sand or same-rail pane.
- **Sand** stops glass the moment it slides on. A pane can never pass sand in one swipe. If its final spot is beyond the sand, it needs at least two swipes: one onto the sand and one off it.
- **Pillars** split a rail into separate sections. A pane can never pass a pillar, so it is always on the same side as where it started.
- **One-way glass** can only move in one direction, so it can never undo a move. Any plan that needs it to come back is impossible.
- **Frosted glass** follows all the normal rules while hidden. Its colour can usually be worked out by counting colours in the picture.
- **Mystery pictures** reveal more with every swipe that moves a pane. Make swipes that are certainly right first: they cost nothing and show you more.

## Using the hint well

A hint in Levels mode shows the next best swipe, and hints never cost stars. Advanced players use them as a check rather than a crutch: make your plan, then if two first swipes seem equally good, one hint resolves it and the rest of the plan usually follows.

> **Tip.** On a desktop, the number keys 1 to 9 select panes directly and the arrow keys swipe them. That makes it quick to try a planned sequence without reaching for the mouse.

For the bigger picture of how levels are designed and checked, read [how PaneSlide puzzles are made](/guides/how-puzzles-are-made/).
