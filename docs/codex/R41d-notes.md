# R41d: iPhone stalls near rest, strip WebGL lost (Claude, 2026-10-31, branch lite/r41b)

Evidence: Anh's two ?perf reports + recording (docs/reference/r41c-iphone-*). Not reproducible in Chromium (no iOS), so the fixes are mechanism fixes checked for no regression; the real-phone check is Anh's (`?perf=quiet`, below).

## Found
1. **My own R41c diagnostics killed the strip's WebGL context.** The ?perf overlay called `__why()` ten times a second and `__why()` called `gpuName()`, which created a new throw-away WebGL context every call. iOS Safari has a small global budget of live contexts (a released one is only freed later) and drops the OLDEST when it is spent: the strip's own context. That is the report-2 state: `glOn:false, glOffReason:"noWebGL2"` (lite's reason text is fixed; it does not mean creation failed), `canvasDpr:0`, no warp. Fixed: ONE cached probe (`gpuProbe()`), closed at once, taken before any other context exists (peak stays 3).
2. Work that waited for "rest" was not tied to one signal: the project page build (`v.build()` + `v.prime()`, 23 + 86 ms at 6x CPU) ran from timers/idle callbacks that nothing cancelled when a finger came back; the neighbour decode, title textures, idle renderer prepare and picture uploads each had their own idea of rest; a touchdown on a picture (every flick starts on one) started the tap-prepare (decode + renderer) in the flick's first frames.

## Changes
- `src/util/gl-ledger.js` (new): every context goes through `glOpen` / `glClose`: live count, peak, created / failed / lost / closed, events with the reason (`webglcontextcreationerror` statusMessage, `webglcontextlost`). In the ?perf report as `glLedger`. Sites: strip, transition renderer, title smear, hero (project page), the GPU probe. The strip's `destroy()` now also releases its context.
- Lost strip context: the flat fallback as before, and on phone / tablet it is rebuilt (600 / 1200 / 1800 ms, only while visible and calm, max 3). Tested: forced `loseContext()` -> glOn true again in under 2.7 s, live 3.
- `src/work/rest.js` (new): ONE rest definition = strip speed < 12 px/s for 150 ms, no finger, no snap / coast / morph / transition. Jobs are queued (`schedule(key, name, fn, afterMs)`), at most ONE per frame and 45 ms apart; a finger / wheel / key (`interrupt`) ends rest at once. Queued: header fetch, idle transition renderer, project page build (new `swap.prebuild(slug, calm)`: its idle callbacks re-check calm every 100 ms and `swap.cancelPrebuild()` runs on drag / wheel), the three neighbour decodes (one per job), the title textures (one per job), the picture loads (`idleLoad`). The tap-prepare starts only after the finger stayed put 70 ms and is cancelled by a drag.
- Slicing: the tall project page is built in 9 steps (blocks 4 at a time, then footer) and primed in 34 steps (one section per step; `display:none` sections switched on one by one). `show()` switches on whatever is left. Desktop build unchanged (one stage).
- `?perf=quiet`: records everything, draws nothing (no graph, no 10 Hz repaint, no synthetic baseline scroll), one small "Copy report" button. Report fields: `restJobs` (`{name, ms, stripSpeed, sinceTouchEnd, restForMs, moving}` per job + summary + `ranWhileMoving`) and `glLedger`.
- Soft snap and a grab: the 48 px / 91 px `snapCorrectionPx` entries in Anh's reports are short touches that STOPPED a coasting strip (no drag, `fling:false`); the snap then paged to the nearest project, which could be BEHIND the travel direction. Now: if the nearest project is more than 15 % of a pitch behind the direction it was travelling, the next one ahead is taken. Test (grab.mjs, 12 grabs mid-coast at 4x CPU): 12 of 12 settle in the direction of travel (before: not measured; the rule is new). Drag, fling and wheel clear the rule.

## Measured (Chromium, 6x CPU, 14 touch flicks with the strip coasting to a stop between)
- 390x844 and 430x932: worst moving frame gap 14-17 ms, 0 stalls over 50 ms, 0 jumps, 0 WebGL contexts created during flicks; retreat 0-13 px (one flick at 430 went 13 px back: slow-release paging, left as is).
- Rest jobs (worst, 6x): preloadHeader 2.7, prepareIdle 1, prebuild 0.9, decodeNeighbour 1.4, titleTexture 6.5, pageBuild step 8.5, **pagePrime step up to 22** (four sections 12-22 ms: image-heavy sections; one section is the smallest slice left), titleSet / titlePlay 0.4 / 1.7 (they run at the title's "stopped" while the strip is still slowing: by design, tiny). Before: pageBuild 23, pagePrime 75-86 in ONE task. All queued jobs ran at rest (`ranWhileMoving` 0); the only 4 flagged are the title set / play.
- Contexts: live 3 (title, strip, transition), peak 3, after 20 open / back cycles + 3 reloads: `glOn:true`, 0 failed / 0 lost, at 1x and 4x CPU.
- R41b / R41c suites: matrix --quick (all rows pass, exit 0), restore, gesture (long press, fling stop, double tap, 20 swipes, menu back), resources (3 contexts flat, 30 MiB), fallbacks (gl0, reduced, saveData, weak, noWebGL), real bfcache (persisted true x3) pass.
- Desktop unchanged: compare 542/542 at 1920x1080 and 2560x1440; clicks 3 x 50 renderer used (60 Hz maxWait 27 ms, 144 Hz first frame 22 ms, 4x 73 ms); midscroll <= 0.5 px, 0 fades both sizes.

## Not verified
- The real iPhone (Anh). Cloudflare preview (Access protected).
- pagePrime steps of 12-22 ms at 6x are over the ~8 ms target; on desktop Chrome that is about 2-4 ms; on an iPhone it is probably 6-12 ms. If the `restJobs` of the new report still show them as the slow ones, the next cut is `content-visibility` on the page sections or not priming the last sections.
- `longTasks` stays empty on iOS: `restJobs` is the only main-thread evidence there.

## For Anh's new recording
Open https://lite-r41b.anh-v-site.pages.dev/work/?perf=quiet (no overlay, only a small "Copy report" button bottom right). Flick as before, tap a picture, go back, press "Copy report" and paste it. Record the screen at the same time if you can.
