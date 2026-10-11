# R37f — WIP, stopped at the continuity check

Branch: `desktop/next`. Undo everything: `git switch work-v2`.

## Result and decisions
One image now grows, zooms only inward from 1 to 1.10, and lands on the zoomed desktop header. The underlay and feather blend are removed. Headers use the same zoom on direct visits, with scroll parallax composed on top. Anh explicitly chose a full-screen Duhat header; its video remains.

Anh approved one homepage-path change: append only the final 1 → 1.10 zoom after the existing enlargement/crossfade. No bulge or other Work-flight effect runs on that path. Pinned pre-click homepage identity was repeated after that change: zero changed pixels.

Final working values: workSec 0.40 (started 0.60), land 0.34 (started 0.51), push 0.34 (started 0.51), zoom tail 0.65, end zoom 1.10, reverse tail 0.30. Measured reference growth is about 0.33 seconds. Reference trigger aligned to 5.77 seconds in r37-dribbble.mp4. The recording cited by the planner was not supplied; the existing Dribbble clip is the available reference.

Chrome cross-document View Transitions are enabled without a crossfade. The old flight canvas is retained through page swap, and the new overlay uses the exact cached URL the old page drew. Session storage remains the fallback. The project module graph is imported only once the first-paint zoom settles.

Work keeps drawing the clearing push during open, with texture uploads and new shader effects paused. On return, the full Work renderer, far loads and title shader start after the shrink. DOM images remain visible until GL has all visible textures; this fixed a measured post-shrink black flash. Reverse uses one DOM image and therefore omits the reverse pillow/lens. Restoring the small GL reverse renderer was tested and rejected after it produced a 93 ms active stress hitch.

Engine policy fields: enabled (navigation), bulge (forward renderer), prepare ('hover', 'idle', 'tap'), maxDpr (canvas cap). The resolver selects desktop/lite policy outside the engine. Lite stays disabled. The small disabled policy addition to src/settings/tall.js is an explicit exception required by R37f. Engine files and the eight hand-off HTML documents are now SHARED; engine changes go through one agent at a time. cards-gl.js remains DESKTOP; its new pauseUploads API defaults off, preserving homepage rendering.

## Why this is WIP
The ~20 ms frame-to-frame continuity check still fails conservatively at cross-document navigation. Final normal-speed recordings show 34–42 ms gaps between open captures around navigation and roughly 37–50 ms around return startup. Main-thread rAF inside each running document is smooth during flight, but that does not establish continuity between documents. No ≥50 ms Long Tasks API entries occur at normal speed; that API cannot certify a 20 ms task ceiling.

Three different fixes were tried: (1) defer project construction until settle, (2) defer Work GL/loads and pause forward uploads while retaining push draws, (3) defer the entire project module graph. They removed black frames and most main-thread work, but did not certify the requested cross-document frame ceiling. Stop per AGENTS.md §4. Do not mark R37f done or issue a final R37f commit.

At 4× CPU, the final open capture gap at navigation is ~78 ms, return ~103 ms. A 135 ms project-setup long task starts after the 0.99 s animation endpoint, with the settled overlay still covering the page. These are limitations, not passes. The screencast is protocol-level evidence, not a recording of Anh's physical display.

## Looks-right gate
Looks like the reference: partly.
Biggest visible difference: navigation still has a short held frame; reverse keeps the zoom/shrink but omits the pillow/lens.
What would close it: maintain compositor motion through the document boundary, then preserve reverse bending without synchronous context setup.

## Checks completed
- Build/layout gates passed before the final HTML module-deferral edit; isolated clean-clone validation is recorded below when available.
- compare: 542/542 at 1920×1080 and 2560×1440, no mismatches. Subsequent timing edits only affect triggered transitions.
- Pinned homepage: 0 pixels changed; Work rest: one edge pixel differs by at most 2 levels (known invisible difference). Tall home, Work, project: 0 pixels changed; tall menu: 0 pixels changed. Menu opens; phone transition remains disabled.
- All seven first-paint curve copies match the shared function. 60/144 Hz capture: 13 common elapsed times, 0 width difference, 0 zoom difference; zoom monotonic and >=1.
- All seven desktop header crops tested at 1920/2560 and DPR 1/2. Duhat exact; other images differ only by resampling, at most 2 levels. Worst changed share ~0.107% at 2560 DPR2; invisible, no doubled image or crop offset.
- Six real open/back runs (TCB, second Forbes, TCB 4×): zero black frames; no page errors. Browser Back also returns correctly. Reduced motion, ?gl=0 and phone policy fallbacks pass. Duhat retains video at full viewport height.
- Owners check: one advisory cross-side warning for the explicitly required disabled default in settings/tall.js; shared edits listed here.
- No theme/404 checks: those paths were not changed. Clean-clone/Cloudflare result remains pending while this WIP is committed.

## Evidence (ignored local artifacts)
- [Aligned reference / ours contact sheet](../../tools/scratch/r37f/reference-vs-ours.png)
- [Pixel-motion curves](../../tools/scratch/r37f/curves.png)
- [Summary, including all header identity results](../../tools/scratch/r37f/summary.json)
- [Real navigation data](../../tools/scratch/r37f/navigation.json)
- [Capture helper](../../tools/scratch/r37f/navigation.mjs)
- [60/144 Hz helper](../../tools/scratch/r37f/motion.mjs)
- [Pinned identity helper](../../tools/scratch/r37f/pinned-identity.mjs)
- [Header identity helper](../../tools/scratch/r37f/headers.mjs)
- [Fallback helper](../../tools/scratch/r37f/fallbacks.mjs)
- [Reference helper](../../tools/scratch/r37f/reference.mjs)
- [Summary helper](../../tools/scratch/r37f/summarize.mjs)
- [Homepage hand-off result](../../tools/scratch/r37f/home-handoff.json)

## Commits / push
- `ac49e50` — WIP R37f: single zoomed crop and defer reverse renderer setup. Pushed.
- Next WIP commit records the reference fit, homepage-only tail, and this stop report; push immediately after commit.

## Every tracked file changed
- `docs/OWNERS.md`
- `docs/codex/R37f-notes.md`
- `docs/status.md`
- `src/effects/bulge-gl.js`
- `src/effects/cards-gl.js`
- `src/effects/flight-curve.js`
- `src/effects/project-transition.js`
- `src/effects/transition-policy.js`
- `src/project.js`
- `src/project/desktop.js`
- `src/sections/project-page.js`
- `src/settings/desktop.js`
- `src/settings/shared.js`
- `src/settings/tall.js`
- `src/styles/project.css`
- `src/timeline.js`
- `src/work/core.js`
- `src/work/v2-ui.js`
- `work/bitis09.html`
- `work/duhat.html`
- `work/forbes.html`
- `work/index.html`
- `work/nam-long.html`
- `work/similac.html`
- `work/sulwhasoo.html`
- `work/tcb-priority.html`
