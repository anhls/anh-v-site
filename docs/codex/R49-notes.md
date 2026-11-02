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
