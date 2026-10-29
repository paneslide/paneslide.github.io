---
title: How to read the PaneSlide target picture
h1: Reading the target picture: decode the colours
desc: The small picture in PaneSlide tells you more than it seems. Learn to decode each colour, find where every pane must end, and spot the clues that crack a puzzle.
icon: 🔍
group: strategy
kicker: Strategy
image: daily
related: colour-mixing, plan-your-swipes, two-colour-puzzles
date: 2026-10-29
---
At the top of every PaneSlide puzzle sits a small picture, marked with an eye. Your goal is to make the big window match it exactly. New players glance at it, then start swiping. Experienced players read it like a map first, because it quietly tells you where every pane has to finish.

## The colour key

Every cell in the picture is one of eight colours. Each tells you exactly which glass covers that cell at the end:

| In the picture | Glass on that cell |
|---|---|
| empty (dark slot) | no glass |
| cyan | one cyan pane |
| magenta | one magenta pane |
| yellow | one yellow pane |
| blue | cyan + magenta |
| green | cyan + yellow |
| red | magenta + yellow |
| black | cyan + magenta + yellow |

::fig mix-chart

The [colour mixing guide](/guides/colour-mixing/) explains why the mixes work this way. For solving, you only need the table.

## Why mixes are such strong clues

Panes on the same kind of rail can never overlap: two ↔ panes block each other, and so do two ↕ panes. So a mixed cell always comes from panes on *different* rails, one sliding left-right and one sliding up-down. A black cell, with three colours, is even stricter, because it needs three panes crossing in one spot.

That turns mixed cells into anchors. If the picture has a green cell in row 3, column 2, then a cyan pane and a yellow pane must meet there, one horizontal and one vertical. Look at the board: often only one cyan pane *can* reach that cell on its rail, and only one yellow pane. You have just found the final spot of two panes.

## A step-by-step read

1. **Count the panes of each colour** on the board, and the cells of each colour in the picture, including the colours hidden inside mixes. Each pane's cells must appear somewhere in the picture.
2. **Start from black and two-colour cells.** Match each mix to the panes whose rails pass through it.
3. **Place long panes next.** A long bar has few possible positions, so its spot is usually forced once one of its cells is known.
4. **Fill in the single colours.** What is left over must be covered by the remaining panes.
5. **Check the empty cells.** Every empty cell in the picture must be empty at the end, which often rules out a position you thought was possible.

::fig read-steps

If you get two possible answers from the steps above, look again at the empty cells and the pillars. PaneSlide's puzzles are checked to have only one answer, so one of your two options must break a rule somewhere.

## Shapes help too

Panes are not always simple bars. L shapes and 2×2 blocks leave a recognisable footprint in the picture. If you spot an L-shaped patch of magenta, possibly with some of it mixed into blue or red, that is the magenta L, and its final position is right there.

## When the picture has pillars

From level 25, some boards contain stone pillars. The picture shows them as grey stone in the same place, so you can count them out straight away: glass can never be on a pillar. See [stone pillars](/guides/stone-pillars/).

## Mystery pictures

From level 95, some levels start with part of the picture hidden behind question marks, and each swipe reveals more of it. Reading what *is* shown becomes even more important there; the [mystery pictures guide](/guides/mystery-pictures/) has tips.

## Practise reading before swiping

Next time you open a puzzle, try a small challenge: before touching anything, point at the target cell of every pane. Then solve it and see how many you got right. After a few days, you will find that most of a PaneSlide puzzle is solved before your first swipe.
