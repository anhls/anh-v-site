# R42d notes: no wait before the open animation

Builder: Codex (partial, stopped at usage limit) then Claude (finish + checks). Branch desktop/r42d-open-lag, 2026-10-31.

## Cold click to first moving frame (tools/scratch/r42d/timing.mjs; baseline.json vs final.json)
| config | before (centre / other) | after (centre / other / warm) |
|---|---|---|
| 1920 60 Hz | 641 / 546 ms | 60 / 22 / 20 ms |
| 1920 144 Hz | 365 / 302 ms | 22 / 37 / 6 ms |
| 1920 4x CPU | 1690 / 1564 ms | 78 / 71 / 27 ms |
| 2560 60 Hz | 637 / 515 ms | 55 / 47 / 18 ms |
| 2560 144 Hz | 371 / 290 ms | 21 / 20 / 13 ms |
| 2560 4x CPU | 2034 / 1782 ms | 74 / 72 / 27 ms |
Targets (<=100 ms at 60/144 Hz, <=250 ms at 4x, warm <=20 ms) met; warm 2560 4x = 27 ms, 1920 4x = 27 ms are 7 ms over the warm line at 4x only.
Biggest cost before: the 64-row, one-strip-per-frame texture upload (about 530 ms of the 640 ms).

## What changed
- 2a: a click uploads the on-screen card picture in one texImage2D (`prepareTexture(im, urgent)`); hover / idle keep the paced strips.
- 2b: the flight starts on the card picture; when the header decodes, `setTexture(hdr)` swaps it after the first flight frame (and again at the end so the held BACK renderer is sharp). Same image, same framing.
- 2c: a parked spare renderer (`spare`, `parkRenderer`, `recycleFlight`) is reused instead of a new WebGL context per prepare. The R42c held BACK renderer stays separate (back must never wait on hover state).
- 2d: idle prefetch decodes header of the centre and its two neighbours at rest only; `headerCacheCount: 3` caps retained decoded headers.
- 3: progress cursor removed (click path in work/core.js and project-transition.js).

## Checks run (Claude, dev server :5199, real Chrome)
- clicks.mjs 50 per config: 150/150 renderer used, 0 flat, 0 errors; worst click-to-first-frame 33.5 ms (60 Hz), 26 ms (144 Hz), 91 ms (4x).
- midscroll.mjs 1920 and 2560: landing <= 0.5 px, 0 fade frames, 0 errors.
- backs.mjs: 50/50 held renderer, 0 fade-only, bend -0.045 constant.
- Live connected WebGL canvases at rest over 20 open/back cycles (contexts.mjs): 3, flat at 3 every cycle.
- npm run build OK (layout checks + vite build); tall smoke (r42c/tall.mjs) 390 wide: no overflow, tap/back ok, 0 errors.

## Finish checks (Claude, 2026-10-31; scripts in the git-ignored tools/scratch/r42d: finish.mjs, swapgl.mjs, frames.mjs, contexts.mjs)
- compare: 542/542 within tolerance, 0 mismatches at 1920x1080 and 2560x1440 (live from cache).
- ?gl=0 and reduced motion: a click is a plain navigation to /work/<slug>.html, no overlay, no canvases, 0 errors.
- Swap pop (exact: WebGL readback of the flight canvas, frame before vs after setTexture(header), flight frozen so the geometry is identical, 1920x1080): mean abs difference 0.70-0.72 of 255 over the whole canvas, 1.3% of pixels differ by more than 16 levels (max 138, edge sharpening from the higher-resolution header). Normal frame-to-frame baseline 0.1-0.13. No visible pop; the card picture and header are the same framing (the existing swapToFull already assumed this).
- Frame cost (rAF gaps, 1920x1080, 2 runs each, work-v2 f062c31 vs this branch): normal CPU hover sweep worst 27.7-27.8 vs 27.7-28.0 ms, scroll to a new project worst 14.0 vs 14.0 ms: equal. 4x CPU: hover worst 34.8 / 69.6 vs 55.6 / 41.8 ms (noise), scroll worst 55.7 / 62.4 vs 48.7 / 48.7 ms, p99 48.6 vs 41.7-48.5 ms: scroll at 4x is up to about 7-14 ms worse at the worst frame. The R37e flag (14 ms / 42 ms) is already exceeded by work-v2 itself at 4x. Suspect: the idle header prefetch decode after a scroll rests; not chased.
- Texture memory (estimate): flight / prepared textures are at most 1920x1251 RGBA with mipmaps = about 12.8 MB each (strip upload at display size 1920x1080 = about 11 MB); 3 live contexts at rest, so about 35-40 MB worst case. Context count flat at 3 over 20 open/backs.
- Clean-clone build: git clone of the pushed branch, npm ci, npm run build OK.
- Cloudflare preview: not verified (Access protected, no link available to me).
