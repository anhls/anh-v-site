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

## R13d (after R13e): back-to-top A+ / A fallback + More Projects list clears the wordmark (Sonnet 4.6 is fine)
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

## Queued (plans agreed with Anh, in this order; each becomes a request after the one before is committed)
1. Selected Work step 2, WebGL edge bend: docs/plans/selected-work-section.md
2. Project pages (Bitis template first), Works page, tablet/phone, launch prep, then back-to-top "rewind" polish.
3. Check later (low priority, Anh 2026-10-02): 4K at 100% scaling (3840x2160 CSS) squeezes the capped section positions (Selected Work ~1 screen down, trail barely runs). Consider letting section positions keep scaling on very tall viewports.

## Later: Selected Work step 2 (WebGL edge bend)
Plan: docs/plans/selected-work-section.md step 2. After Anh tunes R13 with the panel.

## Later: responsive (tablet/phone)
Structure is ready (vw/vh units, timeline.js, CSS custom properties), but portrait screens need their own values: mask 17vw x 50vh becomes a thin strip, About runs to 15 lines on a phone, captions crowd. Also use small/large viewport units (svh/lvh) for the sticky blocks and ScrollTrigger.config({ ignoreMobileResize: true }) so the mobile address bar doesn't make things jump. Follow HANDOFF "Responsive plan".

## Media checklist note (R14 covers it)
Waits for Anh's original files. Convert the two GIFs to MP4/WebM loops, serve images as WebP/AVIF sized to display size (srcset), preload only hero media, lazy-load archive and project images, compress the hero video and add a poster frame, preload the Clash Display woff2.
