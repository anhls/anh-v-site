# R11c (archived)

## R11c [done 2026-10-01]: faster compare + working rules
Full plan: docs/plans/speed.md (sections 1 and 2). Build compare.mjs items 1-6 (live cache per size with --refresh-live, --only/--points tuning mode, adaptive settle, window.__siteReady, parallel --sizes, fixed dev port 5199 strictPort) and add the section 2 rules to CLAUDE.md.
Check: a full run before and after the change must give identical results at 1920x1080 and 2560x1440. Report the timing of a tuning run and a full run, before vs after.
Decision (Anh): below 1920x1080 stays proportional (scale.js rule). The ~136 mismatches at 1440x900 are by design; don't match live there.
Also commit docs/plans/ (Cowork's plan files) and the line-ending-only change in docs/archive/requests-R11.md.

Visual fixes (from Anh's 2560 check of R11b):
1. Wordmark small state is squashed at 2560 (nav.js: scaleX uses uncapped vw width, scaleY the capped one). Keep the logo's proportions: scale width and height together (one uniform scale, not separate scaleX/scaleY), capped at the 1920 size (169x37px). It must never stretch or squash at any size, in any state or during the big/small transition.
2. ABOUT arrow still runs over the label: it rests at x 0-16px and nudges 30px right, while the label starts at 29px. Put the arrow in a clipping container (overflow hidden, like Framer's) from the arrow's rest position to about 4px before the label, so the nudge (30px, capped) slides the arrow out of view at the container edge instead of over the text. Label position unchanged (matches live). Check at 1920 and 2560 that nothing overlaps at the far end of the nudge.

