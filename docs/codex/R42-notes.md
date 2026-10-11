# R42 notes (claude/r42-same-page-nav, 2026-10-11)

What you will see now: Work image click -> puff, grow, land, settle into the project header in one motion, no page load; back -> shrinks with the bend into the same project at the same strip place; clicking again always animates. Phone / tablet: tap opens instantly (effect flag still off), back returns to the same project.
Still off: no side-by-side with docs/reference/r37-dribbble.mp4 (no decoder available; looks-right = "partly", judged from our own sheet: puff -> grow -> land -> settle is one continuous decay, the wordmark then grows to big); under 4x CPU throttle the landing frame has a ~100 ms task (~0 at normal speed, worst frame gap 20.8 ms); real phone / 144 Hz not checked.
Your decision: see the git note at the bottom.

## What was built
- `src/effects/page-swap.js` (router, SHARED): open = flight + build under it + history.pushState; back = popstate / the project nav's Works link -> overlay of the header as it is now + strip resumed + reverse flight (playBack, with the prepared renderer = bend) + project torn down. Any failure -> `location.replace` to the static page. Needs the lazy chunk loaded (idle after load / first pointer-over); before that the old R37f path runs.
- `src/project/in-place.js` (SHARED): same builders as work/<slug>.html in a `.pj-root` container; built hidden on idle for the centred project, layout primed on idle, Lenis proxy until show(); `destroy()` removes everything. Meta / canonical / og taken from the static page's head (fetched once, values only).
- core.js: Lenis is destroyed on pause and re-made on resume at the saved scroll (two Lenis cannot share the window: a stopped one sets overflow:clip); ticker removed; input handlers guarded by `paused`; `swap.attach` controller (pause / resume / frameRect / backPush / finish).
- project-transition.js: `inPlace` option on runProjectTransition (no navigation, `running` reset: this was the "second click does not animate" bug), playBack takes the prepared renderer by `rec.slug`.
- Disposers added (return values, static pages ignore them): project-page.js, project-page-tall.js, footer.js, nav.js (`initNav().destroy()`), scroll-gain.js. project.css: `.nav` blend rule scoped to `html.pj-open`; project.js sets that class and reloads on a stale-document popstate.

## Numbers
- Frame gaps over open / back / open again (headless, ~144 Hz): max 20.8 / 14.0 / 14.0 ms, 0 long tasks. 4x CPU: ~100 ms task at landing only.
- 20 open/back cycles: nodes 5.3k-7.7k (varies with which project is pre-built), listeners 116 -> 128-132, heap 6.4 -> 7.8 MB (+1.3 % between cycle 10 and 20), canvases 3 constant, documents 2, 0 errors.
- Place kept: side and vertical, 3 different projects, S identical. History: ctrl+click opens a new tab, back / forward / back, reload on a project (static page), back from it.
- Static pages vs branch start (7 x 1920x1080 + 390x844, top + scrolled): identical except video pages that differ run-to-run on the untouched base too (forbes 1920 scrolled, similac 390 scrolled).
- compare 542/542 at 1920x1080 and 2560x1440. Phone 390x844 and tablet 1024x768 emulation: tap -> instant swap, back -> same project, 0 errors. Tall smoke (home, menu, project): ok.

## Known differences / not done
- Project page is destroyed and the header replaced by the overlay at the start of back: if the header was only partly scrolled out, the rest of the page disappears at that frame (same as the old static design).
- `mode.tap` gate (R41) is not wired: a tap uses the click path (drag swallow exists). R41 Part B should wire it.
- Dev port 5199 was in use by another agent's server; this run used 5201.
- More Projects links and the homepage frame stay normal navigations (as briefed).

## Git note (needs your eye)
Codex's R39 session works in the same folder `anh-v-site` and switched HEAD to codex/r39-hosting while I was editing; my first WIP commit landed on that branch (unpushed). I cherry-picked it onto claude/r42-same-page-nav in a worktree (tools/scratch/r42/wt) and added a `git revert` of it on codex/r39-hosting (a623a1a + a01f5d5, net zero, not pushed). Cowork may prefer to drop those two local commits when Codex pushes.
