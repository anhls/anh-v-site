// R24i: the largest axis lean the image warp can show without the lookup leaving the offscreen buffer (a blank edge) or running past the cylinder's visible limit (a fold).
// A JS twin of the lookup in src/work/frame-warp-shader.js, evaluated at the FAR screen edge only (the edge that ends up farthest from the leaned axis, where the sheet is seen
// most obliquely): the source position q there grows with the lean, so the cap is the biggest lean whose q still lies inside the buffer (along + cross) and whose distance from the axis
// stays inside the curl's range (fh). Cheap (about 20 bisection steps of a 18-step search), run once per frame while the warp is on.
// amt = the clamped signed shader amount, sReq = the wanted shift (signed, screen lengths); shape = { curl, camA, camB, reach, bowA, bowB, sym } with A = the shader's uAmt > 0 slot.
const search = (e, x, aS, away, cam, bow, curl, reach) => { // the source distance q'.y (from the axis) and q.x scale of the far edge at distance e, null when e is beyond the visible range
  const L = reach * 0.5, R = L / (aS * curl), y0 = (1 - reach) * 0.5;
  let lo = 0, hi = Math.min(1.55, (3 * L) / R);
  if (away < 0) hi = Math.min(hi, Math.acos(Math.max(-1, Math.min(1, 1 - (0.8 * cam) / R))));
  const sh = (R * hi) / L, fh = ((y0 + R * Math.sin(hi)) * cam) / (cam + away * R * (1 - Math.cos(hi)) + bow * x * x * sh * sh);
  if (fh <= e) return null;
  for (let i = 0; i < 18; i++) { const m = 0.5 * (lo + hi), sm = (R * m) / L; if (((y0 + R * Math.sin(m)) * cam) / (cam + away * R * (1 - Math.cos(m)) + bow * x * x * sm * sm) < e) lo = m; else hi = m; }
  const th = 0.5 * (lo + hi), sT = (R * th) / L, z = away * R * (1 - Math.cos(th)) + bow * x * x * sT * sT;
  return { y: y0 + R * th, kx: (cam + Math.min(z, 0.4 * cam)) / cam };
};
export function limitLean(amt, sReq, shape, mAlong, mCross) {
  const a = Math.abs(amt);
  if (a < 1e-5 || sReq === 0) return sReq;
  const sgn = sReq > 0 ? 1 : -1, side = -sgn, away = amt > 0 ? 1 : -1; // the far edge is on the side opposite to the shift
  const aS = a * (side > 0 ? (amt > 0 ? 1 : shape.sym) : (amt < 0 ? 1 : shape.sym));
  const cam = amt > 0 ? shape.camA : shape.camB, bow = amt > 0 ? shape.bowA : shape.bowB;
  const ok = (s) => { const r = search(0.5 + s, 0.5, aS, away, cam, bow, shape.curl, shape.reach); return !!r && r.y + s <= 0.5 + mAlong - 0.01 && 0.5 * r.kx <= 0.5 + mCross - 0.005; }; // (x = 0.5: the corner, the widest the sheet is seen)
  const want = Math.abs(sReq);
  if (ok(want)) return sReq;
  let lo = 0, hi = want;
  for (let i = 0; i < 14; i++) { const m = 0.5 * (lo + hi); if (ok(m)) lo = m; else hi = m; }
  return sgn * lo;
}
