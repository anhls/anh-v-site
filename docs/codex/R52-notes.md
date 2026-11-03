# R52: the big AV in the phone menu goes Home as a menu close (2026-11-03)

Flow: open menu on Work / project -> tap the big AV (above the menu, big at the bottom) -> record `pxm` -> navigate to `/` -> index.html paints the open menu from the first frame -> tall-home.js hands over to tall-menu.js takeOver() -> normal close over the playing hero.

Decisions
- Layer id is `pxg` (data-menu="1"), z-index 70, so the existing render-block (link rel=expect) and the view-transition hold work unchanged; the Work page's own leave record (pxg, card-first) is wiped when `pxm` is valid.
- The snapshot is a clone of the live open menu (all placeMenu() values are inline) + the tall.css rules containing "tmenu" / ".twm", so the layer cannot drift from the live menu. Items forced to rest, no current-page line (Home), burger as X, clip none. vInk is handed over so the live menu places the clock the same.
- Capture-phase click: the Work page's own wordmark click (card flight home) is stopped for this path; keyboard Enter works the same (it is a real `<a href="/">`, label "Home" while open, in the Tab order, 70 px tall at 390).
- takeOver waits for a hero frame (max 1.5 s) while the layer holds the screen; then 4 frames under the cover (first composite of the menu + smear layer), skipTransition, layer out, set(false). No focus() on the burger (it showed the orange focus ring).
- tall-home.js now waits for prerenderingchange before deciding (a Chrome-prerendered Home used to run the loader in the background before activation).
- Back from Home (bfcache) to the page that was left: menu closed with no animation, wordmark small (pageshow persisted).

Checks (tools/scratch/r52/path.mjs; sheets in docs/codex/r52/): see status.md. Headless Chrome with software GL: captures run at ~30 fps and the sweep's frames cost 60-120 ms in the GPU process (SwapBuffers, main thread idle, 0 blocking time); tools/lib/menu-fps.mjs (60 fps) cannot follow a cross-document navigation and was NOT run for this path.
Not verified: real iPhone / Safari, Playwright WebKit (not tried: Chrome used, as in R50), bfcache restore of Home with a record, Cloudflare preview build, 4x CPU throttle.
Known small thing: on a phone with a bottom safe area Work's big AV sits flush with the bottom, Home's above it (--safe-b): that px difference would show as a small step at the hand-off.
