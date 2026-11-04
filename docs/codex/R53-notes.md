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

## Final Tier results (Claude Code, 2026-11-05, round 2)
Round 1 (2026-11-04) compare failed only because the homepage is hero-only since R45; with `?home=full` it passes. Code unchanged by the checks.
- Pushed: yes (`git push -u origin desktop/r53-review-fixes`).
- Clean-clone build (`git clone`, `npm ci`, `npm run build`): PASSED.
- `npm run compare -- --local "http://localhost:5199/?home=full" --sizes 1920x1080,2560x1440`: 542/542 at 1920x1080 and 542/542 at 2560x1440, 0 mismatches.
- Tall smoke 390x844 (touch, DPR 2): home, menu open/close, Work, menu on Work, open a project (/work/bitis09): 0 console errors.
- `?gl=0` (work + home) and `prefers-reduced-motion: reduce` (work + home): load with 0 console errors. (Home still shows the loader at 5 s: its normal ~7 s load.)
- Step 1: with a project open (`?perf=quiet`), `__restJobs().summary` is identical at 2.5 s and 6.5 s: no `activate` / idle jobs run while paused.
- Step 2: `saveHeroFrame` run in Chrome both ways: normal path writes a JPEG data URL (len 17723), forced canvas fallback (`dbg-handoff-canvas=1`) writes one too (len 17727). iPhone itself NOT checked: Anh must test Work -> Home on the iPhone (does the grow flight start from the moving video frame?).
- Step 3: forced context loss (all canvases) 3 times: strip rebuilt each time, live contexts 1 after each (no extra contexts); `requestVideoFrameCallback` outstanding per video = 1 (one video) before and after.
- Step 4: scripted burger taps (5, 120 ms apart) during the takeover close (Work menu -> big AV -> Home): `__siteReady` becomes true, 0 errors.
- Step 5: for the same 390x844 session, bounding rects of all `.tmenu*` elements (menu on Home, menu on Work) and all `.tp-*` elements (project page) are identical to `work-v2` (4d08004): 23/23, 23/23, 81/81 equal, 0 difference.
- Leak cycle (Work -> project -> Back, 4 times, `?perf=quiet`): ledger identical after every cycle (live 5, created 6, peak 5), video-frame callbacks 1, 0 errors.
- Not done: contact sheets before/after (rects and compare used instead), 4x CPU throttle, Cloudflare preview build (no access to check).

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
