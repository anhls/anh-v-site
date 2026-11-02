// R23e / R23f: what the focus does to the strip's positions. Pure function on arrays (screen px), so it can be tested without a page.
//   fP[q]   focus progress of project q (0..1, work.js: builds only at rest)
//   Every card of every project is pushed away from a focused image, radially from the image's centre:
//     - the focused project's own cards: the full push (focusPush x scale x f) PLUS the growth of the image (they move out with it);
//     - the other projects' cards: focusPushOthers of that push, fading with the gap between the card and the image (rect to rect, the
//       homepage hover-push model: strength at the image edge, zero at focusPushRadius), times the card's depth weight;
//     - the two neighbouring projects also move away as wholes along the strip (focusNeighbour of a pitch), cards riding along.
//   Afterwards neighbouring-depth cards that the pushes brought closer than half the minimum gap are nudged apart along the cheaper axis
//   (as layout.js does), only pairs where at least one card was moved, so the resting layout is never touched.
// A = { n, N, kind[] (0 frame, 1 card), proj[], mouse[], X[], Y[], W[], H[] (centres and sizes, px; X / Y are edited in place),
//       vertical, pitch, scale } ; P = WORK-like numbers ; D = { depthRange } ; returns the image scale per frame in `fs` (length N).
const sg = (d, r) => Math.max(-1, Math.min(1, d / Math.max(r, 1))); // a direction that flips smoothly when two centres cross
export function applyFocus(A, fP, P, D, fs, fPush = fP, nud = null) {
  // fP drives the image scale and the cards' growth with it; fPush the pushes and the neighbours' move (R22e: each has its own overshoot)
  const { n, N, kind, proj, mouse, X, Y, W, H, vertical, pitch, scale } = A;
  let any = false;
  for (let q = 0; q < N; q++) { fs[q] = 1 + (P.focusScale - 1) * fP[q]; if (fP[q] > 0 || fPush[q] > 0) any = true; }
  if (!any && !(nud && nud.live)) return false;
  const h = Math.floor(N / 2);
  const rel = (d) => ((((d + h) % N) + N) % N) - h;
  // 1. neighbours move away as wholes along the strip
  const shift = new Float64Array(N);
  for (let p = 0; p < N; p++) for (let q = 0; q < N; q++) { if (fPush[q] <= 0) continue; const r = rel(p - q); if (r === 1 || r === -1) shift[p] += r * P.focusNeighbour * pitch * fPush[q]; }
  const bx0 = new Float64Array(n), by0 = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const s = shift[proj[i]];
    if (s) { if (vertical) Y[i] += s; else X[i] += s; }
    bx0[i] = X[i]; by0[i] = Y[i];
  }
  // 2. pushes, from every focused image
  const wDen = 20 + 80 * D.depthRange;
  const R = Math.max(P.focusPushRadius, 1) * scale;
  const moved = new Uint8Array(n);
  for (let i = N; i < n; i++) {
    const w = (20 + (mouse[i] - 20) * D.depthRange) / wDen;
    let dx = 0, dy = 0;
    for (let q = 0; q < N; q++) {
      const f = fP[q], fp = fPush[q];
      if (f <= 0 && fp <= 0) continue;
      const fx = X[q], fy = Y[q]; // the image centre (the frames were shifted in step 1 like their cards)
      // R22g: the push direction is divided by max(distance, L) (L = 0.35 x the card's short side, as in card-push.js): a card sweeping across the image
      // centre during the toggle morph flipped its whole push (up to 2 x focusPush) in one frame; at rest the cards sit far outside L, so nothing changes
      const rx = bx0[i] - fx, ry = by0[i] - fy, r = Math.max(Math.hypot(rx, ry), 0.35 * Math.min(W[i], H[i]));
      if (proj[i] === q) {
        const g = (P.focusScale - 1) * f, ps = P.focusPush * scale * fp;
        dx += rx * g + (ps * rx) / r; dy += ry * g + (ps * ry) / r;
      } else {
        // gap between the card's rectangle and the image's (grown) rectangle
        const gx = Math.max(0, Math.abs(rx) - (W[i] + W[q] * fs[q]) / 2), gy = Math.max(0, Math.abs(ry) - (H[i] + H[q] * fs[q]) / 2);
        const gap = Math.hypot(gx, gy);
        if (gap >= R) continue;
        const k = (1 - gap / R) ** 1.5;
        const ps = P.focusPush * scale * P.focusPushOthers * w * fp * k;
        dx += (ps * rx) / r; dy += (ps * ry) / r;
      }
    }
    if (dx || dy) { X[i] = bx0[i] + dx; Y[i] = by0[i] + dy; moved[i] = 1; } else { X[i] = bx0[i]; Y[i] = by0[i]; }
  }
  // 3. nudge apart what the pushes brought together (beyond half the minimum gap)
  const preX = Float64Array.from(X), preY = Float64Array.from(Y); // after the pushes, before the nudge
  const need = P.minGap * 0.5 * scale;
  for (let pass = 0; pass < 10; pass++) {
    let changed = false;
    for (let i = N; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (!moved[i] && !moved[j]) continue;
        if (Math.abs(mouse[i] - mouse[j]) > 30) continue;
        const ox = (W[i] + W[j]) / 2 - Math.abs(X[j] - X[i]), oy = (H[i] + H[j]) / 2 - Math.abs(Y[j] - Y[i]);
        const gx = ox - need, gy = oy - need; // how far each axis overlaps beyond the allowed
        if (gx <= 0 || gy <= 0) continue;
        // R22g: no hard switches (they popped cards by up to 40 px when the focus unwound under a moving layout): the pair's push-in is ramped over
        // `need` px, and the work is shared between the two axes by a smooth weight (all on x when x overlaps much less, all on y when y does)
        // instead of picking one axis. Only the part of the overlap that the focus ADDED is resolved (an overlap the resting layout already has
        // is left alone), so nothing pops when f > 0. Both cards go half the way (the one that was not pushed gives way too).
        const ox0 = (W[i] + W[j]) / 2 - Math.abs(bx0[j] - bx0[i]), oy0 = (H[i] + H[j]) / 2 - Math.abs(by0[j] - by0[i]);
        const ex = Math.max(0, gx - Math.max(0, ox0 - need)), ey = Math.max(0, gy - Math.max(0, oy0 - need));
        if (ex <= 0 && ey <= 0) continue;
        const ramp = Math.min(1, Math.min(gx, gy) / Math.max(need, 1)), rr = ramp * ramp * (3 - 2 * ramp);
        const t = Math.min(1, Math.max(0, 0.5 + (gy - gx) / (2 * Math.max(need, 1)))), wx = t * t * (3 - 2 * t);
        const dX = (ex / 2) * wx * rr * sg(X[j] - X[i], need), dY = (ey / 2) * (1 - wx) * rr * sg(Y[j] - Y[i], need);
        if (dX === 0 && dY === 0) continue;
        X[i] -= dX; X[j] += dX; Y[i] -= dY; Y[j] += dY;
        moved[i] = moved[j] = 1;
        changed = true;
      }
    }
    if (!changed) break;
  }
  // R22g: the nudge is smoothed in time (per card, time constant nud.tau s): the pass is an iterative solver over many overlapping pairs and its result
  // can still step by 10-20 px from one frame to the next while the layout moves under it (the toggle morph, a fast scroll). The smoothed nudge
  // decays to exactly 0 once the focus is gone (nud.live tells work.js to keep calling until then).
  if (nud) {
    const a = 1 - Math.exp(-nud.dt / Math.max(nud.tau, 1e-3));
    let live = false;
    for (let i = N; i < n; i++) {
      nud.x[i] += (X[i] - preX[i] - nud.x[i]) * a; nud.y[i] += (Y[i] - preY[i] - nud.y[i]) * a;
      if (Math.abs(nud.x[i]) + Math.abs(nud.y[i]) < 0.02 && !moved[i]) { nud.x[i] = 0; nud.y[i] = 0; }
      X[i] = preX[i] + nud.x[i]; Y[i] = preY[i] + nud.y[i];
      if (nud.x[i] !== 0 || nud.y[i] !== 0) live = true;
    }
    nud.live = live;
  }
  return true;
}
