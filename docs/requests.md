# Requests (from Cowork / Anh to Claude Code)

Only open and upcoming work lives here. Finished requests move to docs/archive/ (R1-R10: archive/requests-R1-R10.md, R11: archive/requests-R11.md, R11b: archive/requests-R11b.md, R11c: archive/requests-R11c.md, R12: archive/requests-R12.md, R13: archive/requests-R13.md, R13b: archive/requests-R13b.md).

## R13e [done] repulsion aura around the frame (use Sonnet 5.5)
Anh tuned R13c and found cards still slide under/over the centre frame (the float/mask): e.g. the "10" card and a sneaker overlap the Bitis frame. The live-style parting is based on each card's SCREEN position, not on where the frame is. Anh wants a repulsion aura around the frame: cards always drift away from the middle image.
1. Source = the frame's real rectangle every frame (mask width/height + float offsets + scroll), taken from the hero's own animation state (export a cheap getter from hero.js / timeline values). No DOM reads in the loop.
2. Field: for each card, distance from the card's edge to the frame's edge (rect to rect). Within an aura margin, push the card outward, direction = frame centre -> card centre (horizontal bias so cards part sideways more than vertically, slider), strength rising as the gap shrinks ((1 - d/margin)^falloff). Overlap (d <= 0) must be pushed fully clear: with clearance = 1 no card ever overlaps the frame at rest, keeping a minimum gap (slider).
3. It REPLACES the live-style parting (parting strength becomes aura strength; keep the R13b spring for the settle, softness/bounce sliders stay). Mouse push, drift and lag stay on top, all summed into one transform per card.
4. Depth: front cards react strongest/fastest, back cards gentler (existing depth spread). Back cards may still pass behind the frame only if clearance < 1; at the default every card clears it.
5. ?tune panel: aura margin, aura strength, falloff, clearance (soft..guaranteed), minimum gap, horizontal bias; all in Copy values. Remove or hide the old parting-only sliders that no longer apply.
6. Checks: script at the 6 target screens (1920x1080, 2560x1440, 3840x2160, 1440x900, 1512x982, 1728x1117): scroll through Selected Work with the mouse parked off-screen and report the smallest card-to-frame gap per frame (must stay >= minimum gap once settled; brief overlap allowed only mid-spring while scrolling fast, report max). Frame time while scrolling + mouse. compare (cards skipped) must stay 574/574 at 1920 and 2560.
Current CARDS defaults stay unless renamed; LAYOUT seed 7 defaults stay.

## R13f [done] aura feel like live — smooth, not snappy (use Sonnet 5.5)
Anh tested R13e: the aura's direction and reach are fine, but it feels TOO SNAPPY. Goal: tune and fix it so the motion LOOKS like the current live site's parting (smooth, continuous, eased), while keeping the aura idea (cards always move away from the frame, and clear it once settled).
Causes found in R13e code (fix these):
1. Hard clearance: cards closer than auraMinGap are placed at a cleared position (a jump). Make clearance a soft TARGET the card's spring travels to; no instant displacement, ever.
2. Look-ahead switching: "now" vs "look-ahead" push, stronger one wins (max) -> the target jumps when they swap. Blend them continuously (or drop look-ahead if the smooth version is good enough).
3. Front cards settle at 0.45x softness: too fast. Same settle character for every card (back cards may be slightly heavier, nothing faster than the base softness).
4. Narrow, steep field (margin 220, falloff 1.5): ease the force in with a smooth curve (smoothstep-like, zero slope at the margin edge).
Match live's look:
- Use live's parting as the reference for the MOTION PROFILE: how far a card moves sideways/down vs scroll position, and the easing character (live: target eased at 0.2 per 60 fps frame, no overshoot) plus Anh's small bounce (partingBounce 0.25). Use the live cache / --cards probes to measure live card trajectories over scroll (displacement vs scroll, for front and back layers) and fit the aura parameters (margin, strength, bias, curve, settle) so our displacement-vs-scroll curves have the same shape and similar amplitude. The layout differs (seeded scatter), so compare curves, not absolute positions.
- Report: for 3-4 representative cards, live curve vs ours (numbers or a small plot image in tools/scratch), and the max single-frame target jump (must be ~0 at constant scroll speed).
- Add one "weight" slider on ?tune (overall heaviness/floatiness of the aura motion); keep the other aura sliders. Put the fitted values as defaults.
- Accept brief overlap during fast scrolling; once settled every card clears the frame (min gap). Recheck at the 6 target screens; frame time; compare 574/574 (cards skipped).

## R13g [done] Part A card-to-card overlap guard + Part B back-to-top and More Projects/wordmark fix (one session, Sonnet 5.5)
Anh wants these two in one run to save time. Do Part A, run its checks, COMMIT it; then Part B, checks, COMMIT. If the context compacts more than once, stop after the current part and report.
### Part A: card-to-card overlap guard
Anh's tuned values from R13f are now the defaults (CARDS aura 580/175/120, depthRange 0.15, push 245/60, LAYOUT seed 37315, scatter 225, centreBand 560, minGap 81). Problem seen at 2560: the aura herds cards into the side gutters between the frame and the screen edge, so cards pile up and a front card covers most of the card behind it (e.g. the "10" card over the billboard card, the knot logo over the "What's your next" text card).
Safeguard (motion time, on top of the layout's minGap which only holds at rest):
1. After each card's target (aura + push + drift) is computed, run a soft card-to-card separation on the TARGETS of the cards currently on screen (2-3 relaxation passes, pairwise; 35 cards is cheap): when two cards overlap by more than maxCover (share of the SMALLER card's area hidden, default ~20%), push them apart along the axis of least overlap, both moving, the front card a bit more (so the back card is revealed). Cards still travel on their springs (no snapping); separation must be continuous (no target jumps).
2. The frame aura wins over separation (never push a card back into the frame); cards may bleed off the screen edge rather than pile up; prefer vertical separation when the gutter is too narrow for horizontal.
3. Small overlaps are welcome (they give depth); only heavy covering is prevented.
4. ?tune: max cover %, separation strength, passes; in Copy values.
5. Checks at the 6 target screens: scroll through Selected Work (mouse parked, then with mouse sweeps) and report the worst pairwise coverage once settled (must be <= maxCover) and during motion; frame time; compare 574/574 (cards skipped).

### Part B (was R13d): back-to-top A+ / A fallback + More Projects list clears the wordmark
Problem: the footer link smooth-scrolls the whole page back to the top, replaying every scrubbed animation, 35 cards and image loads, so it is long and laggy.
- A+ (default): everything EXCEPT the big AV wordmark fades to black (~0.4s, ONE black overlay layered just below the wordmark, opacity only) -> instant jump to scrollY 0 while hidden (Lenis scrollTo(0, { immediate: true }), ScrollTrigger.update, every section in its top state, nav in its big state, no loader replay) -> the hero fades back in around the wordmark (~0.6s). The wordmark is big at the footer and big at the top: it must not move or flicker.
- A (fallback): same, overlay above everything (wordmark included). Use when navigator.hardwareConcurrency <= 4, navigator.deviceMemory <= 4 (when available) or Save-Data is on. No frame-time measuring.
- prefers-reduced-motion: instant jump with a very short plain fade.
- Timings and the fallback rule in timeline.js; force a path with ?top=aplus / ?top=a.
- Check: one 4x CPU-throttled run of A+ (report the worst frame), no visible wordmark jump. Full compare at both sizes.

Later (polish, after everything else, Anh's call): the "rewind" version C (page streaks upward, jump, settles back in; transform/opacity only on one wrapper + one overlay, blur only on strong devices), with A as its fallback.

Also in R13d (Anh 2026-10-02): More Projects list vs the returning big wordmark. The pinned list ("BITIS SEASON 09" etc.) overlaps the big "^ V" wordmark when it comes back at the footer (live has the same bug; seen at 2560x1440).
- Fix by layout, not new motion: move the list block (names + "More Projects" label + "See more work" link, kept aligned together) further up, and scale it down slightly only if needed, so the list's bottom always clears the wordmark's top with a visible gap.
- Make it a rule, not one fitted number: the wordmark scales with width, the list is capped, so compute the list position from the wordmark's top edge (e.g. list bottom = wordmark top - gap, clamped so the list never goes under the nav), with a max scale-down of about 85%.
- Target screens (Anh's priority): 16:9 from FHD to 4K (1920x1080, 2560x1440, 3840x2160) and MacBook 16:10 (1440x900, 1512x982, 1728x1117). Check every one of these with a screenshot at the moment the wordmark is fully back: no overlap, list still reads as centred. Report the gap at each size.
- This departs from live on purpose; update or skip the More Projects compare probes that move.
Also look at the one ~45 ms frame at the start of each R13c test run (first frame of Selected Work?): if it is image decode or first layout, fix it cheaply (e.g. decode="async" + pre-decode just before the section) or report why not.

## R16 [done] (archived in docs/archive/requests-R16.md)

## R17 [done] (archived in docs/archive/requests-R17.md)

## R17b [done] (archived in docs/archive/requests-R17b.md)

## R16b [done] (archived in docs/archive/requests-R16b.md)
After R16b: R16c (frame warp on its own canvas, poster while scrolling): docs/plans/r16c-frame-warp.md

## R16b-fix [done] (archived in docs/archive/requests-R16b-fix.md)

## R16c [done] (archived in docs/archive/requests-R16c.md)

## R16d [done, quick mode] (archived in docs/archive/requests-R16d.md; stress tests deferred to the perf pass below)

## R16e [done, quick mode] (archived in docs/archive/requests-R16e.md)

## R16f (next, quick mode): swap warp directions + frame warp lingers in More Projects (use Sonnet 5.5)
Anh's tuning after R16e is now the default (WARP, FRAME_WARP, BEND sensitivity 2.15 / overshoot 0.13 in timeline.js).
1. Swap the direction for EVERYTHING (cards' cylinder warp AND the centre frame's own-space warp): what scrolling UP does now must happen when scrolling DOWN, and vice versa. Anh: "got the effect but reverse direction, just need to switch them for all". One shared sign flip (e.g. a WARP_DIR constant applied where the scroll direction becomes the warp sign), so the per-direction sliders (strengthUp/Down, camUp/Down, bowUp/Down, pinch/pinchDown) follow the new mapping: rename or swap their values so each slider still controls what its label says on screen. Check with real wheel input (?warptest) at 2560x1440 both ways; screenshots to tools/scratch/r16f-shots/.
2. Frame warp lingers in More Projects (Anh's screenshot: the full-screen frame stays warped/bulged for a long time before returning to normal, while the More Projects list is shown). Likely cause: in that part of the page something keeps the measured scroll speed above the hand-back threshold or keeps the warp target non-zero (e.g. Lenis still easing out its 3 s glide, the More Projects fit / sticky translate, the wordmark spring, ScrollTrigger refresh, or the frame size changing (mask grow 500-585vh) being counted as motion). Find it (log warp target, speed source and hand-back state per frame while scrolling into More Projects and stopping), then fix so the frame settles flat within the same time as elsewhere (~0.5 s after the scroll visibly stops). The warp must be driven by the page scroll velocity only, not by layout or mask-size changes.
3. QUICK MODE: real-wheel checks + screenshots, normal-speed frame time at 2560, compare 542/542. Stress tests stay in the perf pass.

## Queued (plans agreed with Anh, in this order; each becomes a request after the one before is committed)
1. R18 perf + load pass (after R16f, Sonnet 5.5): deferred stress tests (4x CPU, 6-screen frame-time matrix incl. 120 Hz vs 8.3 ms, fallback re-runs, frame-canvas hand-off diffs); load: spawner images (4.9 MB) load only on first hero click or on idle, never at start; first-screen budget check (target < 1 MB before first paint); Lighthouse run (desktop) with the scores logged; GPU memory at 2560 and 3840 with both canvases; quick Safari/Firefox smoke check if available (WebGL2, video textures with alpha, fallbacks). Report and fix only cheap wins; list the rest.
2. Project pages (Bitis template first), Works page, tablet/phone, launch prep, then back-to-top "rewind" polish.
3. Check later (low priority, Anh 2026-10-02): 4K at 100% scaling (3840x2160 CSS) squeezes the capped section positions (Selected Work ~1 screen down, trail barely runs). Consider letting section positions keep scaling on very tall viewports.

## Later: Selected Work step 2 (WebGL edge bend)
Plan: docs/plans/selected-work-section.md step 2. After Anh tunes R13 with the panel.

## Later: responsive (tablet/phone)
Structure is ready (vw/vh units, timeline.js, CSS custom properties), but portrait screens need their own values: mask 17vw x 50vh becomes a thin strip, About runs to 15 lines on a phone, captions crowd. Also use small/large viewport units (svh/lvh) for the sticky blocks and ScrollTrigger.config({ ignoreMobileResize: true }) so the mobile address bar doesn't make things jump. Follow HANDOFF "Responsive plan".

## Media checklist note (R14 covers it)
Waits for Anh's original files. Convert the two GIFs to MP4/WebM loops, serve images as WebP/AVIF sized to display size (srcset), preload only hero media, lazy-load archive and project images, compress the hero video and add a poster frame, preload the Clash Display woff2.
