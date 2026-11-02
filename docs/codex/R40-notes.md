# R40 — mode split, completed 2026-10-11

Branch: `refactor/r40-mode-split`, created from `work-v2` at `c647ead`. One builder; no parallel agents.

## Choices before building

No new design decision was needed. The brief's boundaries were applied as follows:

1. Lite means phone/tablet portrait **and touch landscape**, with no rotate-time switching.
2. Public entry paths and every exported settings name, value and mutable object identity stay intact.
3. Shared nav, wordmark, footer and spawner CSS stays shared because phone entries use it. Desktop homepage layers move together, before page/mode overrides.
4. The strip's input listener registration, toggle morph/focus mathematics and transition state remain shared: they operate on the same cached arrays. The differing layout, release, coast, snap, focus gates and warp policies are adapter hooks. This exception is marked `// SHARED:` in core.js.
5. The brief explicitly permits the single `owners` package scripts entry and a fresh `npm ci` in a new clean clone. No dependency, lockfile, layout-data or media changes were made.

## File map

| Area | Shared | Desktop | Phone/tablet |
| --- | --- | --- | --- |
| Work | `src/work.js` chooses once; `src/work/core.js` owns state, strip, images, DOM anchors, listeners, ticker, GL lifetime and back wiring | `src/work/mode-desktop.js` | `src/work/mode-lite.js`, existing `work/tall.js` and guard |
| Settings | `src/settings/shared.js`; `src/timeline.js` re-exports | `src/settings/desktop.js` | `src/settings/tall.js` |
| Styles | `src/styles/base.css`: fonts, tokens, reset and shared components | `src/styles/desktop.css`, existing Work/project CSS | Existing tall styles |
| Projects | `src/project.js`: common scrolling/footer and dispatch | `src/project/desktop.js`, existing `sections/project-page.js` | Existing `sections/project-page-tall.js` |

The core has no `lite`, `tall` or `tabletLand` conditionals. Mode hooks receive cached state; they do not own a duplicate strip or add an animation loop. Existing `v2` UI calculations remain shared with their strip arrays. The optional hand-off helper is invoked on direct/tall project entries too, preserving the old guard behavior; it is inert without a Work record/overlay.

`docs/OWNERS.md` lists all 89 tracked source files exactly once, plus the shared content/build/docs surfaces. `npm run owners -- --side desktop|lite` (or `OWNERS_SIDE`) reads the branch diff and pending edits, warns about the other side and notes shared edits; it remains advisory. R40 necessarily edits both sides. Shared-file edits are the entry/dispatcher/re-export, base CSS, core, HTML CSS loading, ownership/build tools and standing rules listed below.

Default development/compare port remains 5199. `PORT=5200 npx vite` (PowerShell: `$env:PORT=5200; npx vite`) and `npm run compare -- --port 5200` select the lite server. Verified on unused port 5201: compare 1/1 at the selected port. The parallel-work rules reserve 5199/5200 and leave merges into work-v2 to Cowork.

## Final checks

- Cached desktop comparison: **542/542, zero mismatches at both 1920x1080 and 2560x1440**.
- Before/after snapshots: **zero changed pixels in all 11 samples**: 390x844 home, menu, Work, Bitis; 768x1024 Work/Bitis; 1024x768 Work/Bitis; 1920x1080 Work, light Bitis, homepage. Sampled computed style property/value maps also match in every view.
- Reference is work-v2, not a new design. Baseline fixtures are the original Work/timeline/project/base sources served through Vite. Videos were paused/seeking awaited; the homepage ticker was sampled at the same position. Tablet landscape's existing ambient motion and title reveal needed matching clocks: initial real-time captures showed small phase differences, resolved with Playwright's paused clock and identical frame steps. No site value or check tolerance was changed.
- R37e frozen open/back, sampled at 60 fps: **zero difference in box geometry at every sample**. Mean difference between corresponding grayscale motion values: open **0.000195**, back **0.000448**; peak values identical (6.849252 / 7.226489). Grain/title clocks are aligned before the trigger. The earlier helper accidentally returned a GSAP object from `evaluate`, hanging serialization; void evaluation fixed the helper. No motion source or timing value changed.
- Input smoke: phone, touch landscape and desktop drag/coast/snap all finish with zero landing error, no held drag/inertia/snap; desktop toggle finishes vertical with no active morph. `?perf` and `?tune` load; settings export names/values/functions match and panels edit the same re-exported objects.
- **Zero page exceptions** in sampled pages, motion captures and input smoke. A separate console listener also found **zero console errors across all 13 sampled/panel views**.
- Clean clone at `28ee354`: `git clone --no-hardlinks --branch refactor/r40-mode-split . tools/scratch/r40/clean-clone`, then `npm ci` and `npm run build`: **pass**, including all three layout gates. No ignored helper is needed by the build. The final commit only adds report/request status.
- Total generated JS: **557,909 → 562,309 bytes** (+4,400, 0.79%); CSS: **31,661 → 31,662 bytes**. Chunk boundaries changed; these are totals, not first-screen transfer claims.
- Private preview responds 302 to Cloudflare Access. **Cloudflare build success unverified**: GitHub combined-status lookup returned no statuses; no login or hosting setting changes attempted. [Private preview](https://refactor-r40-mode-split.anh-v-site.pages.dev/work/).
- Extra theme/404/fallback/leak/performance/144 Hz matrices were not repeated: this request changes organization, not those policies, timings, shaders or lifecycle algorithms. The required light-page identity, open/back curve, input and console checks were run. Existing R37e flags remain as signed off; R39/R24c were not implemented.

## Visual gate (sheets opened and inspected)

1. Looks like work-v2: **yes**, for the sampled layouts and opening/return contact sheets.
2. Biggest visible difference: **none**; the aligned motion curves overlap within capture noise.
3. What would close it: no visual tuning is needed for R40; hosted device review can use the private preview after login.

Evidence (local, ignored): [identity sheet](../../tools/scratch/r40/identity-sheet.png), [open/back sheet](../../tools/scratch/r40/motion-sheet.png), [motion curves](../../tools/scratch/r40/motion-curves.png), [summary](../../tools/scratch/r40/summary.json), [input results](../../tools/scratch/r40/inputs.json), [console results](../../tools/scratch/r40/console.json).

Kept reproducible helpers: `tools/scratch/r40/{check,fast,motion,inputs,console,report}.mjs`, `tools/scratch/lib/capture.mjs`; baseline fixtures `r40/baseline-{work,project,timeline}.js`, `baseline-{base,empty}.css`; before/after JSON and screenshots, motion/input/console JSON, bundle manifests and summary. No per-frame PNG dump was made. Throwaway extraction scripts/crops were deleted. The clean clone's source and Git directory remain; its generated install/build outputs were removed after saving bundle sizes, leaving the R40 scratch area about 295 MiB. The working repository's node_modules was untouched.

## Commits and changed files

Each checkpoint was pushed immediately:

- `5dd0b8a` — Work mode policies.
- `c2444ba` — settings re-exports.
- `5fcc8af` — desktop/shared CSS.
- `7458c85` — project dispatcher tidy.
- `f3d059d` — ownership map.
- `4871ba2` — advisory checker.
- `28ee354` — parallel workflow and ports. **Pushed: 28ee354** (all implementation).
- Final report commit: `R40: finish mode split with identity and clean-clone checks`; pushed immediately after creation.

Every tracked file changed: `AGENTS.md`, `docs/OWNERS.md`, `docs/requests.md`, `docs/status.md`, `docs/codex/R40-notes.md`, `index.html`, `package.json`, `vite.config.js`, `tools/compare.mjs`, `tools/owners-check.mjs`, `src/main.js`, `src/project.js`, `src/project/desktop.js`, `src/timeline.js`, `src/work.js`, `src/work/core.js`, `src/work/mode-desktop.js`, `src/work/mode-lite.js`, `src/settings/shared.js`, `src/settings/desktop.js`, `src/settings/tall.js`, `src/styles/base.css`, `src/styles/desktop.css`.

Exact undo: `git switch work-v2`. This leaves the refactor branch unused; no merge, history rewrite or protected-branch changes are required.
