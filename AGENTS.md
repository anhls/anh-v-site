# AGENTS.md: standing rules for any coding agent (Codex, Claude Code, others)

Read first: CLAUDE.md (house rules), docs/requests.md (open work: the first item not marked [done]), the brief it points to
(docs/codex/*.md wins over requests.md where they differ), docs/status.md (what is built). Owner: Anh, an art director, not a developer.

## 1. Before building: question the brief
- List up to 5 points where the brief is ambiguous, contradicts the code, or is likely to produce a result that will not LOOK like the
  reference (example: "this ease reaches 90 % in 0.1 s; the reference does not"). Put them at the top of your status entry.
- If Anh is present, ask. If not, pick the reading that best matches the reference and Anh's stated goal, not the literal number, and log it.
- Planner numbers are starting values. Visible behaviour beats specified values.

## 2. Visual / motion work: the "does it look right?" gate
- References live in docs/reference/. If a brief links one that is not there, try to download it there; if you cannot, say so at the top.
- Before calling a visual task done, make a side-by-side contact sheet (ours vs reference, same timing) and LOOK at it. Write 3 lines:
  1) looks like the reference: yes / partly / no; 2) the biggest visible difference; 3) what would close it.
- "Partly" or "no" = keep tuning or stop and ask. It is never "done".
- Red flags even if every test passes: identical frames, pops, jumps, nothing moving, things drawn in the wrong order (behind / in front).

## 3. Proportionate strictness
- Classify every difference by what a person would see:
  invisible (<= 2 colour levels, < 0.1 % of pixels, edges only) -> log as a known difference, continue;
  visible but minor -> fix if cheap, else log and continue;
  visible and wrong, or something breaks -> fix, or stop.
- Never weaken or edit a test to make it pass. Just do not stop a whole task over invisible differences.
- Helper scripts are tools: rewrite them freely, keep them few, put them in tools/scratch/, delete throwaway ones before finishing.

## 4. Stop rules
- A site check still failing after 3 different fixes: commit WIP, stop, report.
- A helper script failing after 3 different approaches: mark "unverified (script issue)", continue.
- About 30 minutes on one problem without progress: write what you tried, commit WIP, move on (or stop if nothing else can be done).
- Stop immediately if: the homepage or the dark site at rest changes and you cannot undo it; a git lock blocks you; a fix needs a file
  outside the brief's list; you would need a new package.

## 5. Git
- Work on the branch the brief names (one branch per request batch). Never commit to, merge into, push, or reset work-v2 or main.
  Never touch tags.
- Banned: reset --hard, rebase, clean, stash drop, history rewrite, any --force; no package.json / package-lock / node_modules changes.
- Small commits ("WIP <req>: ..." while working, "<req>: ..." when done). After EVERY commit: `git push origin <branch>`.
  Rejected push: `git pull --ff-only origin <branch>`; if that fails, stop. Login asked: stop and tell Anh. Never edit git config or credentials.

## 6. Report (docs/status.md, dated entry)
- First 3 lines in plain words for Anh, no codes or jargon:
  "What you will see now: ...", "Still off: ...", "Your decision: ...".
- Then at most 5 technical lines (final values vs start values, checks, "Pushed: <hash>", the undo command). Longer detail goes in
  docs/codex/<request>-notes.md.
- Mark the request [done] in docs/requests.md (heading only).

## 7. Motion: continuity, timing, refresh rate (learned on R37-R37d)
- Measure motion, do not only look: record frames (60 fps or more) from the trigger to the final settle and compute the per-frame motion
  curve (mean absolute difference between consecutive greyscale frames). Do the same for the reference and compare the SHAPES.
- No stop-then-go: continuous means continuous SPEED. A phase that eases to zero and then starts a new phase is a bug, even if every
  position is right. Judge dips RELATIVE TO THE REFERENCE's own curve (drop its duplicate frames first: exported reference videos often
  repeat frames), not against an absolute threshold the reference itself would fail.
- Anything that reverses direction (a pulse that returns) passes through zero speed: if continuity matters, prefer monotonic motion
  that settles, or carry the motion into the next page instead of reversing it.
- Click / tap responsiveness: the first frame after a trigger must be under ~20 ms. Heavy setup (WebGL context, shader compile, texture
  upload) happens BEFORE the trigger (hover, idle, after load), sliced so it never makes a visible hitch either. Judge hitches at real
  speed first, then at 4x CPU throttle as a stress check; report both.
- Refresh rate: Anh's desktop is 144 Hz (4K), his laptop Full HD (60 Hz). All motion must be time-based (elapsed time / dt, exact
  springs, GSAP timelines), never "move X % per frame" or frame counts. For motion work, run the motion test at simulated 60 and 144 Hz
  (e.g. throttle / pace requestAnimationFrame in Playwright) and confirm the curves match in time.
- Anh's screen recordings are usually 60 fps: good for spotting stops and hitches, not for judging 144 Hz smoothness.
- Planner formulas and numbers are starting points. If they produce a visibly wrong result (examples so far: an expo-out ease that
  popped, a lens sign that bent the wrong way, a 15 % strength that was invisible), say so and fix toward the reference.

## 8. Hosting and machines
- Every push builds a PRIVATE preview on Cloudflare Pages: `<branch>.anh-v-site.pages.dev` (branch name lowercased, `/` -> `-`),
  behind a Cloudflare Access login, noindex. Use it for Anh's phone / laptop checks.
- `live` is the public production branch and is EMPTY on purpose until launch (unreleased client work in the repo). Never push the
  site to `live`, never change Cloudflare settings, never ask for or store Cloudflare / GitHub tokens.
- Anh works on a PC and a laptop: pull before starting, push when stopping, one agent per branch at a time. Never copy folders between
  machines.

## 9. Working speed (checks in proportion to the change)
- Two check tiers:
  - ITERATING: run only the one or two checks that tell you whether the current change works (e.g. the motion curve at 1920 for a
    motion change, one screenshot for a layout change). Fast feedback first.
  - FINAL (once, before the final commit of a request): the full list in the brief.
- Only check what the change can affect. Examples: no theme / 404 checks unless theme or 404 code changed; leak cycles only when
  renderer / canvas / listener code changed; homepage identity only when shared code the homepage imports changed; 2 sizes x 2 DPR only
  for pixel hand-offs. Say in the report which checks you skipped and why (one line).
- Reuse helpers: shared capture / diff / motion-curve / cycle scripts live in tools/scratch/lib/ (create it from the best existing
  helpers the first time). Extend them instead of writing a new script per request. Per-request scripts go in tools/scratch/<req>/ and
  are deleted at the end unless the report links them.
- Outputs: keep only what the report links (final sheets, curves, one JSON summary). Delete per-frame PNG dumps and intermediate runs
  before finishing. Target: tools/scratch under ~300 MB.
- Time budget: aim for ~20-30 minutes per request. Past ~45 minutes, write where you are, commit WIP, push, and report instead of
  continuing to iterate. A brief may set its own budget.
- Same-value retries: at most 2 trial edits of the same number, then calculate it from measurements or report (as in CLAUDE.md).

## 10. Clean-clone rule
- tools/scratch/ is ignored by git. NOTHING the build, the site or a tracked tool imports may live there: shared code goes in
  tools/lib/ (tracked). (Found 2026-10-11: the layout checks imported tools/scratch/r29-shim.mjs, so every Cloudflare / fresh-clone
  build failed while local builds passed.)
- Every request's FINAL tier includes: build from a clean clone (`git clone` of your branch into a temp folder, `npm ci`, `npm run build`)
  and, after pushing, confirm the Cloudflare preview build succeeded (or say you could not check).

## 11. Parallel work
- Use docs/OWNERS.md: desktop-side and lite-side requests stay mostly in their own files (any agent can build either side). Run `npm run owners -- --side desktop` (or `lite`)
  before each commit. Its warnings are advisory. Keep shared edits small and list them in the request notes.
- Each side protects the other: desktop runs a tall smoke test at 390x844 (home, menu, one project); lite runs desktop compare
  at 1920x1080 and 2560x1440 (542/542 each). Use the request's final tier before handing back a finished branch.
- Cowork merges into work-v2 often, one branch at a time. Builders never merge into or push work-v2. R24c rotation mode switching
  starts only after both sides have been merged.
- Separate dev ports: desktop 5199 (default), lite 5200. Use `PORT=5200 npx vite` in POSIX shells, or
  `$env:PORT=5200; npx vite` in PowerShell. Compare the matching server with `npm run compare -- --port 5200`.

## 12. Folders and branches: one agent per folder (learned 2026-10-11)
- The REQUEST sets the side, not the agent: Codex or Claude Code may build desktop or lite work. Every brief's first lines name
  `Side: desktop | lite`, `Folder:` and `Branch:`. Use exactly those.
- Side picks the folder: desktop -> `D:\Portfolio website\anh-v-site`, lite (phone/tablet) -> `D:\Portfolio website\anh-v-site-mobile`.
  A folder named in the brief wins.
- Busy note: on start, write `.git/agent-busy` in that folder (one line: agent, request, branch, start time). Delete it when you finish
  or stop. It is inside .git, so it is never committed or synced. From a worktree, write it in the main folder: `$(git rev-parse --git-common-dir)/agent-busy`.
- Before starting, read that note. Another agent's note < 2 h old = the folder is in use: do NOT checkout/switch there. Work in your
  own worktree (`git worktree add tools/scratch/<req>/wt <your-branch>`) or stop and ask Anh. A note >= 2 h old = stale: log it, continue.
- Never checkout/switch branches in a folder another agent may be using. If the folder is on someone else's branch, use a worktree.
- Before every commit run `git branch --show-current`; if it is not the brief's branch, stop (do not commit, do not move commits).

