# Session brief: anh-v.com rebuild (for a fresh Cowork session)

Owner: Anh (art director, not a full-time developer). Rule: confirm plan and content in chat before creating files or running builds. Explain plainly.

## Where things are
- Site repo: E:\PORTFOLIO\New portfolio\anh-v-site (Vite + GSAP + Lenis, no React). Git, committed per request.
- Claude Code works from anh-v-site; it reads CLAUDE.md, docs/requests.md (open work only) and docs/status.md.
- Brief: docs/HANDOFF.md. Exact motion reference: docs/framer-extract/motion-spec.md (springs, eases, triggers, ranges from the published Framer code). Card layout: docs/framer-extract/cards.json. History: docs/archive/.
- All timings: src/timeline.js. Springs: src/effects/springs.js.
- Original media sorted into E:\PORTFOLIO\New portfolio\_site-media (sources.tsv maps each file to its original in D:\Work\PORTFOLIO 2025 and the live URL it replaces). Missing: hero portrait (#2) and a higher-res hero video.
- Live site: https://www.anh-v.com (Framer project "Framer Website", home page id dERIYUY1Z).

## Workflow
Cowork writes requests into docs/requests.md -> Anh tells Claude Code "do Rn" -> Claude Code builds, runs `npm run compare`, commits, logs 8 lines in status.md -> Cowork previews only at milestones or for judgement calls.
Comparison: `npm run compare` (tools/compare.mjs, headless Chrome at a real 1920x1080, live vs local, prints only mismatches). Never measure scroll timing in the scaled in-app browser panel: it skewed earlier results.

## Status (2026-10-01)
Done: loader, hero (mask + strip + vertical float + springs), About, project index (with per-character text effects), captions, nav/wordmark (spring, returns big at footer), Lenis 3s glide. Performance: 60fps median, 7% slow frames (live Framer 73%), 1.5 MB (live 15 MB).
Open: R11 (mask timing back to 0-70/150-185/500-585, peels share index-swap ranges, #3 rise 196-224, float lag, small About offset). Then R12 clients + footer (hover image cursors in motion-spec section 8), then the archive section (cards.json + ParallaxFloating/scroll-drift, "parting" around the mask), then media optimisation with _site-media, then project pages (Bitis first), then tablet/phone.
Decisions: loose scrub 0.25; no loader start delay; loader waits for first screen only, max 5s; "Sulwhasoo" spelling, "Di De Tro Ve 09" unaccented (Clash Display lacks the glyphs); no background music (0.5s click sound on the top 100vh only; self-host later); hero fades to black at the end instead of the live pop at 585vh (confirm with Anh).
