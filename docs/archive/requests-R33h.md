## R33h (WORK v2: counter blur off by default, "Copy values" must export every tuned group) (use Sonnet 5.5, quick mode; branch `work-v2`: commit there, never merge to main)

Anh's findings: on /work the counter blurs while it rolls, on /work/?tune it does not (his saved ?tune slider values override the defaults only there; most likely `WORK_COUNTER.counterBlurPx` was set to 0 in the panel). He does NOT want the counter blur. And the "Copy values" export he pasted (twice) contains only WORK, WORK_LIMITS, SCROLL, darkShare, frontShare: none of the Work v2 groups, so the values he tuned in the other groups (counter, info, title, text, line, ruler, smear...) were never in the export and cannot reach the defaults.

### 1. Counter blur: off
`WORK_COUNTER.counterBlurPx` default 10 -> 0 (the slider stays in ?tune, range 0-20). With 0 the SVG blur filter on the counter must not be applied at all (no filter node attached / `filter: none`, no per-frame stdDeviation writes, no layer cost), not just a zero-radius blur. The odometer roll, the digits split, the "/N" and everything else on the counter stay as they are. The reduced-motion branch (opacity fade) stays. Keep the info text blur (textBlurPx) exactly as it is: only the COUNTER blur goes. Check by reading pixels or the computed filter on /work (no ?tune, localStorage cleared) and on /work/?tune after "Reset to defaults": the same, no blur, on both.

### 2. "Copy values" exports everything that ?tune can change
Today the button writes `{ WORK, WORK_LIMITS, SCROLL, darkShare, frontShare }`. Make it write every tunable group in the panel, as one JSON with the same group names as the source (src/timeline.js exports): at least WORK, WORK_LIMITS, SCROLL, TRANSITION, TALL (as in the panel's defaults), WORK_UI (incl. copy), WORK_TITLE, WORK_INFO, WORK_RULER, WORK_TEXT, WORK_COUNTER, WORK_SMEAR, WORK_LINE, the pixel / hover values, and every other object the panel lists, so a paste is complete and a diff against the defaults is possible. Add a second button "Copy changed only" that exports just the values that differ from the defaults (key, value), so Anh can paste small, readable exports; the full one stays. Both must match the stored slider values (what you see is what is exported), including legacy-hidden controls.
- Test: change 3 controls in different groups (counterBlurPx, WORK_UI.smallSize, WORK_LINE opacity), click both buttons, read the clipboard text (or the string built by the handler): the 3 values appear, the other values equal the defaults; paste the JSON back through a small dev function / script that applies it and verify it round-trips (same values after apply).

### 3. Make a silent override visible
In ?tune, a control whose value differs from the default gets a small marker (a dot or the label in a brighter colour) and the panel header shows "N changed" with a "Reset to defaults" next to it, so a stored value never silently differs from /work again. Cheap, no new controls.

Usual gates and a docs/status.md entry: what the counter blur default and filter are now, the export keys (list the groups), the round-trip test, the marker, and what could not be tested.

