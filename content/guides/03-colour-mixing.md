---
title: Colour mixing explained: subtractive vs additive (and PaneSlide)
h1: Colour mixing: why cyan and yellow make green
desc: Why does cyan glass over yellow glass look green? A clear guide to subtractive and additive colour mixing, filters, printer inks and screens, and how PaneSlide mixes its glass.
icon: 🌈
group: start
kicker: Colour
image: level-18
related: reading-the-picture, two-colour-puzzles, how-panes-move
date: 2026-10-29
---
In PaneSlide, cyan glass over magenta glass shows blue, cyan over yellow shows green, magenta over yellow shows red, and all three together show black. If you learned at school that "blue and yellow make green", some of this may feel back to front. It isn't. It is simply a different kind of mixing, and it is the same kind your printer and a stained-glass window use.

## Two ways to mix colour

There are two basic ways colours combine, and they behave in opposite directions.

**Additive mixing** happens when you add *light* together. Shine a red torch and a green torch on the same white wall and the spot where they overlap looks yellow. Add blue light as well and the spot looks white. The primaries of additive mixing are **red, green and blue** (RGB), and the more light you add, the brighter the result.

**Subtractive mixing** happens when something *takes light away*. A coloured filter, a layer of ink or a sheet of tinted glass lets some colours of light pass and absorbs the rest. Stack two filters and each one removes its share, so only the light both of them let through survives. The primaries of subtractive mixing are **cyan, magenta and yellow** (CMY), and the more layers you stack, the darker the result.

::fig mix-both

## How each filter works

White light contains the whole spectrum, which we can roughly split into red, green and blue parts. Each subtractive primary removes one of those parts:

| Filter | Removes | Lets through | Looks |
|---|---|---|---|
| Cyan | red | green + blue | blue-green |
| Magenta | green | red + blue | pink-purple |
| Yellow | blue | red + green | yellow |

Now stack two filters and keep only what both let through:

- **Cyan + magenta:** cyan removes red, magenta removes green. Only blue is left, so you see **blue**.
- **Cyan + yellow:** cyan removes red, yellow removes blue. Only green is left: **green**.
- **Magenta + yellow:** magenta removes green, yellow removes blue. Only red is left: **red**.
- **All three:** red, green and blue are all removed, so almost no light gets through: **black**.

That is exactly the rule PaneSlide follows. Where panes overlap, the game keeps the darkest value of each red, green and blue channel among the glass in that cell, which is how ideal filters behave.

::fig mix-chart

## Where you see subtractive mixing every day

- **Printers.** Colour printers use cyan, magenta and yellow inks, plus black (the K in CMYK). In theory CMY together make black, but real inks are not perfect filters and the mix tends to come out as a muddy dark brown, so printers add a black ink for crisp text and to use less coloured ink.
- **Photographic and theatre filters.** Lighting designers stack gels to shape colour, and each extra gel makes the light dimmer.
- **Stained glass and coloured bottles.** Light passing through two layers of tinted glass takes on a colour neither layer has on its own.

## Where you see additive mixing

Every phone, laptop and TV screen is additive. Each pixel is made of tiny red, green and blue parts that glow at different strengths. Look very closely at an old screen with a magnifying glass and you can see them. When all three glow fully, the pixel looks white.

So when you play PaneSlide on a screen, the game *draws* subtractive glass using an additive display. It works out what stacked filters would let through and then lights up the matching red, green and blue.

## What about "blue and yellow make green"?

Painters have long taught red, yellow and blue as the primary colours, and mixing blue and yellow paint does give a green. Paint pigments are subtractive too, but traditional "red" and "blue" paints are not pure filters, and the red-yellow-blue system is a practical painter's tradition rather than a precise model. In colour science, cyan, magenta and yellow are the subtractive primaries because each one removes exactly one third of the spectrum. A slightly greenish blue (cyan) plus yellow gives a clean green, which matches what the paint-box rule describes.

## Using colour mixing to solve puzzles

Because the mixing is predictable, the target picture is a map:

- A **single colour** cell means exactly one pane covers it.
- A **two-colour mix** means two crossing panes overlap there, one ↔ and one ↕ (two panes on the same kind of rail can never overlap).
- **Black** means three panes overlap there, which is the rarest and most useful clue on a board.

The next guide, [reading the target picture](/guides/reading-the-picture/), turns these facts into a step-by-step method. If you find some colours hard to tell apart, switch on **Patterns** in Settings: each glass colour gets its own pattern, so mixes can be read by shape as well as colour.

For the history behind the three sets of primary colours, read [primary colours: RYB, RGB and CMY](/guides/colour-wheels-primaries/). For the chemistry of real glass, see [why glass is coloured](/guides/why-glass-is-coloured/).
