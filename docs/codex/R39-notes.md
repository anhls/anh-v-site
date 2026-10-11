# R39 Part B — 2026-10-11

What you will see now: hosting instructions and cache configuration for private previews.
Still off: hosted checks need Anh's Cloudflare Access login; they are unverified.
Your decision: open the branch preview and complete the hosted review below.

## Boundaries and decisions

- Branch: `codex/r39-hosting`, explicitly selected by Anh instead of the brief's default. Part B only; no dashboard changes.
- Changed files: `.nvmrc`, `public/_headers`, `docs/HOSTING.md`, and this note. The explicit file limit overrides edits to `docs/status.md` and `docs/requests.md`.
- Cloudflare's Rollback action applies to production deployments, not previews. The guide documents older preview permalinks and normal follow-up/revert commits for preview recovery.
- Keep existing `.html` links, all site code, packages, media, and the empty `live` branch unchanged.

## Local checks

- Node: `v24.20.0`; `.nvmrc` pins Cloudflare to major 22. A Node 22 cloud build has not been verified.
- `npm run build`: passed all layout gates and Vite (123 modules, Vite 1.04 seconds).
- Output: 722 files; largest `media/tcb-priority/b14a.webp`, 5,221,462 bytes (4.98 MiB); no file exceeds 25 MiB. `dist/_headers` exactly matches `public/_headers`.
- `npm run compare -- --sizes 1920x1080,2560x1440 --port 5200`: 542/542 at each size, zero mismatches.
- Playwright console smoke on port 5200: zero page errors / console errors on desktop home, Work, Bitis09, Duhat, light Work and GL-disabled Work; phone 390x844 home/menu, Work and Bitis09.
- Clean-clone build: pending the first checkpoint commit.
- Five unrelated source edits appeared during validation (`src/effects/nav.js`, `src/sections/footer.js`, `src/sections/project-page-tall.js`, `src/sections/project-page.js`, `src/util/scroll-gain.js`). They were not made or staged by this task. Clean-clone validation will isolate committed hosting changes from them.

## Hosted checks and launch follow-up

- Unauthenticated `curl.exe -sS -I --max-time 20 https://codex-r39-hosting.anh-v-site.pages.dev/work/duhat.html`: HTTP 302 to Cloudflare Access login. Access refuses an unauthenticated origin-page request.
- Preview build success, build duration, final log lines, and cloud install behaviour of `ffmpeg-static` / `sharp`: unverified (no authenticated dashboard access).
- Origin `X-Robots-Tag: noindex`, custom cache headers, `.html` redirect status, `/nope` status/body, and same-origin open/back hand-offs: unverified behind Access. Login response headers do not prove origin headers.
- Same as local: unverified; an authenticated preview comparison was not possible.
- Biggest visible difference: unknown until Anh opens the protected preview.
- What would close it: Anh compares desktop and phone home, both Work modes, two projects, open/back, light theme and `?gl=0`, then checks the build log and origin headers/statuses while authenticated.
- Launch cleanup: seven project canonical URLs and sitemap entries use `.html`, while Pages serves extensionless project URLs. Slugs: `tcb-priority`, `bitis09`, `sulwhasoo`, `similac`, `forbes`, `duhat`, `nam-long`. No URL changes in this request.

## Commits and undo

- Checkpoint: `WIP R39: add Node pin, cache rules and hosting guide` (hash and push recorded after committing).
- Undo this branch's use: `git switch work-v2`. No reset, merge, or history rewrite is needed.
