import { WORK_UI } from './desktop.js';
// Smooth scroll (Lenis). Framer's "Intensity 30" = duration 3 with Lenis' default easing. Lower duration = snappier
// (try 2.5). `easing` is t (0..1) -> progress (0..1).
// R23d: gainCap / gainFrom / gainTo / gainDecay = the wheel acceleration (src/util/scroll-gain.js): the distance per wheel tick is multiplied
// by 1 (slow notches) rising to gainCap as the wheel speed goes from gainFrom to gainTo (px/s); gainDecay = seconds the speed is held.
export const SCROLL = {
  gainCap: 2.5, gainFrom: 700, gainTo: 3500, gainDecay: 0.74, gainMinDelta: 50,
  duration: 3,
  easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
};

// R37f / R41: the project header rests zoomed in at zEnd (the transition's flight ends on this exact state). Same line as on desktop/next.
export const FLIGHT = { zEnd: 1.10 };

// R24a: the menu's Contact item stays hidden until this is set (a mailto: link); Anh has no address yet.
export const CONTACT = { email: WORK_UI.reachEmail }; // R45: one source, the address on the Work page

// R45: the homepage is the hero only (no About / index / Selected Work / More Projects / footer, no scroll). The sections stay in the code; ?home=full brings the old page back.
export const HOME = { heroOnly: true };

// R46b: the contact card's two throwable cards. Time-based (a fixed 1/240 s physics step), so 60 and 144 Hz look the same. Tunable live with ?tune on a dev server (CONTACT group, a small panel while the card is open).
export const CONTACT_CARD = {
  omega: 9,           // spring speed (rad/s): higher = the cards arrive faster (~0.7 s settle at 9)
  zeta: 0.62,         // position damping: 0.62 = one slight overshoot, no wobble loop; 1 = none
  rotZeta: 0.9,       // rotation damping (high so the spin does not swing back)
  spin: 300,          // degrees of spin the cards start with (random sign)
  throwDist: 1,       // 1 = start just off the screen edge; larger = further away (faster, longer throw)
  rotMax: 6,          // the main card's final tilt, +- degrees
  backRotMax: 10,     // the back card's final tilt, +- degrees
  backOffset: 0.025,  // back card offset as a share of the card width (its edge shows)
  backLead: 0.06,     // seconds the back card is thrown before the main card (it lands earlier)
  outSec: 0.45,       // slide-out time
  outLag: 0.08,       // the back card leaves this many seconds after the main card
  flingSpeed: 1800,   // px/s: a release faster than this closes the card
  dragTilt: 5,        // degrees of tilt per 1000 px/s of horizontal drag speed
  tiltMax: 12,        // tilt cap while dragging, degrees
  friction: 5,        // inertia after a drop: higher = stops sooner (1/s)
  dragStart: 6,       // px of movement before a press becomes a drag
};
