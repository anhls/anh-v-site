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

## Home page structure (order, heights in vh)
Loader ("Loading visual language" + percentage, cursor-following loader) then hero stack 730vh (video + ticker section, image section, 3-image section with overlay), About 190vh (sticky text + ABOUT label), Works/archive 250vh (35 absolutely positioned image cards with titles swapping: Techcombank Priority, Bitis, Sulwhasoo), project index 400vh (PRJ-01 Techcombank Priority 2025, PRJ-02 Bitis DDTV SS09 2024, PRJ-03 Sulwhasoo Launch 2023), clients 140vh (Forbes Vanguard, Techcombank Priority, Sulwhasoo, Similac Virgo 2024, Bitis Season 09), footer 110vh with "^ V" wordmark. Fixed nav: About / Works / Contact.
Card positions/images: read them from the live page or Framer node XML (page id dERIYUY1Z when focused).
Project pages: video hero, sticky details, split media, chapter titles, scroll reveals, YouTube embeds, Lenis + scroll-fade text. No GSAP.

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
