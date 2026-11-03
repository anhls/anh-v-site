# R48 notes (Claude Code, 2026-11-03)
Files: src/effects/tall-menu.js + src/styles/tall.css (menu), src/work/tall-details.js + src/styles/tall-work.css (Part B), src/effects/nav.js (startBig/noDrive/grow), src/work/mode-lite.js, core.js (details hooks, wordmarkGrow), src/project/in-place.js + src/project.js (small wordmark), src/settings/tall.js (TALL.wmSmall, TALL_DETAILS), data.json (menu.flavour).
Menu motion: MENU_FX in tall-menu.js (sec 0.55 open / 0.5 close, band, grid = WORK_PTR.pixelGrid). Time-based (rAF + performance.now). Reduced motion / ?gl=0 = plain fade.
Choices: details row gap 0.1 x card height (mock proportion) instead of "~48 px"; wordmark small box top centre (TALL.wmSmall). Home<->Work flights: Work nav has noDrive, so the wordmark never animates there.
Unverified: iPhone, 60/144 Hz motion curves, tablet portrait 820x1180 flow, clean-clone build. Desktop compare shows 135/360 on both this branch and clean work-v2 in this setup.
Undo: git revert the R48 commits on lite/r48-phone-menu.
