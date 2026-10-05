// R29: the states the Work page card rules are checked in (LAYOUT_STATES in timeline.js), for ONE mode. Pure functions on arrays, shared by the offline solver
// (tools/layout-solve.mjs), the build gate (tools/layout-check.mjs), the load-time fallback pass (work/cards.js) and the ?overlap debug overlay.
// Coordinates: x = across the strip (the card's `cross`), y = along the strip from project 0's frame centre (project * pitch + the card's `along`), px at the
// real window size; the strip is a loop of period N * pitch, so every state is seen from the view centred on each project (the loop seam is covered).
// States: rest; the mouse drift at LAYOUT_STATES.drift of its maximum in the four diagonal directions; the focus push of project k at full progress (without
// the overshoot bump); the ambient drift at its END position. Not checked: the extremes, the lead, the transitions (see timeline.js).
import { WORK, CARDS, LAYOUT_STATES } from '../timeline.js';
import { applyFocus } from './focus.js';
import { ambUnits, ambParams, ambDepthW, ambProgress } from './ambient.js';

export const wrapP = (v, P) => ((((v + P / 2) % P) + P) % P) - P / 2;
export const slugSeed = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }; // FNV-1a: a project's seed from its slug

// The per-mode constants of a layout. projects = the card lists, M = the mode's metrics (work/cards.js workMetrics), placed = { cross, along, crossSize, alongSize } per card
export function stateData(projects, M, placed) {
  const N = projects.length, pitch = M.alongF + M.gap, period = N * pitch, sc = M.scale;
  const flat = [];
  projects.forEach((list, pi) => list.forEach((c, k) => flat.push({ c, pi, k })));
  const n = flat.length;
  const X0 = Float64Array.from(flat, (f) => placed[f.pi][f.k].cross);
  const Y0 = Float64Array.from(flat, (f) => f.pi * pitch + placed[f.pi][f.k].along);
  const Wv = Float64Array.from(flat, (f) => placed[f.pi][f.k].crossSize);
  const Hv = Float64Array.from(flat, (f) => placed[f.pi][f.k].alongSize);
  const dd = Float64Array.from(flat, (f) => (20 + (f.c.mouse - 20) * CARDS.depthRange) * CARDS.mouseStrength * sc); // the mouse drift's full travel per card
  const adw = flat.map((f) => ambDepthW(f.c.mouse));
  const ambX = new Float64Array(n), ambY = new Float64Array(n);
  flat.forEach((f, i) => { // the ambient drift at its end (sway 0), per card: along toward the next project, a lean across
    const pr = ambParams(ambUnits(f.c, slugSeed(f.c.slug))), av = ambProgress(1e4, pr.tau, pr.delay), al = av * WORK.ambFrame * pr.mul * adw[i] * sc;
    ambY[i] = al; ambX[i] = al * pr.lean;
  });
  const wDen = 20 + 80 * CARDS.depthRange;
  const wd = Float64Array.from(flat, (f) => (20 + (f.c.mouse - 20) * CARDS.depthRange) / wDen);
  return { N, n, flat, pitch, period, sc, M, X0, Y0, Wv, Hv, dd, ambX, ambY, wd };
}

const relIdx = (d, N) => { const h = Math.floor(N / 2); return ((((d + h) % N) + N) % N) - h; };

// the focus push of project q at full progress on ONE card (project pi, size w x h, mouse weight wd) at (x, y) as seen from the view centred on q (y already
// wrapped into that view): exactly steps 1 and 2 of work/focus.js applyFocus (the neighbour shift and the radial push); step 3 (the nudge apart of pairs the
// push brought together) is a separate pass over all pairs and is only part of the full check (scenarios below)
export function focusPos(S, q, pi, w, h, wd, x, y, out) {
  const fs = WORK.focusScale, sc = S.sc, pitch = S.pitch, N = S.N;
  const rel = relIdx(pi - q, N);
  if (rel === 1 || rel === -1) y += rel * WORK.focusNeighbour * pitch; // the neighbours move away as wholes
  const Yq = q * pitch, R = Math.max(WORK.focusPushRadius, 1) * sc;
  const rx = x, ry = y - Yq, r = Math.max(Math.hypot(rx, ry), 0.35 * Math.min(w, h));
  if (pi === q) {
    const g = fs - 1, ps = WORK.focusPush * sc;
    out.x = x + rx * g + (ps * rx) / r; out.y = y + ry * g + (ps * ry) / r;
  } else {
    const gx = Math.max(0, Math.abs(rx) - (w + S.M.crossF * fs) / 2), gy = Math.max(0, Math.abs(ry) - (h + S.M.alongF * fs) / 2), gap = Math.hypot(gx, gy);
    if (gap >= R) { out.x = x; out.y = y; return out; }
    const k = (1 - gap / R) ** 1.5, ps = WORK.focusPush * sc * WORK.focusPushOthers * wd * k;
    out.x = x + (ps * rx) / r; out.y = y + (ps * ry) / r;
  }
  return out;
}

// The full list of scenarios for the generic overlap code (overlap.js): [{ mode, x, y, w, h, state, view }], positions absolute in each view. `real` = use the
// real applyFocus (with its nudge pass) for the focus state, as the page does at full progress; false = the separable push only.
export function workScenarios(S, mode, real = true) {
  const { N, n, flat, pitch, period, X0, Y0, Wv, Hv, dd, ambX, ambY, wd } = S, scen = [];
  const push = (state, view, x, y) => scen.push({ mode, state, view, x, y, w: Wv, h: Hv });
  for (let k = 0; k < N; k++) {
    const wy = (y) => wrapP(y - k * pitch, period) + k * pitch;
    const Yk = Float64Array.from(Y0, wy);
    if (LAYOUT_STATES.rest) push('rest', k, Float64Array.from(X0), Float64Array.from(Yk));
    if (LAYOUT_STATES.drift > 0) for (const [sx, sy] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) push(`drift${sx > 0 ? '+' : '-'}${sy > 0 ? '+' : '-'}`, k, Float64Array.from(X0, (v, i) => v + sx * dd[i] * LAYOUT_STATES.drift), Float64Array.from(Yk, (v, i) => v + sy * dd[i] * LAYOUT_STATES.drift));
    if (LAYOUT_STATES.ambientEnd && WORK.ambFrame > 0) push('ambient', k, Float64Array.from(X0, (v, i) => v + ambX[i]), Float64Array.from(Yk, (v, i) => v + ambY[i]));
    if (LAYOUT_STATES.focus) {
      if (real) {
        const nI = N + n, A = { n: nI, N, kind: new Uint8Array(nI).fill(1), proj: new Int8Array(nI), mouse: new Float64Array(nI), X: new Float64Array(nI), Y: new Float64Array(nI), W: new Float64Array(nI), H: new Float64Array(nI), vertical: true, pitch, scale: S.sc };
        for (let q = 0; q < N; q++) { A.kind[q] = 0; A.proj[q] = q; A.mouse[q] = 60; A.X[q] = 0; A.Y[q] = wy(q * pitch); A.W[q] = S.M.crossF; A.H[q] = S.M.alongF; }
        flat.forEach((f, i) => { A.proj[N + i] = f.pi; A.mouse[N + i] = f.c.mouse; A.X[N + i] = X0[i]; A.Y[N + i] = Yk[i]; A.W[N + i] = Wv[i]; A.H[N + i] = Hv[i]; });
        const fS = new Float64Array(N), fPu = new Float64Array(N); fS[k] = 1; fPu[k] = 1;
        applyFocus(A, fS, WORK, CARDS, new Float64Array(N), fPu, null);
        push('focus', k, A.X.slice(N), A.Y.slice(N));
      } else {
        const o = { x: 0, y: 0 }, xs = new Float64Array(n), ys = new Float64Array(n);
        for (let i = 0; i < n; i++) { focusPos(S, k, flat[i].pi, Wv[i], Hv[i], wd[i], X0[i], Yk[i], o); xs[i] = o.x; ys[i] = o.y; }
        push('focus', k, xs, ys);
      }
    }
  }
  return scen;
}
