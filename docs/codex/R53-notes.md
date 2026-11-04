# R53 Notes — Code-Review Fixes (from `review-antigravity-2026-11-04.md`)

- **Branch**: `desktop/r53-review-fixes` (from `origin/work-v2` at `4d08004`)
- **Builder**: Antigravity

## Brief Check
All six items in `docs/codex/R53.md` matched the current `work-v2` source cleanly. One minor line-number note for Step 6c: in `src/effects/frame-gl.js`, `uPinchDown` was only in the `uniforms(post, ...)` lookup at line 76 (not set in `postPass`), so removing it from `warp-shader.js`, `cards-gl.js` (lookup + uniform write), and `frame-gl.js` (lookup) removed every reference while keeping `uZoom` intact.

## Commits & Steps

1. **`8132950` — Step 1: Strip loading while a project is open (`src/work/core.js`)**
   - Call `rest.interrupt()` in `pause()` so `stillSince` resets immediately when an in-place project pauses the strip ticker.
   - Check `paused` alongside `TC.on` in `idleLoad()`'s `step()` (`if (paused || TC.on || TP.q >= 0 || !rest.ok()) { setTimeout(step, 60); return; }`).
   - Check `!paused` in the phone initial tap stagger (`if (!paused && !transitionBusy) activate(it);`); remaining items are picked up by `idleLoad()` in `finish()`.
   - Build check: `npm run build` + `npm run owners -- --side desktop` OK.
   - Browser check (`?perf` `restJobs` read during an open project): not run (sandbox), for the final check.

2. **`d26f9d2` — Step 2: iPhone hero frame (`src/effects/home-handoff.js`, `src/effects/home-leave.js`)**
   - Kept the `createImageBitmap` + `OffscreenCanvas` + `convertToBlob` path first in `saveHeroFrame(video)` and added a 2D `<canvas>` fallback (`drawImage(video, 0, 0, w, h)` + `toDataURL('image/jpeg', 0.82)`) when the offscreen path throws or is unavailable (or when `localStorage.getItem('dbg-handoff-canvas') === '1'` is set for testing).
   - Logged which path ran (`saveHeroFrame offscreen` vs `saveHeroFrame canvas2d`) via `dbg(...)` (`?debug=handoff`). Only clears `pxhf` / `pxhft` if the fallback also throws.
   - In `src/effects/home-leave.js`, kept `const saveP = saveHeroFrame(video)` and awaited `Promise.race([saveP, new Promise((r) => setTimeout(r, 150))])` after `await playFlight(...)` before `location.href = '/work/'`.
   - Build check: `npm run build` + `npm run owners -- --side desktop` OK.
   - Browser check (normal + forced fallback path in Chrome): not run (sandbox), for the final check.

3. **`2206620` — Step 3: GPU leaks on rebuild (`src/effects/cards-gl.js`, `src/effects/text-fx/smear.js`, `src/effects/frame-gl.js`)**
   - `src/effects/cards-gl.js`: stored per-video `requestVideoFrameCallback` handles (`vfcHandles`), stopped re-arming when `(!api.active) || lost`, and cancelled handles with `el.cancelVideoFrameCallback?.(vfcHandles[i])` in `destroy()`.
   - `src/effects/cards-gl.js`: stored the 400 ms post-pass warm-up timer (`warmT`), cleared any prior timer on `resize()`, and cleared it in `destroy()`.
   - `src/effects/text-fx/smear.js`: called `glClose(gl, 'title')` in `destroy()` (and on shader link failure).
   - `src/effects/cards-gl.js` & `src/effects/frame-gl.js`: called `glClose(gl, 'strip')` / `glClose(gl, 'hero')` before returning `null` if shader program linking fails.
   - Build check: `npm run build` + `npm run owners -- --side desktop` OK.
   - Browser check (`glLedger` after 3 renderer rebuilds and live video-frame callback count): not run (sandbox), for the final check.

4. **`b4a5a76` — Step 4: Phone menu takeover hang (`src/effects/tall-menu.js`)**
   - Kept `takingOver = true` across the takeover close sweep (or plain 260 ms close fallback), ignored burger open taps (`if (takingOver && on) return;`) while takeover close runs so `pending` is not queued, and resolved `takeOver()` directly from `endTakeOver()` when the close sweep / fallback finishes (removing the 50 ms `setInterval` poll).
   - Build check: `npm run build` + `npm run owners -- --side desktop` OK.
   - Browser check (scripted burger tap during takeover close, `window.__siteReady` resolves to `true`): not run (sandbox), for the final check.

5. **`dcd34b1` — Step 5: Text measuring (`src/work/tall-details.js`, `src/effects/tall-menu.js`)**
   - Reused one lazy-initialized module-level 2D canvas context (`let inkCtx; const c = (inkCtx ||= document.createElement('canvas').getContext('2d'));`) in `tall-details.js` (`ink`) and `tall-menu.js` (`inkOf`).
   - Build check: `npm run build` + `npm run owners -- --side desktop` OK.
   - Browser check (compare `ink()` outputs across one `layout()` before vs after): not run (sandbox), for the final check.

6. **`c603690` — Step 6: Dead code (`src/effects/tall-menu.js`, `src/util/clock.js`, `src/effects/page-swap.js`, `src/effects/warp-shader.js`, `src/effects/cards-gl.js`, `src/effects/frame-gl.js`, `work/index.html`)**
   - Imported `hcmcTime` from `src/util/clock.js` in `src/effects/tall-menu.js` and removed the duplicate inline `Intl.DateTimeFormat` + `hcmcTime` and the stale merge comment in `src/util/clock.js`.
   - Removed the empty `const warmNext = () => {};` and its call in `src/effects/page-swap.js`.
   - Removed unused `uPinchDown` from `src/effects/warp-shader.js`, `src/effects/cards-gl.js`, and `src/effects/frame-gl.js` (`uZoom` kept).
   - `git log -S 'expect' -p -- work/index.html` finding: `<link rel="expect" href="#pxh" blocking="render" />` was added in `5eaeca56` ("R45c round 3") and deliberately removed in `ffa2cb5f` ("R45c cleanup: drop the round 4 canvas layer and the work/ rel=expect (the view-transition hold covers both)"), which left the stale `<!-- R45c3: render-block... -->` comment behind. Updated the comment in `work/index.html` to describe the view-transition hold + `#pxh` script without adding the tag back.
   - Build check: `npm run build` + `npm run owners -- --side desktop` OK.

## Final Tier results (Claude Code, 2026-11-04)
- Pushed: branch pushed with upstream set (`git push -u origin desktop/r53-review-fixes`).
- Clean-clone build (`git clone` of the branch, `npm ci`, `npm run build`): PASSED (layout checks + vite build, built in 1.34 s).
- `npm run compare -- --sizes 1920x1080,2560x1440`: NOT 542/542 on this machine: 135/360 (1920) and 124/360 (2560). The SAME run against an
  untouched `origin/work-v2` (4d08004, port 5201) gives the identical 135/360 at 1920, so this is not caused by R53. Cause seen: in headless
  Chrome here `document.documentElement.scrollHeight` stays 1080 after `__siteReady` (ready after ~6.8 s on both branches), so `scrollTo` does
  nothing and every local value stays at its rest state. Not investigated further (stop rule: a check failed).
- NOT RUN because of the stop: tall smoke 390x844, `?gl=0` / reduced motion, leak cycle, and the per-step browser checks of steps 1-5
  (restJobs, glLedger / frame callbacks, burger tap during takeover, ink diff, forced canvas fallback). Still open.
- Cloudflare preview build: not checked.

## Shared & Lite-Owned Files Touched (Merge Note)
- **Lite-owned files**:
  - `src/effects/tall-menu.js`
  - `src/work/tall-details.js`
- **Shared files**:
  - `src/work/core.js`
  - `src/effects/home-handoff.js`
  - `src/effects/home-leave.js`
  - `src/effects/cards-gl.js`
  - `src/effects/frame-gl.js`
  - `src/effects/text-fx/smear.js`
  - `src/effects/warp-shader.js`
  - `src/effects/page-swap.js`
  - `src/util/clock.js`
  - `work/index.html`
