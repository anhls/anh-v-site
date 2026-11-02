# Plan: faster runs without losing quality (agreed with Anh 2026-10-01)

Becomes request R11c right after R11b is committed (short request; Sonnet 4.6 is fine).

## 1. compare.mjs (R11c)
Current cost: live load 20s (+20s per reload when live scripts fail) + 22 points x 2s settle; then local 8s + 22 x 2s; sequential. About 2 min per size, 5-6 min per tuning try at 2-3 sizes.
1. Live cache: save live probe values per viewport to tools/live-cache/<W>x<H>.json (with date + point list). Reuse by default; `--refresh-live` re-measures. Refresh once at the start of each request that touches motion, and after any Framer republish. If a requested point is missing from the cache, measure just that point on live and add it.
2. Tuning mode: `--only aboutRev,aboutTop` (probe filter) + `--points 60,75,90`. Use while tuning; the FULL run (all probes, all points, 1920x1080 + 2560x1440) stays mandatory before every commit.
3. Adaptive settle: after each scroll, read the probes every 100ms and continue once two reads in a row match (within 1% of tolerance), max 2000ms. Keeps settled values exact, skips dead waiting.
4. Local readiness: wait for a `window.__siteReady = true` flag (set in main.js after the loader resolves and ScrollTrigger.refresh) instead of a fixed 8s; fallback timeout 10s.
5. Parallel: `--sizes 1920x1080,2560x1440` runs each size in its own browser context at the same time; when refreshing live, live and local run in parallel too.
6. Fixed dev port: vite.config.js server { port: 5199, strictPort: true }; compare.mjs defaults --local to http://localhost:5199/. An old server on another port can no longer be measured by mistake.
Target: tuning check under 30s; full pre-commit check about 1-2 min. Verify: full run before/after the change gives identical results at both sizes.

## 2. CLAUDE.md rules (add in R11c)
- Measure, then fit: use `--dump` and compute the value from the data. Max 2 trial edits of the same value; after that stop and calculate, or report.
- Log measurements in status.md as you go (survives context compaction).
- Small leftovers: if a remaining mismatch is small and hard to see, log it as a known difference and move on instead of looping.
- Second context compaction in one session: stop after the current item, log, commit, report.
- Use tuning mode while iterating; full two-size run only before commit.

## 3. Sessions (Anh, no code)
- One fresh Claude Code session per request.
- Turn off integrations the site does not need in Claude Code (`/mcp`: Google Drive/Docs/Sheets/Slides) to cut starting context.
- Model: Sonnet 5.5 for measurement/motion work (R11b-type, archive, WebGL bend); Sonnet 4.6 for straightforward builds (R12, media, remaining project pages).

## 4. Later stages
- Media optimisation: one batch script (ffmpeg + sharp) over ../_site-media, skips files already converted, so re-runs take seconds.
- Deploy: Cloudflare Pages builds on every push (no manual step).
- Cowork checks the repo directly; full visual previews only at milestones.

Order: R11b -> R11c -> R12 ...
