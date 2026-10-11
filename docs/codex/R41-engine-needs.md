# R41 engine needs (for Cowork, after R37f merges; the lite side may not edit these files this round)

1. **core.js click path (src/work/core.js ~line 498, 'click' on the stage).** It is mode-agnostic already, but needs three small changes for lite:
   - on `pointerdown` (frame anchor) call `mode.tap?.down({moving: !!(inertia || snap || Math.abs(vel) > 5)})`;
   - in the click handler, replace `!transitionOK()` with `!transitionOK() || (mode.tap && !mode.tap.accept({dragMoved, moving, centre, reduced, degraded: !guard.state.warp}))`,
     where `centre` = (image centre - viewport centre) / viewport along the strip (the strip axis: `vertical ? (py[i]-H/2)/H : (px[i]-W/2)/W`);
   - build the rect with `mode.tap.rect({bx:bx[i], by:by[i], bw, bh, ox:gl.ox[i], oy:gl.oy[i]})`, call `mode.tap.lock()` in `onStart` and pass `mode.tap.viewport`
     as `viewport: {w, h}` to `runProjectTransition` (the engine should size the flight from it instead of live `innerWidth/innerHeight`).
   Smallest form: ~6 lines, desktop path unchanged because `mode.tap` is undefined there.
2. **Prepare without hover (project-transition.js prepareTransition).** `prepareTransition` returns early unless `(hover:hover) and (pointer:fine)`. For lite it must
   run from `prepare: 'idle'` (the existing `prepareIdleTransition` path, delay `policy.idleMs` instead of the hard-coded 1800 ms in core's `warmCentre`) and on
   `touchstart` of the frame when `tapFallback`. Keep at most `policy.maxPrepared` (1) renderer; `disposePrepared` also on `visibilitychange` hidden and `pagehide`.
3. **Engine policy fields lite sets:** `bulge`, `bulgeWeak`, `grid` (overrides `T.bulgeGrid`), `maxDpr` (overrides `BEND.dprCap` for the transition canvas),
   `uploadRows` (overrides `T.hoverUploadRows`). All are in `TRANSITION_POLICY_LITE` (src/settings/tall.js) with R37f's field names where known.
4. **Header scale:** the flight must end at `FLIGHT.zEnd` (1.10, src/settings/shared.js). The tall project header already rests at this scale (CSS var
   `--flight-z` on `.tp-hero .tp-media`). The `isTall()` gates in project-transition.js (flight, bulge, playBack) are what Part B removes.
5. **Tablet landscape project page** uses the desktop project page (`project-page.js`, R37f's file), so its header zoom comes from R37f, not from this branch.
