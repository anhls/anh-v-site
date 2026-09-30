# Handoff: rebuild anh-v.com off Framer (desktop prototype first)

## Who and why
Owner: Anh (Vu Tuan Anh), art director, not a full-time developer. Explain setup steps plainly.
Rule: confirm the plan and content in chat before creating files, running builds, or executing steps.
Goal: replace the slow, non-responsive Framer site with a fast static site that keeps the same look and behavior, then make it responsive (tablet and phone later).

## Decisions made
- Stack: plain HTML/CSS/JS + Vite, GSAP (ScrollTrigger), Lenis. No React.
- Build desktop prototype first, using fluid units (%, vw/vh, clamp) so tablet/phone don't need a rewrite. Reference design is 1920px wide.
- Content lives in one JSON data file (projects, titles, years, media). Optional Decap CMS later. No backend.
- Hosting: GitHub repo + Cloudflare Pages (or Netlify) for preview links. Framer stays live until the switch.
- Prototype scope: full home page + ONE project page (Bitis) from a template. Other 4 projects are data entries later.

## What is actually live (verified from the published site)
Live pages: /, /work/tcb-priority, /work/bitis09, /work/sulwhasoo, /work/similac, /work/forbes.
Not published, ignore: /contact, /work, /playground, /work/:slug template, /work/tcb, /work/ddtv9, /work/7up-tet.
Nav: About -> #2section, Works -> #archive, Contact -> #contact (a section on home, not a page).
The 404 page still has the template title "Dune - Portfolio & Creative Agency": give the rebuild its own 404.
Method used to verify: the published .mjs chunks have source maps listing shipped source files. Framer's MCP getNodeXml only reads the page currently focused in the editor.

## Code actually in use (everything else in the Framer project is unused, ignore it)
Project code files: Clickable_Frame (click image spawner), ScrollFadeText, Image_Resize3 (hero pin), useLazyScrollXYWithEasing, Force_Reload, ForceReload_ID.
External: ParallaxFloating_Prod, CursorImageTrail_Prod. Also Lenis, Ticker, Video, Audio, YouTube (project pages).
Unused (33 override files + LoadingIndicator, 23 components): do not read or port. Do not trust earlier claims about imageScrollOverrides, Image_Gallery_Movement, Scrub_Desktop, LoadingIndicator: none are shipped.

## Exact behaviors to reproduce
Hero pin (GSAP): wrapper starts 100vw x 100vh centered. ScrollTrigger start "top top", end "+=585%", scrub 0.25, pin, pinSpacing, fastScrollEnd, anticipatePin 1, invalidateOnRefresh. Timeline (1 vh = 0.01s):
- 0 to 70: shrink to 17vw x 50vh, expo.inOut
- 150 to 185: reshape to 25vw x 40vh, expo.out
- 185 to 385: hold
- 500 to 585: back to 100vw x 100vh, expo.inOut

Click spawner: sizeVh 60 (min 30), lifetime 8s, fadeOut 1s, floatDistanceVh 125, rotation X10 Y2 Z5 (initial X0 Y2 Z5), spawn 0.4s easeOut, opacity 0 to 1, scale 0.2 to 1, spawnOrigin 0.7, overlap 8%, maxImages 8, perspective 1200, positionOffset 3vw. Shuffled image order, no immediate repeat. Click also plays the page audio.

ScrollFadeText (About): opacity 0.2 to 1, start 0.1, end 0.6, direction down, from end, easing cubic-bezier(0.4,0,0.2,1). Original is per-letter; rebuild per-word.

Cursor image trail: frequency 25, visibleFor 0.5s, region 150vh tall, in-animation opacity/scale/blur spring (stiffness 300, damping 30).

Mouse parallax (35 cards, 34 enabled): direction "away", smoothing 70, distance by layer: back 20, layer1 25, layer2 50, layer3 75, layer4 100. Offset = normalized mouse (-1..1) x distance, springed. Use ONE shared loop, not one per card.

Scroll drift on cards: progress = element center vs viewport; parabola = 1 - |progress - 0.5| x 2; x offset = parabola x (1vw to 20vw, larger near center) x direction x (1 + layer x 0.1). Y component not fully read: match by eye.

Lenis smooth scroll (v1.3.x).

## Home page structure (CORRECTED 2026-09-30, measured on the live site at 1920x1080)
The whole page is 730vh tall. The sections do NOT follow each other after the hero: the hero is a background layer pinned for the entire page, and all other sections scroll over it in one content layer.
- Hero layer ("sticky1-wrapper"): position absolute, top 0, 730vh tall, z-index 3. Inside: a CSS sticky (top 0) 100vh block holding the mask. The mask timeline runs 0-585vh of page scroll; overlays darken 490-630vh.
- Content layer ("Main", in normal flow, 730vh total), each part over the hero:
  | Part | Page range (vh) | Positioning | z-index |
  |---|---|---|---|
  | Hero captions ("Header Projects") | 0-261 | absolute, top 0 (85vh spacer first) | 5 |
  | Click spawner area | 0-100 | absolute, top 0 | 3 |
  | About ("sticky2-wrapper") | 0-190 | in flow: 90vh spacer + 100vh sticky block | 4 (sticky block 3) |
  | Project index ("sticky3-wrapper") | 190-590 | in flow: 50vh blank + 100vh sticky block | sticky block 6 |
  | Archive ("section3") | 211-461 | absolute, top 211vh (2280px), 250vh tall | 4 |
  | Clients ("sticky4-wrapper") | 590-730 | in flow: 100vh sticky block | 4 |
  | Footer | 620-730 | absolute, bottom 0, 110vh | - |
- How they pair up: About lights up around the small mask (17vw x 50vh). The project index titles (PRJ-01/02/03) swap while the 3 images in the mask's #3 section peel away, so each project title goes with one image. The archive cards scroll past the mask and part around it. Clients appear over the full-screen image as the overlay darkens.
- About reveal (live): letters light from ~40vh to ~95vh of page scroll, sequentially (about one letter mid-fade at a time).
Card positions/images: read them from the live page or Framer node XML (page id dERIYUY1Z when focused).
Project pages: video hero, sticky details, split media, chapter titles, scroll reveals, YouTube embeds, Lenis + scroll-fade text. No GSAP.

## Confirmed with Anh + Framer file read (2026-09-30)
Loader: text is "Loading visual language" (not the "Are you ready?" in Framer's Loader Comp). A "Loading N%" label follows the cursor and shows real progress.
Hero captions (4, scroll normally, not pinned): Techcombank Priority / Di De Tro Ve 09 (Bitis) / Sulwashoo Product Launch / Similac Virgo, each with client + "Art Direction" + link. Hovering a caption shows that project's image (427x249) following the cursor.
Click spawner area: top 100vh only. Cursor image trail: 150vh region below the captions.
Nav + wordmark (measured on live site at 1920x1080): state switch is time-based, not scrubbed. It fires on any scroll away from the top (>= 5px) and reverses when back at scrollY 0. Duration ~1s, strong ease-out (about half the distance in the first 150ms, settled by ~1.1s; expo.out or a spring is a close match).
- Wordmark (Framer layer "Logo", an image): start x 0, y 735, 1572 x 345 px (bottom-left, flush with the bottom edge) -> end x 60, y 35, 169 x 39 px (top-left).
- Links (12px text, y 43 in both states), left edge x: About 496 -> 1443, Works 1556 -> 1523, Contact 1769 -> 1600. In vw: About 25.8 -> 75.2, Works 81.0 -> 79.3, Contact 92.1 -> 83.3. So the links regroup to the right, next to each other, in the scrolled state.
- Each link label exists twice (stacked 18px apart): a hover roll effect.
About: 90vh spacer, then sticky. "ABOUT" label + icon sit at the start of the first line; the text starts with blank spaces to leave room for them. Text: "Vu Tuan Anh, Art Director. Based in Ho Chi Minh City with over 5 years of experience in design. I focus on turning ideas into thoughtful visuals - blending motion, layout, and typography to create work that feels clear, expressive, and alive."
Archive ("parting of the Red Sea"): the 35 small floating cards react to the cursor (mouse parallax) AND split apart / move away to the sides as the main image scrolls up through them. 19 cards in the left half (positioned from the right edge of that half), 16 in the right half (from its left edge). Positions/sizes/layers/parallax for all 35 cards: docs/framer-extract/cards.json.
Project index (400vh, sticky): the 3 rows sit in the same spot. Each title rolls in letter by letter, then slides up and out, driven by scroll (scrubbed, not time-based).
Clients (140vh, sticky): same behavior as the project index (letter-by-letter roll in, slide up out, scrubbed). "Client" at left 60px, "2025" at right 60px.
Footer: 110vh, "Go Back To Top" link with a line animation, at the right.

## Why the Framer site is slow
34 parallax loops on every frame (each reads computed style), plus a per-item scroll loop with layout reads via a hosted lazyScrollAnimation module, per-letter React state on scroll, ~6.7 MB home transfer (two GIFs = 3.3 MB), fixed 1920 layout (viewport meta width=1920), 1100 DOM nodes.

## Assets
Use images/video currently on framerusercontent.com as placeholders; request originals (transparent PNGs for cut-out objects). Background music is hotlinked from a free-music site: needs Anh's own licensed file. Fonts: Clash Display (confirmed; variable woff2 + license in public/fonts). Colors: black background, off-white text (approx #ece9e2, sample from live site).

## Responsive plan (later)
Desktop >=1024 scaled from 1920 reference; tablet 600-1024 fewer cards, no mouse parallax; phone <600 own layout (wireframes approved in concept): intro with real progress, hero wordmark scaled to width, tap-to-spawn (max ~4), pinned image shrink, per-word About reveal, ~10-12 drifting cards, vertical sticky project index, centered clients, single-column project page. Drop cursor trail and mouse parallax on touch. Respect prefers-reduced-motion. Test at 360, 390, 768, 1024, 1440, 1920, 2560.

## Next steps
1. Confirm scaffold plan (Vite, folder structure, data.json schema) in chat.
2. Build home page sections in order, then Bitis template.
3. Side-by-side compare with https://www.anh-v.com and tune timing by eye.
4. Set up GitHub + Cloudflare Pages previews.
