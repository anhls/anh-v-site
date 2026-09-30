# anh-v.com rebuild

Read these before doing anything:
1. docs/HANDOFF.md: full brief, decisions, exact behaviors to reproduce.
2. docs/requests.md: open tasks. Work on the first one not marked done.
3. docs/status.md: what's already built and decided.

## Working rules
- Owner is Anh, an art director, not a full-time developer. Explain setup steps plainly.
- Confirm the plan and content in chat before creating files, running builds, or executing steps.
- When you finish a request, mark it [done] in docs/requests.md and add a dated entry to docs/status.md (what changed, decisions, open questions). Don't edit other parts of requests.md.

## Source material (outside this repo, read-only)
- ../_design/: portfolio PDF, .ai file, old project archive, random exports
- ../_brand-assets/fonts/Melodrama/Fonts/WEB and ../_brand-assets/fonts/Nunito/Fonts/WEB: woff2 + CSS
- ../_brand-assets/icons/: app logo PNGs
Copy only what the site needs into this repo (optimized). Never modify files outside anh-v-site.

## Units and responsive (applies to every section)
Measurements come from the live site at 1920x1080. Never hard-code those px values. Convert them:
- Horizontal sizes and positions: vw (px / 19.2).
- Vertical positions, scroll offsets and translateY: vh (px / 10.8). Scroll ranges stay in vh.
- Font sizes, line heights, small gaps: clamp(min, vw value, max) so text never gets tiny on a laptop or huge on a 4K screen.
- Images and cards: width in vw with aspect-ratio, so they keep their shape at any window ratio.
- Keep all breakpoint-specific values in CSS custom properties (e.g. --about-size) so tablet/phone overrides later are one place.
Desktop must look right at 1440x900, 1920x1080 and 2560x1440. Tablet/phone get their own layouts later (see HANDOFF "Responsive plan").

## Architecture rules (the Framer site's structure was a workaround; don't copy it)
1. One scroll timeline config. Every scroll-driven animation is defined by page-scroll position in vh in ONE file (src/timeline.js), e.g. `aboutReveal: [40, 95]`, `prj02In: 300`. Sections import their ranges from it. No invisible trigger elements (Framer's TriggerFrame, Project1TextOut, 3SectionProject1Zoom etc. were only markers). Tuning = editing numbers in that file.
2. Hero is held by CSS sticky only. No GSAP pin on it.
3. One pointer listener + one requestAnimationFrame loop shared by all cursor effects (click spawner, image trail, caption hover preview, mouse parallax). Effects register/unregister; a section's effect only runs while that section is on screen (ScrollTrigger onToggle or IntersectionObserver). Disabled on touch devices and when prefers-reduced-motion is set.
4. Archive cards: one element per card. Read positions/sizes once (on load and on resize), then only write transforms in the loop. No getComputedStyle or getBoundingClientRect inside per-frame code.
5. Letter/word animations: split text once at build time, animate the spans as a group with transform/opacity (stagger or a scrubbed timeline). No per-letter JS work on each scroll event.
6. No reload-on-resize (Framer's Force_Reload files). On resize: ScrollTrigger.refresh() and re-read cached measurements.
General: animate only transform and opacity where possible. The hero mask's width/height tween is the one agreed exception.
