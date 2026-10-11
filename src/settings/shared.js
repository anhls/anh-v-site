// Smooth scroll (Lenis). Framer's "Intensity 30" = duration 3 with Lenis' default easing. Lower duration = snappier
// (try 2.5). `easing` is t (0..1) -> progress (0..1).
// R23d: gainCap / gainFrom / gainTo / gainDecay = the wheel acceleration (src/util/scroll-gain.js): the distance per wheel tick is multiplied
// by 1 (slow notches) rising to gainCap as the wheel speed goes from gainFrom to gainTo (px/s); gainDecay = seconds the speed is held.
export const SCROLL = {
  gainCap: 2.5, gainFrom: 700, gainTo: 3500, gainDecay: 0.74, gainMinDelta: 50,
  duration: 3,
  easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
};

// R24a: the menu's Contact item stays hidden until this is set (a mailto: link); Anh has no address yet.
export const CONTACT = { email: '' };

export const FLIGHT = { zEnd: 1.10 };
