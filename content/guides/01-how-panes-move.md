---
title: How glass moves in PaneSlide: glide, stop and stick
h1: Glide and stick: the two rules behind every move
desc: Every PaneSlide swipe follows two rules. Learn exactly where a pane glides, what makes it stop, and why it sticks on new colour, with diagrams.
icon: ↔️
group: start
kicker: Rules
image: level-2
related: plan-your-swipes, colour-mixing, undo-hints-stuck
date: 2026-10-29
---
When you swipe a pane in PaneSlide, you never choose exactly where it lands. You choose a pane and a direction, and the glass does the rest. That sounds like a small detail, but it is the heart of the whole game. Once you can predict where a pane will stop, every puzzle becomes something you can read and plan instead of something you poke at.

This guide explains the two movement rules, **glide** and **stick**, with the exact conditions the game uses.

## Rails: each pane has one direction

Every pane sits on a rail. A pane marked with ↔ slides left and right; a pane marked with ↕ slides up and down. It can never turn a corner or change rail. Panes come in different shapes, from a single square to long bars, L shapes and 2×2 blocks, but the shape always moves as one piece.

That means each pane has a small number of possible positions, all in one line. A 1×2 bar on a 4-wide board, for example, can only be in three places. Thinking "which of my three spots does this pane need?" is often the quickest way into a puzzle.

## Rule 1: glass glides until something stops it

A swipe sends the pane along its rail one cell at a time, and it keeps going until one of these things happens:

1. **It reaches the edge of the board.**
2. **The next cell is blocked** by a stone pillar, or by another pane on the *same* kind of rail. Two ↔ panes can never overlap each other, and neither can two ↕ panes, so a pane stops just before glass that moves the same way.
3. **It sticks** (rule 2, below).

::fig glide-edge

Glass on a *crossing* rail does not block. A ↔ pane can slide right over a ↕ pane, and that is how colours mix: the overlap is where cyan over magenta becomes blue.

## Rule 2: glass sticks the moment it slides onto new colour

As a pane glides, the game counts how many of its cells overlap crossing glass. If a step would make that overlap **bigger**, the pane moves onto that cell and stops right there. We call this sticking.

::fig stick

Two details make this rule easy to use once you know them:

- **Sliding off glass never makes a pane stick.** If a step makes the overlap smaller or keeps it the same, the pane keeps gliding. So a pane that starts on top of other glass will happily slide off it and carry on.
- **The pane stops on the new overlap, not before it.** You will always see the new mixed colour appear as the pane comes to rest.

> **Tip.** Before you swipe, trace the pane's path with your eyes. The first crossing pane in its way is usually where it will stop. If there is none, it goes all the way to the edge or to the next pane on its own rail.

## Why these rules make real puzzles

If you could drop panes anywhere, every PaneSlide board would be solved by simply copying the picture. Gliding and sticking take that freedom away. A pane might need to stop in the middle of the board, but the only way to stop it there is to have the right crossing glass waiting, or a same-rail pane to bump into. So you often have to move one pane *first* to build a stopper for another.

That is why order matters so much, and why the game counts swipes. **Par** is the shortest number of swipes that solves the puzzle, found by a full computer search of every reachable position. Each daily and each level has exactly one arrangement of panes that matches the picture, so there is never a second, sneaky answer.

## Three quick examples

::fig three-examples

- **Free run.** A ↕ pane with nothing in its column glides all the way to the edge.
- **Bump.** A ↔ pane slides towards another ↔ pane in the same row and stops in the cell next to it.
- **Stick.** A ↔ pane slides across a column that holds a ↕ pane and stops on top of it, showing the mixed colour.

## Special cells change the rules a little

From level 25 onwards, new kinds of cells and glass bend these rules in small, predictable ways: [stone pillars](/guides/stone-pillars/) block like the edge, [ice](/guides/ice-cells/) cancels sticking, [sand](/guides/sand-cells/) adds a new way to stop, and [one-way glass](/guides/one-way-glass/) only glides one way. Each guide explains the exact change. The two core rules above never go away.

## Practise the rules

The first three levels in Levels mode are short lessons: level 1 is about gliding, level 2 about sticking, and level 3 about order. If you skipped them, replay them from the map. Then try today's [daily puzzle](/?mode=daily) and, before every swipe, say out loud where you think the pane will stop. You will be surprised how quickly your guesses become right.

Curious where the glide idea comes from? Read [glide puzzles](/guides/glide-puzzles/), and if you are just starting, [seven beginner mistakes](/guides/beginner-mistakes/) will save you a lot of swipes.
