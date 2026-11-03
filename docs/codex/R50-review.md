# R50 code review (what went live 2026-11-03)

Branch `review/r50-code-review` (from origin/work-v2 4d336c2). Tested in Chrome (iPhone emulation 390x844, touch): **WebKit would not download** (cdn.playwright.dev download failure), so nothing here ran in real Safari.
Scripts: `tools/scratch/r50/` (untracked). Severity: breaks / visible / invisible.

## Findings

| # | file:line | what | severity | fixed | commit |
|---|---|---|---|---|---|
| 1 | src/work/mode-lite.js:86 (`startBig:!!#pxh`) | Home -> Work on phone: the landing layer draws the wordmark SMALL at TALL.wmSmall, but the live Work wordmark started BIG and shrank after the layer left: 2 wordmarks for about 2 frames, then a visible jump (big bottom -> small top, ~0.6 s). The same "old rule survives in a second place" class as the two bugs Anh found. Measured (rect log per frame): before 319 px wide at y 774 shrinking to 109; after 109 px at 141,16 in every frame | visible | yes | e1f2057 |
| 2 | src/work/tall-title.js:31-37 and src/effects/home-leave.js liteTitle | The phone title rule (full vs short, fit to card, tracking) existed in two copies. Now ONE function `fitLiteTitle` (src/util/title-fit.js); defaults `?? 0.6` / `|| 0` dropped (both are defined in LITE_TITLE) | invisible (latent) | yes | 1560095 |
| 3 | src/work/home-return.js:51 | After the cap change (10 s -> 2.5 s) the `slow` debug branch (`> 2500` inside a loop that exits at 2500) can never fire, and its text "layer kept" is wrong: after 2.5 s the layer fades even if the strip has NOT drawn (a frame of page colour could show under it on a very slow device). Behaviour is what Cowork chose; with video blocked the layer left at 757 ms | invisible (dead code); the 2.5 s trade-off is a decision | no | |
| 4 | src/effects/home-leave.js:118 vs src/effects/nav.js:66-69 | Landing wordmark uses plain vw / vh from TALL.wmSmall; the live one uses capped `cw()` / `ch()`. Same on phones and tablet portrait; would differ only above 1920 css px wide | invisible | no | |
| 5 | src/settings/tall.js titleCapPx | The wordmark size comes from the Clash Display cap height and needs the font loaded. The landing record is measured on Home; the live wordmark re-measures every frame. If the font is not ready on Home the landing wordmark could be slightly off. Home preloads the font, could not make it happen | invisible (unverified) | no | |
| 6 | data.json (04... 4996d2e) | TCB 2025 -> 2024, Sulwhasoo 2023 -> 2024, Forbes null -> 2023: now the desktop Work year column also shows these (Forbes had none before) and they match the project pages' "Year" row. duhat / nam-long are `hidden` (no `work`), so the phone row would show year only if they were turned on | visible on desktop (Forbes year appears) | no, Anh's taste | |
| 7 | src/work/v2-ui.js:129,178 | `T.s0` is never set (always 0); only read when no title is shown, so harmless. Every real read of title size is `T.size[idx]` (per project): setTitle, placeTitle, leaveTitle, playTitle, scrubTitle all fine with the new per-project scale-down. Desktop 1920 shows "Techcombank" | invisible | no | |
| 8 | src/effects/tune-docs.js:270 | Tune help text still says "Every project uses this one size" (not true since 33c0f17) | invisible | no | |
| 9 | src/settings/tall.js:75 | `TALL_DETAILS.lineInsetVw` read nowhere (descLines / descChars already gone) | invisible | yes | c6b4327 |

## Cowork commits, line by line
- 04f9eb3 tall-menu.js lineTw Map: correct. `lineKill(el)` kills only that link's tweens, `lineKill()` all; entries deleted. Menu open/close x20: listeners, GL contexts and rAF did not grow.
- 590c4d6 wm-handle stack: correct; destroy() removes only itself, `getWm` skips detached. Repro (a) passes for Back, menu "Work", swipe-right (2 visits each, wordmark 109 -> 319 px on menu open). One earlier run right after a cold dev-server start showed no growth and I could not repeat it in 8 further runs: possible rare race, unexplained.
- 33c0f17 fitTitles: correct for all T.size readers (see 7). trail.js `T.size` is a different object. `TITLE_SHORT` is read by v2-ui, tall-title, title-fit only.
- 4996d2e tall-details: correct. `srYear` is unused (harmless); screen-reader line now reads year + work. Check 6 above.
- 4d336c2 liteTitle/pxh/core firstReady: title rule now identical (finding 2); poster accepted; landing cap 2.5 s works (757 ms with .mp4/.webm aborted); wordmark bug is finding 1.

## Scope 2 summary
1. Small wordmark place/size: nav.js (getters), home-leave.js:118 (getters), mode-lite.js:86-87, project.js:46, in-place.js:137 all use TALL.wmSmall. index.html / work/index.html copy the record's rect/style. No hard-coded vw/vh found (finding 4 = cap only).
2. Title text/size: tall-title.js + home-leave.js now share title-fit.js. Desktop v2-ui has its own (different, desktop) rule by design. page-swap / project-transition / in-place paint no title.
3. Wait loops: firstReady accepts the poster; landing cap 2.5 s; video blocked = layer gone at 757 ms, one wordmark. Loader 12 s cap, menu prime and page-pause were only read, not re-tested (page-pause is cleared in closeNow / sweep done; a stuck flag needs a document change mid-sweep, not found).
4. Singletons: wm-handle fixed; page-pause as above; `window.__r45vt/__paintPxh` are set per document, not touched by in-place pages.
5. Dead code: only lineInsetVw proven unused. CSS for removed elements and old LOADER / MENU_SWEEP keys NOT swept (time).
6. Leaks (Chrome, 390x844): menu x20 and project open/back x10: window/document listeners (deduped by function), live GL contexts (5) and pending rAF (2-3) stay flat.
7. data.json: 5 visible projects all have year + work; project-page Year row equals `year` for all 7; sitemap built from visible projects.

## Checks
Repro (a) pass x3 ways; repro (b) pass (hand-written pxh record because the real flight does not run in headless Chrome: layer gone 757 ms, 1 wordmark per frame after fix, title text from the shared function); desktop compare 542/542 at 1920 and 2560 (`--local http://localhost:5199/?home=full`; without that URL it reports 124/360); tall smoke 390x844 (home, work, project) and desktop 1920 work: no console errors; build OK; clean-clone `npm ci` + build OK. Cloudflare preview not checked.
