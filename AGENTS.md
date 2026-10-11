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
