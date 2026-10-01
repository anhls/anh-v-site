# Plan: Selected Work section motion (was "archive"; not a request yet; agreed with Anh 2026-10-01)

Name (Anh, internal only): this section is "Selected Work" = the most impressive work. The file keeps its old name until R12 renames it.

Turn into requests after R12. Home page Selected Work = showcase of the most impressive work; a separate full Works page comes later (nav "Works" will point there).
Card data: docs/framer-extract/cards.json (35 cards, positions, sizes, layers). Derive each card's depth (z) from its Framer layer/parallax values; confirm with Anh.

## Step 1: DOM version (also the fallback for phones, weak devices, prefers-reduced-motion)
One element per card; one shared rAF loop (CLAUDE.md architecture rules 3 and 4). Each frame, sum these into ONE transform per card:
1. Depth parallax: one depth value per card. Deeper = slower scroll and more lag; depth also scales mouse response (optionally size/blur).
2. Elastic lag (reference: Codrops ElasticGridScroll, MIT): each card chases its scroll target with a delay tied to depth (deep = heavy, front = light). Build it on Lenis; do NOT add GSAP ScrollSmoother (two smooth-scroll systems fight).
3. Parting around the frame: as the sticky frame passes, cards move sideways away from the horizontal centre (left half left, right half right), stronger the closer the frame is, easing back after it passes.
4. Mouse push: current behaviour, radius + strength with falloff.
Dev-only tuning panel (sliders) for lag, depth range, parting strength, mouse radius/strength. Anh tunes by eye; final numbers go into timeline.js.

## Step 2: WebGL bend (separate request, on top of step 1)
Cards drawn as textured planes on one WebGL canvas (OGL preferred for size), positioned from the same step-1 motion. Cut-out PNG alpha kept; GIF cards as video textures.
- Shape: top AND bottom edges bend into a smooth arc, deepest at the horizontal middle, flat at the corners; sides stay straight.
- Amount: arc depth follows scroll speed (Lenis velocity), easing in as speed rises, with a max cap.
- Direction: both arcs bow against the scroll direction (trailing, "pulled through water"); flips when scrolling the other way.
- Depth weighting: strongest for middle-depth cards, weaker toward BOTH the front and the back, on a smooth bell curve. Panel: strength at the extremes (e.g. 30% of middle), width of the strong band.
- Return: when scrolling slows, ease back to a perfect rectangle with ONE gentle overshoot (edges pass slightly beyond flat, about 10-15% of the arc, then settle). No repeated jiggle, not a liquid droplet wobble. Panel: overshoot amount, settle speed.
- Panel also: max arc depth, speed sensitivity.
Optional later: same bend on the main frame image as it moves from About into the archive (decide after seeing it on the cards).
