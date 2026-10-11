# Flags to revisit (signed off for now, check later)

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
