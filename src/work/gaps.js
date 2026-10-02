// R23: the cards in the gaps between two main images. Pure layout: no DOM. Coordinates are "strip" coordinates: `along` runs along the
// strip with frame i centred on i * pitch, `cross` across it (0 = the strip's centre line). The cards of gap i come from the two
// neighbouring projects (the whole pool, not only the featured images) and sit in two bands, one hugging each edge of the frames and
// overlapping the frame edge by overlapMin..overlapMax of the card's cross size. Each gap has its own seed (WORK.seed + gap index), so
// the layout is stable. Sizes use the same tiers / fit rules as the homepage cards (CARD_SIZE, cards-gen.js).
import { WORK, CARD_SIZE } from '../timeline.js';
import { rng, mix, fit } from '../data/cards-gen.js';

// m = { scale (px per card px at 1920), alongF, crossF (frame size along / across the strip, px), gap (px between two frames), vertical }
export function layoutGaps(pool, slugs, m) {
  const N = slugs.length;
  const pitch = m.alongF + m.gap;
  const cards = [];
  for (let i = 0; i < N; i++) {
    const left = slugs[i];
    const right = slugs[(i + 1) % N];
    const r = rng(mix(WORK.seed, i * 7919 + 13));
    const n = WORK.cardsMin + Math.floor(r() * (WORK.cardsMax - WORK.cardsMin + 1));
    const nTop = Math.floor(n / 2) + (n % 2 && r() < 0.5 ? 1 : 0);
    const rank = (s) => pool.filter((e) => e.slug === s).sort((a, b) => mix(a.hash, WORK.seed + i) - mix(b.hash, WORK.seed + i));
    const lists = { [left]: rank(left), [right]: rank(right) };
    const used = { [left]: 0, [right]: 0 };
    const gapMid = i * pitch + pitch / 2;
    for (const band of [-1, 1]) {
      const cnt = band < 0 ? nTop : n - nTop;
      const slot = m.gap / Math.max(1, cnt);
      for (let k = 0; k < cnt; k++) {
        // the draws are always taken in the same order (tier, overlap, jitter), whatever the mode
        const f = (k + 0.5) / cnt; // 0..1 across the gap
        const slug = f < 0.5 ? left : right;
        const list = lists[slug].length ? lists[slug] : lists[slug === left ? right : left];
        const e = list[used[slug]++ % list.length];
        const t = r();
        let tier = t < CARD_SIZE.weights[0] ? 0 : t < CARD_SIZE.weights[0] + CARD_SIZE.weights[1] ? 1 : 2;
        const ov = WORK.overlapMin + r() * (WORK.overlapMax - WORK.overlapMin);
        const jit = (r() - 0.5) * 0.3;
        if (!e) continue;
        let size;
        for (;;) { // a card must not be much longer along the strip than its slot
          const s = fit(e.w, e.h, CARD_SIZE.tiers[tier]);
          size = { w: s.w * m.scale, h: s.h * m.scale };
          if ((m.vertical ? size.h : size.w) <= slot * 1.5 || tier === 0) break;
          tier--;
        }
        const crossSize = m.vertical ? size.w : size.h;
        cards.push({
          gap: i, slug: e.slug, key: e.key, src: `/media/${e.key}.webp`, w: size.w, h: size.h, tier, band,
          along: gapMid - m.gap / 2 + (k + 0.5 + jit) * slot,
          cross: band * (m.crossF / 2 - ov * crossSize + crossSize / 2), // the inside edge of the card overlaps the frame by ov * crossSize
          alongSize: m.vertical ? size.h : size.w, crossSize,
        });
      }
    }
  }
  return { cards, pitch, period: N * pitch };
}
