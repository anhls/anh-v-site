# Requests (from Cowork / Anh to Claude Code)

Only open and upcoming work lives here. Finished requests move to docs/archive/ (R1-R10: archive/requests-R1-R10.md, R11: archive/requests-R11.md, R11b: archive/requests-R11b.md, R11c: archive/requests-R11c.md, R12: archive/requests-R12.md, R13: archive/requests-R13.md, R13b: archive/requests-R13b.md).

## R13e [done] repulsion aura around the frame (use Sonnet 5.5)
Anh tuned R13c and found cards still slide under/over the centre frame (the float/mask): e.g. the "10" card and a sneaker overlap the Bitis frame. The live-style parting is based on each card's SCREEN position, not on where the frame is. Anh wants a repulsion aura around the frame: cards always drift away from the middle image.
1. Source = the frame's real rectangle every frame (mask width/height + float offsets + scroll), taken from the hero's own animation state (export a cheap getter from hero.js / timeline values). No DOM reads in the loop.
2. Field: for each card, distance from the card's edge to the frame's edge (rect to rect). Within an aura margin, push the card outward, direction = frame centre -> card centre (horizontal bias so cards part sideways more than vertically, slider), strength rising as the gap shrinks ((1 - d/margin)^falloff). Overlap (d <= 0) must be pushed fully clear: with clearance = 1 no card ever overlaps the frame at rest, keeping a minimum gap (slider).
3. It REPLACES the live-style parting (parting strength becomes aura strength; keep the R13b spring for the settle, softness/bounce sliders stay). Mouse push, drift and lag stay on top, all summed into one transform per card.
4. Depth: front cards react strongest/fastest, back cards gentler (existing depth spread). Back cards may still pass behind the frame only if clearance < 1; at the default every card clears it.
5. ?tune panel: aura margin, aura strength, falloff, clearance (soft..guaranteed), minimum gap, horizontal bias; all in Copy values. Remove or hide the old parting-only sliders that no longer apply.
6. Checks: script at the 6 target screens (1920x1080, 2560x1440, 3840x2160, 1440x900, 1512x982, 1728x1117): scroll through Selected Work with the mouse parked off-screen and report the smallest card-to-frame gap per frame (must stay >= minimum gap once settled; brief overlap allowed only mid-spring while scrolling fast, report max). Frame time while scrolling + mouse. compare (cards skipped) must stay 574/574 at 1920 and 2560.
Current CARDS defaults stay unless renamed; LAYOUT seed 7 defaults stay.

## R13f [done] aura feel like live — smooth, not snappy (use Sonnet 5.5)
Anh tested R13e: the aura's direction and reach are fine, but it feels TOO SNAPPY. Goal: tune and fix it so the motion LOOKS like the current live site's parting (smooth, continuous, eased), while keeping the aura idea (cards always move away from the frame, and clear it once settled).
Causes found in R13e code (fix these):
1. Hard clearance: cards closer than auraMinGap are placed at a cleared position (a jump). Make clearance a soft TARGET the card's spring travels to; no instant displacement, ever.
2. Look-ahead switching: "now" vs "look-ahead" push, stronger one wins (max) -> the target jumps when they swap. Blend them continuously (or drop look-ahead if the smooth version is good enough).
3. Front cards settle at 0.45x softness: too fast. Same settle character for every card (back cards may be slightly heavier, nothing faster than the base softness).
4. Narrow, steep field (margin 220, falloff 1.5): ease the force in with a smooth curve (smoothstep-like, zero slope at the margin edge).
Match live's look:
- Use live's parting as the reference for the MOTION PROFILE: how far a card moves sideways/down vs scroll position, and the easing character (live: target eased at 0.2 per 60 fps frame, no overshoot) plus Anh's small bounce (partingBounce 0.25). Use the live cache / --cards probes to measure live card trajectories over scroll (displacement vs scroll, for front and back layers) and fit the aura parameters (margin, strength, bias, curve, settle) so our displacement-vs-scroll curves have the same shape and similar amplitude. The layout differs (seeded scatter), so compare curves, not absolute positions.
- Report: for 3-4 representative cards, live curve vs ours (numbers or a small plot image in tools/scratch), and the max single-frame target jump (must be ~0 at constant scroll speed).
- Add one "weight" slider on ?tune (overall heaviness/floatiness of the aura motion); keep the other aura sliders. Put the fitted values as defaults.
- Accept brief overlap during fast scrolling; once settled every card clears the frame (min gap). Recheck at the 6 target screens; frame time; compare 574/574 (cards skipped).

## R13g [done] Part A card-to-card overlap guard + Part B back-to-top and More Projects/wordmark fix (one session, Sonnet 5.5)
Anh wants these two in one run to save time. Do Part A, run its checks, COMMIT it; then Part B, checks, COMMIT. If the context compacts more than once, stop after the current part and report.
### Part A: card-to-card overlap guard
Anh's tuned values from R13f are now the defaults (CARDS aura 580/175/120, depthRange 0.15, push 245/60, LAYOUT seed 37315, scatter 225, centreBand 560, minGap 81). Problem seen at 2560: the aura herds cards into the side gutters between the frame and the screen edge, so cards pile up and a front card covers most of the card behind it (e.g. the "10" card over the billboard card, the knot logo over the "What's your next" text card).
Safeguard (motion time, on top of the layout's minGap which only holds at rest):
1. After each card's target (aura + push + drift) is computed, run a soft card-to-card separation on the TARGETS of the cards currently on screen (2-3 relaxation passes, pairwise; 35 cards is cheap): when two cards overlap by more than maxCover (share of the SMALLER card's area hidden, default ~20%), push them apart along the axis of least overlap, both moving, the front card a bit more (so the back card is revealed). Cards still travel on their springs (no snapping); separation must be continuous (no target jumps).
2. The frame aura wins over separation (never push a card back into the frame); cards may bleed off the screen edge rather than pile up; prefer vertical separation when the gutter is too narrow for horizontal.
3. Small overlaps are welcome (they give depth); only heavy covering is prevented.
4. ?tune: max cover %, separation strength, passes; in Copy values.
5. Checks at the 6 target screens: scroll through Selected Work (mouse parked, then with mouse sweeps) and report the worst pairwise coverage once settled (must be <= maxCover) and during motion; frame time; compare 574/574 (cards skipped).

### Part B (was R13d): back-to-top A+ / A fallback + More Projects list clears the wordmark
Problem: the footer link smooth-scrolls the whole page back to the top, replaying every scrubbed animation, 35 cards and image loads, so it is long and laggy.
- A+ (default): everything EXCEPT the big AV wordmark fades to black (~0.4s, ONE black overlay layered just below the wordmark, opacity only) -> instant jump to scrollY 0 while hidden (Lenis scrollTo(0, { immediate: true }), ScrollTrigger.update, every section in its top state, nav in its big state, no loader replay) -> the hero fades back in around the wordmark (~0.6s). The wordmark is big at the footer and big at the top: it must not move or flicker.
- A (fallback): same, overlay above everything (wordmark included). Use when navigator.hardwareConcurrency <= 4, navigator.deviceMemory <= 4 (when available) or Save-Data is on. No frame-time measuring.
- prefers-reduced-motion: instant jump with a very short plain fade.
- Timings and the fallback rule in timeline.js; force a path with ?top=aplus / ?top=a.
- Check: one 4x CPU-throttled run of A+ (report the worst frame), no visible wordmark jump. Full compare at both sizes.

Later (polish, after everything else, Anh's call): the "rewind" version C (page streaks upward, jump, settles back in; transform/opacity only on one wrapper + one overlay, blur only on strong devices), with A as its fallback.

Also in R13d (Anh 2026-10-02): More Projects list vs the returning big wordmark. The pinned list ("BITIS SEASON 09" etc.) overlaps the big "^ V" wordmark when it comes back at the footer (live has the same bug; seen at 2560x1440).
- Fix by layout, not new motion: move the list block (names + "More Projects" label + "See more work" link, kept aligned together) further up, and scale it down slightly only if needed, so the list's bottom always clears the wordmark's top with a visible gap.
- Make it a rule, not one fitted number: the wordmark scales with width, the list is capped, so compute the list position from the wordmark's top edge (e.g. list bottom = wordmark top - gap, clamped so the list never goes under the nav), with a max scale-down of about 85%.
- Target screens (Anh's priority): 16:9 from FHD to 4K (1920x1080, 2560x1440, 3840x2160) and MacBook 16:10 (1440x900, 1512x982, 1728x1117). Check every one of these with a screenshot at the moment the wordmark is fully back: no overlap, list still reads as centred. Report the gap at each size.
- This departs from live on purpose; update or skip the More Projects compare probes that move.
Also look at the one ~45 ms frame at the start of each R13c test run (first frame of Selected Work?): if it is image decode or first layout, fix it cheaply (e.g. decode="async" + pre-decode just before the section) or report why not.

## R16 [done] (archived in docs/archive/requests-R16.md)

## R17 [done] (archived in docs/archive/requests-R17.md)

## R17b [done] (archived in docs/archive/requests-R17b.md)

## R16b [done] (archived in docs/archive/requests-R16b.md)
After R16b: R16c (frame warp on its own canvas, poster while scrolling): docs/plans/r16c-frame-warp.md

## R16b-fix [done] (archived in docs/archive/requests-R16b-fix.md)

## R16c [done] (archived in docs/archive/requests-R16c.md)

## R16d [done, quick mode] (archived in docs/archive/requests-R16d.md; stress tests deferred to the perf pass below)

## R16e [done, quick mode] (archived in docs/archive/requests-R16e.md)

## [done] R16f (quick mode): swap warp directions + frame warp lingers in More Projects (use Sonnet 5.5)
Anh's tuning after R16e is now the default (WARP, FRAME_WARP, BEND sensitivity 2.15 / overshoot 0.13 in timeline.js).
1. Swap the direction for EVERYTHING (cards' cylinder warp AND the centre frame's own-space warp): what scrolling UP does now must happen when scrolling DOWN, and vice versa. Anh: "got the effect but reverse direction, just need to switch them for all". One shared sign flip (e.g. a WARP_DIR constant applied where the scroll direction becomes the warp sign), so the per-direction sliders (strengthUp/Down, camUp/Down, bowUp/Down, pinch/pinchDown) follow the new mapping: rename or swap their values so each slider still controls what its label says on screen. Check with real wheel input (?warptest) at 2560x1440 both ways; screenshots to tools/scratch/r16f-shots/.
2. Frame warp lingers in More Projects (Anh's screenshot: the full-screen frame stays warped/bulged for a long time before returning to normal, while the More Projects list is shown). Likely cause: in that part of the page something keeps the measured scroll speed above the hand-back threshold or keeps the warp target non-zero (e.g. Lenis still easing out its 3 s glide, the More Projects fit / sticky translate, the wordmark spring, ScrollTrigger refresh, or the frame size changing (mask grow 500-585vh) being counted as motion). Find it (log warp target, speed source and hand-back state per frame while scrolling into More Projects and stopping), then fix so the frame settles flat within the same time as elsewhere (~0.5 s after the scroll visibly stops). The warp must be driven by the page scroll velocity only, not by layout or mask-size changes.
3. QUICK MODE: real-wheel checks + screenshots, normal-speed frame time at 2560, compare 542/542. Stress tests stay in the perf pass.

## [done] R16g (quick mode): frame warp covers the whole screen, no black edges (use Sonnet 5.5)
Anh's tuning after R16f is the default (FRAME_WARP arc 0 / persp 0.18 / pinch 0.11 / strength 1.39 / deadzone 580, WARP curl 0.5 / cam 1.25). Problem (Anh's screenshots, 2560x1440, More Projects, frame full screen): while the frame canvas warps it recedes, so black bands and curved dark edges appear at the top, bottom and sides. Anh wants the frame to scale up with the warp so it always covers the whole screen; the warp shape stays visible, just no background leak. Decided with Anh: uniform zoom, exact cover (not edge-weighted, not edge-smear, not a backdrop).
1. Cover zoom in the frame post shader (effects/frame-gl.js + the frame branch of warp-shader.js): sample the frame picture magnified about the frame's centre by z >= 1, z = 1 + coverZoom x (zCover(amt) - 1). zCover(amt) = the smallest zoom for which every screen-border pixel (top, bottom, sides, the 4 corners) maps to a source point inside the frame picture, computed from the warp's own UV map at the current amt (a JS twin of the three-term model, like warp-model.js; a small table or closed form per frame, no per-pixel cost). It must be exactly 1.0 at amt = 0 (rest hand-off stays pixel-matched, re-run the diff at 2 positions), and follow the spring amt (eases in and out with the warp, no jump, also through the zero crossing when the direction flips and the overshoot).
2. Only when the frame fills the screen: weight the zoom by the frame's share of the screen (frameState: 0 while the mask is small, 1 when it covers the screen; smoothstep over the last ~15% of the mask growth so there is no pop during the grow stage). Small frames (hero octagon, About strip) keep the current look.
3. ?tune: one slider "Cover zoom" in the Frame warp section (FRAME_WARP.coverZoom, 0 = off, 1 = exact cover, default 1), in Copy values.
4. Report: zCover at amt 0.25 / 0.5 / 1.0 / 1.15 (overshoot) for scroll down and up at Anh's numbers, and the grid check (121x121 border points, JS twin) showing no border pixel samples outside the picture at coverZoom 1, both directions.
5. QUICK MODE: real-wheel screenshots at 2560x1440 (full-screen frame in More Projects, both directions, at peak warp and at the end) to tools/scratch/r16g-shots/, plus 1920x1080; no black bands. Normal-speed frame time at 2560, compare 542/542. Note the crop at peak and the image softness in the log.

## [done] R19 (quick mode): Bitis project page /work/bitis09 as the template (use Sonnet 5.5)
Source of truth: the Framer page (read with the Framer MCP, node OLr0gI9Mo, desktop frame 1920 wide) cross-checked with live https://www.anh-v.com/work/bitis09. Scope: ONE page built data-driven from data.json (projects[bitis09]) so the other 4 projects become data entries later. Entry points exist: work/bitis09.html, src/project.js (16 lines, empty), data.json projects[1] (blank). Anh decided: media is fetched from live for now (originals are not on this PC).
Media (already downloaded, see ../_site-media/sources.tsv rows bitis09/*): ../_site-media/bitis09/ holds 8 images (hero 1920x1080 PNG, insight-a 1080 JPG, gallery-1 JPG height 6004, tagline GIF 1920x1080, wrapup-a 1172 PNG, promo-a / sketch 2480x3508 PNG, promo-b 1920x1080 PNG) and 5 live videos (campaign 2000x2000 6.2 s, timecross-a 1280x720 3.7 s, timecross-b 1280x720 19.8 s, wrapup 1800x1172 5.1 s, concept 1000x1000 4.3 s) plus vid-framer-editor.mp4 (what the Framer editor shows in ALL 5 video slots; it is NOT on live, ignore it). 7 more images are already in ../_site-media (same live URLs): xFPw = archive/card-img-24 (Soobin), AlABm = hero/s3_middle (billboard), Ed5U = captions/caption-2, 1898 = archive/card-img-18, 7JV33 = archive/card-img-17, kpvw = archive/card-img-20, UKmRV = archive/card-img-02. Reference them via sources.tsv, don't copy twice. Extend `npm run media`: WebP (srcset 800/1600/2560) for images, keep the GIF as MP4/WebM loop if a source exists else animated WebP, MP4 (H.264, faststart, muted loop) + WebM for the videos, posters for the videos, lazy-load everything below the first screen, only the hero preloaded. Page budget before first paint < 1 MB.
Page, top to bottom (all blocks 100% wide, black background, white text, Clash Display; Lenis smooth scroll intensity 30 like the home page; nav fixed as on home):
 1 Hero 100vh: one image (img-hero). No video.
 2 INSIGHT text block, padding 60px: ScrollFadeText with the quote ("There are always two halves in me—one wants to roam, one longs to return." + the sentence after it), label "INSIGHT" absolute top 13px left 29px (Clash Display Regular) with a 16px icon that slides in from the left (left -30px at rest).
 3 Two images 50/50, each 100vh: insight-a (left), Soobin (right).
 4 CONCEPT text block (same pattern): "The campaign imagines a dialogue between your past and present selves — a reunion shaped by distance, time, and the pull of home."
 5 YouTube 100vh: s5GFw-7XPjo, play off, muted, high-quality thumbnail, no autoplay (privacy-friendly embed, load on click).
 6 Details block, padding 60px, two columns 1fr/1fr: left "Bitis Season 09" / "Di De Tro Ve" (Clash Display Medium); right "Project Details" then rows Client: Bitis / Year: 2024 / Role: Art Director, Motion Lead (labels 50% opacity Regular, values Medium; 1 px lines between rows, 15 px gap, 20 px between rows, 50 px under the heading), then the campaign paragraph at 50% opacity ("This music video campaign marks the 9th season of Bitis’ iconic “Đi Để Trở Về” platform, ...", full text in the Framer node aHT0AwqPv or on live). Check on live whether this block is sticky (the Framer layer tree is not; HANDOFF says "sticky details", maybe a code override): measure and copy the live behaviour.
 7 100vh split 50/50: campaign video (cover, left) | heading "Time-crossing Homesick Dialogue" + paragraph ("It’s a truth most people carry — two halves in constant pull between the road ahead and the place called home.", 50% opacity, 0.5fr wide), padding 60px, space-evenly.
 8 100vh split 50/50: timecross-a (cover, left) | timecross-b contained, 75% x 44% (right).
 9 Full-bleed image 100vh (gallery-1, cover).
10 Full-bleed image 100vh (billboard = s3_middle).
11 100vh split 50/50: tagline GIF (1663x936, aspect 1.778) with the tagline paragraph pinned right/left 120px, bottom 60px, 50% opacity ("The tagline draws from the imagery of a crossroad ...") | Ed5U image 100vh.
12 WRAPUP text block: "As the final episode of “Di De Tro Ve,” the MV wraps the journey with warmth and closure. Retro tones meet Bitis’ signature orange, blending nostalgia with a sense of new beginnings." Label WRAPUP.
13 100vh split 50/50: wrapup video (cover, left) | wrapup-a image (right).
14 Image 100vh: 1898 (cover, 1296 px tall box at 1920).
15 100vh split 50/50: 7JV33 image (left) | empty (right).
16 PROMOTION text block: "In parallel with the MV, the campaign also introduced a standalone creative route to celebrate the new product drop and the Year of the Snake — blending festive motifs with bold, youthful styling tailored for Tết." Label PROMOTION.
17 100vh split: paragraph pinned bottom (left/right 120px, bottom 60px, 50% opacity, "Beyond the emotional narrative of the MV, ...") | kpvw image 50% wide, 100vh.
18 Three-up, 800 px tall: promo-a (75% x 80%) | promo-b (100% wide, 320 px tall, aspect 1.975) with caption "Initial concept sketch" at the bottom (50% opacity) | sketch (75% x 80%).
19 100vh split 50/50: concept video (cover, left, 50% wide) | paragraph 720 px wide, 50% opacity ("The concept draws from the texture of shoelaces ...").
20 Final image 100vh: UKmRV (cover, 1296 px tall box).
Add a "next project" / back link and the footer only if live has them (check live; the Framer tree shows none). Full copy: take it from the Framer nodes (all text above is verbatim there, with curly quotes and Vietnamese diacritics) rather than from this summary where they differ.
ScrollFadeText (rebuild exactly, from Workshop/ScrollFadeText.tsx, code file iPcVSEH): letters in word spans, rect.top / innerHeight gives raw progress (0 when the block's top enters the bottom of the window, 1 at the top), mapped through start 0.1 .. end 0.6, easing cubic-bezier(0.4,0,0.2,1), direction "down", animationStartFrom "end", opacity min 0.2 max 1, text colour white, each letter fades with a 0.2 s opacity transition. Do it once with shared scroll state (no per-letter JS work, per CLAUDE.md rule 5), not a per-frame getBoundingClientRect per block outside the visible range.
Measure on live (script, 1920x1080 and 2560x1440, as for the home page; Framer's XML has no font sizes): font sizes / line heights / letter spacing of every text role, paddings, column gaps, heading widths, scroll-fade font and width, label and icon motion, any reveal or parallax on images/videos (Framer overrides are not in the XML). Use src/scale.js; vw/vh units per CLAUDE.md. Tablet/phone later, not in this request.
Checks (QUICK MODE): screenshots at 1920x1080 and 2560x1440 of each of the 20 blocks vs live (tools/scratch/r19-shots/), scroll-fade text sampled at 5 positions (opacity per letter) vs live, videos play muted/loop and pause when off screen, no layout shift, frame time while scrolling the page at 2560, page weight and first-paint budget, build ok, compare for the home page unchanged (542/542 at both sizes). Log known gaps: low-res sources (tagline GIF 480 KB at 1920, wrapup-a 1172 px used full height), the 2000x2000 / 1000x1000 videos shown cover.

## R19b (next, before R16h): Bitis page motion + transparent GIFs (use Sonnet 5.5, quick mode)
Anh: the Bitis page does not match live. R19 only compared STATIC positions (page height, section tops, text boxes); it missed motion that lives in Framer overrides (not in the XML).
1. Masked parallax images: on live the HERO and the two INSIGHT images (and possibly other image/video blocks: check every one) sit in a fixed 100vh mask (overflow hidden) with the image inside scaled up; while scrolling, the inner image moves at a different speed than the mask, giving a parallax. Measure it on live for EVERY block (real wheel scroll at 1920x1080 and 2560x1440): per block, inner image scale, translateY of the inner element vs scroll position (start / end / curve), whether it is scrubbed or springy, any zoom-out over scroll; also read the matching override code in the published Framer chunks (as R13/R15/R17 did) to get exact numbers. Rebuild with one shared "parallax mask" behaviour for image and video blocks (transform only, one rAF/ScrollTrigger per visible block, GPU-friendly, off with reduced motion), parameters per block in data.json, defaults from live. Log the table (block, scale, travel, curve) in status.md and motion-spec.md.
2. Transparent GIFs/PNGs turned white: some live media have a TRANSPARENT background (e.g. the tagline GIF; check every GIF and PNG on the page for alpha on live and in ../_site-media/bitis09). Our pipeline flattened them (MP4 has no alpha; the GIF transparent index became white). Fix in tools/media.mjs: detect alpha; for animated ones make VP9 WebM WITH alpha (yuva420p) + an animated WebP fallback with alpha for Safari (instead of an MP4); for still PNGs keep alpha in WebP. Never flatten onto white or black. Re-run npm run media for bitis09; check visually against live on the black page.
3. Re-check the whole page against live WHILE scrolling, not only at rest: screenshot pairs (live vs ours) at 3 scroll points inside each parallax block at 1920 and 2560, to tools/scratch/r19b-shots/. Quick mode otherwise: compare 542/542 for home, normal-speed frame time on the Bitis page at 2560, build ok.
4. Keep the blocks/data approach; parallax and alpha are block features, reusable by the other project pages.

## R16h (after R19b, quick mode): centre frame warp matches the cards' direction (use Sonnet 5.5)
Anh (2026-10-02, after R16f/R16g): scrolling DOWN, the centre frame still INFLATES (content bulges toward the viewer), while the Selected Work cards now do the wanted look on scroll down. The frame must do exactly what the cards do in each direction.
- Cause to check: the cards use the cylinder model (R16e) with the WARP_DIR swap (R16f); the frame still uses the older three-term model (pinch / pinchDown / arc / persp, own-space, FRAME_WARP) whose per-direction branches may not follow WARP_DIR the same way, or whose "down" branch is the inflate one after the swap.
- Fix: drive the frame with the SAME model and direction mapping as the cards (cylinder sheet in the frame's own space: same curl / camera / bow terms, WARP_DIR applied identically), keeping FRAME_WARP strength / reach / deadzone / cover zoom (R16g) and Anh's frame tuning where it still applies. Simplest acceptable alternative: keep the three-term model but flip the frame's branch mapping so down = the cards' down look; report which.
- Proof: real wheel at 2560x1440, scroll down and up, screenshots of cards and frame in the SAME frames (Selected Work stage, frame + cards visible) side by side: both must bend the same way. ?warptest grid on both. Quick mode: compare 542/542, normal-speed frame time at 2560.

## Queued (plans agreed with Anh, in this order; each becomes a request after the one before is committed)
1. R18 perf + load pass (after R16f, Sonnet 5.5): deferred stress tests (4x CPU, 6-screen frame-time matrix incl. 120 Hz vs 8.3 ms, fallback re-runs, frame-canvas hand-off diffs); load: spawner images (4.9 MB) load only on first hero click or on idle, never at start; first-screen budget check (target < 1 MB before first paint); Lighthouse run (desktop) with the scores logged; GPU memory at 2560 and 3840 with both canvases; quick Safari/Firefox smoke check if available (WebGL2, video textures with alpha, fallbacks). Report and fix only cheap wins; list the rest.
2. R19 Bitis page (in requests.md above), then the other 4 project pages as data, Works page, tablet/phone, launch prep, then back-to-top "rewind" polish.
3. Check later (low priority, Anh 2026-10-02): 4K at 100% scaling (3840x2160 CSS) squeezes the capped section positions (Selected Work ~1 screen down, trail barely runs). Consider letting section positions keep scaling on very tall viewports.

## Later: Selected Work step 2 (WebGL edge bend)
Plan: docs/plans/selected-work-section.md step 2. After Anh tunes R13 with the panel.

## Later: responsive (tablet/phone)
Structure is ready (vw/vh units, timeline.js, CSS custom properties), but portrait screens need their own values: mask 17vw x 50vh becomes a thin strip, About runs to 15 lines on a phone, captions crowd. Also use small/large viewport units (svh/lvh) for the sticky blocks and ScrollTrigger.config({ ignoreMobileResize: true }) so the mobile address bar doesn't make things jump. Follow HANDOFF "Responsive plan".

## Media checklist note (R14 covers it)
Waits for Anh's original files. Convert the two GIFs to MP4/WebM loops, serve images as WebP/AVIF sized to display size (srcset), preload only hero media, lazy-load archive and project images, compress the hero video and add a poster frame, preload the Clash Display woff2.
