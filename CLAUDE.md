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
