# <Request id>: <one-line title>

Planner: <who>, <date>. Builder: any agent. AGENTS.md applies. This brief wins over docs/requests.md where they differ.

## Goal (one sentence, what Anh should SEE)

## Reference
- File(s) in docs/reference/ (video / images), the exact time range or frame that matters, what NOT to copy from it.
- Rough targets (starting values only): ...

## Scope
- Files to change: ...
- Must not change: ... (homepage is parked unless stated)

## Steps
1. ...

## "Looks right?" test
- The side-by-side to make (ours vs reference, timings), and what "yes" looks like in plain words.

## Checks
- Build, compare 542/542 at 1920 and 2560 (dark), 0 console errors, fallbacks (?gl=0, reduced motion), plus request-specific ones.
- Motion work: per-frame motion curve ours vs reference (AGENTS.md section 7), first frame after the trigger < ~20 ms, curves match at simulated 60 and 144 Hz.
- Check on the private preview link too (AGENTS.md section 8) when the change is visual.

## Assumptions and likely misreadings
- A1 ...

## Branch and push
- Branch: <name>. Push after every commit. Safety rules: AGENTS.md section 5.
