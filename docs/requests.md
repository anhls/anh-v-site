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

## R7 [done]: Tune R6 to the live site (Cowork preview findings, 1920x1080, scroll fully settled)
Cowork measured both sites at the same scroll points. Hero strip, captions, About start position/size, layering, nav end positions and the 730vh page all match. Fix these:
1. Mask timing (timeline.js HERO.mask). The live GSAP mask runs earlier than Framer's code numbers. Measured live widths: 5vh 99.1vw, 15vh 91, 25vh 43.8, 30vh 27, 35vh 20.5, 45vh 17.2; 135vh 17, 145vh 23.1, 150vh 24.3, 155vh 24.8, 160vh 25; 500vh 25.1, 520vh 32, 540vh 92.3, 560vh 99.9. Use ranges [0,48] expo.inOut, [137,162] expo.out, [500,562] expo.inOut, then fine-tune so the rebuild hits those widths within ~2vw. The strip ranges stay as they are (they already match).
2. About drift. Live About text top (vh from viewport top) by page scroll: 0: 124.4, 60: 63.9, 70: 56.9, 100: 35.9, 120: 21.9, 150: 0.9, 190: -27.1, 250: -69.1. From ~60vh it moves at 0.7x scroll speed. Rebuild currently moves 1:1 (150: -25.6). Add ABOUT.drift = { from: 60, speed: 0.7 } in timeline.js and apply it as a transform (translateY) on the block, scrubbed. Match the numbers above within ~2vh.
3. About reveal. Share of letters lit (opacity > 0.6), live vs rebuild: 45vh 0% vs 10%; 60vh 21% vs 38%; 70vh 69% vs 57%; 80vh 95% vs 76%; 90vh 100% vs 95%. Set ABOUT.reveal to about [50, 85] and make the edge sharper (live is ~1 letter mid-fade; per word is fine, reduce SOFT to ~1). Match the table within ~10%.
4. Nav optimisation (Architecture rules, "transform and opacity only"). nav.js animates left/top/width. Switch to transforms: wordmark = translate + scale from a fixed base box (transform-origin top left), links = translateX. Same duration (1.1s), ease (expo.out), trigger (5px) and start/end positions. Also strip the BOM at the start of nav.js.
5. Ticker. Live "Click Anywhere" ticker is an SVG image (https://framerusercontent.com/images/2sWL1DXbPXG6eGRplIQ3eWfr3I8.svg from the Framer canvas, check it's the one on the live page) 237 x 12 px per item at 1920, repeating every ~237px, opacity 0.5, vertically centred in #1 section. Use the image at 12.34vw wide (or text sized with clamp to match), not fixed 0.75rem.
Re-measure at 1920x1080 against the numbers above, check 1440x900 and 2560x1440, commit, log the before/after numbers in status.md, stop for preview.
(Anh confirmed the hero video plays in the real browser.)

## R8 [done]: Loader tightening + small fixes (ticker speed, wordmark delay, smoothing switch, spellings, icon, click sound)
The loader already uses real progress (no fixed timer, unlike Framer's 1.8s fake count). Tighten it:
1. No double video download: track the real hero <video> element on the page (loadeddata = first frame ready) instead of creating a second hidden video.
2. Video cap 10s -> about 4s (LOADER.videoCapMs). The video keeps streaming after the loader leaves.
3. Minimum display time about 1s (LOADER.minMs) so "Loading visual language" doesn't just flash on a cached/fast load. Anh can change it in timeline.js.
4. Per-word roll-in (open since R3): each word of "Loading visual language" rises into place from below its own clipped line, staggered, as on the live site (Framer Loader Comp: words start ~70px below and rise to centre; states Start -> Arrive -> Leave). Watch the live intro on https://www.anh-v.com (reload with the browser pane VISIBLE) for timing, stagger and the exit, and match it. Transforms/opacity only.
5. Ticker speed (not part of the loader, added here): measure the live "Click Anywhere" ticker speed on https://www.anh-v.com (px per second at 1920, pane visible) and match it; currently 40s per half, set by eye. Put it in timeline.js.
6. Wordmark grow-back delay (not part of the loader, added here): nav.js reverses only when window.scrollY < 5px, so with Lenis smoothing the wordmark waits for the glide to finish. Use Lenis's target position (lenis.targetScroll) for the check, so it starts growing the moment the user scrolls up to the top, and shrinks as soon as the target leaves the top. Same 1.1s expo.out animation. Keep the threshold in timeline.js (NAV).
7. Double smoothing, make it comparable (not part of the loader, added here): Lenis smoothing + HERO.scrub 0.25 both smooth the hero. Add a URL switch so Anh can compare in the browser: ?scrub=tight uses scrub: true, default stays 0.25. Mention in status.md how to try it. Anh picks one afterwards and the switch gets removed.
8. Caption spellings (Anh confirmed): "Sulwashoo" -> "Sulwhasoo" everywhere (hero captions, client names). Keep "Di De Tro Ve 09" as it is: Cowork checked the Clash Display font file and it has no glyphs for ể, ở, ề, so Anh chose to leave it unaccented.
9. About icon: Anh sent the original (a plain white right arrow, thin stroke, no box; the dark rounded square with blue outline in the screenshot is just Framer's selection UI). Framer's built-in icons are Phosphor, so use Phosphor "arrow-right" (MIT licence, regular weight) as inline SVG at 16px, currentColor. Replace the hand-drawn arrow.
10. Click sound (Anh confirmed): there is NO background music. The audio file only plays when someone clicks inside the "Click Anywhere" area (top 100vh, same area as the click image spawner), once per click. Live file: https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3 (Framer Audio settings: loop off, start offset 10, volume 100). Check on the live site what a click does exactly (restart from the offset each click, or keep playing), note it in status.md, and wire the hook to the click area only. Don't hotlink mixkit in the final build: leave data.hero.clickSound pointing to it for now with a TODO; Anh will decide whether to self-host that file (check the Mixkit licence) or supply her own.
11. Overlay-2 confirmed: black fade (transparent to black over the bottom half). Remove the "guessed" note.
Put the loader numbers (minMs, videoCapMs, roll duration/stagger) in timeline.js as LOADER. Test with a cold cache and with cache, commit, log, stop for preview.

## R9 [done]: Pass-check fixes + project index section (190-590vh)
Cowork pass check (2026-10-01): headless Chromium at 1920x1080, same scroll script on both sites. Rebuild: 60fps median, 8% slow frames, 138 DOM nodes, 1.5 MB. Live Framer: 30fps median, 73% slow frames, 1179 nodes, 15 MB. Desktop 1366 to 3440 wide looks consistent. Portrait tablet/phone not designed yet (expected; see "Later: responsive").

### Part A: fixes
1. Smoothing decided: Anh prefers the loose scrub. Keep HERO.scrub = 0.25 and remove the ?scrub=tight switch.
2. Loader start delay decided: no artificial delay (the roll starts immediately, as now).
3. Loader waits for too much on slow connections. Measured cold cache: fast 2.4s, slow 4G 10s, 3G 35s, because it waits for all 4 hero images (about 1.5 MB). Only wait for what is visible on the first screen: font, wordmark, ticker, hero video first frame. Start loading #2/#3 images right after (they are not visible before ~40vh of scroll). Add LOADER.maxMs = 5000: the loader never stays longer than that. Re-test fast / slow 4G / 3G with DevTools throttling and log the times.
4. Linked timings (Anh wants to retime things later without breaking pairs). In timeline.js, express ranges that belong together as offsets from one shared anchor, so moving the anchor moves its partners: e.g. INDEX swap 1 = gallery2 peel start + offset, INDEX swap 2 = gallery1 peel start + offset, and the About reveal relative to the mask's first shrink. Add a short comment block at the top of timeline.js listing which ranges are linked. Independent ranges stay as plain numbers.

### Part B: project index (measured on anh-v.com at 1920x1080)
- Layout: section 190-590vh = 50vh blank + 100vh sticky block (z-index 6, over the hero mask). So the rows scroll up into place from 190 to 240vh, then stay until the section ends.
- Three rows stacked in the SAME place: each is a full-width band 64px tall (6vh), top 508px (47vh), overflow hidden (the band clips its content).
  - Label "PRJ - 01/02/03": 12px, white, left 60px (3.125vw), y 534px.
  - Title: Clash Display 500, 80px (4.167vw, use clamp), line-height 0.8em, letter-spacing -0.01em, centred. Titles: Techcombank Priority, Bitis DDTV SS09, Sulwhasoo Launch. Links to /work/tcb-priority, /work/bitis09, /work/sulwhasoo (live only links the first two; link all three).
  - Year 2025 / 2024 / 2023: 12px, right 60px, y 534px.
- Swap motion (label, title and year of a row move together, linear with scroll, clipped by the band):
  - 318.6-353.3vh: row 1 goes 0 to -200px (-18.52vh, up and out), row 2 goes +200px to 0 (up from below).
  - 403.5-438.4vh: row 2 goes 0 to -200px, row 3 goes +200px to 0.
  - Rows 2 and 3 start at +200px (hidden below the band).
  - These swaps pair with the hero's image peels (gallery2 315-375, gallery1 405-460): top image = Techcombank, then Bitis, then Sulwhasoo. Use the anchors from Part A item 4.
- Letter roll: the live titles are split into letter spans, but Cowork saw NO per-letter motion (not on scroll, first appear or hover); the whole row slides as one block. Build the block slide as live. Add INDEX.letterStagger (default 0 = off): when > 0, letters of the incoming title rise with that stagger (seconds of scroll-timeline), outgoing ones leave the same way, so Anh can try it. Split letters once at build time, transforms only.
- Use data.json projects (index, title, year, slug) as the source; no hard-coded text.
Test at 1440x900, 1920x1080, 2560x1440 against the numbers above, commit, log before/after in status.md, stop for preview.

## Later: responsive (tablet/phone)
Structure is ready (vw/vh units, timeline.js, CSS custom properties), but portrait screens need their own values: mask 17vw x 50vh becomes a thin strip, About runs to 15 lines on a phone, captions crowd. Also use small/large viewport units (svh/lvh) for the sticky blocks and ScrollTrigger.config({ ignoreMobileResize: true }) so the mobile address bar doesn't make things jump. Follow HANDOFF "Responsive plan".

## Later (not yet): media optimisation (see HANDOFF "Media checklist")
Waits for Anh's original files. Convert the two GIFs to MP4/WebM loops, serve images as WebP/AVIF sized to display size (srcset), preload only hero media, lazy-load archive and project images, compress the hero video and add a poster frame, preload the Clash Display woff2.
