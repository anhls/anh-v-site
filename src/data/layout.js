// Selected Work card layout (R13c). Each card keeps its image, depth layer, side (left/right of the centre line) and rough
// vertical order; its position is moved by a seeded random scatter, a share of cards is pulled to start near or across the
// centre line, and a relaxation pass spreads cards on neighbouring depths so they do not pile up. Same seed + params =
// same layout, every time (mulberry32). Cost: 35 cards x 40 passes, a fraction of a millisecond.
// Units as in data.json: x = px from the centre line at 1920 wide, y = vh from the section top, w / h = px at 1920.
const VH = 10.8; // px per vh at the 1080 reference
const X_LIMIT = 1150;
// R23c: a card may carry xLo / xHi (the least / greatest distance of its centre from the centre line) instead of the fixed X_LIMIT: the Work page
// keeps cards outside the strip's image and inside the screen with them. Without them nothing changes.
const clampX = (c, v) => {
  const hi = c.xHi ?? X_LIMIT;
  const r = Math.max(-hi, Math.min(hi, v));
  return c.xLo !== undefined && Math.abs(r) < c.xLo ? (v < 0 ? -c.xLo : c.xLo) : r;
};

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// R22c: a card may carry yMin / yMax (vh): its band plus a little slack, so jitter and relaxation cannot carry it into another project's band
const clampY = (c, v) => Math.max(c.yMin ?? -Infinity, Math.min(c.yMax ?? Infinity, v));

export function generateLayout(cards, P) {
  const rand = rng(Math.round(P.seed));
  const n = cards.length;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const side = new Int8Array(n);
  cards.forEach((c, i) => {
    // five draws per card, always, so changing one parameter does not reshuffle the others
    const r1 = rand(), r2 = rand(), r3 = rand(), r4 = rand(), r5 = rand();
    side[i] = c.x < 0 ? -1 : 1;
    const centre = r3 < P.centreShare && !c.keepSide; // keepSide: a duplicate pair stays on opposite sides of the line
    // pulled cards start between 15% across the line and centreBand out from it
    x[i] = centre ? side[i] * Math.max(r4 * 1.15 * P.centreBand - 0.15 * P.centreBand, 20) : c.x + (r1 * 2 - 1) * P.scatter;
    x[i] = clampX(c, x[i]);
    y[i] = clampY(c, c.pinY ? c.y : c.y + (r2 * 2 - 1) * P.yJitter); // pinY: a duplicate pair keeps its vertical distance
    void r5; // spare draw
  });

  // relaxation: only cards on neighbouring depths (mouse value within 30) keep a gap; different depths may overlap a little
  for (let pass = 0; pass < (P.passes ?? 40); pass++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(cards[i].mouse - cards[j].mouse) > 30) continue;
        const dx = x[j] - x[i];
        const dy = (y[j] - y[i]) * VH;
        const ox = (cards[i].w + cards[j].w) / 2 + P.minGap - Math.abs(dx);
        const oy = (cards[i].h + cards[j].h) / 2 + P.minGap - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        const pi = cards[i].pinY, pj = cards[j].pinY;
        const bias = cards[i].xHi !== undefined ? (P.crossBias ?? 0.5) : 1.6; // R23c: cards with a narrow across-range (the Work page) resolve overlaps along the strip first
        if (ox < oy * bias || (pi && pj)) { // sideways is cheaper, and keeps the vertical order
          const s = dx === 0 ? (side[j] || 1) : Math.sign(dx);
          x[i] -= (s * ox) / 2; x[j] += (s * ox) / 2;
        } else {
          const s = dy === 0 ? 1 : Math.sign(dy);
          if (pi) y[j] += (s * oy) / VH; else if (pj) y[i] -= (s * oy) / VH; else { y[i] -= (s * oy) / 2 / VH; y[j] += (s * oy) / 2 / VH; }
        }
      }
    }
    for (let i = 0; i < n; i++) { x[i] = clampX(cards[i], x[i]); if (Math.sign(x[i]) !== side[i]) x[i] = side[i] * Math.max(40, cards[i].xLo ?? 0); /* R22d: a card keeps its side of the line */ y[i] = clampY(cards[i], y[i]); }
    if (!moved) break;
  }
  return cards.map((_, i) => ({ x: Math.round(x[i] * 10) / 10, y: Math.round(y[i] * 1000) / 1000 }));
}
