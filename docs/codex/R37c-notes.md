# R37c motion notes — 2026-10-11

Branch codex/r37-r38. Planning/reference commit84f6817 pushed (also included Cowork's standing-rule commit). Exact undo: `git switch work-v2`.

## Questions resolved before building

1. Continued reference zoom contradicts an exact unzoomed project header. Anh explicitly approved a small zoom pulse returning to1,0.6s move plus roughly0.3s rebound, reverse rebound on.
2. Positive radial sampling in the proposed formula bows straight lines outward. For an inward picture pinch, the sampling coefficient must be negative. Sign follows visible deformation rather than the planner's suggested sign.
3. The proposed15% rebound multiplier was too subtle in the first contact sheets. The final60% multiplier is a visual fit, not a precisely measured reference coefficient.
4. Neighbors appearing through rounded corners could be mistaken for stacking failure. The overlay already sits above Work; no stacking change was needed.
5. Reference zoom, train perspective and preexisting bend confound isolated curvature measurement. Raster estimates are evidence about direction/trend, not an exact optical model.

## What changed

Work move0.4→0.6s; landing remains85% (0.51s); clearing push0.34→0.51s. Existing bow0.13, corner0.08, early bump peak25%/end70%, and size overshoot3% remain. Work keeps drawing full screen for reboundSec0.3s, then navigates at0.9s. The outline stays fixed through rebound. ReboundAmp0.6 multiplies bulgeAmp0.13 for peak sampling coefficient−0.078. Peak is20% of the rebound phase (60ms after that phase starts). ReboundZoom0.025 is a sin² pulse returning exactly to0. All rebound values are in timeline.js and the tune/Copy values panel, including peak timing and backRebound1. ExpoOut/homepage curves remain unchanged.

The inward lens samples around the texture center with squared radius from normalized box coordinates. Sampling is clamped; the full-screen phase writes alpha1 across the rectangle. At its endpoints lens and zoom are exactly0 with zero slope. The existing overlap and sessionStorage hand-off remain; the overlap is applied at the end of the rebound rather than before it. Context loss reveals the flat DOM image. On return the0.3s reversed content phase plays first, followed by0.6s shrink; backRebound0 removes the first phase. Existing wheel/key/pointer interruption jumps to the final state. No separate idle loop was added.

## Reference measurement and visual gate

Extracted every20ms from5.84–6.80 to tools/scratch/r37c-ref/. Green-window threshold measurements at y290 of the800x600 source:

| Time | Window width px | Left-edge middle residual px |
| --- | ---: | ---: |
|6.10|299|−13.5|
|6.16|330|−12.5|
|6.24|349|−12.5|
|6.32|361|−10.5|
|6.44|381|−11.5|
|6.80|413|−11.0|

Residual compares the middle of the window's left edge with its upper/lower samples. It includes perspective, segmentation and zoom; it is not pure lens strength. The continued38% visible window-width growth reinforces why the reference cannot be copied literally while ending at the unchanged header crop. Our smaller pulse is Anh's approved compromise. The first15% multiplier/positive coefficient did not read as inward rebound; one revision to negative60% made the pinch visible against the laptop's straight panel lines.

Final actual open/back contact sheets in both themes were viewed. Files: tools/scratch/r37c-shots/{dark,light}-{open,back}-reference-sheet.png, plus rebound-detail.png. Every pair has ours left/reference right. Ours sampled every20ms through0.9s. Reference alignment is piecewise: opening click5.84 at ours0; full-screen base landing6.14 at ours0.51; final6.80 at ours0.9. Return maps the full-screen lead-in7.40–7.78 to ours0–0.3, then the shrink7.78–8.20 to ours0.3–0.9. This normalizes the intentionally longer move, rather than pretending both run at the same absolute speed. Repeated reference source frames remain repeated.

Looks like the reference: yes for the requested puff → inward picture rebound → flat landing, including reversed return.
Biggest visible difference: the reference continues zooming, while the approved small pulse returns to the original crop; Work also starts from a larger, wider image.
What would close it: carrying the reference zoom into the project header would close the zoom difference, but would violate this request's unchanged-header endpoint. The approved returning pulse is retained.

## Checks

Production build passes. Cached dark compare542/542 at1920x1080 and2560x1440. Homepage shared open at three points per size:0 changed pixels. Post-rebound composited endpoint max0 at both sizes/DPR1 and2. Full-screen peak-rebound readPixels:0 nonopaque pixels; phase start/end lens0 zoom0. Context loss mid-move and mid-rebound reveal DOM; double click ignored; wheel during initial reverse rebound completes and removes overlay. gl=0, reduced-motion and unavailable-GL navigation pass. backRebound0 duration0.6s verified. All collected page errors0. No check thresholds changed.

Twenty actual open/back cycles leave0 transition canvases, contexts or textures. RTX4080/ANGLE D3D11 at4x CPU throttle, including rebound: median6.9ms both sizes; p957.0/7.1ms; initial worst125/131.9ms includes setup. R37b median6.9–7.0ms. Navigation heap changes are not a heap leak proof.

Layer check: overlay root z8 vs Work GL z1. At0.18s an8x8 patch within the outward edge is identical (max0) after hiding the underlying Work layer. The suspected portrait overlap was outside the rounded mask, not painted above opaque transition pixels. Project name/navigation order remains unchanged; src/work.js was inspected, not edited.

Known previous limitation: strict whole-page animated rest/return pixel captures remain unverified (script issue), as recorded in R37/R37b. They are not implied by the isolated composited endpoint result. The accepted R38 404 edge difference is unchanged. One return-switch helper initially imported a separate Vite timestamped config instance; resolving the module URL used by the transition fixed the helper, with no site change.

## Files

Changed source: src/effects/bulge-gl.js, src/effects/project-transition.js, src/effects/tune-docs.js, src/timeline.js, src/work/tune.js. Documentation: docs/requests.md (heading only after planning), docs/status.md, this new note. Planning added docs/codex/R37c.md and docs/reference/r37c-reference-rebound.png. Own ignored helpers kept for reproducible checks: tools/scratch/r37c-{measure,capture,check,coverage}.mjs; output r37c-ref/ and r37c-shots/. Reused prior behavior/home/fallback/cycle/performance helpers unchanged. No package, layout, homepage, theme, original media or outside-directory changes.
