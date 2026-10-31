# Flags to revisit (signed off for now, check later)

## R37f: desktop open / close (signed off by Anh 2026-10-11; R42 is the planned fix for 1-3)
1. Page-change hold ~34-50 ms (78-103 ms at 4x CPU): the document switch. Anh: "the delay snap is noticeable". Fix = R42 (same-page navigation).
2. The way back has no bend (dropped to avoid a WebGL setup stall on the freshly loaded Work page). Anh wants the reverse bend. Fix = R42.
3. Second click after coming back plays no animation (Anh's recording 22:20). Fix = R42 (the Work page stays alive) + a regression test.
4. A 135 ms project-setup long task after the animation endpoint (covered by the settled overlay).
5. settings/tall.js now has TRANSITION_POLICY (R37f default, enabled false) and TRANSITION_POLICY_LITE (R41 Part A): reconcile into one in R42 / R41 Part B.

## R37e: Work page open / close (signed off by Anh 2026-10-11)
Signed off as is, to be checked by eye on desktop later. Revisit:
1. Inward bend strength: Codex cut the lens to 0.1 x bulge (from 0.6) to keep the zoom one-directional. Does the "inverse inflate"
   still read? (?tune: reboundAmp, lensSec)
2. Page-change hold: ~43-49 ms where the browser keeps the old frame while the project page commits. Next idea: cross-document
   View Transitions (Chrome) to keep the old page painted through the commit.
3. Motion test still fails against the reference curve (interior dips). Judge by eye first; numbers in docs/codex/R37e-notes.md.
4. Hover / idle WebGL prepare: 14 ms at real speed (fine), 42 ms at 4x CPU throttle (weak devices may hitch while hovering).
5. Reference zoom keeps going longer than ours; ours settles exactly on the project header (by design, option B).
Where: src/effects/{flight-curve,bulge-gl,project-transition}.js, src/timeline.js (TRANSITION), work/*.html head scripts.

## R38: light theme preview
- 404 page: 9 edge pixels differ by 1 colour level in dark (accepted). Light-mode design weaknesses: docs/codex/R38-light-notes.md.

## R36 / earlier
- Strict whole-page Work rest / return pixel proof remains "unverified (script issue)" since R37 (endpoint checks pass).

## ?perf report on Anh's 4K desktop (2026-10-31, work-v2 after R41b-d + R42e; docs/reference/perf-4k-desktop-2026-10-31.json)
Performance is fine: 144 Hz (median 6.9 ms), both opens 180 frames with max 7.1 ms, first flight frame 8.5-10 ms after the click, 3 live WebGL contexts, none failed. Report bugs to fix in a small desktop request:
1. `backRuns` is empty although Anh went back twice with the mouse back button (pointer buttons 8 at 23937 and 33800 ms): the back path is not recorded on desktop (or the mouse back button skips the animated back). Check which.
2. `why.chosen` says "lite (animated)" on desktop (warpDiagnosis.kind is "desktop"): wrong label in the WHY report.
3. `restJobs`: 146 desktop jobs flagged ranWhileMoving with stripSpeed 0 and restForMs 0: the R41d rest signal (src/work/rest.js) is not fed on desktop, so desktop idle work is not gated by it (cheap here, max 2.7 ms, but the gate is meant for every mode).

## ?perf report on Anh's FHD laptop (2026-10-31, AMD Radeon iGPU, 1920x1080 at 144 Hz; docs/reference/perf-fhd-laptop-2026-10-31.json)
- Open: 176 frames, median 6.9 ms, one 20.9 ms frame; first flight frame 12 ms after the click. Fine.
- Start-up hitch: during the 5 s baseline right after load, 3 frames over 50 ms, worst 152.8 ms (GPU 158.7 ms), while 7 textures (51.7 MB) uploaded. On the integrated GPU the first scroll after load can hitch while the card textures upload; spread the uploads (one per frame, smaller first) or finish them before the first interaction.
- Anh confirmed the backs DID animate on both machines (only the report misses them). Same report bugs as the 4K desktop: backRuns empty (Anh did 3 Work -> project -> back rounds but only 1 forward run and 0 backs are recorded: the recorder may reset on the in-page swap), WHY label "lite" on desktop, rest signal not fed on desktop (pageBuild up to 10.8 ms flagged ranWhileMoving at speed 0).
