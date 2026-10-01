# R13c (draft, goes into requests.md after R14): depth-driven parting + mouse push (use Sonnet 5.5)
Order (Anh 2026-10-02): R13b -> R14 media -> R13c -> R13d back-to-top -> WebGL bend -> ... -> back-to-top "rewind" polish at the very end.
Keep it lean: set reasonable starting defaults and stop; Anh tunes by eye with the panel.

Anh (2026-10-02): the 8 "BackImageNoReact" cards were only a Framer workaround, because Framer could not make cards react differently by depth. Bake depth into the interaction instead. Depth = the card's layer (cards.json parallaxDistance: back 20, layer1 25, layer2 50, layer3 75, front 100).

1. Parting: ALL 35 cards take part (drop the `scroll: false` exception for the 8 cards). Parting amount scales with depth: front cards pushed furthest, back cards least. Keep live's parting targets as the front-card reference and the R13b parting spring.
2. Mouse push-away (new, what Anh originally wanted): cards near the cursor are pushed AWAY from it (direction = from the cursor to the card centre), strength fading with distance over a radius (smooth falloff, zero outside the radius), and scaled by depth (front strongest, back weakest). Use each card's current on-screen centre (from cached base positions + current offsets; no DOM reads in the loop). Spring-smoothed like the current mouse effect.
3. Keep live's global mouse drift (Parallax Floating) as a gentle background layer, with its own amount slider (0 = off).
4. Panel (?tune) sliders, all in Copy values: push radius, push strength, falloff softness, depth spread (how much more front cards move than back cards; applies to parting and push), background drift amount. Sensible starting defaults; Anh tunes by eye.
5. Card 11: treat like the others (no investigation).
6. Touch / reduced motion: no mouse push or drift (as now). Performance: still one transform per card per frame; report slow frames while scrolling + moving the mouse.
7. Compare: SKIP the card probes (they now differ from live by design; do not fit new reference values). Every other probe must still pass at 1920x1080 and 2560x1440.

8. New card layout (Anh 2026-10-02): the Framer layout was pre-placed "half parted" (an open lane down the middle) only because Framer had no responsive way to part them. Replace it with a more random scatter where some cards start near or across the centre line, so the parting has visible work to do.
   - Keep each card's identity: same image, same depth layer, same side (left/right) and the same rough vertical order through the section, so the story of the section stays the same.
   - Generate positions from a SEED (same layout on every visit; never random per page load). Controls: scatter amount (how far cards may move from their current spot), centre pull (share of cards that start near/over the centre line, and how close), minimum gap (relax overlaps so cards don't pile up; small overlaps between different depths are fine), vertical jitter.
   - ?tune panel: those sliders plus a "Reshuffle" button (new seed) and the seed in Copy values, so Anh can flick through layouts and keep the one he likes. Bake the chosen seed + values into data (or timeline.js) so the production build has no generator cost at load if that is simpler.
   - Parting is per card from its own screen position, so cards near the centre will part hardest: check that the frame passing through stays readable (cards near the centre must clear the frame) and that the depth scaling (item 1) still reads.
