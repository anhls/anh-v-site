# Status (from Claude Code back to Cowork / Anh)

Newest at the bottom. Format: date, request ID, what changed, decisions, open questions.

- 2026-09-30: folder and handoff docs set up. Nothing built yet.
- 2026-09-30, R1 (scaffold): project folder was renamed to E:\PORTFOLIO (site now at E:\PORTFOLIO\New portfolio\anh-v-site). Re-ran `npm run build` (Vite 6.4.3): succeeded in under 1s, 13 modules, no errors. Output in dist/: index.html, work/bitis09.html, main JS 115 kB (45.6 kB gzip), shared data chunk 21 kB, CSS 0.6 kB. No leftover references to the old folder path in the repo.
  - Scaffold in place: Vite with two HTML entries (home, work/bitis09) in vite.config.js; GSAP + ScrollTrigger and Lenis installed from npm and imported in src/main.js, with Lenis driven by GSAP's ticker so pinned sections stay in sync; folders src/sections, src/effects, src/styles, src/data, public/fonts (Clash Display + license).
  - data.json schema: `site` (title, nav), `about.text`, `spawnerImages[]`, `archiveCards[]`, `projects[]` (slug, index, title, client, year, live, hero{type,src}, details, media[{type,src,layout,caption}], chapters[{title,media}]), `clients[]` (name, slug). Media `src` values are still empty.
  - Decisions: none new; follows HANDOFF.md. Note: R1 asked to propose the plan in chat before creating anything, but the scaffold already existed when this session started, so I verified it instead of rebuilding.
  - Open questions: (1) image/video sources for spawnerImages, archiveCards and project media (placeholders from framerusercontent.com or originals?); (2) archive card positions still need to be read from the live page; (3) licensed background music file; (4) the .gitkeep-only src/sections and src/effects are empty, next up is building home sections in order (HANDOFF "Next steps" 2). This folder is not a git repo yet.
