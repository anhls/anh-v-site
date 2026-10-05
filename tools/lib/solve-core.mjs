// R29: the annealing core of tools/layout-solve.mjs. One mode of one window size: all cards of all projects, the states of LAYOUT_STATES (separable form: rest,
// drift at half in 4 directions, ambient end, the focus push of every project), objective = the sum of the pair overlaps beyond pairOverlapMax over every state
// + a small pull toward the starting layout. Deterministic (seeded mulberry32); positions are rounded to 0.01 px at the end.
// S = stateData(); mods = { wrapP, focusPos }; opts = { seed, iters, pairMax, locked (Uint8Array), aLo/aHi (along bounds relative to the project, per card),
// cLo/cHi (|cross| bounds), side (+1 / -1), twin (index of the duplicate partner or -1), lambda, T0, T1 }
export function solveMode(S, mods, opts) {
  const { wrapP, focusPos } = mods;
  const { N, n, flat, pitch, period, Wv, Hv, dd, ambX, ambY, wd } = S;
  const X = Float64Array.from(S.X0), Y = Float64Array.from(S.Y0); // absolute along = project * pitch + along
  const X0 = Float64Array.from(X), Y0 = Float64Array.from(Y);
  const proj = Int32Array.from(flat, (f) => f.pi);
  const drift = opts.drift ?? 0.5, driftOn = drift > 0, ambOn = !!opts.ambient, focusOn = opts.focus !== false;
  const states = [{ kind: 'rest' }];
  if (driftOn) for (const [sx, sy] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) states.push({ kind: 'drift', sx, sy });
  if (ambOn) states.push({ kind: 'amb' });
  if (focusOn) for (let k = 0; k < N; k++) states.push({ kind: 'focus', k });
  const NS = states.length;
  const PX = new Float64Array(NS * n), PY = new Float64Array(NS * n);
  const tmp = { x: 0, y: 0 };
  const setCard = (i) => {
    for (let s = 0; s < NS; s++) {
      const st = states[s]; let x = X[i], y = Y[i];
      if (st.kind === 'drift') { x += st.sx * dd[i] * drift; y += st.sy * dd[i] * drift; }
      else if (st.kind === 'amb') { x += ambX[i]; y += ambY[i]; }
      else if (st.kind === 'focus') { const yk = wrapP(y - st.k * pitch, period) + st.k * pitch; focusPos(S, st.k, proj[i], Wv[i], Hv[i], wd[i], x, yk, tmp); x = tmp.x; y = tmp.y; }
      PX[s * n + i] = x; PY[s * n + i] = y;
    }
  };
  for (let i = 0; i < n; i++) setCard(i);
  const pm = opts.pairMax, EPS = 1e-6;
  const pairE = (i, j) => { // the sum over the states of the overlap beyond pm for the pair
    let e = 0;
    const wi = Wv[i], hi = Hv[i], wj = Wv[j], hj = Hv[j], sw = (wi + wj) / 2, sh = (hi + hj) / 2, amin = Math.min(wi * hi, wj * hj);
    for (let s = 0; s < NS; s++) {
      const dx = Math.abs(PX[s * n + i] - PX[s * n + j]); if (dx >= sw) continue;
      let dy = PY[s * n + i] - PY[s * n + j]; if (states[s].kind !== 'focus') dy = wrapP(dy, period); dy = Math.abs(dy); if (dy >= sh) continue;
      const f = ((sw - dx) * (sh - dy)) / amin; if (f > pm + EPS) e += f - pm;
    }
    return e;
  };
  const cardE = (i) => { let e = 0; for (let j = 0; j < n; j++) if (j !== i) e += pairE(i, j); return e; };
  const groupE = (g) => { // g = [i] or [i, j] (a duplicate pair): pairs with the rest + the pair itself once
    let e = 0; for (const i of g) for (let j = 0; j < n; j++) if (!g.includes(j)) e += pairE(i, j);
    if (g.length === 2) e += pairE(g[0], g[1]);
    return e;
  };
  const reg = (g) => { let r = 0; for (const i of g) r += Math.abs(X[i] - X0[i]) + Math.abs(Y[i] - Y0[i]); return r / S.sc; };
  // random
  let a = opts.seed >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(rnd(), 1e-12))) * Math.cos(2 * Math.PI * rnd());
  const free = []; for (let i = 0; i < n; i++) if (!opts.locked[i]) free.push(i);
  const groupOf = (i) => (opts.twin[i] >= 0 && !opts.locked[opts.twin[i]] ? [Math.min(i, opts.twin[i]), Math.max(i, opts.twin[i])] : [i]);
  const total = () => { let e = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) e += pairE(i, j); return e; };
  let viol = [], E = total(), iters = opts.iters, T0 = opts.T0 ?? 0.25, T1 = opts.T1 ?? 0.0015, lam = opts.lambda ?? 0.0004, best = E, bestX = Float64Array.from(X), bestY = Float64Array.from(Y);
  const refresh = () => { viol = free.filter((i) => cardE(i) > 0); };
  refresh();
  for (let it = 0; it < iters && free.length; it++) {
    if (it % 400 === 0) refresh();
    const T = T0 * (T1 / T0) ** (it / iters), sig = Math.max(2 * S.sc, 70 * S.sc * Math.sqrt(T / T0));
    if (E <= 0 && it > iters * 0.6) T0; // (once clean, the low-temperature tail only pulls cards back toward their start)
    const i = viol.length && rnd() < 0.8 ? viol[Math.floor(rnd() * viol.length)] : free[Math.floor(rnd() * free.length)];
    const g = groupOf(i);
    const oldX = g.map((q) => X[q]), oldY = g.map((q) => Y[q]);
    const before = groupE(g), rBefore = reg(g);
    const da = gauss() * sig, dc = rnd() < 0.5 ? gauss() * sig : 0, along = rnd() < 0.75;
    // move: along the strip (a duplicate pair translates together), or across (each card on its own)
    if (along) { for (const q of g) { const base = proj[q] * pitch; Y[q] = base + Math.max(opts.aLo[q], Math.min(opts.aHi[q], Y[q] - base + da)); } }
    if (!along || dc) { const d2 = along ? dc : gauss() * sig; for (const q of g) { const m = Math.max(opts.cLo[q], Math.min(opts.cHi[q], Math.abs(X[q]) + d2 * opts.side[q])); X[q] = opts.side[q] * m; } }
    for (const q of g) setCard(q);
    const after = groupE(g), rAfter = reg(g), dE = after - before + lam * (rAfter - rBefore);
    if (dE <= 0 || rnd() < Math.exp(-dE / T)) { E += after - before; } else { g.forEach((q, k) => { X[q] = oldX[k]; Y[q] = oldY[k]; setCard(q); }); }
    if (E < best - 1e-12 || (E <= 1e-12 && best <= 1e-12 && false)) { best = E; bestX.set(X); bestY.set(Y); }
  }
  // the best configuration seen (the lowest overlap; the tail with zero overlap keeps the last one, closest to the start)
  if (E > best + 1e-12) { X.set(bestX); Y.set(bestY); for (let i = 0; i < n; i++) setCard(i); E = total(); }
  for (let i = 0; i < n; i++) { X[i] = Math.round(X[i] * 100) / 100; Y[i] = Math.round(Y[i] * 100) / 100; }
  return { X, Y, energy: E, free: free.length };
}

// R29: the same annealing for a flat list of cards with fixed state offsets (the homepage: rest, drift at half, aura at half; no loop). opts = { seed, iters, pairMax,
// X0, Y0 (px), W, H, offs: [{ dx: Float64Array, dy: Float64Array }], yLo, yHi (px, absolute), xLo, xHi (|x| bounds), side, twin, locked, lambda, T0, T1, scale }
export function solveOffsets(opts) {
  const n = opts.X0.length, NS = opts.offs.length;
  const X = Float64Array.from(opts.X0), Y = Float64Array.from(opts.Y0), X0 = Float64Array.from(X), Y0 = Float64Array.from(Y);
  const { W, H, offs, pairMax: pm } = opts, EPS = 1e-6;
  const pairE = (i, j) => {
    let e = 0; const sw = (W[i] + W[j]) / 2, sh = (H[i] + H[j]) / 2, amin = Math.min(W[i] * H[i], W[j] * H[j]);
    for (let s = 0; s < NS; s++) {
      const o = offs[s], dx = Math.abs(X[i] + o.dx[i] - X[j] - o.dx[j]); if (dx >= sw) continue;
      const dy = Math.abs(Y[i] + o.dy[i] - Y[j] - o.dy[j]); if (dy >= sh) continue;
      const f = ((sw - dx) * (sh - dy)) / amin; if (f > pm + EPS) e += f - pm;
      if ((opts.dup?.[i] || opts.dup?.[j]) && f >= opts.link && !(opts.dup[i] && opts.dup[j] && opts.twin[i] === j)) e += opts.dupLinkW * (f - opts.link + 0.02); // a forced-dark duplicate in a cluster costs: clusters hold at most maxDarkPerCluster dark cards and duplicates cannot be undarked
    }
    return e;
  };
  const groupE = (g) => { let e = 0; for (const i of g) for (let j = 0; j < n; j++) if (!g.includes(j)) e += pairE(i, j); if (g.length === 2) e += pairE(g[0], g[1]); return e; };
  const cardE = (i) => { let e = 0; for (let j = 0; j < n; j++) if (j !== i) e += pairE(i, j); return e; };
  const reg = (g) => { let r = 0; for (const i of g) r += Math.abs(X[i] - X0[i]) + Math.abs(Y[i] - Y0[i]); return r; };
  let a = opts.seed >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(rnd(), 1e-12))) * Math.cos(2 * Math.PI * rnd());
  const free = []; for (let i = 0; i < n; i++) if (!opts.locked[i]) free.push(i);
  const groupOf = (i) => (opts.twin[i] >= 0 && !opts.locked[opts.twin[i]] ? [Math.min(i, opts.twin[i]), Math.max(i, opts.twin[i])] : [i]);
  const total = () => { let e = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) e += pairE(i, j); return e; };
  let E = total(), best = E, bestX = Float64Array.from(X), bestY = Float64Array.from(Y), viol = [];
  const iters = opts.iters, T0 = opts.T0 ?? 0.25, T1 = opts.T1 ?? 0.0015, lam = opts.lambda ?? 0.0004, sc = opts.scale ?? 1;
  const refresh = () => { viol = free.filter((i) => cardE(i) > 0); };
  refresh();
  for (let it = 0; it < iters && free.length; it++) {
    if (it % 400 === 0) refresh();
    const T = T0 * (T1 / T0) ** (it / iters), sig = Math.max(2 * sc, 70 * sc * Math.sqrt(T / T0));
    const i = viol.length && rnd() < 0.8 ? viol[Math.floor(rnd() * viol.length)] : free[Math.floor(rnd() * free.length)];
    const g = groupOf(i), oX = g.map((q) => X[q]), oY = g.map((q) => Y[q]);
    const before = groupE(g), rb = reg(g);
    if (rnd() < 0.7) { const d = gauss() * sig; for (const q of g) Y[q] = Math.max(opts.yLo[q], Math.min(opts.yHi[q], Y[q] + d)); }
    else { const d = gauss() * sig; for (const q of g) { const m = Math.max(opts.xLo[q], Math.min(opts.xHi[q], Math.abs(X[q]) + d * opts.side[q])); X[q] = opts.side[q] * m; } }
    const after = groupE(g), dE = after - before + lam * (reg(g) - rb) / sc;
    if (dE <= 0 || rnd() < Math.exp(-dE / T)) E += after - before; else g.forEach((q, k) => { X[q] = oX[k]; Y[q] = oY[k]; });
    if (E < best - 1e-12) { best = E; bestX.set(X); bestY.set(Y); }
  }
  if (E > best + 1e-12) { X.set(bestX); Y.set(bestY); E = total(); }
  for (let i = 0; i < n; i++) { X[i] = Math.round(X[i] * 100) / 100; Y[i] = Math.round(Y[i] * 100) / 100; }
  return { X, Y, energy: E };
}
