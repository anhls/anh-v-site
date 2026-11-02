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
