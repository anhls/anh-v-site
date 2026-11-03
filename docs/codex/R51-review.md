# R51 independent review — 2026-11-03

Base: `origin/review/r50-code-review` at `10ff536`. Isolated worktree; branch `review/r51-codex-review`. Findings below were written before opening R50's report or status entry. Severity describes what the visitor experiences. No taste changes are authorized by this review.

| ID | File:line (base) | Finding / evidence | Severity | Fixed + commit |
| --- | --- | --- | --- | --- |
| F1 | src/effects/loader.js:88,112 | A rejected font load rejects `fontsP`; `nextAt` remains Infinity even after the 12 s cap. Blocking woff2 requests leaves the loader present and siteReady false after 16.5 s. | breaks | yes, 396f29d |
| F2 | src/effects/tall-menu.js:119 | Nested idle preparation is unguarded. If its third slice runs after opening, `prepWork()` replaces the entrance timeline and rewinds it to zero. Controlled idle scheduling reproduced Work menu item opacity 1 -> 0 while the menu remained open. | visible | yes, 70a4c26 |
| F3 | src/work/home-return.js:56 | The 2.5 s cap is a wait cap, not a removal deadline: two additional frames and landFadeSec (0.35 s) follow. If the strip has not drawn, the frozen landing dissolves to an undrawn strip. The log incorrectly says the layer is kept. | visible | yes, 848874b |
| F4 | src/project/in-place.js:121 | Each show registers a modal subscription that destroy never removes. The closure retains a destroyed Lenis instance. Cycle measurements pending. | invisible | yes, 9ac1c53 |
| F5 | src/effects/home-leave.js:182 | Safari card-first return awaits two image decodes without a deadline before the 1.5 s video cap even starts. A stalled card/hero request can keep the card-first layer and hidden home wordmark forever. | breaks | yes, f8a778c |
| F6 | src/work/tall-title.js:81 | Font readiness has no deadline: both load and fonts.ready can stay pending. The row eventually appears but the title never initializes. | visible | yes, c68805c |
| F7 | src/work/tall-details.js:22,29 | The live status node is a descendant of aria-hidden=true. Its counter/year/work updates cannot be announced. | invisible | yes, e2d92d2 |
| F8 | src/effects/loader.js:23; src/styles/base.css:131 | Loading hides controls only with opacity; keyboard can focus and activate them beneath the loader. No inert/aria-busy page guard. | breaks | yes, b3e8333 |
| F9 | src/effects/tall-menu.js:20; src/effects/menu-smear.js:16; src/effects/tune-docs.js:270 | MENU_FX and unsmooth have no callers; tune help still claims every title has one size after per-title shrink was added. CSS/dead settings sweep pending. | invisible | yes, 481d008 |

Independent checks: `T.s0` IS assigned in v2-ui.js:132, so the brief's old report of it never being set does not hold at this base. The shared title rule and live-wordmark handle stack need runtime regression checks; no fresh correctness defect asserted for either yet.

Tests use headless browsers with tools/lib/no-mailto.mjs before goto. WebKit binary was absent; installation failed after download-host timeouts; Chrome iPhone emulation is the fallback.

## R50 comparison (read after saving the independent table)

| Finding | R50 had it: yes / no / disagrees |
| --- | --- |
| F1 | no — loader waits were read, not re-tested |
| F2 | no — menu cycles missed the delayed idle slice |
| F3 | disagrees — R50 found the extra fade but calls the cap working; it is not a 2.5 s removal deadline |
| F4 | disagrees — R50 reported flat leak counts; modal subscribers are outside its window/document listener count |
| F5 | yes, f8a778c |
| F6 | yes, c68805c |
| F7 | disagrees — R50 says the screen-reader line reads year/work; an aria-hidden ancestor prevents this |
| F8 | yes, b3e8333 |
| F9 | yes for tune help; no for the unused helpers |

R50 correction: its finding 7 is false at the reviewed base: `T.s0 = size` is present at v2-ui.js:132 (introduced by 33c0f17). No fix needed. R50's three patches were inspected individually: e1f2057 correctly removes startBig on phone Work arrivals; 1560095 correctly centralizes the text/size formula but leaves font readiness outside that rule (F6); c6b4327 correctly removes a key with no reads. All three are retained. The rare cold-start failure to grow the wordmark has not yet been reproduced; F2 is a confirmed initialization race affecting menu items, not proof of the same wordmark failure.


## Also fixed (found while fixing)
- 89087e0 loader: if the swipe code chunk stalls, the loader leaves with the plain fade instead of waiting.
- 4c6adea loader: reduced motion = the wordmark is placed at once (no grow).

## Final tier (Cowork picked up after Codex stopped, 2026-11-03 ~11:00)
- Build OK; clean-clone build OK.
- Desktop compare at 1920 and 2560 (?home=full, local dev server): 542/542 both (one run at 1920 showed 541/542, the rerun 542/542: flaky single item).
- Repro (a) /work/ -> project -> menu "Work" -> menu open: wordmark grows (16 -> 594). Repro (b) not re-run here (the real flight does not run in headless Chrome; R50's hand-written record test covers it).
- F1: all woff2 requests blocked: the loader appears and leaves (desktop 7.1 s, phone 6.0 s), no page errors, no inert left except the closed phone menu (by design).
- Smoke 1920 + 390x844: Home, Work, /work/forbes load with no errors.
- WebKit: not available (same as R50).
