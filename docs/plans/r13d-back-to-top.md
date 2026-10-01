# R13d (draft, after R13c; Sonnet 4.6 is fine): "Go Back To Top" without the long scroll

Problem: the footer link smooth-scrolls the whole page back to the top, replaying every scrubbed animation, 35 cards and image loads, so it is long and laggy.
- A+ (default): everything EXCEPT the big AV wordmark fades to black (~0.4s, ONE black overlay layered just below the wordmark, opacity only) -> instant jump to scrollY 0 while hidden (Lenis scrollTo(0, { immediate: true }), ScrollTrigger.update, every section in its top state, nav in its big state, no loader replay) -> the hero fades back in around the wordmark (~0.6s). The wordmark is big at the footer and big at the top: it must not move or flicker.
- A (fallback): same, overlay above everything (wordmark included). Use when navigator.hardwareConcurrency <= 4, navigator.deviceMemory <= 4 (when available) or Save-Data is on. No frame-time measuring.
- prefers-reduced-motion: instant jump with a very short plain fade.
- Timings and the fallback rule in timeline.js; force a path with ?top=aplus / ?top=a.
- Check: one 4x CPU-throttled run of A+ (report the worst frame), no visible wordmark jump. Full compare at both sizes.

Later (polish, after everything else, Anh's call): the "rewind" version C (page streaks upward, jump, settles back in; transform/opacity only on one wrapper + one overlay, blur only on strong devices), with A as its fallback.
