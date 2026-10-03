// R22h part 3: the Work page's ambient drift. While the strip rests (focus built) every item eases, over many seconds, a few px toward the NEXT
// project: a separate visual offset like the mouse drift (the strip position, the snap, the counter, the focus and the seam never see it). The main
// images drift together on ONE smooth curve; each card has its own seeded amount, speed, start delay, cross-axis lean and (optionally) sway, so the
// cards fan out slightly against the steady image. Any input returns every offset to zero (work.js). Pure functions here, shared with the overlap check
// (work/cards.js), so the rules are checked against the same motion that is drawn.
import { WORK, CARDS } from '../timeline.js';
import { rng, mix } from '../data/cards-gen.js';

// the card's own random numbers (0..1): from its own hash + the seed + its project, so the same seed gives the same motion and adding an image
// changes nobody else's (a duplicate of an image gets its own set)
export const ambUnits = (c, pi) => {
  const r = rng(mix(c.hash, WORK.seed + pi * 131 + 301 + (c.dup ? 977 : 0)));
  return { amt: r(), spd: r(), del: r(), cross: r(), per: r(), ph: r() };
};
// the units turned into this frame's numbers (the tunables are read live)
export const ambParams = (u, W = WORK) => ({
  mul: W.ambCardMulMin + u.amt * (W.ambCardMulMax - W.ambCardMulMin), // travel as a multiple of the image's
  tau: Math.max(W.ambTau * (1 + W.ambTauVar * (2 * u.spd - 1)), 0.5), // its own time constant (s)
  delay: W.ambStagger * u.del, // start delay (s)
  lean: W.ambCross * (2 * u.cross - 1), // cross-axis component as a share of its travel, either sign
  period: 40 + 40 * u.per, // sway period (s)
  phase: Math.PI * 2 * u.ph,
});
// depth weight of the travel: the mouse drift's, 0.25 (far) .. 1 (near)
export const ambDepthW = (mouse) => (20 + (mouse - 20) * CARDS.depthRange) / (20 + 80 * CARDS.depthRange);
// progress 0..1 of an exponential approach that starts after `delay`
export const ambProgress = (t, tau, delay) => (t <= delay ? 0 : 1 - Math.exp(-(t - delay) / tau));
// a card's offset at progress av (px; along = toward the next project, cross = across the strip), sway time tSec; `scale` = capped layout scale
export const ambCardOffset = (out, prm, depthW, av, tSec, scale) => {
  const along = av * WORK.ambFrame * prm.mul * depthW * scale;
  out.along = along;
  out.cross = along * prm.lean + (WORK.ambSway > 0 ? WORK.ambSway * scale * av * Math.sin((Math.PI * 2 * tSec) / prm.period + prm.phase) : 0);
};
export const ambImageOffset = (av, scale) => av * WORK.ambFrame * scale;
