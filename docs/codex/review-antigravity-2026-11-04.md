### Ranked Code Review (`work-v2`)

---

#### 1. Background `idleLoad` and touch-activation timers continue running while a project page is open in-place
- **Issue**: `pause()` stops the Work strip's ticker when a project opens in-place, but neither `idleLoad()` nor the initial touch-mode `setTimeout` stagger checks `paused`. Because `rest.update()` is no longer called while `tick` is detached, `stillSince` stays frozen at its pre-pause timestamp and `rest.ok()` returns `true` for the entire duration the user is viewing the project page.
- **File + line**: [core.js:660-670](file:///D:/Portfolio%20website/anh-v-site/src/work/core.js#L660-L670), [core.js:996-1010](file:///D:/Portfolio%20website/anh-v-site/src/work/core.js#L996-L1010), [rest.js:18](file:///D:/Portfolio%20website/anh-v-site/src/work/rest.js#L18)
- **Why it matters**: While the user scrolls a project page (especially on a phone after returning from one project and opening a second), `idleLoad` keeps firing in the background every ~50 ms, decoding and activating hidden Work strip images/videos and competing for main-thread, network, and memory bandwidth with the active project page.
- **Suggested fix**: Check `if (paused || TC.on || TP.q >= 0 || !rest.ok())` inside [`idleLoad`](file:///D:/Portfolio%20website/anh-v-site/src/work/core.js#L1003) and inside the `mode.tap` activation timeouts at [core.js:996](file:///D:/Portfolio%20website/anh-v-site/src/work/core.js#L996) (or store and clear their timer IDs in `pause()`), and call `rest.interrupt()` inside `pause()`.
- **Effort**: **S**

---

#### 2. `saveHeroFrame` fails on iOS Safari (`createImageBitmap` resize options on `<video>`) and races with `location.href`
- **Issue**: [`saveHeroFrame`](file:///D:/Portfolio%20website/anh-v-site/src/effects/home-handoff.js#L16-L27) calls `createImageBitmap(video, { resizeWidth: w, resizeHeight: h, resizeQuality: 'medium' })` followed by `OffscreenCanvas.convertToBlob()`, and is invoked without `await` in [`installHomeLeave`](file:///D:/Portfolio%20website/anh-v-site/src/effects/home-leave.js#L115).
- **File + line**: [home-handoff.js:16-27](file:///D:/Portfolio%20website/anh-v-site/src/effects/home-handoff.js#L16-L27), [home-leave.js:115-123](file:///D:/Portfolio%20website/anh-v-site/src/effects/home-leave.js#L115-L123)
- **Why it matters**:
  1. WebKit/iOS Safari has long-standing bugs where `createImageBitmap(video, { resizeWidth, resizeHeight })` rejects with `InvalidStateError` / `NotSupportedError` on `<video>` elements, and `OffscreenCanvas` 2D context is unavailable prior to iOS 16.4. It silently hits `catch`, removing `pxhf` so the Work → Home return flight falls back to the static poster instead of the live video frame.
  2. Even where supported, `convertToBlob` + `FileReader` is asynchronous and unawaited; if the flight is skipped/aborted or finishes before JPEG encoding completes, `location.href = '/work/'` aborts the write.
- **Suggested fix**: Draw `video` directly onto a standard 2D `<canvas>` (`ctx.drawImage(video, 0, 0, w, h)`) and call `canvas.toDataURL('image/jpeg', 0.82)` synchronously (or await the promise before navigating at [home-leave.js:123](file:///D:/Portfolio%20website/anh-v-site/src/effects/home-leave.js#L123)).
- **Effort**: **S**

---

#### 3. Unreleased WebGL GPU resources, shader objects, and stacked `requestVideoFrameCallback` loops in `cards-gl.js` and `smear.js`
- **Issue**:
  1. [`createCardsGL.destroy()`](file:///D:/Portfolio%20website/anh-v-site/src/effects/cards-gl.js#L646) calls `glClose(gl, 'strip')` without deleting allocated textures (`tex`, `vtex`, `gridTex`), framebuffers/renderbuffers (`fb.ms`, `fb.res`, `fb.rb`, `fb.tex`), programs (`prog`, `post`, `postF`), VAOs, or buffers, and does not cancel the 400 ms warm-up `setTimeout` at [cards-gl.js:389](file:///D:/Portfolio%20website/anh-v-site/src/effects/cards-gl.js#L389).
  2. [cards-gl.js:346-352](file:///D:/Portfolio%20website/anh-v-site/src/effects/cards-gl.js#L346-L352) starts a perpetual `el.requestVideoFrameCallback(cb)` loop on every video element that never stops when `destroy()` is called. When [`startRenderer()`](file:///D:/Portfolio%20website/anh-v-site/src/work/core.js#L268-L276) rebuilds `cards-gl` after context loss on mobile, duplicate `requestVideoFrameCallback` loops stack on the same `<video>` elements.
  3. [`createTitleSmear.destroy()`](file:///D:/Portfolio%20website/anh-v-site/src/effects/text-fx/smear.js#L257) removes its canvas without calling `glClose(gl, 'title')` or deleting its cached textures in `cache`.
  4. If shader program linking fails at [cards-gl.js:116](file:///D:/Portfolio%20website/anh-v-site/src/effects/cards-gl.js#L116), [cards-gl.js:137](file:///D:/Portfolio%20website/anh-v-site/src/effects/cards-gl.js#L137), or [frame-gl.js:73](file:///D:/Portfolio%20website/anh-v-site/src/effects/frame-gl.js#L73), the function returns `null` without calling `glClose(gl, ...)`, leaking an active context slot in `gl-ledger` and the browser.
- **File + line**: [cards-gl.js:110-139](file:///D:/Portfolio%20website/anh-v-site/src/effects/cards-gl.js#L110-L139), [cards-gl.js:346-352](file:///D:/Portfolio%20website/anh-v-site/src/effects/cards-gl.js#L346-L352), [cards-gl.js:389](file:///D:/Portfolio%20website/anh-v-site/src/effects/cards-gl.js#L389), [cards-gl.js:646](file:///D:/Portfolio%20website/anh-v-site/src/effects/cards-gl.js#L646), [smear.js:257](file:///D:/Portfolio%20website/anh-v-site/src/effects/text-fx/smear.js#L257), [frame-gl.js:69-73](file:///D:/Portfolio%20website/anh-v-site/src/effects/frame-gl.js#L69-L73)
- **Why it matters**: iOS Safari enforces a strict per-page WebGL context and GPU memory limit. Relying solely on `WEBGL_lose_context` without deleting large textures/renderbuffers first delays driver reclamation on WebKit, and stacked `requestVideoFrameCallback` chains keep firing forever.
- **Suggested fix**: Stop the `requestVideoFrameCallback` loop when `lost` or ` !api.active` (or via `cancelVideoFrameCallback`), clear the warm-up timer ID in `destroy()`, delete textures/FBOs/programs before `glClose()`, call `glClose(gl, 'title')` in `smear.destroy()`, and call `glClose()` on early link-failure returns.
- **Effort**: **S**

---

#### 4. `tall-project.css` is dynamically imported without `await` in `in-place.js`, racing with `primeStep()` layout measurements
- **Issue**: At the top of [`in-place.js`](file:///D:/Portfolio%20website/anh-v-site/src/project/in-place.js#L22), `if (document.documentElement.dataset.layout === 'tall') import('../styles/tall-project.css');` fires an unawaited dynamic import.
- **File + line**: [in-place.js:22](file:///D:/Portfolio%20website/anh-v-site/src/project/in-place.js#L22), [in-place.js:89-102](file:///D:/Portfolio%20website/anh-v-site/src/project/in-place.js#L89-L102), [page-swap.js:24-27](file:///D:/Portfolio%20website/anh-v-site/src/effects/page-swap.js#L24-L27)
- **Why it matters**: On a phone/tablet, if the user taps a project card quickly (or on a slow mobile connection where `tall-project.css` takes longer to fetch than `in-place.js`), `primeStep()` and `show()` force layout (`offsetHeight`) and ScrollTrigger measurements before `tall-project.css` has applied, causing wrong section heights, unstyled flash, or mispositioned footer wordmark triggers.
- **Suggested fix**: Export a readiness promise (or await the CSS import inside [`warm()`](file:///D:/Portfolio%20website/anh-v-site/src/effects/page-swap.js#L24-L27) in `page-swap.js`) so `in-place.js` is only marked ready after `tall-project.css` has loaded.
- **Effort**: **S**

---

#### 5. `takeOver()` in `tall-menu.js` can hang `window.__siteReady` if the user taps the menu button during the takeover close
- **Issue**: [`takeOver`](file:///D:/Portfolio%20website/anh-v-site/src/effects/tall-menu.js#L306-L329) calls `set(false)` and then polls `setInterval(() => { if (!open && !sweeping) { clearInterval(iv); r(); } }, 50)`. While `set(false)` is sweeping (`sweeping === true`), the burger button is live (`z-index: 60`); if the user taps it during the close sweep, [`set(true)`](file:///D:/Portfolio%20website/anh-v-site/src/effects/tall-menu.js#L211) queues `pending = [true, 'list']`. When the close sweep finishes, [`finishSweep()`](file:///D:/Portfolio%20website/anh-v-site/src/effects/tall-menu.js#L202-L208) immediately invokes `set(true, 'list')`, setting `open = true` and `sweeping = true` synchronously before the 50 ms `setInterval` ticks.
- **File + line**: [tall-menu.js:202-212](file:///D:/Portfolio%20website/anh-v-site/src/effects/tall-menu.js#L202-L212), [tall-menu.js:327-329](file:///D:/Portfolio%20website/anh-v-site/src/effects/tall-menu.js#L327-L329), [tall-home.js:61](file:///D:/Portfolio%20website/anh-v-site/src/tall-home.js#L61)
- **Why it matters**: `takeOver()`'s promise (and `window.__siteReady` in `tall-home.js:61`) remains unresolved until the user manually closes the menu again, and the 50 ms interval keeps polling the whole time.
- **Suggested fix**: Resolve `takeOver()` directly from the `onDone` callback of that close sweep (or ignore burger clicks while `takingOver` / takeover close is in progress) instead of polling `open && !sweeping` with `setInterval`.
- **Effort**: **S**

---

#### 6. Repeated `<canvas>` DOM element & 2D context allocations in `tall-details.js` and `tall-menu.js`
- **Issue**: [`ink()`](file:///D:/Portfolio%20website/anh-v-site/src/work/tall-details.js#L125-L131) in `tall-details.js` and [`inkOf()`](file:///D:/Portfolio%20website/anh-v-site/src/effects/tall-menu.js#L71) in `tall-menu.js` call `document.createElement('canvas').getContext('2d')` on every invocation.
- **File + line**: [tall-details.js:125-131](file:///D:/Portfolio%20website/anh-v-site/src/work/tall-details.js#L125-L131), [tall-details.js:163-167](file:///D:/Portfolio%20website/anh-v-site/src/work/tall-details.js#L163-L167), [tall-menu.js:71](file:///D:/Portfolio%20website/anh-v-site/src/effects/tall-menu.js#L71)
- **Why it matters**: On phones, `tall-details.js` calls `ink()` ~18 times per `layout()` and 3 times on every single project change inside `placeTags()`, creating and discarding decenas of 2D canvas contexts during scrolling and resizing. In WebKit, 2D canvas contexts hold backing resources until GC runs.
- **Suggested fix**: Create a single shared module-level measurement context (`const measureCtx = document.createElement('canvas').getContext('2d')`) in each module (or in a shared `util/` helper) and reuse it across all `ink()` / `inkOf()` calls.
- **Effort**: **S**

---

#### 7. Per-frame TypedArray heap allocations in `applyFocus` and `core.js` `tick`
- **Issue**:
  1. [`applyFocus()`](file:///D:/Portfolio%20website/anh-v-site/src/work/focus.js#L13-L61) is called every frame while focus is building, unwinding, or nudging ([core.js:873](file:///D:/Portfolio%20website/anh-v-site/src/work/core.js#L873)), allocating 5 new TypedArrays per frame (`new Float64Array(N)`, `new Float64Array(n)` × 2, `new Uint8Array(n)`, `Float64Array.from(X)`, `Float64Array.from(Y)`).
  2. In [`core.js`](file:///D:/Portfolio%20website/anh-v-site/src/work/core.js#L886-L888), while any project image has hover progress (`hzA[q] > 0`), `tick` allocates `new Float64Array(N)` twice every frame (`rel` and `c`).
- **File + line**: [focus.js:21-60](file:///D:/Portfolio%20website/anh-v-site/src/work/focus.js#L21-L60), [core.js:886-888](file:///D:/Portfolio%20website/anh-v-site/src/work/core.js#L886-L888)
- **Why it matters**: Avoidable per-frame heap allocations create GC pressure during 60/120 Hz animations (violating `.agents/rules/house.md`: *"Never per frame: layout reads, getComputedStyle, querySelector, allocations"*).
- **Suggested fix**: Pre-allocate scratch buffers on `FA` / module scope (reusing or resizing only if `n` or `N` changes) and `.fill(0)` / `.set(...)` in place each frame.
- **Effort**: **S**

---

#### 8. Accessibility: Tall menu "About" view traps users without a "Back" control and puts a non-interactive `<p>` in the `Tab` cycle
- **Issue**:
  1. In [`tall-menu.js`](file:///D:/Portfolio%20website/anh-v-site/src/effects/tall-menu.js#L261), activating `.tmenu__about-btn` sets `menu.dataset.view = 'about'`, which hides `.tmenu__list` (`display: none`). There is no button inside the About view to return to the menu list—users can only close the entire menu via the top-left burger `X` or `Escape`.
  2. In [`focusables()`](file:///D:/Portfolio%20website/anh-v-site/src/effects/tall-menu.js#L60), when `menu.dataset.view === 'about'`, `.tmenu__text` (a static `<p tabindex="-1">`) is included in the `Tab` rotation (`[btn, menu.querySelector('.tmenu__text'), homeWm()]`), forcing keyboard users to tab through a non-interactive paragraph.
- **File + line**: [tall-menu.js:47](file:///D:/Portfolio%20website/anh-v-site/src/effects/tall-menu.js#L47), [tall-menu.js:60](file:///D:/Portfolio%20website/anh-v-site/src/effects/tall-menu.js#L60), [tall-menu.js:261-270](file:///D:/Portfolio%20website/anh-v-site/src/effects/tall-menu.js#L261-L270)
- **Why it matters**: Screen-reader and keyboard users get tabbed onto a static `<p>` element with no role or interactivity, and touch/keyboard users have no way to return from About to Work/Contact without closing and reopening the menu.
- **Suggested fix**: Remove `.tmenu__text` from `focusables()` (keep initial programmatic focus on `.tmenu__text` or the dialog container on view switch if desired, while `Tab` cycles only between interactive controls `[btn, homeWm()]`).
- **Effort**: **S**

---

#### 9. Accessibility: Work strip items and homepage Selected Work cards lack accessible names (`alt=""` inside unlabelled `<a>` / clickable `<img>`)
- **Issue**:
  1. On the Work page ([core.js:187-194](file:///D:/Portfolio%20website/anh-v-site/src/work/core.js#L187-L194)), every `<a class="work__item">` contains only an `<img alt="">` or `<video>` with no `aria-label` on the anchor.
  2. On the full homepage ([selected-work.js:42-43](file:///D:/Portfolio%20website/anh-v-site/src/sections/selected-work.js#L42-L43), [selected-work.js:126](file:///D:/Portfolio%20website/anh-v-site/src/sections/selected-work.js#L126)), `.sw__card` elements are `<img>` / `<video>` tags with `alt=""` that navigate on `window` click when hovered (`if (hov >= 0 && on && cards[hov].slug) window.location.href = ...`), making them completely unreachable by keyboard and invisible to assistive tech.
- **File + line**: [core.js:187-194](file:///D:/Portfolio%20website/anh-v-site/src/work/core.js#L187-L194), [selected-work.js:42-43](file:///D:/Portfolio%20website/anh-v-site/src/sections/selected-work.js#L42-L43), [selected-work.js:126](file:///D:/Portfolio%20website/anh-v-site/src/sections/selected-work.js#L126)
- **Why it matters**: Screen readers announce every `<a class="work__item">` on `/work/` as an unlabelled link (or raw URL slug), violating WCAG 2.4.4 / 4.1.2.
- **Suggested fix**: Add `aria-label="${p.title}"` (from `projects[it.proj].title`) to each `<a class="work__item">` in [`core.js:188`](file:///D:/Portfolio%20website/anh-v-site/src/work/core.js#L188).
- **Effort**: **S**

---

#### 10. Contact card `popstate` race when closing via `Escape` / outside click / fling and immediately reopening
- **Issue**: When [`exit()`](file:///D:/Portfolio%20website/anh-v-site/src/effects/contact-card.js#L109) closes the contact card, it calls `history.back()` asynchronously to pop its `{ cc: 1 }` history entry. The `popstate` event from `history.back()` fires asynchronously in a later task. If the card is reopened (or if `popstate` is delayed while another navigation state is active) before `popstate` fires, the listener at [contact-card.js:68](file:///D:/Portfolio%20website/anh-v-site/src/effects/contact-card.js#L68) sees `open === true` and `!(history.state && history.state.cc)` and immediately closes the newly opened card (`exit()`).
- **File + line**: [contact-card.js:68](file:///D:/Portfolio%20website/anh-v-site/src/effects/contact-card.js#L68), [contact-card.js:109](file:///D:/Portfolio%20website/anh-v-site/src/effects/contact-card.js#L109), [contact-card.js:213-226](file:///D:/Portfolio%20website/anh-v-site/src/effects/contact-card.js#L213-L226)
- **Why it matters**: Rapid close + reopen (or double-tapping a Contact trigger while closing) will immediately self-close the newly opened contact modal when the pending `popstate` from `history.back()` arrives.
- **Suggested fix**: Track a `popping` flag when calling `history.back()` in `exit()`; ignore the matching `popstate` in the listener (or prevent `openContact()` until the pending `history.back()` has settled).
- **Effort**: **S**

---

#### 11. Duplicate `hcmcTime` clock implementation & dead/unused code across `src/`
- **Issue**:
  1. [`src/util/clock.js`](file:///D:/Portfolio%20website/anh-v-site/src/util/clock.js#L1-L12) explicitly notes in its comment (*"R48's tall-menu.js has the same function inline (hcmcTime): at the merge it should import this file instead"*), yet [`tall-menu.js:21-22`](file:///D:/Portfolio%20website/anh-v-site/src/effects/tall-menu.js#L21-L22) and [`tall-menu.js:66-68`](file:///D:/Portfolio%20website/anh-v-site/src/effects/tall-menu.js#L66-L68) still duplicate the `Intl.DateTimeFormat` and minute-tick timer inline.
  2. [`warmNext = () => {}`](file:///D:/Portfolio%20website/anh-v-site/src/effects/page-swap.js#L129) in `page-swap.js` is a no-op stub still called at [page-swap.js:101](file:///D:/Portfolio%20website/anh-v-site/src/effects/page-swap.js#L101).
  3. [`src/effects/warp-shader.js`](file:///D:/Portfolio%20website/anh-v-site/src/effects/warp-shader.js#L35) declares `uniform float uZoom;` and uses it on line 91 (`if (fr && uZoom > 1.0) q /= uZoom;`), while [`cards-gl.js:130`](file:///D:/Portfolio%20website/anh-v-site/src/effects/cards-gl.js#L130) never queries `uZoom` and `uPinchDown` is declared/set ([warp-shader.js:34](file:///D:/Portfolio%20website/anh-v-site/src/effects/warp-shader.js#L34), [cards-gl.js:136](file:///D:/Portfolio%20website/anh-v-site/src/effects/cards-gl.js#L136), [frame-gl.js:187](file:///D:/Portfolio%20website/anh-v-site/src/effects/frame-gl.js#L187)) but never referenced anywhere in `POST_FRAG`'s `main()` body (the old 3-term branch was replaced by the cylinder projection).
  4. In [`work/index.html:63`](file:///D:/Portfolio%20website/anh-v-site/work/index.html#L63), the inline comment states `Below: <link rel="expect" href="#pxh" blocking="render"> holds the first paint until #pxh is in the DOM`, but unlike [`index.html:28`](file:///D:/Portfolio%20website/anh-v-site/index.html#L28), the `<link rel="expect">` tag is missing in `work/index.html`.
- **File + line**: [clock.js:1-12](file:///D:/Portfolio%20website/anh-v-site/src/util/clock.js#L1-L12), [tall-menu.js:21-22](file:///D:/Portfolio%20website/anh-v-site/src/effects/tall-menu.js#L21-L22), [page-swap.js:101, 129](file:///D:/Portfolio%20website/anh-v-site/src/effects/page-swap.js#L129), [warp-shader.js:34-35](file:///D:/Portfolio%20website/anh-v-site/src/effects/warp-shader.js#L34-L35), [work/index.html:63](file:///D:/Portfolio%20website/anh-v-site/work/index.html#L63)
- **Why it matters**: Dead uniforms (`uPinchDown`) cause `gl.getUniformLocation` to return `null` and perform redundant WebGL API calls every post-pass frame; duplicated clock timers and stale comments increase maintenance drift.
- **Suggested fix**: Reuse [`mountClock`](file:///D:/Portfolio%20website/anh-v-site/src/util/clock.js#L7-L12) / [`hcmcTime`](file:///D:/Portfolio%20website/anh-v-site/src/util/clock.js#L4) in `tall-menu.js`, remove the unused `uPinchDown` uniform and `warmNext` no-op, and either add the `<link rel="expect" href="#pxh" blocking="render" />` tag or update the comment in `work/index.html`.
- **Effort**: **S**
