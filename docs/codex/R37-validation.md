# R37 validation, 2026-10-11

Branch: `codex/r37-r38`. Return to the preserved original working branch with `git switch work-v2`.

Implemented Work-only 0.4 s move and push, expoOut, 0.06 pillow amplitude, peak at 0.5, 0.03 box overshoot, clearStagger 0.1, 32 x 32 mesh. Homepage sec remains 0.9. A tunable 0.125 time share (50 ms at the default duration) overlaps the final GPU image into the DOM on open and the existing Work canvas on return. This is an implementation judgement to avoid browser/GPU texture resampling seams. Raw GL sampling is not pixel-identical to the browser image. The composited open endpoint matches the DOM exactly in renderer tests at 1920 and 2560, DPR 1 and 2; this does not claim raw GL texture equality.

## Results

- Build passes; its existing layout checks run as part of build. No standalone layout/media command was run.
- Cached compare: 542/542 at 1920x1080 and 2560x1440, without refresh.
- Homepage shared transition at 0.225, 0.45, 0.675 s: 0 changed pixels at both sizes against Task 0 source. initFrameOpen itself unchanged.
- Actual open/back contact sheets at both sizes: `tools/scratch/r37-shots/actual-*-sheet.png`, frames every 0.05 s through 0.5 s. Reference not downloaded. Synthetic renderer sheets are also present, separately named.
- Double click ignored; move duration 0.4; context loss removes the renderer and reveals the flat DOM image; wheel finishes the return; overlay cleanup succeeds; zero page errors.
- Actual gl=0, reduced-motion and unavailable-WebGL navigation reach the project with zero console/page errors.
- 20 actual open/back cycles: 0 live transition GL contexts, 0 transition textures and 0 transition canvases after every forward and return hand-off. Heap readings 21–45 MB include navigation/cache/GC variability and do not prove heap leak freedom.
- Real GPU: ANGLE / NVIDIA RTX 4080. At 4x CPU throttle: 1920 median 6.9 ms, p95 7.1 ms, worst 125 ms; 2560 median 6.9 ms, p95 7.1 ms, worst 131.9 ms. The long initial frame includes on-demand setup; these are short 0.4 s samples, not sustained performance guarantees.

## Unverified, script issue (rule 6b)

Strict Work-rest 0-pixel identity and actual return hand-off tolerance remain unverified. No tolerance was relaxed. Capture approaches included sequential snapshots, unchanged-code controls, and attempts to freeze the ticker/rAF and match grain phase. Unchanged-code captures also vary (initial reduced-motion control: maximum 1–2 levels); later normal-GL captures introduce grain and independent nav/UI spring timing. Latest normal-GL before/after rest capture: 1920 side 1 pixel/max3, vertical 711/max4; 2560 side 0, vertical 2/max1. These are not a strict 0-pixel pass. Return whole-page snapshots include visible wordmark/UI changes and exceed tolerance; the helper has not isolated their timestamps reliably. The compositor overlap is implemented, but its actual return hand-off must not be represented as a proven pass. Per 6b, continue rather than stop on the helper limitation. At rest the new renderer is never created, the only changed Work call is click-only, and new motion values are only used by transitions; no rest layout/warp code was changed.

The first capture timeout came from clicking a covering card rather than the main frame. Further freezes accidentally awaited paused GSAP thenables. Main-frame targeting and boolean waits fixed those capture issues, allowing actual sheets and behavior tests to run.

## Changed files and checkpoints

R37: src/effects/bulge-gl.js (new), src/effects/project-transition.js, src/effects/tune-docs.js, src/timeline.js, src/util/ease.js, src/work.js, src/work/tune.js, docs/requests.md (heading only), docs/status.md, this note. New ignored helper/output files are confined to tools/scratch/r37-*, tools/scratch/before-*, tools/scratch/gsap-access.js, tools/scratch/r37-shots/; the previous r38-baseline helper and baseline shots also remain there.

Commits before this completion note: d70a925, 0d22bc3, 064fe32, a393a52. Final commit message: `R37: Work pillow open and reverse transition with validation notes`. Task 0 is 94720ec and predates branch safeguards; it preserved the original user edits and added the supplied brief.
