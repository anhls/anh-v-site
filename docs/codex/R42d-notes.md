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

## NOT done / not verified
- compare 542/542 at 1920 and 2560, ?gl=0 and reduced-motion fallbacks, clean-clone build, Cloudflare preview.
- Pixel diff across the texture swap (2b) and worst hover-sweep frame time (R37e flag) not measured.
- Texture memory not stated.
