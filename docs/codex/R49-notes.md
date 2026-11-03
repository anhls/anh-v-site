# R49 notes: new loader (counter style of savoirfaire.nyc)
Measured on the reference (docs/reference/r49-*-sheet.png): digit cap height = 20.9 % of the WIDTH at both 1440x900 and 1920x1080 (not a constant share of the height), bottom gap 2.35 vw; on 390x844 their pair fills the width. Ours: LOADER in src/settings/desktop.js (capVw 20.9, capMaxVh 42, bottomVw 2.35; tall = width minus 16 px gutters). Digits Clash Display weight 200.
Progress sources: fonts (Clash Display load), the first-screen images, the hero video (buffered seconds ahead, 'can play' = full); weights 0.1 / 0.15 / 0.75; steps at 0 / .27 / .59 / .77 / .99 (99 = everything ready); 12 s stall cap.
Shared edits for the merge with R48:
- src/util/clock.js (new): hcmcTime / mountClock. R48's tall-menu.js has the same function inline: import it from here.
- src/data/data.json: added "menu.flavour" (identical to R48's) and removed "loader.text" (unused now).
- src/effects/home-flight.js: setPicture also accepts a 2D canvas (source.width / height), one line.
- runLoader signature is now runLoader({ urls, onReady }) (main.js, tall-home.js updated). Old loader code and its CSS/settings removed.
- Entrance: the wordmark / nav / ticker / burger are hidden while loading (html.is-loading) and fade in after the swipe (loader-out, base.css).
Ambiguities: ?skipLoader does not exist in the code (not added); wide-screen top text is one right block.
NOT run (time): Slow 4G run, 12 s cap run, 144 Hz motion curve, Home->Work->Back never-shows run, compare 542/542 at 1920 + 2560, clean-clone build, Cloudflare preview check. Build passes; ?gl=0 ends with siteReady.

## Round 2
- Wordmark: the page's own wordmark (desktop: nav.drive(1), the Work pages' small state; phone: .twm moved to x 5vw / y 3.4vh / 28vw wide, the project pages' phone small box) is on screen small from the first frame (z-index above the loader while html.is-loading) and grows to big with the swipe (the flight's own size curve, (1-t)^sizePow), released to the normal scroll logic at the end (new nav.release(), shared edit in nav.js). No loader copy, no entrance for it.
- Top text: one group, centred (gap 6.5 vw), first-line ink top level with the wordmark's ink top (measured: ink top = box top + 3 % of its height; my first guess from Anh's percentages was 37 %, which put the text 12 px too low). Phone: stacked, left edge at 50 % of the width. Burger hidden while loading.
- Anh's screenshot numbers (ink x 2.15-11.4 %) are wider than the Work pages' small wordmark at 1920 (3.1-11.9 %): I used the same element/state as the Work pages, so they match by construction; check his window size if it still looks off.
- Item 4 (menu-smear for the phone ending): not done, R48 is not merged; the phone keeps the flight look.
- Sheets: docs/reference/r49-r2-*. NOT run: Home -> Work -> Back (loader code path untouched), Slow 4G, 144 Hz.

## Round 2 add-on (layers + wordmark after the swipe)
- Layers while loading: hero < black background (z100) + top text (100) < wordmark (101, class loader-wm) < veil (102, --bg at LOADER.overlayOpacity 0.7) < digits (103). The swipe snapshot = background + top text (drawn at 30 %: under the veil) + digits at 100 %; the wordmark is not in it.
- At the swipe's first frame the veil is gone, so the wordmark gets a CSS mask: dimmed (30 %) right of the swipe front, full left of it, cut on the flip grid's cell edges (the cells whose centre the front passed). Measured wordmark brightness: 70 dimmed while loading, 232 once the front passed.
- The grow (small -> big, the flight's size curve, LOADER.wmGrowSec 1 s) starts only after the swipe has fully ended (+ LOADER.wmAfterSwipeDelay 0); nav / ticker / burger enter with it (enter.delaySec 0.2 from the swipe's end). Fade fallback: same order (fade, then grow).
- Fixed on the way: the snapshot's background read a transparent container (A showed through); it now reads .loader__bg.
- Sheets: docs/reference/r49-r2b-ending-*.png (rest, swipe at 0 / .25 / .45 / .65 / .999, grow at +0.45 / +0.95 / +2.15 s).

## Add-on 03:52
- LOADER.clockOpacity 0.75 (loader only; the phone menu keeps 0.25).
- Tall screens: the swipe is sized in css px: LOADER.swipeBlockPx 50 (grid = W / 50, min 8 columns: 8 on a 390 phone), swipeBrushPx 500 (the smear zone radius), swipePullRefW 1920 (the pull strength x 1920 / W, so the drag distance in px equals a 1920 desktop's), swipeJitterBlocks 1.5 (ragged front). Wide screens keep the flight's own numbers (38 columns, 1920 = ~50 px blocks; 1440 stays 38 px blocks): "desktop unchanged".
- Shared edits: home-flight.js shader gets uJit (a per-cell random offset of the flip front, 0 = the old straight edge; the flights never set it). WORK_PTR.pixelGrid is set for the tall swipe's length and put back at its end (pointer-fx reads the grid size there).
- R48's menu-smear.js is still not merged: this is the flight's smear with a wider zone and a ragged front, not that module.
- Sheets: docs/reference/r49-r3-ending-*.png.

## Fix 04:00 (no hero in the swipe)
- The swipe draws only the loader (snapshot: background, top text, digits); the swiped-away cells are transparent (new shader flag uClear, set only by loader-swipe.js), so the live homepage with its own dim shows through. No hero copy, no video upload during the swipe, nothing to keep in sync with the page's CSS.
- Check (hero video paused so its own motion does not count; mean luma of a hero patch, 30-70 % x 25-55 %): 1920: last swipe frame 7.00, settled +0.4 s 7.40 (the +0.1 s value 11.1 contains the growing wordmark crossing the patch, not the hero); 390x844: 57.23 -> 57.23 (identical). The video unpaused changes by more than that between any two frames, so only a paused video can show the dim.
- Lost on purpose: the dragged hero picture under the front (only the loader's pixels are dragged now).

## Add-on 04:06 (flights: the hero's dim)
- What dims the hero on the wide homepage at rest: the hero VIDEO's opacity, 0.15 (settings HERO.details.video.from.opacity, the hero timeline's start value) over the black hero background. The overlays (.hero__overlay / .hero__overlay2) are at opacity 0 at rest. Measured (paused video, mean luma of a patch): page 3.72 vs the raw frame 19.33. The phone / tablet home shows the raw video: page 21.19 vs raw 21.15, so no dim there.
- One source: src/util/hero-dim.js heroDim() (1 on tall, else that setting). home-flight.js: new uniform uDim (A / B brightness) in the shader (both the pixel look and the smear look); playFlight gives the hero picture (slot 0 on 'in', slot 1 on 'out') 1 - (1 - heroDim()) x size, size = the flight's own shrink / grow curve (1 = hero), the card picture stays undimmed. The Work -> Home mark (pxg) now carries dim; index.html paints the landing layer on black with the image at that opacity (no dim = as before).
- Luma table (dev server, video paused, frozen flight via __hfAt; patch 30-70 % x 25-55 %):
  1920: Home before tap 3.58 -> flight frame 0 2.61 (-0.97); flight (Work->Home) last frame 2.64 -> landing layer 2.59 -> settled home 3.54 (-0.90 / -0.95).
  390x844: 20.07 -> 20.04 (-0.03); last 20.14 -> layer 19.80 -> settled 20.07 (+0.07 / -0.27). All hero-side steps <= 1 level.
- Not a hero issue, seen in the same table: the Home->Work last frame vs the settled Work page card (1920: 40.9 vs 86.0; 390: 22.4 vs 45.4) and Work->Home frame 0 vs the Work page differ a lot. The dim is 1 there (undimmed card), so it is not this fix; the card on the Work page is a video loop (a different frame) and/or the strip is mid-move: not investigated, worth a look.
- Not run: the bfcache return path (it calls the same __paintPxg, so it gets the dim by the same code), 60 fps frame capture (frozen frames instead).

## R48 merge + phone swipe = menu-smear.js
- Merged origin/work-v2 (04f9eb3). Conflicts: home-flight.js (R48 skipZero/glide + my uDim/uClear: both kept), nav.js (R48 api + my `release()`), home-return.js (R48 `flown:true` + my `dim`), status.md (both kept).
- Phone / tall swipe (loader-swipe.js `prepareGlide`): R48's `createMenuSmear()` run MIRRORED (`play({ mirror: true })`, added to menu-smear.js, menu path untouched): the loader is the panel right of the ragged per-row edge and goes away to the right; the page appears on its left; the smear zone trails the edge; the sweep runs on by one zone width so the smear ends at exactly 0. The loader's real layers (bg, top text, veil, digits) are clipped by the same row edges (loader.js); the clipped veil is what takes the wordmark from dimmed to full. No snapshot on phones.
- Pre-warm: `prime()` (hero frame + one zero-grid draw) when the 99 step starts, ~1 s before the swipe.
- Settings: `LOADER.swipeBlockPx` = 28 (menu's; css px at 430 ref width; ~50 = desktop-like). Removed swipeBrushPx / swipePullRefW / swipeJitterBlocks and the shader's uJit (dead).
- Dev: `window.__lsAt` freezes the phone swipe too. Sheets: docs/reference/r49-r4-phone-glide-390.png, r49-r4-desktop-1920.png.
- Merge note done: nothing left for R48's tall-menu.js to import except src/util/clock.js (same function; not touched here).
