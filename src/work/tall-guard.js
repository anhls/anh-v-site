import { TALL } from '../timeline.js';

// R24d: the frame-time guard of the lite modes (phone, tablet). A weak phone must still scroll smoothly, just flat. While the strip moves (drag, coast, snap, wheel) the
// frame times are collected (rAF gaps); every TALL.guardFrames frames, and at the end of a burst of movement of at least half that, the median and the p95 are checked: over
// TALL.guardMs / TALL.guardP95 the guard steps down one stage: 1 = the warp pass at x0.75 resolution, 2 = x0.5, 3 = the warp off (flat images, nothing else changes).
// It never steps back up in a visit (no flapping). `state` is read by the ?perf report (field tallGuard); in dev every step is logged to the console.
// Frames that are not strip motion, stalls over 500 ms (a hidden tab) and the 5 frames after a step (the buffer is rebuilt) are not counted.
const SCALES = [1, 0.75, 0.5, 0.5];
export function createGuard({ setScale, enabled = true }) {
  const state = { enabled, step: 0, scale: 1, warp: true, history: [] };
  let buf = [], skip = 0, wasMoving = false;
  const q = (a, p) => a[Math.min(a.length - 1, Math.floor(p * a.length))];
  const evaluate = () => {
    if (buf.length < Math.floor(TALL.guardFrames / 2)) { buf = []; return; }
    const a = [...buf].sort((x, y) => x - y), median = q(a, 0.5), p95 = q(a, 0.95);
    buf = [];
    if (median <= TALL.guardMs && p95 <= TALL.guardP95) return;
    state.step += 1; state.scale = SCALES[state.step]; skip = 5;
    if (state.step >= 3) state.warp = false; else setScale?.(state.scale);
    const label = ['', 'warp pass x0.75', 'warp pass x0.5', 'warp off'][state.step];
    state.history.push({ step: state.step, label, medianMs: +median.toFixed(1), p95Ms: +p95.toFixed(1), atMs: Math.round(performance.now()) });
    if (import.meta.env.DEV) console.info(`[tall guard] step ${state.step}: ${label} (median ${median.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms)`);
  };
  return {
    state,
    frame(ms, moving) {
      if (!state.enabled || state.step >= 3) return;
      if (!moving) { if (wasMoving) evaluate(); wasMoving = false; buf = []; return; }
      wasMoving = true;
      if (ms > 500) return;
      if (skip > 0) { skip -= 1; return; }
      buf.push(ms);
      if (buf.length >= TALL.guardFrames) evaluate();
    },
  };
}
