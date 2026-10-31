# R41b — phone and tablet transitions (in progress)

Branch `lite/r41b`, based on `origin/work-v2` bcc6e84. Builder: Codex. Started 2026-10-31.

## Readings of the brief

- The actual policy selector imported an obsolete, disabled `TRANSITION_POLICY` from tall settings. The intended `TRANSITION_POLICY_LITE` was unused. Select the intended policy and keep weak / Save-Data / reduced-motion navigation plain.
- Preserve the original tap gate's animation checks; add a separate gesture-intent check so plain navigation also rejects drags, long presses, fling-stopping taps and duplicate taps.
- Use the merged R42e timing without changing any bend or clock values. Capture the tap viewport for canvas, overlay and in-place header; defer strip resize during flight. Tablet landscape remains lite.
- Same-document back and a genuinely fresh Work document are separate restore paths. A session slug record handles plain navigation; a saved header pose allows the fresh document to rebuild the bend renderer.
- The perf HUD performs synthetic scrolling for five seconds. Helpers install the mark sink before navigation to disable that unrelated automatic scroll. The normal `?perf` HUD itself is unchanged.

## Implementation so far

Shared edits: `transition-policy.js` selects lite settings with a weak-device fallback; `bulge-gl.js` reads lite grid / upload rows and accepts a frozen viewport; `project-transition.js` freezes lite flight/back geometry, disposes hidden/resized idle resources, sizes lite textures to the 1.5 DPR budget, rebuilds a missing fresh-load back renderer, and preserves parked homepage behaviour; `work/core.js` wires the tap gate, idle delay, lite title tick, viewport capture, remembered project, and Works menu close/back route.

Lite files: `mode-lite.js` exposes the title and back-record helper; `settings/tall.js` enables the existing policy and defines phone type bounds; `tall-title.js` reuses `createSmear` without changing it or `v2-ui.js`; `tall-work.css` supplies lite-only title and captured-header styles; `tall-back.js` stores reload-safe header poses; `project-page-tall.js` installs/removes its pagehide capture.

## Evidence collected (not final sign-off)

- Initial 32-case matrix (four sizes, 60/120 Hz, normal/4x, cold/warm): correct renderer and project in every case, no console errors; largest landing difference 0.014 px; no fade frames. All tap-response targets passed. That first run included pre-flight and post-flight hold time in its worst-gap metric.
- A refined helper retains the total gap metric and separately measures moving frames, from first visible size change to `fwd:end`. The first capped-texture phone run had normal moving gaps 10.2–18.6 ms; 4x CPU still needs investigation (up to 140 ms). Some large gaps occur during project-page landing after the flight has ended.
- 12 restore cases: three projects × animation on/off × same-document/history vs fresh Work load, all within 0.009 px of centre; animated landings within 0.001 px, held/rebuilt renderer used, no errors. Real `pageshow.persisted` was not observed on the Vite preview; test separately before sign-off.
- Gesture check at normal/4x: long press and fling-stopping tap did not open; double tap opened once; 20 fast swipes left one hidden smear canvas, correct settled title, no ghosts; menu Work link closed the menu and played back correctly. Initial title draw was late (54/60 ms) before adding a two-frame hidden warm-up flush; subsequent draws were 7–17 ms. Rerun pending.

Pending: final timing matrix after the last viewport/title changes, visual contact sheets and logical 60 Hz pixel-motion curves, plain fallbacks and real bfcache, 20-cycle context/memory check, desktop regression suite, build/clean-clone build, push and Cloudflare check. Request remains open.

Local helpers/evidence live in `tools/scratch/r41b/` (ignored, retained for review). No packages, media, layouts, homepage source, desktop settings, smear renderer or desktop UI files changed.
