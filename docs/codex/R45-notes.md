# R45 Part 0 + A notes (desktop, Claude Code, 2026-11-02)

## Architecture chosen: cross-document hand-off (the brief's alternative), not the in-document Work
- Why: src/work/core.js is one ~1100-line module that owns the whole document (own Lenis, ~40 window / document listeners, no destroy()). Building it hidden inside the
  homepage document would have meant a teardown path for the homepage AND for Work, well past the Part A budget. The R25 / R28 hand-off pattern already exists, so the flight
  is split in two documents:
  - Home: `src/effects/home-leave.js` plays the shrink (hero -> first card), stores `pxh` (card rect, file, small-wordmark style) in sessionStorage, navigates to /work/.
  - Work: the inline script in work/index.html paints `#pxh` (the card on the page colour + the small wordmark) from the first frame; `src/work/home-return.js` fades the dark layer
    out once the strip's first card image is up (landFadeSec 0.35 s). The card layer is the same file / same crop / same rect as the strip's card: landing frame vs direct visit
    inside the card: mean signed difference 0.06 (grain only), no pop. The Work page's own title entrance plays as on a direct visit.
  - The hold between the end of the flight and the Work page's first frame is the page load of /work/ (HTML + script + styles, all prefetched on idle after the hero settles);
    the overlay shows the landed card meanwhile. NOT measured on a real GPU / network here (headless software GL only).
- Back: history = [home, work 'first', work 'dup'] (`history.replaceState` + `pushState` at arrival). Back -> popstate on 'first' -> the centred card smears and grows into the hero
  (`leave()` in home-return.js), then `history.back()` returns to the homepage. The wordmark does the same flight, then `history.go(-2)`. A Work page loaded DIRECTLY: the wordmark flies,
  then a plain navigation to '/' with a `pxg` hand-off: the homepage paints the hero frame full screen from its first frame (index.html inline script), skips the loader and fades the
  layer when the video plays (`arriveFromWork`). Browser Back on a directly loaded Work page is the browser's own (no flight).
- bfcache restore of the homepage (`pageshow persisted`): handled in home-leave.js (`restore()`), UNTESTED (headless Chromium has no bfcache).

## Renderer (src/effects/home-flight.js, its own chunk on Work)
One fullscreen fragment shader: per pixel `smearTaps` copies of the picture are placed along the box's own path (the box a moment ago mixed with the box now), each copy with the R42
inward bow inverted per tap, A -> B cross-faded, RGB split along the trail. Smear is EXACTLY zero at rest (box now == box before: a `still` branch draws one tap). Scissored to the union of the two boxes.
Size curve = (1 - p)^sizePow in, 1 - (1 - p)^sizePow out (the R42 back family). All numbers: `HOME_FLIGHT` in settings/desktop.js, sliders under ?tune on the Work page.
Start values kept (sec 1.27, sizePow 3, bendAmp -0.045, smearStrength 0.08, smearRGB 0.006, cross 0.2..0.8, fade 0.15). Not yet tuned by eye on the 4K / FHD screens.
Home -> Work: the video frame is uploaded at the click (texImage2D from the playing <video>); everything else (context, shader, card texture, Work files) on idle. Not ready = plain link.
Work -> Home: end picture = the hero frame saved at the click (`pxhf`, jpeg data URL, async off-thread), poster as fallback.

## Wordmark (A4)
`initNav(..., { alwaysSmall: true })` on the desktop Work page (mode-desktop.js), project.js and project/in-place.js: always small, no scroll / top / footer switching. The homepage
(hero only) is always big. The only big <-> small moves are the flights: `nav.drive(1 - size)` frame by frame. Lite (mode-lite.js) untouched (Part B).

## Hero-only homepage (A1)
`HOME.heroOnly` (settings/shared.js); `?home=full` = the old page. No About / project index / Selected Work / More Projects / footer, no Lenis, no initFrameOpen, `html.home-hero` (no scroll,
hero 100vh), About nav link hidden, Contact -> mailto (CONTACT.email = WORK_UI.reachEmail, one source; the phone menu shows it now too). The hero build itself is unchanged (its scroll
triggers stay inert at scroll 0).

## Checks (ITERATING tier + the brief's FINAL list where it could be run)
- `?home=full` compare: 542/542 at 1920x1080 and 2560x1440. Hero-only vs full at scroll 0: ~0.45 % of pixels differ (the moving ticker + the hidden About link; not diffed further).
- Landing frame vs direct /work/ at 1920 and 2560: card interior mean difference ~0 (grain only; title / info text are the Work page's own layers).
- Flight frozen at 12 progress values (home -> work) and 6 (work -> home): shrink / grow, bow, smear visible mid-flight, cross-fade without a dark dip (viewed), wordmark follows.
- Flows run in headless Chromium: home -> Work, Back (flight + homepage without loader), wordmark from a direct Work visit, ?gl=0 and reduced motion (plain navigation, no overlay).
- 5 round trips: DOM nodes / canvases flat per document (each hop is a new document, so nothing accumulates). NOT done: the 20-run, mid-flight random clicks, 4x CPU, 60 / 144 Hz curves,
  the real-speed contact sheet + per-frame motion curve (software GL: a flight is a few frames per second; the clock keeps the 1.27 s). Click -> first frame under software GL: 48-85 ms
  (the first draw + the video upload run on the CPU); not representative of a GPU, needs Anh's screen.
- Build OK. Tall smoke 390x844: home, Contact mailto, one project page OK. Icons: light / dark glyph links with `media="(prefers-color-scheme: ...)"` (the `light` glyph is white = for
  dark tabs), apple-touch-icon, og:image 1200x630 on every page head incl. the project pages (they had their own hero image; the brief says every page). No /favicon.ico (a renamed PNG is not an .ico).
- Clean-clone build and the Cloudflare preview check: see the status entry.

## Open / for Anh
- Tune strength, duration, smear by eye (Work ?tune -> HOME_FLIGHT, Copy values). The Home -> Work part reads the same numbers from the file.
- Click response and the landing hold on the real GPU + network (needs a look on the 4K screen and the laptop).
- A homepage restored from the bfcache and "reload on /work/ after the flight, then Back" are untested (reload at the 'dup' entry: Back then loads /work/ once more before the homepage).
- Home from a project page: plain navigation (logged as a later polish, per the brief).
- Project pages' og:image is now the share image (was each hero). Say if the per-project image should come back.

## R45c (2026-11-02): pixel swipe, no loader on return, full-strip landing, prerender
- Look: `HOME_FLIGHT.look = 'pixel'` (default). Square screen-grid blocks (pixelBlocks 24 columns at 1920), a front sweeps along the strip axis (pixelAngle 0) inside crossFrom..crossTo (0.2..0.8);
  each block flips video frame -> card image, with a mosaic (pixelMosaic 4, pixelFront 0.25 wide, pixelJitter 0.6) at the front, exactly 0 at rest. The same front reveals the neighbour cards at their rest
  places (no slide-in). Back = the reverse (centred card -> video). 'smear' = the old look, kept for one comparison. All under ?tune -> HOME_FLIGHT. Time-based (performance.now), so 60 and 144 Hz match by construction.
- Fix 1: `pxg` is written BEFORE leaving Work (goHome), cleared after use; home -> Work -> Back, -> wordmark and direct /work/ -> wordmark: no loader (headless Chromium, run once each; the 5x / cache-disabled matrix was NOT run).
- Fix 2: landing layer `#pxh` carries the first card plus both neighbours (same rects / files as the strip) and stays until the strip's first card is decoded + 8 frames, so never a black frame.
- Fix 4: project pages have their own og:image / twitter:image again.
- Fix 5: speculation rules prerender /work/ (from home, on idle) and / (from Work). Hand-offs moved to localStorage; Work / home read them at activation (`prerenderingchange`). NOT verified: headless Chromium never activated a prerender (activationStart 0), so the <100 ms target is unmeasured. Browsers without prerender keep the layer landing.
- Checks run: ?home=full compare 542/542 at 1920 and 2560, build OK, tall smoke 390x844 OK, out-flight contact sheet viewed. NOT run: 60/144 Hz curve run, Vertical-mode landing diff, 5x loops, real-GPU timing.
- Looks right? 1) pixel front reads as a block swipe with mosaic, neighbours revealed: yes in frozen frames, partly overall (not seen at speed). 2) Biggest difference: unseen at real speed on a GPU. 3) Anh's look on the 4K screen, then tune pixelBlocks / pixelFront.
