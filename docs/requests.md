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

## R16d (next): warp SHAPE to match the reference + wordmark returns too early (use Sonnet 5.5)
QUICK MODE (Anh wants to see the effect first): build items 1-5, then only: one real-wheel ?warptest run at 2560x1440 (down + up) with screenshots, the grid numbers for item 1, a quick normal-speed frame time at 2560 (no throttling), and compare at 1920 + 2560. SKIP for now: 4x CPU / throttled runs, the 6-screen frame-time matrix, 120 Hz analysis, fallback re-runs, hand-off diff pictures. Log "stress tests deferred" in status.md; they go into a later perf pass. Commit as soon as the quick checks pass.
From Anh's screen recording (frames saved in tools/scratch/anh-rec/, Anh's 2560x1440, ?tune&warptest grid on).
1. Warp shape, scrolling DOWN (frames down-2.8.png, down-3.6.png). R16c item 0 is right that the sign is correct, but the SHAPE reads wrong: near the bottom edge the arc bows lines TOWARD the screen centre (middle higher than the corners), so cards left/right of centre tilt and their outer sides lean OUTWARD: the field fans out like a bowl, which Anh reads as "inflate". The reference (YouTube u8YujK0jTSM ~31:20; Anh's screenshot: the image's edge arcs AWAY from the image, middle further out than the corners, while its sides converge toward that edge) is a surface curling AWAY: near the trailing edge, edge lines bow AWAY from the screen centre (at the bottom: middle LOWER than the corners) AND the sides converge toward that edge (narrower toward the edge), content smaller.
   - Scroll DOWN (bottom = trailing edge with sym 0): bottom-region horizontal lines bow DOWN in the middle; vertical lines converge toward the bottom (a card left of centre has its outer side leaning INWARD toward the bottom); local scale <= 1.
   - Scroll UP: Anh accepted the current look; keep it, unless the cleanest model makes up the mirror of down (top edge curls away); ask before changing up.
   - Strongly consider a real curl model instead of the 3 independent terms: map the trailing band of the screen onto a cylinder bending away from the viewer and project with perspective (the narrowing and the edge bow then come from one deformation, like the reference). Keep sliders: strength up/down, reach, curl radius/perspective, plus pinch/arc as fine-tune if still useful.
   - Prove it with numbers on a grid, not by eye only: at max down warp, for a horizontal line in the bottom band y(mid) > y(corner) (screen y down), and the width of a vertical strip shrinks toward the bottom; plus ?warptest screenshots at 2560x1440 scrolling down and up with REAL wheel input, saved to tools/scratch/r16d-shots/. Apply the same shader to the frame canvas (shared warp-shader.js).
2. Big wordmark returns too early (frame wordmark-early-9.2.png, fast scroll down): the big "^ V" is already back while the frame is still small (Sulwhasoo, before its grow), Selected Work cards are still on screen and the More Projects list is still rising through it. Find the trigger (nav.js footer-in-view / Lenis target) and make the return happen only when the footer state is really reached: e.g. based on the scroll TARGET passing the footer threshold AND the mask grow done (frameState full screen), or IntersectionObserver on the footer with a later threshold. Check at normal and fast scroll, down and up, 1920 / 2560 / 1512x982: wordmark never overlaps a small frame or Selected Work cards.
3. Frame warp video mode: default to "frozen current frame" (videoMode 1) instead of the 720x540 poster until Anh supplies a high-res video (Anh to confirm; take this default).
5. Frame warp model (Anh, from the recording): the screen-space warp suits the cards but NOT the centre frame. The frame mostly sits in the middle of the screen, where a screen-space warp (strongest at the screen edges, reach band) barely touches it, so in Selected Work (frame sticky, centred) it shows almost no effect; and from hero -> About -> Selected Work the frame itself moves and resizes (mask tween + float springs), so it slides in and out of the warp band and the warp looks inconsistent / messy. Change the frame canvas to warp in the FRAME'S OWN SPACE: the same curl-away shape as item 1 (trailing edge of the frame bows away + sides converge, scroll down; up as agreed), applied relative to the frame rectangle (its own edges), driven by scroll speed with the same spring, independent of where the frame is on screen and of its own movement. Strength scaled by frame size (subtle when small, fuller when large). Remove the frame from the screen-space pass. Cards keep the screen-space warp. ?tune Frame warp section: strength up/down, reach (share of the frame), curl; check at the hero, About (moving), Selected Work (sticky) and full-screen stages.
6. Checks: see QUICK MODE above (full stress tests deferred).

## Queued (plans agreed with Anh, in this order; each becomes a request after the one before is committed)
0. Perf pass (deferred stress tests from R16d): 4x CPU runs, 6-screen frame-time matrix incl. 120 Hz, fallback re-runs, hand-off diffs for the frame canvas. Run once the warp looks right to Anh.
2. Project pages (Bitis template first), Works page, tablet/phone, launch prep, then back-to-top "rewind" polish.
3. Check later (low priority, Anh 2026-10-02): 4K at 100% scaling (3840x2160 CSS) squeezes the capped section positions (Selected Work ~1 screen down, trail barely runs). Consider letting section positions keep scaling on very tall viewports.

## Later: Selected Work step 2 (WebGL edge bend)
Plan: docs/plans/selected-work-section.md step 2. After Anh tunes R13 with the panel.

## Later: responsive (tablet/phone)
Structure is ready (vw/vh units, timeline.js, CSS custom properties), but portrait screens need their own values: mask 17vw x 50vh becomes a thin strip, About runs to 15 lines on a phone, captions crowd. Also use small/large viewport units (svh/lvh) for the sticky blocks and ScrollTrigger.config({ ignoreMobileResize: true }) so the mobile address bar doesn't make things jump. Follow HANDOFF "Responsive plan".

## Media checklist note (R14 covers it)
Waits for Anh's original files. Convert the two GIFs to MP4/WebM loops, serve images as WebP/AVIF sized to display size (srcset), preload only hero media, lazy-load archive and project images, compress the hero video and add a poster frame, preload the Clash Display woff2.
