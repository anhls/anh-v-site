// R13c / R17 / R22e: the cards' reaction to the pointer, ONE implementation for the homepage Selected Work (sections/selected-work.js) and the
// Work page (work.js). Two sources push a card away (positions are screen px, the card's centre WITHOUT its own push, so the push cannot
// feed back into itself):
//   1. the pointer: distance from the pointer to the card's EDGE (0 inside the card), direction pointer -> card centre, strength
//      CARDS.pushStrength x (1 - r / R)^CARDS.pushFalloff x depth weight, radius CARDS.pushRadius; it gives way (S.pw) while a card is hovered;
//   2. hovered cards (hover progress hp > 0): the hovered card, enlarged by its hover scale, pushes its neighbours (CARD_HOVER.pushStrength /
//      pushRadius, rect to rect, weighted by the source's hover progress and the receiver's depth).
// The direction is divided by max(distance, L), L = 0.35 x the card's short side, so it stays continuous (and fades) when the pointer is on or
// near the card centre: no swinging. The target is then chased by a spring (stepPushSpring: CARDS.pushStiffness / pushDamping).
//
// S = { pointerOn, px, py, pw, R, pushMax, falloff, hsPush, hRad, hoverScale, nSrc, srcs (indices), srcX, srcY (screen centres of the sources),
//       bw, bh (card sizes, indexed like srcs), hp (hover progress) }
export function pushTarget(out, S, self, cxm, cym, bwI, bhI, w, own) {
  out.x = 0;
  out.y = 0;
  const L = 0.35 * Math.min(bwI, bhI);
  if (S.pointerOn && S.pw > 0.001 && own > 0.001) {
    const dxm = cxm - S.px;
    const dym = cym - S.py;
    const exm = Math.max(Math.abs(dxm) - bwI / 2, 0);
    const eym = Math.max(Math.abs(dym) - bhI / 2, 0);
    const r = Math.hypot(exm, eym);
    if (r < S.R) {
      const f = (1 - r / S.R) ** S.falloff;
      const inv = 1 / Math.max(Math.hypot(dxm, dym), L);
      out.x += dxm * inv * S.pushMax * f * w * S.pw * own;
      out.y += dym * inv * S.pushMax * f * w * S.pw * own;
    }
  }
  if (own > 0.001 && S.hsPush > 0) {
    for (let k = 0; k < S.nSrc; k++) {
      const s = S.srcs[k];
      if (s === self) continue;
      const grow = 1 + (S.hoverScale - 1) * S.hp[s];
      const dxm = cxm - S.srcX[s];
      const dym = cym - S.srcY[s];
      const exm = Math.max(Math.abs(dxm) - (S.bw[s] * grow + bwI) / 2, 0);
      const eym = Math.max(Math.abs(dym) - (S.bh[s] * grow + bhI) / 2, 0);
      const r = Math.hypot(exm, eym);
      if (r < S.hRad) {
        const f = (1 - r / S.hRad) ** S.falloff;
        const inv = 1 / Math.max(Math.hypot(dxm, dym), L);
        out.x += dxm * inv * S.hsPush * f * w * S.hp[s] * own;
        out.y += dym * inv * S.hsPush * f * w * S.hp[s] * own;
      }
    }
  }
}

// One card's push spring (position q, velocity v) chasing the target (tx, ty), sub-stepped; returns true while it still moves.
export function stepPushSpring(q, v, i, tx, ty, uk, uc, ph, steps) {
  for (let s = 0; s < steps; s++) {
    v.x[i] += (uk * (tx - q.x[i]) - uc * v.x[i]) * ph;
    v.y[i] += (uk * (ty - q.y[i]) - uc * v.y[i]) * ph;
    q.x[i] += v.x[i] * ph;
    q.y[i] += v.y[i] * ph;
  }
  return Math.abs(v.x[i]) + Math.abs(v.y[i]) > 0.05 || Math.abs(tx - q.x[i]) + Math.abs(ty - q.y[i]) > 0.05;
}
