# R52d: what is on the phone Home that Work does not have (bisect, no guess-fix)

Evidence (Anh, iPhone 03.11 18:33 / 18:34): the same menu sweep runs at 60 fps on Work and at ~30 fps on Home; rAF stays at 16 ms (?debug=menu), so the screen is GPU / compositor-bound on Home. The loader's digit slides are fine, the loader SWIPE into Home is not.
Inventory taken with `tools/scratch/r52/layers.mjs` (390x844, after the page is ready; headless Chrome, so it lists what exists, not what it costs; tools/scratch is not tracked).

## Home (tall) vs Work (tall), DOM order, only layers with a cost class
| layer | Home | Work |
|---|---|---|
| `#hero.thero` fixed 390x844, poster `<img>` (z 0) + **`<video>` autoplay loop** (z 1), full screen, decoded + composited all the time | YES | no (Work: 2-3 small card videos / images + one GL canvas `.sw__gl`) |
| big wordmark `a.twm` (img 319x70), fixed bottom | YES | small `a.wordmark` (109x24), grows when the menu opens |
| tap spawner `.spawner` (8 items, display none at rest, `will-change: transform, opacity` on each) | YES | no |
| `button.tmenu__btn` z 60, **`mix-blend-mode: difference`** (blends with everything under it: here a playing video) | YES | YES (over a GL canvas) |
| `#tmenu` z 50, `will-change: opacity`; `.tmenu__panel` `will-change: clip-path` (the sweep's mask) | YES | YES |
| 9 `.tmenu__fx` items, **CSS `filter: blur(8px)` while animating, `will-change: opacity, filter, transform` always (tall.css line 27)** | YES | YES |
| smear canvas `.hf__canvas` z 49 (WebGL2, full screen, display none at rest, shown during a sweep) | YES | YES |
| flight canvas `div.hf` z 6 (WebGL, from home-leave.js `flight()`, `visibility: hidden`) | YES | YES (z 8) |
| Work GL: `canvas.sw__gl` z 1 (cards), `canvas.w2__smear`, `canvas.px__bulge`, project root `.pj-root` (hidden) | no | YES |
| loader layers (only until the loader ends): `.loader__bg` z 100, `.loader__veil` z 102 (opacity .7), counter with 10 `will-change: transform` digit spans | first load only | no |
| rAF loops (4 s sample): only the gsap ticker (~60/s) | 1 loop | gsap ticker + ScrollTrigger + card GL + title smear |
| CSS animations / transitions running at rest | none | none |
| WebGL contexts at rest | 3 (smear + flight + one I did not identify) | 5 |

Home-only, therefore the suspects (most likely first): the hero `<video>` under a WebGL smear canvas AND under a `mix-blend-mode` button (a blend over a video usually forces the browser to leave the video's fast path); then the big wordmark and the spawner (small); the blur filter / will-change items exist on Work as well (so unlikely alone).
R52c already pauses the video once the band passes 30 %, but the 30 fps starts in the first frames, before the pause: so the video's existence / compositing, not its decode, is the first suspect.

## Switches (src/util/off.js; nothing changes when `?off` is absent; combine with a comma; `?debug=menu` shows them)
| key | removes |
|---|---|
| `hero` | the poster, the `<video>` and the hero wrapper's content (the wrapper is display:none): the page colour shows |
| `video` | only the `<video>` (the poster picture stays: tells "decode / video layer" from "a full-screen picture") |
| `blend` | the burger's `mix-blend-mode: difference` (normal) |
| `blur` | the menu items' CSS blur filter and `will-change` (`filter: none; will-change: auto`) |
| `wm` | the big wordmark (display none) |
| `spawn` | the tap spawner is not built |
| `loader` | no loader (page ready at once; for menu tests only) |
| `all` | every key above = the 60 fps control |
| `smeardpr=1` | value switch (R52c): the smear canvas at 1x |

Not switchable on purpose: the smear canvas and the panel mask (they ARE the sweep; Work has the same). `div.hf` is visibility hidden (not composited) and exists on Work too.
The Work -> AV -> Home path paints its own copy of the open menu (`#pxg[data-menu]`) on top: test it with the same switches on Home (the layer is on top of the hero anyway).
