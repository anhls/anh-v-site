# R37e build notes — 2026-10-11 (in progress)

Decisions: Anh requested edge coverage throughout, so a resting header crop underlies the moving inner crop on both pages. Preserve Duhat's shorter video header and check its reveal separately (Anh confirmed). Use wall-clock Date.now across navigation, not a restarting clock. Start values zStart0.97, tail0.65s, land0.51s, lens0.22s/strength0.6; no new packages. R39 is not started.

One shared cubic zoom is copied verbatim into all seven first-paint scripts, with a helper checking source and intermediate 60/144Hz values. It starts below1 and only increases after full-screen crossing, ending exactly1. Work retains the inward lens; navigation starts when the lens is under one device pixel. The first-paint overlay continues the same zoom; project.js waits for both completion and decoded header before removal. A wordmark snapshot prevents it disappearing between documents. Legacy/home records keep the old path. Extensionless, .html and trailing slash paths are accepted.

Preparation: centered image warms on idle after1.8s; hover can replace it. GPU compilation is polled with KHR_parallel_shader_compile where available. Texture is resized/uploaded in64-row slices at the viewport/DPR cap. Profiling found a full-image createImageBitmap copy taking19.5ms on the main thread; removed it and resize each slice instead. Real-speed idle/hover worst14.1ms; at4x41.8ms (stress result). Warm click handler1.4/6.4ms. More validation and visual gate pending.

Passing so far: build; cached compare542/542 both sizes; all seven direct-link rest screenshots0 pixels (video paused at matched time); curve copies identical; extensionless/.html/trailing slash handoffs; real arrival has live zoom and overlay removes. Raw earlier rest helper differed because Duhat's video had advanced; original project.js response and current version now use the same paused timestamp.

Branch codex/r37-r38. Planning36e1652, Pushed:36e1652. WIP implementation checkpoint and later validation commits will be listed in status.md.

Files changed: docs/requests.md, docs/codex/R37e.md (planning); src/effects/flight-curve.js (new), src/effects/bulge-gl.js, src/effects/project-transition.js, src/effects/tune-docs.js, src/timeline.js, src/work.js, src/work/tune.js, src/project.js; work/bitis09.html, work/similac.html, work/duhat.html, work/nam-long.html, work/forbes.html, work/sulwhasoo.html, work/tcb-priority.html; docs/status.md, docs/codex/R37e-notes.md. Own ignored helpers/artifacts under tools/scratch/r37e-* will be inventoried at review.

Exact undo: `git switch work-v2`.

Second implementation step: flight-only overlay now paints from the head before stylesheets; legacy/home records still paint at the original body point. Carry a wordmark snapshot into the first paint. Source responsive metadata follows the flight. Project overlay blends into the decoded header only once remaining zoom displacement is under1 device pixel, avoiding Chrome's different layer rasterization at the endpoint. All6 still headers pass composited endpoint at1920/2560 DPR1/2: max0 at DPR1, at most1 level and0.0047% pixels at DPR2. Duhat's video exception remains approved.

Fit changed zStart0.97→0.9, inward strength0.6→0.1: the stronger old lens could reverse local optical motion despite monotonic zoom. Keep tail0.65s; reverse zoom0.3s before shrink, separately tunable. Feather the moving crop's edges into the resting crop on both GPU and DOM so every edge is covered without a hard inner seam. Full-screen time remains0.51s; Work size carry0.8. Re-test motion guard after the source-pixel correction below; not yet done.

Real navigation exposed source-pixel cropping: srcset density-corrected naturalWidth is not the bitmap's raw width. A plain decoded image of currentSrc now supplies slice coordinates, while retaining the same responsive file selection. Previous raw motion recordings before this correction are superseded.

Fast3G plus deliberately delayed hero decode passes: overlay stays at scale1 until decode, then disappears; history back/forward0 overlays; Duhat retains863.3px video header at1920 width and reveals it. Homepage6 frames0 pixels; fallback/loss/double-click/wheel pass;20 open/back and20 hover cycles0 resources and0 errors. Real host check redirects to Cloudflare Access login, so authenticated preview verification remains Anh's check.
