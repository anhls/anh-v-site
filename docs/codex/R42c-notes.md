# R42c review candidate — 2026-10-12

What you will see now: a smaller outward puff, a visible inward opening bend, and a gentle inward back with a longer settle.
Still off: reference match is partial; the slowed-CPU run also has a later hitch.
Your decision: keep the brief's clear inward silhouette, or fit the video's subtler shape more closely. R42c remains open pending review.

## Choices and scope

- Created `codex/r42c-bend` from fetched `origin/work-v2` at `43678f1`. Wrote `.git/agent-busy` before fetching/switching, using section 12 of the already-fetched remote AGENTS (the initial local copy lacked section 12). No other busy note or local edits were present.
- The brief calls for inward top/bottom edges; decoded reference frames often show slight outward top/bottom curvature. Late side edges are partly obscured. A symmetric signed bow cannot exactly reproduce every axis. The candidate follows the brief's clear inward goal; Anh was asked which interpretation to keep.
- Anh explicitly approved adding `src/work/tune.js` to scope. Reporting files follow the brief's instruction to report per AGENTS section 6.
- `reboundAmp` previously changed texture coordinates, not mesh edges. The renderer now accepts independent signed mesh bow and corner radius. Homepage calls retain the existing default rendering path.
- Back uses its own continuous shrinking curve instead of reversing the open's stationary full-screen zoom tail. R42b placement and direct swap remain unchanged.

## Candidate values

All numbers live in `TRANSITION` in `src/settings/desktop.js`; new controls are exposed in the existing transition tuning group.

| Setting | Before | Candidate |
| --- | --- | --- |
| `bulgeAmp` / `cornerAmp` | 0.13 / 0.08 | 0.035 / 0.008 |
| `workSec` / `zoomTailSec` | 0.4 / 0.65 s | 0.6 / 0.2 s |
| full-screen crossing / total open | 0.34 / 0.99 s | 0.51 / 0.71 s |
| `inwardAmp` / `inwardStartAt` | absent | 0.045 / 0.45 of growth time |
| `backSec` / `backSizePow` | reversed open | 0.75 s / 3 |
| `backBendAmp` / `backBendEndAt` | outward opening pillow | -0.018 / 0.85 of return time |
| `backCornerAmp` | opening radius | 0.003 |

First trial used return power 4.5. The reference's width residual near 0.25 seconds was closer to 0.3 than 0.16, so the fitted cubic completes about 70% of the size change in 0.25 s and settles over another 0.5 s. The first sheet showed the old puff/radius were excessive, so both were reduced. At full screen the fitted opening's approximate horizontal growth speed is 1,357 px/s against initial zoom edge speed 1,440 px/s at 1920; this reduces the speed drop. It is a geometric estimate, not proof of a full-scene reference match.

## Visual gate and evidence

1. Looks like the reference: **partly**, open and back. Requested inward phases are present; a full shape match is not established.
2. Biggest visible difference: ours has landscape geometry and dark edges; reference top/bottom contours do not consistently share the brief's inward sign. Ours is deliberately clearer.
3. What would close it: Anh chooses the stated inward silhouette or the video's subtler/asymmetric shape, then reviews the fit. AGENTS section 2 says a partial match is not done, so this is a WIP checkpoint.

- [Open contact sheet](../../tools/scratch/r42c/contact-open.png), [back contact sheet](../../tools/scratch/r42c/contact-back.png): made with existing ffmpeg, decoded reference and production flight frames at matching normalised moments. Reference crop resized into the same display area; source aspect ratios differ.
- [Bow plot](../../tools/scratch/r42c/bow.svg), [60/144 Hz motion plot](../../tools/scratch/r42c/motion.svg), [reference motion comparison](../../tools/scratch/r42c/motion-reference.svg).
- [Our samples](../../tools/scratch/r42c/curves.json): all four analytic edge-midpoint bows, size, corner share and rendered grayscale differences. Opening peaks about +3.5% / -4.25% of the short side; return -1.8%. Both refresh rates use the same 0.71 / 0.75 s clocks. Time-paced rendered samples do not substitute for a physical 144 Hz display check.
- [Reference estimates](../../tools/scratch/r42c/reference.json): native 30 fps. Only usable top/bottom edge samples plotted; near-corner estimates are approximate. Full four-edge/corner-radius raster fit is **unverified**: neighbours, text and viewport clipping contaminate segmentation. No fabricated measurements substituted. [Reference motion](../../tools/scratch/r42c/reference-motion.json) omits duplicate frames; image/crop differences limit amplitude comparisons.
- Frozen capture initially hung because Playwright assimilated GSAP's paused thenable. Boolean waits and non-returning timeline seeks fixed the helper. No site check was edited or weakened.

## Checks

- `npm run build`: all layout gates pass, Vite 125 modules, 1.18 s.
- `npm run compare -- --sizes 1920x1080,2560x1440 --port 5199`: **542/542 both sizes, zero mismatches**, after final fit.
- Original `tools/scratch/r42/midscroll.mjs` recovered unchanged from `tools/scratch/r42/wt/tools/scratch/r42/midscroll.mjs` into [r42c/midscroll.mjs](../../tools/scratch/r42c/midscroll.mjs). Final runs at 5199 / 1920x1080: 60 Hz/history, 144 Hz/Works link. Twelve cases, rest/mid-scroll/mid-snap, TCB/Bitis/Sulwhasoo/Similac/Duhat and repeat clicks: **max 0.5 px**, **0 fade frames**, **0 errors**. The helper reports failures without a failing exit code; every case output was inspected.
- [Final timing/smoke](../../tools/scratch/r42c/smoke.json): warmed first-rAF callback after click **4.6 ms normal / 23.9 ms at 4x CPU**; maximum frame gap **27.7 / 222.3 ms**. Normal first response passes ~20 ms; throttled first response exceeds it. Later throttled hitch unresolved. Callback timing is a responsiveness proxy, not a display presentation timestamp. Earlier run 3.9 / 18.9 ms and max 20.9 / 194.4 ms; final results take precedence.
- Tall smoke 390x844: home/menu, Work and Bitis09; tall layout, zero transition canvases, zero console/page errors. Phone effects remain off.
- Clean clone of `5a586b3` into `tools/scratch/r42c/clean-clone`, `npm ci`, `npm run build`: **pass**, Node v24.20.0, install 8 s / zero vulnerabilities, all layout gates, Vite 125 modules / 1.32 s. Local npm warned of unapproved esbuild/ffmpeg-static install scripts; no approval/config changes made. Root dependencies/packages unchanged.
- Hosted build **unverified**: after push, HEAD to `https://codex-r42c-bend.anh-v-site.pages.dev/` returned Access HTTP 302. Protection does not prove deployment success; no authenticated dashboard access.
- Homepage/theme/404-specific checks skipped per brief. Ownership command run before each commit; broad warnings include inherited R42/lite files this task did not edit.

## Files, commits and undo

Tracked files changed: `src/effects/bulge-gl.js`, `src/settings/desktop.js`, `src/work/tune.js`, `docs/status.md`, this note. `docs/requests.md` stays unchanged because R42c is not done. No changes to `project-transition.js`, `flight-curve.js`, packages, layouts or media.

- `84f8614` — `WIP R42c: separate inward edge bend and back settle`. Pushed: `84f8614`.
- `5a586b3` — `WIP R42c: fit puff strength and continuous drop timing`. Pushed: `5a586b3`.
- Report checkpoint: `WIP R42c: record partial reference match for review`; exact hash and push outcome in chat.

Retained ignored helpers: [capture](../../tools/scratch/r42c/capture.mjs), [reference](../../tools/scratch/r42c/reference.mjs), [curves](../../tools/scratch/r42c/curves.mjs), [sheets](../../tools/scratch/r42c/sheets.mjs), [reference motion](../../tools/scratch/r42c/reference-motion.mjs), [smoke](../../tools/scratch/r42c/smoke.mjs), unchanged midscroll. Linked final PNG/SVG/JSON evidence retained; intermediate images and one-off edit scripts removed. Ignored clean clone retained for isolated build verification; site/build imports nothing from it.

Undo all R42c branch use: `git switch work-v2`. Busy note removed on hand-off. No work-v2 pushes, merges, resets or tags touched.


## Part B — repeatable clicks, 2026-10-12

Anh has deferred clear versus subtle until the eye check. The current clear bend and all flight/bow numbers are unchanged.

Confirmed gaps: cold `takePrepared()` returned null and ran a flat DOM flight; a click before `swap.warm()` completed took the older navigation path. Centre preparation existed but waited 1.8 seconds and was not rearmed when a wheel gesture finished on the same project.

Implementation (`1be3b07`, pushed): prepare the centre after 180 ms of rest, rearm on wheel input, warm the router in a separate task after setup, await it on early clicks, and finish the clicked card's texture/shader preparation before starting the flight clock. Only one prepared renderer is retained. Hover/leave/wheel cannot cancel an active click's preparation. Failed texture preparation now cleans up instead of leaving a pending renderer. Startup clicks during asynchronous setup are queued; modified clicks and disabled-effect policies retain their existing paths.

Cold clicks display a progress cursor immediately, with the picture kept at its starting crop until ready. They then run the entire original puff/inward/settle curve from time zero. This is feedback, not immediate picture motion. A true renderer failure takes normal navigation rather than claiming to animate a flat flight.

- [Mixed-click helper](../../tools/scratch/r42c/clicks.mjs) and [results](../../tools/scratch/r42c/clicks.json): 50 cases per clock/CPU configuration, five scenarios repeated ten times. Synthetic clicks are cancellable and do not send pointerenter; wheel tests park the mouse, another-hover tests explicitly prepare another card, and early-load cases click as soon as anchors exist. The helper initially used non-cancellable MouseEvents, which caused default link navigation despite preventDefault; corrected the helper, no acceptance condition weakened.
- Size curves are sampled at normalised progress 0/.2/.45/.7/.9; exact equality checks growth consistency across different card sizes. Renderer-used marks and a live canvas verify the bend path. Refreshed bow/motion plots separately inspect the unchanged renderer at 60/144 Hz; this does not prove identical whole-scene pixels or physical 144 Hz smoothness.
- Midscroll: six 60 Hz/history plus six 144 Hz/Works-link cases, max 0.5 px, zero fading frames and errors. Full cached compare: 542/542 both sizes. Tall smoke: home/menu, Work, Bitis09 at 390x844; effect off, no errors. Warm click response proxy 5.6 ms normal / 34.6 ms at 4x; max frame gaps 41.8/312.5 ms. Existing throttled hitch remains.
- Clean local clone of pushed `1be3b07`, locked `npm ci`, `npm run build`: pass, all layout gates and Vite 125 modules. No dependency/package changes. Cloudflare remains unverified: GitHub combined statuses are empty; Access protects the preview.
- Refreshed [open](../../tools/scratch/r42c/contact-open.png) and [back](../../tools/scratch/r42c/contact-back.png) sheets were visually inspected. Looks like reference: partly. Biggest difference: stronger symmetric inward bend and landscape geometry. What closes it: Anh's eye check, with the clear version retained as instructed. R42c remains a review candidate, not reference-match sign-off.

Files changed in Part B: `src/work/core.js`, `src/effects/project-transition.js`, this note, `docs/status.md`. Shared edits are limited to preparation, click readiness and startup capture; no lite policy/settings changes. Ownership warnings include inherited lite changes, not edits made here. Homepage/theme/404 identity checks skipped per brief. Final sheets, curves, clicks JSON, smoke JSON and linked helpers retained; intermediate frame dumps removed. Undo branch use: `git switch work-v2`.

Final mixed-click results: 60 Hz **50/50**, 144 Hz **50/50**, 4x CPU/60 Hz **50/50** renderer uses and animations; zero page errors and zero normalised growth spread in all three sets. Worst click-to-flight waits: **760.7 / 1207.1 / 2087.7 ms**. First-rAF response proxies: **24.4 / 15.6 / 89.5 ms** respectively. The synchronous progress cursor is set before preparation, but its presentation time is not measured; the 60 Hz proxy exceeds ~20 ms, so responsiveness is not claimed fully signed off. No additional bend tuning pending Anh.
