# R37d WIP review — 2026-10-11

Stopped under the three-fix rule. R37d is not complete; its request stays open. R39 implementation has not started.

## Questions and decisions

1. Keep the approved 0.6-second move plus 0.3-second tail as one gesture, crossing full screen near 0.51 seconds. Anh confirmed this boundary.
2. Landing speed feeds content zoom rather than a hidden box overshoot. The Work path uses one reversible trajectory; homepage easing stays unchanged.
3. Preserve the returning zoom and exact flat endpoint rather than the reference's continued zoom.
4. Prepare only one fine-pointer, non-tall Work renderer. Cold clicks retain their fallback.
5. A visible navigation gap after the subpixel tail requires option B, not edits to project pages. Anh confirmed that boundary.

## Implementation saved for review

Shared workFlight samples size and content over 0.9 seconds. workCarry=0.8 feeds nonzero landing speed into the content trajectory; the separate overshoot/window and rebound peak control were removed. Rebound strength remains 0.6, zoom 0.025, reverse enabled; bow 0.13, peak 0.25, end 0.7, corners 0.08. Tune controls and descriptions follow these changes.

Hover waits 120ms, compiles a hidden renderer, and uploads decoded texture in 64-row slices separated by animation frames. Click adopts it without uploading the same image again. Leave expires it after 2 seconds; different hover, scrolling, dragging and pagehide dispose it. Prepared context loss falls back to fresh construction.

Navigation starts when remaining lens/zoom displacement is below one device pixel. The renderer stays alive until pagehide or completion. In the latest real-navigation run this starts 9ms before animation completion; the header still appears 269.5ms after completion. An earlier run measured 284.3ms. **Option B for Anh:** allow the project page to resume the remaining rebound from sessionStorage. This is not implemented.

## Failed checks and stopping evidence

Three motion approaches: inherited-speed polynomial with an early lens lobe; a later lens peak; a coupled sinusoidal carry and lens trajectory. The final nominal-60fps grayscale measurement at 480px width still has four open valleys below 15% of peak (0.667–0.717s), and five return valleys (0.200–0.267s). Neither sequence has identical frames. A separate calculation of candidate trajectories did not produce a passing fit. No check or threshold was weakened.

Three hover fixes: decoded ImageBitmap before upload, sliced uploads, then removal of unused depth/stencil attachments. Measured worst hover frames fell from about 85.6ms to 76.3ms, 45.1ms and 46.8ms respectively at 4× CPU throttle on RTX4080. Final repeat: 40.7ms. Hover still hitches, so stop as WIP.

Warmed click passes: latest handler 5.3ms; first five frame intervals 11.9, 4.7, 2.0, 7.0, 6.6ms. Previous repeat: 15.6, 5.6, 5.8, 6.5, 7.0ms. Cold fallback remains slow: 125/131.9ms worst at 1920/2560; steady median 7.0/6.9ms and p95 7.1ms.

Reference 5.80–6.80s extracted at 60fps contains 30 duplicate frames and 24 interior below-threshold samples. Raw curves are retained without dropping duplicates. This source limitation does not excuse our failed guard.

## Visual gate — sheets inspected

Open looks like the reference: partly.
Biggest visible difference: our inward bend/zoom slows and reverses within the tail; the reference continues its zoom more decisively.
What would close it: fit a trajectory without the measured interior dip while retaining the approved flat hand-off, and resolve the page-load hold through a reviewed option B.

Return looks like the reference: partly.
Biggest visible difference: our rebound has a slow region before shrink; reference shrink reads more direct.
What would close it: remove the measured return valley, then recapture against the reference with the new crossing time. Current return sheet uses the old 0.3-second phase alignment rather than the new 0.39-second reverse crossing; it is qualitative, not exact timing proof.

## Passing verification

- npm run build passes. Cached compare: 542/542 within tolerance, zero mismatches at both 1920×1080 and 2560×1440.
- Homepage open: three points at each size, zero changed pixels.
- Composited endpoint: maximum difference zero at both sizes, DPR1/2. Bow stacking patch also maximum zero.
- gl=0, reduced motion and unavailable GL navigate successfully. Prepared loss creates a fresh canvas; loss during rebound restores DOM. Double click and wheel interruption checked.
- Twenty hover cycles and twenty open/back cycles leave zero transition canvases, contexts and textures. Leave expiry checked. No console/page errors.
- Earlier whole-page Work rest/return identity remains unverified (script issue); endpoint and cached comparisons do not replace that proof. Accepted R38 404 difference remains nine edge pixels, maximum one colour level; no 404 edit in R37d.

## Files, artifacts and commits

Branch: codex/r37-r38. Planning commit 08d038a, Pushed: 08d038a. Implementation checkpoint uses message `WIP R37d: save continuity and hover measurements for review`; its push receipt is recorded in status.md.

Every tracked file changed in this request: docs/requests.md, docs/codex/R37d.md, docs/codex/R39.md (planning); src/effects/bulge-gl.js, src/effects/project-transition.js, src/effects/tune-docs.js, src/timeline.js, src/work.js, src/work/tune.js; docs/codex/R37d-notes.md, docs/status.md.

Own ignored reproducible helpers: tools/scratch/r37d-capture.mjs, r37d-motion.mjs, r37d-runtime.mjs. Outputs: r37d-shots/actual.json, runtime.json, motion-summary.json, motion.csv, motion.png, candidates.json, dark/light open/back frames and reference sheets; r37d-ref/ref-001 through ref-061.png. Throwaway fit/profile helpers removed. Reused existing behavior, cycles, endpoint, homepage, fallback and performance helpers; their outputs remain in r37-shots/ and r37c-shots/.

Exact command to stop using all this branch's work: `git switch work-v2`.
