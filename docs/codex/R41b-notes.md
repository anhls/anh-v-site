# R41b — phone and tablet transitions (done 2026-10-31)

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

## Finish (Claude, 2026-10-31; code unchanged since Codex's last push except the committed WIP core.js tweak)

Helpers: tools/scratch/r41b (git-ignored): matrix.mjs, attr.mjs (new: CDP CPU profile per gap), extra.mjs (real bfcache), fallbacks.mjs, resources.mjs, visual.mjs, title-profile.mjs.

- Tap response (final matrix, 32 cases: 390x844, 430x932, 768x1024, 1024x768 x 60/120 Hz x normal/4x x cold/warm): first moving frame 12-56 ms at normal CPU, 32-106 ms at 4x. Targets (<=100 / <=250) pass. Correct renderer and project everywhere, 0 errors, 0 fade frames.
- 4x CPU hitches, separated with attr.mjs (60 Hz, 4x): IN-FLIGHT there is no gap over 2.2 frames between the first frames and fwd:end (about 1.26 s) at any size. The gaps are (a) the start: 70-112 ms for the first ~100 ms (texImage2D upload, context, project page build; inside the 250 ms tap target); (b) the LANDING after fwd:end: 95-114 ms at phone / tablet portrait (lenis.js:105 reset 19-29 ms plus page swap), and 263 ms then 4 x 40-77 ms at 1024x768 4x (project-page.js:156 getBoundingClientRect + lenis). Those are project-page mount work after the flight ended, not flight frames. At normal CPU the in-flight gap is <=20 ms (60 Hz) / <=11 ms (120 Hz) and the landing <=47 ms. Not fixed: the landing mount cost is the desktop project page's, a separate request; 4x is a stress check.
- Title: first smear frame 7 ms (normal), 27 ms (4x; target about 20, was 54-60 before the warm-up flush). Swipe frame cost vs work-v2: median 8 / p95 8.1 / max 8.6-8.8 ms, unchanged at normal and 4x. 20 fast swipes: one hidden smear canvas, no ghosts.
- Contact sheets (contact-open/back/title.png, 1920 vs 390x844): looks like the desktop effect: yes. Biggest difference: the phone shows the vertical strip (neighbours above / below) instead of side neighbours, as designed. Motion curves (motion.json / motion.svg): phone and desktop peak at the same frame (open 36, back 1) and have the same shape; no stop-then-go.
- Fallbacks (reduced motion, ?gl=0, Save-Data, weak device, no WebGL): plain navigation, no flights, strip opens on the opened project (centre error 0.008 px), 0 errors.
- Real bfcache (Chrome with bfcache enabled): pageshow persisted=true, back canvas used, centre error 0.008 px for 3 projects; no-WebGL fresh load plain; address-bar resize keeps overlay 844 tall.
- 12 restore cases: landing <= 0.009 px, 0 wrong projects. Gestures: long press / fling-stop tap never open, double tap opens once.
- Resources over 20 open/backs: contexts 3 -> 3 (max 3), texture memory about 29.4-29.6 MiB, nodes flat at 78.
- Desktop unchanged (rerun on the final code): compare 542/542 at 1920x1080 and 2560x1440; desktop clicks.mjs 60 Hz 4x 50/50 renderer used, worst first 73 ms; midscroll landing <= 1 px, 0 fade frames at both sizes.
- Build and clean-clone build OK. Not verified: Cloudflare preview https://lite-r41b.anh-v-site.pages.dev/work/ (Access protected); the owners script (needs a local work-v2 ref); a real phone (Anh).
