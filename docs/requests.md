# Requests (from Cowork / Anh to Claude Code)

Newest at the bottom. Claude Code marks each one [done] when finished and logs details in status.md.

## R1 [done]: Scaffold plan
Propose in chat, before creating anything: Vite setup, folder structure, data.json schema (projects, titles, years, media), and how GSAP/Lenis are loaded. See HANDOFF.md, "Next steps" 1.

## Answers to R1 open questions (from Anh, 2026-09-30)
1. Media: use the framerusercontent.com files as placeholders for now. Originals will be swapped in later by editing data.json only.
2. Archive card positions: read them from the live page yourself (https://www.anh-v.com).
3. Music: skip for now. Keep the audio hook in place but silent (no file, no hotlink). Anh will supply a licensed file later.
4. Font: Clash Display is confirmed. Keep the file already in public/fonts.
5. Git: see R2.

## R2 [done]: Git setup
Initialize a git repo in anh-v-site, add a sensible .gitignore check (node_modules, dist), and make the first commit. Explain each step plainly. No GitHub or remote yet.

## R3 [done]: Loader + hero pin (first home section only)
Build the loader ("Loading visual language" + percentage, cursor-following) and the 730vh hero stack with the GSAP pin timeline exactly as in HANDOFF.md ("Hero pin"). Use framerusercontent.com placeholders for media. Stop after this section so Anh can compare it side by side with anh-v.com. Commit when done, log in status.md, and list anything that needed guessing.

## R4 [done]: Fix hero content motion + nav animation
Notes from Anh after comparing R3 with the live site, plus what Cowork read from the Framer project.

### 1. Hero: mask + sliding strip (replace the crossfades)
- The mask is correct as built: Image_Resize3 only animates width/height of a centred overflow:hidden wrapper (100vw x 100vh -> 17vw x 50vh -> 25vw x 40vh -> hold -> 100vw x 100vh).
- What's wrong is the content inside it. On the live site the video, image 2 and the 3-image group form ONE vertical strip: each asset is anchored to the bottom of the previous one, all fill the mask and shrink/grow with it. Scrolling moves the strip upward inside the mask. No crossfades.
- Framer layer structure inside the mask (each group pinned to all four edges of the mask):
  - 1Section (z3): black bg, video (object-fit cover), ticker (opacity 0.5, 10vh tall, vertically centred)
  - 2Section (z1): image 2
  - 3Section (z2): 3 images stacked (z0-2), Overlay2 gradient on bottom 50%, Overlay black at 90% opacity
- MEASURED by Cowork on the live site (1920x1080, 2026-09-30). No need to re-measure; use these values.
  Live layer names: "#1 section" (video + ticker), "#2 section" (image 2), "#3 section" (3 images + "Overlay" + "Overlay-2"). The mask is the INNER "wrapper" (the one whose inline style becomes 17vw/50vh).
  Stacking inside the mask: #1 on top (z3), #3 middle (z2), #2 bottom (z1). Each section fills the mask (inset 0); transform-origin is the section centre.
  Transforms are Framer px values at 1080px viewport height; convert with vh = px / 10.8. Scroll positions are in vh of page scroll from the top of the hero. All tweens are linear with scroll unless noted (Framer scroll transforms), on top of the mask's own eased width/height.

  | Layer | Scroll range (vh) | translateY | scale | notes |
  |---|---|---|---|---|
  | #1 section (video) | 0 to 40 | 0 | 1.3 | holds |
  | #1 section | 40 to 140 | 0 to -2000px (-185.2vh) | 1.3 to 1.0 | slides up and out of the mask |
  | #2 section (image 2) | 0 to 90 | 600px (55.6vh) to 0 | 2.0 to 1.0 | settles underneath while #1 leaves |
  | #3 section | 0 to 190 | 1350px (125vh) | 1.2 | waiting below |
  | #3 section | 190 to 230 | 1350px to 0 | 1.2 to 1.1 | slides up over #2 |
  | #3 section | 300 to 520 | 0 | 1.1 to 1.2 | slow zoom, then holds at 1.2 |
  | #3 image 3 (top img) | 315 to 375 | 0 to -1500px (-138.9vh) | 1 | slides up out, revealing image 2 |
  | #3 image 2 (middle) | 405 to 460 | 0 to -1500px | 1 | slides up out, revealing image 1 |
  | #3 image 1 (bottom) | all | 0 | 1 | stays |
  | Overlay + Overlay-2 | 490 to 630 | - | - | opacity 0 to 1, linear (Overlay is black at 90%, Overlay-2 is the bottom-half gradient) |

  Mask sizes measured match HANDOFF: 100x100 until ~10vh, 17vw x 50vh by 70, 25vw x 40vh by ~175, hold, back to 100x100 by ~575.
  So the "strip" effect Anh describes = #1 sliding up and out while #2 rises into place beneath it, then #3 sliding up from below, then #3's images peeling upward one by one, then the overlay darkening as the mask opens back to full screen.

### 2. Ticker and hero project captions: no fade
- Remove the fade-outs. The "Click Anywhere" ticker lives inside 1Section, so it just moves up with the strip.
- The 4 project captions (HeaderProjects) are NOT in the pinned stack: they're an absolute layer at the top of the page (z5) that scrolls normally, so scrolling simply rolls past them.
  Layout from Framer: 85vh spacer, then a row: 24% gap, caption, 8% gap, caption, 8% gap, caption, flexible gap, caption, 11% gap. Below it a 20vh spacer and the 150vh cursor image trail region.

### 3. Nav animation tied to the AV wordmark
Measured on the live site; use these values (details in HANDOFF.md, "Confirmed with Anh"):
- Time-based switch (~1s, strong ease-out), fires on any scroll away from the top (>= 5px), reverses at scrollY 0.
- Wordmark: 1572 x 345 px at x 0, y 735 (bottom-left) -> 169 x 39 px at x 60, y 35 (top-left). Express in vw/vh.
- Links at y 43, left edge: About 25.8vw -> 75.2vw, Works 81.0vw -> 79.3vw, Contact 92.1vw -> 83.3vw (they regroup to the right).
- Keep the hover roll (each label is doubled, 18px apart).
- This replaces R3's space-between nav, which overlaps the wordmark.

### Deferred
Caption spellings (Sulwhasoo / Đi Để Trở Về 09): leave as is for now.

Commit when done, log the measured values in status.md, and flag anything still guessed.

## R5 [done]: About section (190vh)
- Structure: 90vh spacer, then a 100vh sticky block (top 0). Section id "2section" (nav About link target).
- Text (Clash Display, left aligned, white): "Vu Tuan Anh, Art Director. Based in Ho Chi Minh City with over 5 years of experience in design. I focus on turning ideas into thoughtful visuals - blending motion, layout, and typography to create work that feels clear, expressive, and alive."
- First line is indented to leave room for a small "ABOUT" label + 16px icon placed at the start of the line (Framer: label at left 29px/top 11px, icon at left 0/top 8px inside the text block).
- Scroll fade per WORD: opacity 0.2 to 1, reveal from 10% to 60% of the section's scroll progress, moving forward through the text, easing cubic-bezier(0.4,0,0.2,1). One ScrollTrigger / one update loop for the whole block, no per-letter work.
- Measure on https://www.anh-v.com at 1920x1080 before building: font size, line height, text block width and position. Convert with the Units rule below.
- Follow the new "Units and responsive" rule in CLAUDE.md. Check the result at 1440x900, 1920x1080 and 2560x1440, not just 1920.
- Commit, log in status.md (include the measured values), then stop so Anh (and Cowork) can preview.

## R6 [done]: Fix page structure: hero is a pinned background for the whole page
Read HANDOFF.md "Home page structure (CORRECTED)" first. The current build stacks sections after a 730vh hero; the live page is 730vh in total with everything scrolling over the hero.
- Hero layer: absolute, top 0, 730vh, z-index 3, with a CSS sticky 100vh block holding the mask. Drive the existing mask/strip timeline with a ScrollTrigger that scrubs 0-585vh of page scroll WITHOUT a GSAP pin (the CSS sticky holds it, and pinSpacing would add height). Keep scrub 0.25 and all measured tweens as they are. Overlay trigger stays 490-630vh of page scroll.
- Content layer in normal flow on top (730vh total): About (0-190: 90vh spacer + sticky), then a placeholder for the project index (190-590: 50vh blank + 100vh sticky, empty for now), then a placeholder for clients (590-730). Archive (absolute, top 211vh, 250vh tall, z 4) and footer (absolute bottom, 110vh) as empty placeholders. Hero captions stay absolute at the top (z 5). Use the z-indexes in the table.
- Retime the About reveal to match live: first words start at ~40vh of page scroll, all lit by ~95vh, forward through the text.
- Check: document height is exactly 730vh at 1920x1080; at 70vh scroll the About text is over the small mask; the nav still switches at 5px.
- Set up src/timeline.js (CLAUDE.md "Architecture rules" 1) as part of this request: move the hero mask/strip ranges, the overlay range, the nav trigger and the About reveal into it, and add the section ranges from the HANDOFF table (captions 0-261, about 0-190, index 190-590, archive 211-461, clients 590-730, footer 620-730). Hero and About read their numbers from it.
- Apply Architecture rules 2 (no GSAP pin on the hero) and 6 (no reload-on-resize) now. Rules 3-5 apply when those sections are built.
- Test at 1440x900, 1920x1080, 2560x1440. Commit, log in status.md, stop for preview.

## Later (not yet): media optimisation
Waits for Anh's original files. Convert the two GIFs to MP4/WebM loops, serve images as WebP/AVIF sized to display size (srcset), preload only hero media, lazy-load archive and project images, compress the hero video and add a poster frame, preload the Clash Display woff2.

## To decide during preview: double smoothing
Lenis smoothing + hero scrub 0.25 both smooth the motion (the hero trails the scroll slightly). Try scrub: true vs 0.25 side by side with anh-v.com; Anh picks.
