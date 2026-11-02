# R43 notes (desktop, Claude Code, desktop/r43-perf-fixes)

## What changed
- src/work/core.js: desktop only (`!mode.tap`): the far pictures load through `idleLoad(true)` (one per slice, only at rest, nearest to the centre first) instead of the 15 ms stagger at 800 ms. Lite keeps the old stagger (untouched).
- src/work/core.js, src/work/rest.js: `restJobs` now separates `ranInFlight` (page steps of an open / back flight) from `ranWhileMoving`; every moving job also lists `blockedBy` (which term of the rest signal held rest: touching / snap / inertia / morph / speed / interrupt).
- src/work/core.js: `why.chosen` uses the real mode (`desktop (animated)` / `lite (animated)`).
- src/effects/perf-hud.js: runs are saved with merge-on-write (a stale copy of the runs can no longer erase newer ones); the Reset button clears storage first.
- src/effects/page-swap.js: a forward through the browser history (no flight) is now a recorded run (`fwd:click` ... `fwd:end`).

## Measured (Chromium, 1920x1080, 4x CPU, ?perf baseline, 8 s)
- The laptop's 152 ms frame is an integrated-GPU upload cost; it does NOT reproduce here (texImage2D 0-13 ms). What reproduces: three uploads inside 40 ms at ~1.3 s (frame 69.5 ms at 1309 ms). After: uploads at 1202, 1482, 1658 ms (>= 170 ms apart), no frame over 50 ms after 1.1 s except one 48.6 ms. The load-time frames before ~1 s (42-270 ms) are page load, unchanged.
- Report test (rounds.mjs / mixed.mjs): 3 rounds with history back, nav link, CDP mouse-back button, a forward through history: all present (3 fwd + 3 back; 5 + 5 with the forward round).
- Rest signal: it WAS fed on desktop (core.js calls rest.update every frame). In every local run, ranWhileMoving = 0. The 134 / 146 flagged jobs in Anh's reports could not be reproduced; I could not find the cause. `blockedBy` will name it in the next report.
- Not reproduced: why Anh's backRuns were empty. The in-place back records `back:arrive` (R41h) and ends at `back:idle-load-end`; every back path I tried records. Likely those reports came from a build before R41h; if the next report still shows 0 backs, send it.

## Checks
compare 542/542 at 1920x1080 and 2560x1440; clicks.mjs 50 x 3 configs: 150/150 used, 0 errors (worst click-to-first-frame 32.1 ms 60 Hz, 27.5 ms 144 Hz, 83.4 ms 4x; R42d: 33.5 / 26 / 91); midscroll 1920 + 2560: 0 cases over 1 px, 0 fade frames; tall smoke 390x844 ok; R41 restore (12 cases) and gesture (20 swipes, menu-back, double-tap) against this branch: pass; build OK.
Skipped: leak cycles (no renderer code changed), theme / 404.
