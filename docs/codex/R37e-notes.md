# R37e build notes — 2026-10-11 (in progress)

Decisions: Anh requested edge coverage throughout, so a resting header crop underlies the moving inner crop on both pages. Preserve Duhat's shorter video header and check its reveal separately (Anh confirmed). Use wall-clock Date.now across navigation, not a restarting clock. Start values zStart0.97, tail0.65s, land0.51s, lens0.22s/strength0.6; no new packages. R39 is not started.

One shared cubic zoom is copied verbatim into all seven first-paint scripts, with a helper checking source and intermediate 60/144Hz values. It starts below1 and only increases after full-screen crossing, ending exactly1. Work retains the inward lens; navigation starts when the lens is under one device pixel. The first-paint overlay continues the same zoom; project.js waits for both completion and decoded header before removal. A wordmark snapshot prevents it disappearing between documents. Legacy/home records keep the old path. Extensionless, .html and trailing slash paths are accepted.

Preparation: centered image warms on idle after1.8s; hover can replace it. GPU compilation is polled with KHR_parallel_shader_compile where available. Texture is resized/uploaded in64-row slices at the viewport/DPR cap. Profiling found a full-image createImageBitmap copy taking19.5ms on the main thread; removed it and resize each slice instead. Real-speed idle/hover worst14.1ms; at4x41.8ms (stress result). Warm click handler1.4/6.4ms. More validation and visual gate pending.

Passing so far: build; cached compare542/542 both sizes; all seven direct-link rest screenshots0 pixels (video paused at matched time); curve copies identical; extensionless/.html/trailing slash handoffs; real arrival has live zoom and overlay removes. Raw earlier rest helper differed because Duhat's video had advanced; original project.js response and current version now use the same paused timestamp.

Branch codex/r37-r38. Planning36e1652, Pushed:36e1652. WIP implementation checkpoint and later validation commits will be listed in status.md.

Files changed: docs/requests.md, docs/codex/R37e.md (planning); src/effects/flight-curve.js (new), src/effects/bulge-gl.js, src/effects/project-transition.js, src/effects/tune-docs.js, src/timeline.js, src/work.js, src/work/tune.js, src/project.js; work/bitis09.html, work/similac.html, work/duhat.html, work/nam-long.html, work/forbes.html, work/sulwhasoo.html, work/tcb-priority.html; docs/status.md, docs/codex/R37e-notes.md. Own ignored helpers/artifacts under tools/scratch/r37e-* will be inventoried at review.

Exact undo: `git switch work-v2`.
