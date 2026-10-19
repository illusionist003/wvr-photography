# Design

## The idea

A photographer's site where the photos do the selling. Dark where the work is
shown, light where the visitor reads. The structure is the same band pattern
on every page, so a visitor from a search or an ad always finds the same
things in the same places: what he shoots, the work, what clients said, how
booking works, questions, the form.

## Two planes

| Plane | Token | Use |
|---|---|---|
| Ink | `--ink` #0a0d0e | Heroes, the work, the about band, the form band, the footer |
| Paper | `--paper` #f3f3ef | Services, steps, galleries list |
| White | `--white` | Reviews, questions, a second light plane |

## One accent

The teal of his logo badge (`--teal` #2c5c6c), spent on actions and small
marks only.

- White text on a button sits on `--teal-btn` #387787 (5.1:1).
- Teal text on paper is `--teal-ink` #2c5c6c.
- Teal text on ink is `--teal-soft` #8fc3d1.

## One family

Inter Tight, one variable file (latin, 100 to 900), preloaded, with a
metric-matched Arial fallback. Display 690 to 700 weight, tracked in. Reading
type 400. Sentence case everywhere.

## Parts

- Radii 4 and 6 pixels. No shadows. The only gradients are photo scrims.
- Buttons: `btn primary` (teal) and `btn ghost` (outline). Two per group.
- His badge in the header at 50px with the name set in type beside it (the
  name inside the badge is unreadable at that size), and alone at 112px in
  the footer.
- Hero: one of his photos edge to edge, a scrim, the keyword line and display
  line inside one h1, a paragraph, two actions, one client quote (desktop),
  and a caption naming the photo. Phones get a portrait cut of the photo
  (`scripts/crops.mjs`), not a thin slice of the wide frame.
- Work mosaic: fixed row grid of his photos, each captioned with the gallery
  it comes from and linking to it.
- Galleries: his photos at their own shape, two columns, captioned. No
  lightbox, no filter catalog, no expand icons (Nick's standing preference).
- Every selling page ends with the form band: the form on a white card beside
  phone, email, Instagram and town.
- On phones a bar with Call and Get a free quote stays at the bottom and steps
  away while the form is on screen.

## Motion

One page-load moment in the hero: the photo settles from 106% and the words
rise 0.9rem. Transform only, so nothing waits on an animation to be painted.
The home hero crossfades six photos with a caption; only the first is in the
page load, the rest are fetched on the first touch, scroll or key press, or
four seconds after load. Pause button and dots, no slideshow with reduced
motion or data saving. Below the hero, motion answers the visitor: cards lift,
photos ease in scale, arrows nudge, the menu and the questions open. Nothing
slides in on scroll.

## Copy rules

First person, Matthew speaking. Free quote voice ("Get a free quote", "no
pressure"). No prices, packages, turnaround times, guarantees, counts of
clients or awards: none are confirmed. Reviews are his clients' words exactly
as published on his old site; the long one is shortened with an ellipsis.
Captions name a client only where his own gallery did.

## Performance rules

- No client framework, no external stylesheet, CSS inlined.
- One font file, preloaded, `font-display: swap`.
- Hero image preloaded per screen size, `fetchpriority="high"`, never lazy,
  never faded in from invisible.
- Every image has width and height; everything below the first screen is lazy.
- No third-party script. If analytics or an ads tag is added, load it on the
  visitor's first interaction (see Refresh My Ride's `Tracking.astro`).
