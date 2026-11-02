# Motion spec extracted from the published Framer site (2026-10-01)

Source: the compiled page code on anh-v.com (Framer publishes every scroll effect, text effect, variant transition and spring as data), plus settled measurements at 1920x1080. Values here are the ground truth; where Framer's own code numbers and the measured page differ, the measured scroll ranges win and the spring/ease settings come from the code.

## 1. Why the live site feels smoother / heavier
1. Smooth scroll: Framer's Lenis component "Intensity 30" = Lenis `duration: 3` (seconds per wheel glide) with Lenis' default easing `t => Math.min(1, 1.001 - 2 ** (-10 * t))`. The rebuild used `new Lenis()` defaults (lerp 0.1, much shorter glide).
2. Springs on scroll effects: most Framer scroll-linked transforms are NOT locked to the scroll. The scroll gives a target value (piecewise linear between trigger points) and each layer CHASES that target through its own spring. Different springs = different lag = the "weight" and parallax feel. Scroll ranges measured on the page were the settled targets, so they stay; the springs are what was missing.
3. The mask floats vertically (section 3 below). The rebuild kept it centred.

Spring notation below: stiffness / damping / mass (Framer/motion units). Implement with one shared requestAnimationFrame loop: per layer, `target = map(scrollVh)`, then integrate `a = (-k*(x-target) - c*v)/m` with dt in seconds (the rebuild uses the exact closed-form spring solution, so it is refresh-rate independent and stable for stiff springs). Transforms/opacity only. Layers with "no spring" follow the target directly.

## 2. Hero strip (inside the mask)
| Layer | Scroll range (vh) | Values | Spring |
|---|---|---|---|
| #1 section (video + ticker) | 40-140 | y 0 to -2000px, scale 1.3 to 1 | none |
| video element | 0-90 | opacity 0.15 to 0.8 | none |
| ticker | 0-90 | opacity 1 to 0, y 0 to -500px (on top of its own 0.5 opacity) | none |
| #2 section (portrait) | 0-90 | y 600px to 0, scale 2 to 1 | none |
| #3 section | 196-224 | y 1350px to 0, scale 1.2 to 1.1 | 891 / 90 / 0.5 |
| #3 section | 300-520 | scale 1.1 to 1.2 | 891 / 90 / 0.5 |
| #3 top image (Techcombank) | 318.6-353.3 (same trigger as index swap 1) | y 0 to -1500px | 148 / 39 / 0.1 (bounce 0.2) |
| #3 middle image (Bitis) | 403.5-438.4 (same trigger as index swap 2) | y 0 to -1500px | 148 / 38 / 0.1 |
| Overlay (black 90%) + Overlay-2 (bottom black fade) | 490-630 | opacity 0 to 1 | 500 / 60 / 1 |
px values are at 1080px viewport height (vh = px / 10.8).

## 3. Mask vertical float (NEW, was missing)
The mask (GSAP width/height timeline, unchanged) sits inside two wrappers that move vertically:
| Wrapper | Scroll range (vh) | y | Spring |
|---|---|---|---|
| outer wrapper | 128.2-177.7 | 0 to -300px (-27.78vh), then holds | 10000 / 250 / 1 (stiffened R11b: ~92ms settle, was 891/90/0.5 ~520ms) |
| inner wrapper | 189.3-212.6 | 0 to +300px (+27.78vh), then holds | 10000 / 250 / 1 |
Net effect (measured mask centre, % of viewport height): 50 until ~128, rises to 22.2 at ~178 (while the About text scrolls up and the mask reshapes to 25vw x 40vh), holds to ~189, then drops back to 50 by ~213 ("catching up" to the project index). Both apply as translateY on containers around the mask, so the mask resize and the float combine.

## 4. About
- Text block: two nested Framer parallax layers, speed 75% and 95% (= 0.7125x scroll). Rebuild's drift (0.7 from 60vh) is a fit of the same thing; keep, or switch to 0.7125.
- Letters: ScrollFadeText (opacity 0.2 to 1, per letter, transition 0.2s). Rebuild is per word with no transition: add a short opacity transition (about 0.2s) so the reveal softens like live.
- "ABOUT" arrow icon: looping nudge, x 0 to 30px, 1s tween, ease cubic-bezier(.44,0,.56,1), mirror (back and forth), 0.5s pause between repeats, never stops.

## 5. Project index (text effects were missed before)
Row blocks (label, title, year) move with spring 500 / 60 / 1 over the measured swap ranges (318.6-353.3, 403.5-438.4).
Per-character text effects (play ONCE per page load, not scrubbed):
| Element | Trigger | Each char | Stagger | Duration | Ease |
|---|---|---|---|---|---|
| Row 1 label + year | row 1 comes into view (50% visible) | rises from +200px | 0.02s | 0.3s | cubic-bezier(.44,0,.56,1) |
| Row 1 title | same | rises from +200px | 0.05s | 1.0s | cubic-bezier(.87,.01,.13,1.01) |
| Row 2 label + year | scroll passes the "project-1-text-out" trigger (= start of swap 1) | +200px | 0.02s | 0.3s | cubic-bezier(.44,0,.56,1) |
| Row 2 title | same | +200px | 0.05s | 0.2s | cubic-bezier(.87,.01,.13,1.01) |
| Row 3 label + year / title | scroll passes "project-2-text-out" (= start of swap 2) | same as row 2 | | | |
So the letter roll Anh remembered is real: it runs in time when each row arrives, on top of the scroll-driven block slide. INDEX.letterStagger in the rebuild should become this time-based effect (not scroll-scrubbed).

## 6. Nav + wordmark
- State switch transition: spring 650 / 100 / 0.7 (overdamped, ~1s settle; rebuild's 1.1s expo.out is close, switch to the spring for the same feel). Some inner parts use 650 / 60 / 0.1 (snappier).
- Triggers: small state when the top "Trigger Frame" leaves the viewport (threshold 0); BIG STATE AGAIN when the Footer comes into view (threshold 0). The big "^ V" at the footer is the nav wordmark returning, not a separate footer logo.
- Link hover roll (doubled labels): spring, bounce 0.2, duration 0.4s.
- The logo has a ForceReload override (click reloads the page). Replace with a normal link to top / home.

## 7. Loader (Framer Loader Comp, words "Loading / visual / language")
Variant transitions are tweens with an overshoot ease cubic-bezier(.59,.25,.12,1.17): durations 0.8s with delays 0 / 0.1 / 0.2 (per word), and 1s with delays 0 / 0.3 (backdrop). The rebuild's measured 0.52s power2.inOut is an approximation; use these curves.

## 8. Hover cursors
- Hero caption hover image: follows the cursor with spring 500 / 60 / 1, offset x +50px, placed right of the cursor, aligned to its end (bottom).
- More Projects names (was clients; measured R12): static list, no roll in. Each name = two stacked copies 74px apart in a 64px band. Hover: the hovered name rolls up 74px (second copy, white) while all others grey to rgba(112,112,112,.7); spring bounce 0.2 / 0.4s. Image cursor: one 400x500 box, left edge at cursor +200px, centred 20px below the cursor, spring 500 / 60 / 1, holding all project images in a vertical strip (500px each) that slides to the hovered name; hidden when off the list. Built as: grey = opacity 0.31 of the first copy.
- Footer "Go Back To Top": 12px, centred, 30px box ending 30px above the page bottom, 1px line through the text: a 1px dot at rest, scaleX to full width on hover (spring).

## 9. Page end (decided R11b 2026-10-01)
On live, the hero mask layer disappears at ~585vh (GSAP pin ends) while the overlay is only at ~0.68, so the image pops away. **Confirmed decision: the rebuild keeps its fade-to-black (hero stays under the overlay to 630vh). The live pop is a Framer GSAP-pin artefact, not the intended design.** Do not replicate it.

## 10. Mask resize (GSAP) timing
Verified in headless Chrome at a real 1920x1080: live follows Framer's code exactly, [0,70] expo.inOut, [150,185] expo.out, [500,585] expo.inOut, scrub 0.25. Earlier fits made in the scaled in-app browser panel were wrong.

## 11. Caption + nav hover strike-through (R17b, measured on live at 1920x1080, tools/scratch/r17-cap4.mjs, r17b-nav3.mjs)
- Both the hero captions (HeaderPrj) and the nav links (Nav Item) have a 1 px line, background rgb(240, 74, 14), at the vertical middle of the text (caption title box 923..935 -> line y 928; nav label 43..57 -> line y 50), left aligned, width 0 at rest. Hover draws it left to right over the text width; it never moves otherwise (the nav roll runs separately above it).
- Caption (title 130 px wide): line width 0 -> 100% in about 0.42 s, ease-in-out (progress .47 at 192 ms, .79 at 269, .986 at 362); title colour rgba(255,255,255,.5) -> rgb(240,74,14) at once; leaving: the line is gone in the first frame (instant), the colour fades back in ~0.35 s. Moving to the next caption: old line instant, new line draws in.
- Nav (About, 36 px): line 1 -> 36 px in about 0.3 s ease-out (progress .47 at 53 ms, .69 at 81, .83 at 110, .92 at 138); on leave it retracts to the LEFT (x fixed, width shrinks) in about 0.2 s (.42 at 47 ms, .64 at 74, .81 at 103, .92 at 130). The second (rolled-in) copy of the label is orange rgb(240,74,14); the roll itself moves 19 px in ~0.25 s (unchanged from R6). On the live hero (scroll 0) the nav links sit under another layer and do not react; they do once the page has scrolled.
- Ours: scaleX on a full-width line with origin left (::after of the caption title / of the nav link), no width animation. Caption: cubic-bezier(.4,.1,.5,1) 0.42 s in, 0 s out (CAPTION_HOVER.lineInSec / lineOutSec, ?tune). Nav: cubic-bezier(.25,.8,.4,1) 0.3 s in, cubic-bezier(.2,0,.4,1) 0.2 s out. Frame samples at 1920 and 2560 are identical (the line is a scale of the element).

## R21: project pages Sulwhasoo + Techcombank Priority (2026-10-02, live measurements, Chrome 1920x1080 and 2560x1440)
- Parallax (same model as R19b / R20: ty = y * scrollY, scale = s + ds * (k / (innerHeight + 200)) * scrollY; origins centre except where noted). Sulwhasoo: hero y .25 s 1 up k .03528; pair y .15 s 1.4 down k .03527 (origin = seam, centre height). Techcombank: hero y .25 s 1 up k .019 (fits .0186 at 1080 / .0195 at 1440); pair y .15 s 1.4 down k .019. No other block moves on either page.
- TCB "Key Visual Exploration" scroller (section "Section", fixed 4195 px tall at every window size): a sticky 100vh pin (top 0) inside it; three layers each translate X linearly with the page scroll `off` = scrollY - section top, from off 544 to off 3240.6 (so it keeps moving ~485 px after the pin releases at 1440 tall; same numbers at 1080 and 1440): cards track (5880 px wide, 6 images 1241 / 501 / 415 / 1241 / 1241 / 1241 x 606, no gaps, left 1127.3, centred vertically) tx 1338 -> -4360; heading tx 800 -> -3690 (left 60); paragraph (518 px wide, left 509.3) tx 800 -> -2992. Heading + paragraph are centred vertically (heading 471..609 of 1080), cards drawn over them. Direct from scrollY, no smoothing. Not snapping, not draggable, no hover.
- TCB mosaic: 2 columns of 100vh cells, contain; block height = 830 px + 300vh (4070 at 1080, 5150 at 1440); first left cell top = 400 px - 50vh, the others at 810 px + k * (100vh + 10 px); the paragraph sits in the first right cell (top ~ 8.89vh + 504 px).
