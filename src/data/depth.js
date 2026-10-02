// R23d: ONE depth rule for the Selected Work cards (homepage, cards-gen.js) and the Work page cards (work/cards.js). A card's depth is
// seeded from its own hash and does NOT depend on its size tier: depth 0 = far back, 1 = nearest. The main image (the homepage centre
// frame, the Work page strip) sits in a fixed slot, DEPTH.slot, in the middle of the range; DEPTH.frontShare of the cards are drawn in
// front of it (depth between the slot and 1), the rest behind it (between 0 and the slot). The mouse value is the old drift scale
// (20 far .. 100 near) so every existing use (drift, push weight, lag, aura weight) follows the depth; z is the integer paint order
// (1 .. 21) and the frame's own z is frameZ(). Same hash + seed = same depth, and a new image changes nobody else's.
import { DEPTH } from '../timeline.js';

const mixBits = (h, seed) => {
  let t = (Math.imul(h ^ Math.imul(seed | 0, 0x9e3779b1), 0x85ebca6b) ^ (h >>> 13)) >>> 0;
  t = Math.imul(t ^ (t >>> 15), 0x2c1b3c6d) >>> 0;
  t = Math.imul(t ^ (t >>> 12), 0x297a2d39) >>> 0;
  return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
};

export const zOf = (depth) => 1 + Math.round(depth * 20);
export const frameZ = () => zOf(DEPTH.slot);

// hash: the image's own hash, seed: the card seed (+ a salt for a duplicate)
export function cardDepth(hash, seed) {
  const front = mixBits(hash, seed + 101) < DEPTH.frontShare;
  const r = mixBits(hash, seed + 202);
  const depth = front ? DEPTH.slot + (1 - DEPTH.slot) * r : DEPTH.slot * r;
  return { depth, mouse: 20 + 80 * depth, z: zOf(depth), front };
}
