# Requests (from Cowork / Anh to Claude Code)

Only open and upcoming work lives here. Finished requests move to docs/archive/ (R1-R10: archive/requests-R1-R10.md, R11: archive/requests-R11.md, R11b: archive/requests-R11b.md, R11c: archive/requests-R11c.md, R12: archive/requests-R12.md, R13: archive/requests-R13.md, R13b: archive/requests-R13b.md).

## R13c (next): depth-driven parting, mouse push-away, new card layout (use Sonnet 5.5)
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
Current CARDS defaults (Anh's tuning, keep unless the new model needs renaming): partingStrength 1.15, partingSoftness 0.8, partingBounce 0.25, mouseStrength 1.4, mouseStiffness 1375, mouseDamping 100, depthRange 0.85, lagStrength 0.9, lagFrontSec 0.03, lagBackSec 0.25. The trail (R15) fades out over Selected Work: check the two still read well together.
Target screens: 1920x1080, 2560x1440, 3840x2160, 1440x900, 1512x982, 1728x1117.

## Queued (plans agreed with Anh, in this order; each becomes a request after the one before is committed)
1. R13d back-to-top A+ (A fallback) + More Projects list clears the returning wordmark: docs/plans/r13d-back-to-top.md
2. Selected Work step 2, WebGL edge bend: docs/plans/selected-work-section.md
3. Project pages (Bitis template first), Works page, tablet/phone, launch prep, then back-to-top "rewind" polish.

## Later: Selected Work step 2 (WebGL edge bend)
Plan: docs/plans/selected-work-section.md step 2. After Anh tunes R13 with the panel.

## Later: responsive (tablet/phone)
Structure is ready (vw/vh units, timeline.js, CSS custom properties), but portrait screens need their own values: mask 17vw x 50vh becomes a thin strip, About runs to 15 lines on a phone, captions crowd. Also use small/large viewport units (svh/lvh) for the sticky blocks and ScrollTrigger.config({ ignoreMobileResize: true }) so the mobile address bar doesn't make things jump. Follow HANDOFF "Responsive plan".

## Media checklist note (R14 covers it)
Waits for Anh's original files. Convert the two GIFs to MP4/WebM loops, serve images as WebP/AVIF sized to display size (srcset), preload only hero media, lazy-load archive and project images, compress the hero video and add a poster frame, preload the Clash Display woff2.
