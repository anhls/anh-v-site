## R16b [done]: one screen-space warp over all Selected Work cards (use Sonnet 5.5)
Anh (2026-10-02), reference YouTube u8YujK0jTSM ~31:20 (screenshot in chat): content near the bending area gets narrower and its sides curve inward (pinch) while edges arc, like a surface curling away in perspective. Anh wants this as a whole-screen shader overlay on ALL the Selected Work cards together, not a separate bend per card.

1. Post-process pass: render all cards (as now) into an offscreen framebuffer, then draw it to the screen through ONE full-screen distortion shader. Cards keep their normal flat geometry (drop or reduce the per-card bend; keep it as an option slider "per-card bend" default 0).
2. Distortion (driven by Lenis scroll velocity, same spring with one gentle overshoot as R16, flips with direction):
   - curl/pinch: near the top and bottom of the viewport (the leading/trailing side of the scroll), content is pulled toward the vertical centre line and curves, strongest at the screen edge, fading to none toward the middle: horizontal lines arc, vertical lines bow inward (hourglass), like a sheet curling away in perspective;
   - implement as a UV warp in the full-screen shader (or a mild 3D cylinder/curl projection if that matches the reference better; report);
   - nothing distorts at rest (exact pass-through, pixel-identical to today).
3. Grain moves into the same pass (one full-screen grain, same settings).
4. Layering: the overlay only affects the cards' canvas. The centre frame (hero mask image, DOM), index title, nav, wordmark stay undistorted on top/behind as now. DECIDED (Anh): the centre frame stays undistorted, as the solid anchor the cards curl around. Do NOT move the frame into WebGL. Check that cards near the frame read well while warped (aura gap kept).
5. ?tune: warp strength, reach (how far from the screen edge it fades in), pinch vs arc balance, perspective/curl amount, top/bottom symmetry, per-card bend (default 0), grain; in Copy values.
6. Performance: one extra full-screen pass (respect the DPR caps; 4K at 1.5 DPR). Check all 6 target screens incl. 120 Hz (8.3 ms) and a 4x CPU run; fallback rule unchanged (DOM cards, no warp). Screenshots rest / mid / fast scroll to tools/scratch/r16b-shots/.
