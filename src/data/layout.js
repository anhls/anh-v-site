// Selected Work card layout (R13c). Each card keeps its image, depth layer, side (left/right of the centre line) and rough
// vertical order; its position is moved by a seeded random scatter, a share of cards is pulled to start near or across the
// centre line, and a relaxation pass spreads cards on neighbouring depths so they do not pile up. Same seed + params =
// same layout, every time (mulberry32). Cost: 35 cards x 40 passes, a fraction of a millisecond.
// Units as in data.json: x = px from the centre line at 1920 wide, y = vh from the section top, w / h = px at 1920.
const VH = 10.8; // px per vh at the 1080 reference
const X_LIMIT = 1150;

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
    const centre = r3 < P.centreShare;
    // pulled cards start between 15% across the line and centreBand out from it
    x[i] = centre ? side[i] * (r4 * 1.15 * P.centreBand - 0.15 * P.centreBand) : c.x + (r1 * 2 - 1) * P.scatter;
    x[i] = Math.max(-X_LIMIT, Math.min(X_LIMIT, x[i]));
    y[i] = c.y + (r2 * 2 - 1) * P.yJitter;
    void r5; // spare draw
  });

  // relaxation: only cards on neighbouring depths (mouse value within 30) keep a gap; different depths may overlap a little
  for (let pass = 0; pass < 40; pass++) {
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
        if (ox < oy * 1.6) { // sideways is cheaper, and keeps the vertical order
          const s = dx === 0 ? (side[j] || 1) : Math.sign(dx);
          x[i] -= (s * ox) / 2; x[j] += (s * ox) / 2;
        } else {
          const s = dy === 0 ? 1 : Math.sign(dy);
          y[i] -= (s * oy) / 2 / VH; y[j] += (s * oy) / 2 / VH;
        }
      }
    }
    for (let i = 0; i < n; i++) x[i] = Math.max(-X_LIMIT, Math.min(X_LIMIT, x[i]));
    if (!moved) break;
  }
  return cards.map((_, i) => ({ x: Math.round(x[i] * 10) / 10, y: Math.round(y[i] * 1000) / 1000 }));
}
