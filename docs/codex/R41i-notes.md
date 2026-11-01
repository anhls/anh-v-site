# R41i notes (Claude, 2026-11-01, branch lite/r41i)

**Not reproduced.** In Chromium (390x844, 6x CPU) the no-shrink back (fake popstate with `hasUAVisualTransition` true, tools/scratch/nosh.mjs) was never slow: worst frame 22-34 ms before my change. The iPhone's 415 / 484 ms single frame therefore comes from work that is much heavier on iOS than the JS timings here suggest (style / layout / paint of the big DOM changes in one frame, GPU canvas re-show). What I could do without the phone: remove the biggest synchronous piece and make every step visible in the ?perf back run.

## What the landing did in ONE frame (JS ms at 6x, Chromium)
destroy of the project page ~15 (triggers + block / footer disposers 5, Lenis 3, removal of the large page DOM 5), strip resume ~10 (show, scrollTo, new Lenis 6, relayout only if the viewport size changed), then `finish()` (unlock, upload gate, idle load, prepare / prebuild scheduling).

## Changes
- `in-place.js` `destroy(defer)`: with `defer` (both back paths, shrink and no-shrink) only what the strip needs gone NOW is done in the landing frame: page hidden (`display:none`), nav, Lenis, ticker, classes, title. The triggers (`offs`), `disposeBlocks`, `disposeFooter` and the DOM removal follow ONE PER FRAME, starting two frames later.
- Marks in the ?perf back run (page-swap `back()` now also starts the run, R41h): `back:destroy-start`, `destroy-lenis`, `destroy-step` (x4, later frames), `resume-start`, `resume-shown`, `resume-scroll`, `resume-lenis`, `resume-relayout` (only if the size changed), `resume-end`, `finish-start`, `finish-end`. The phases between them show ms per step on the phone.
- Chromium after: no-shrink back worst frame 25-30 ms, 0 over 33 ms; synchronous landing JS ~25 ms (was ~30, with the teardown moved out); drag 50 ms after the landing moved the strip 240 px every time. Animated back: the teardown steps now fall in later frames (fly-start no longer waits for them).

## Still unknown (the phone's report decides)
If the iPhone's no-shrink landing is still one long frame, the marks will say whether it is JS (`resume-*`) or browser work after the JS (a gap with no mark): then the next candidates are `app.style.display` (re-show of the whole strip incl. the DPR-3 canvas), `relayout()` after an address-bar size change, or `gl.pauseUploads(false)` resuming texture uploads in `finish()`.
