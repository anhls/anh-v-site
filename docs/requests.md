# Requests (from Cowork / Anh to Claude Code)

Only open and upcoming work lives here. Finished requests move to docs/archive/ (R1-R10: archive/requests-R1-R10.md, R11: archive/requests-R11.md, R11b: archive/requests-R11b.md, R11c: archive/requests-R11c.md, R12: archive/requests-R12.md, R13: archive/requests-R13.md, R13b: archive/requests-R13b.md).

## R15 [done] hero interactions (use Sonnet 5.5)
All three are cursor effects: reuse the shared pointer + loop (effects/pointer.js, CLAUDE.md rule 3); each registers only while its range is on screen; off on touch (phone: tap-to-spawn comes with the responsive pass) and with prefers-reduced-motion. Measure live first for anything below marked "match live". Media: the optimised files from R14.

1. Click spawner (match live; specs in HANDOFF.md "Click spawner"): click inside the top 100vh spawns an image at the click (size 60vh, min 30; spawn 0.4s easeOut, opacity 0->1, scale 0.2->1, 3D rotation X10 Y2 Z5 from X0 Y2 Z5, perspective 1200, spawnOrigin 0.7, overlap 8%, positionOffset 3vw), it floats 125vh and lives 8s with a 1s fade; max 8 on screen; shuffled image order with no immediate repeat; the click also plays the click sound (already built). Read which images live uses (data.json spawnerImages is empty).
2. Caption hover image (match live; motion-spec section 8): hovering a hero caption shows that project's image (427x249) following the cursor on spring 500/60/1, offset x +50px, right of the cursor, bottom-aligned. Images: ../_site-media/captions (via R14).
3. Image trail (Anh's design, NOT live's range: in Framer it was squeezed into an overlapping 150vh layer only because heavy overlapping layers broke GSAP/scroll there):
   - Behaviour per spawn: match live's CursorImageTrail (frequency 25, visibleFor 0.5s, in-animation opacity/scale/blur on spring 300/30); measure the rest (images, size, spacing) on live.
   - START: as soon as the hero mask shrink (hero video -> Anh's portrait) is about 60% done visually, i.e. the mask width is 60% of the way from full screen to 17vw. Compute that scroll point from the mask tween in timeline.js (ease expo.inOut over [0,70]); do not hard-code a guess.
   - Runs through About and the project index.
   - END: it does not stop at a hard edge. It overlaps into the Selected Work section a little and dies off slowly as you scroll on: an intensity factor from 1 to 0 over a scroll range starting around the top of Selected Work (211vh; propose the exact range), which lowers the spawn rate and the trail images' opacity/scale together, so the last images fade naturally.
   - Put start, fade range and intensity curve in timeline.js and on the ?tune panel (trail frequency, visible time, fade-out start/end), included in Copy values.
4. Performance: trail images come from a small reused pool (no new DOM per spawn); transforms/opacity only; blur only if it stays within budget at 2560 (report). Report slow frames while moving the mouse fast through About.
5. Compare: no new probes needed for cursor effects; check by script that nothing spawns outside the ranges and that existing probes still pass at 1920x1080 and 2560x1440.
Target screens to check (Anh's priority): 16:9 1920x1080, 2560x1440, 3840x2160 and MacBook 1440x900, 1512x982, 1728x1117. Card compare probes differ from live by design since Anh's tuned CARDS values (588/630 at 1920, 582/634 at 2560 after R14): ignore swL/swB mismatches, every other probe must pass.

## Queued (plans agreed with Anh, in this order; each becomes a request after the one before is committed)
1. R13c depth-driven parting + mouse push-away: docs/plans/r13c-depth-interaction.md
2. R13d back-to-top A+ (A fallback) + More Projects list clears the returning wordmark: docs/plans/r13d-back-to-top.md
3. Selected Work step 2, WebGL edge bend: docs/plans/selected-work-section.md
4. Project pages (Bitis template first), Works page, tablet/phone, launch prep, then back-to-top "rewind" polish.

## Later: Selected Work step 2 (WebGL edge bend)
Plan: docs/plans/selected-work-section.md step 2. After Anh tunes R13 with the panel.

## Later: responsive (tablet/phone)
Structure is ready (vw/vh units, timeline.js, CSS custom properties), but portrait screens need their own values: mask 17vw x 50vh becomes a thin strip, About runs to 15 lines on a phone, captions crowd. Also use small/large viewport units (svh/lvh) for the sticky blocks and ScrollTrigger.config({ ignoreMobileResize: true }) so the mobile address bar doesn't make things jump. Follow HANDOFF "Responsive plan".

## Media checklist note (R14 covers it)
Waits for Anh's original files. Convert the two GIFs to MP4/WebM loops, serve images as WebP/AVIF sized to display size (srcset), preload only hero media, lazy-load archive and project images, compress the hero video and add a poster frame, preload the Clash Display woff2.
