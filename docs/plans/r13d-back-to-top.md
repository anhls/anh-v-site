# R13d (draft, after R13c; Sonnet 4.6 is fine): "Go Back To Top" without the long scroll

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
