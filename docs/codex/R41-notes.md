# R41 Part A notes (mobile/next, 2026-10-11)

What you will see now: on a phone the project page header rests slightly zoomed in (1.10), like the picture that the transition will land on. Nothing else changes for visitors: the open / close transition is still off on phones and tablets.
Still off: tapping a Work image is still a plain page load; the transition itself waits for Part B (needs R37f's engine merged).
Your decision: none yet. Part B starts when Cowork has merged R37f into work-v2.

## Done
1. `FLIGHT = { zEnd: 1.10 }` added to src/settings/shared.js (R37f's identical line; R37f's branch was not available here). Tall header: `.tp-hero .tp-media` scales by `--flight-z` (set from FLIGHT in project-page-tall.js); the hero's overflow clips it, scale >= 1 so it always covers. Checked at 390x844: matrix(1.1) on a 390x844 hero, no gaps.
2. Tap gate (`createTapGate` in src/work/mode-lite.js, exposed as `mode.tap`): refuses taps that stop a fling, drags, long presses, off-centre images, a second tap within 700 ms, reduced motion, Save-Data, a degraded device (guard warp off). `rect()` returns `{x,y,w,h}` like the desktop click call; `lock()` captures the layout viewport at tap; `unlock()` on bfcache restore. 10 unit checks pass (tools/scratch/r41/gate.test.mjs, not tracked). The core is not wired to it yet: see docs/codex/R41-engine-needs.md item 1 (core.js is R37f's this round).
3. `TRANSITION_POLICY_LITE` in src/settings/tall.js, `enabled: false`: bulge grid 20 (desktop 32), DPR cap 1.5 (desktop 2), upload slices 32 rows, bulge off on weakDevice, prepare = idle 600 ms after the strip rests plus touchstart fallback, one renderer, dispose on scroll / drag / pagehide / hidden / resize, plain load for reduced motion / Save-Data.
4. iOS / Android: no hover (idle / touchstart prepare), flight sized from the viewport captured at tap, header uses 100svh so the address bar does not resize it, bfcache unlock on pageshow(persisted), Low Power Mode has no web API so the frame-time guard (warp off) is the signal -> plain load. Safe areas: the flight fills the layout viewport; the page header already pads with env(safe-area-inset-*). Not testable without a real device: Part B.

## Checks (tier: FINAL for Part A)
- desktop compare 542/542 at 1920x1080 and 2560x1440.
- owners (lite): 4 lite files + shared.js (NOTE shared) + 2 docs. (`npm run owners` fails in this clone: no local work-v2 branch; checked with `git diff --name-only origin/work-v2`.)
- vite build ok; clean-clone build and Cloudflare preview: see "Pushed" line below.
- Skipped: tall screenshots of the Work strip, home and menu (no strip / home / menu code touched), motion curves (no motion code changed).

## Looks right? (header only)
1) looks like the reference: partly (no reference video of the phone landing exists yet; the rest state matches the desktop's 1.10 zoom). 2) Biggest difference: none visible in the static header. 3) Part B compares the flight's last frame with this rest frame.
