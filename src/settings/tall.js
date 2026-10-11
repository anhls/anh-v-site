import { WORK } from './desktop.js';

// R24a: the TALL mode (phones, tablet portrait; src/util/layout-mode.js). Flags and numbers for what tall does differently; desktop never reads them.
// cardsMax: cards per project on the Work page; dprCap: backing-store DPR cap; warp / lead / ambient: the Work strip's warp, speed lead and ambient
// drift (off = lighter, see the status note for their cost); transition: the R25 / R28 / R30 project transitions (false = a plain page load);
// spawnScale: the tap spawner's image size relative to desktop (phone width is small).
export const TALL = {
  cardsMax: 0, cardsMaxTablet: 0, // R24d: cards per project on a phone / on a tablet in portrait (0 = the project images only; Anh may want cards back on tablets later)
  frame: 0.8, // R24e: the project image's WIDTH as a share of the viewport width (phone and tablet portrait, one value); the height follows from the desktop image ratio. The number to try: 0.8-0.9
  dprCap: 2, lead: false, ambient: false, transition: false, spawnScale: 0.5, frameRef: 633,
  // R24d: the image warp (WORK.frameWarp, the R22h main-image warp with its own spring) on the strip, driven by the strip's real speed; flat at rest. Strength x warpStrength for the narrow screen.
  warp: true, warpStrength: 1, // (R24j: strength now scales the SHAPE only, so the phone uses the desktop shape; it was 1.4 to reach the clamp sooner)
  // R24f: the speed that drives the warp is measured against the screen length ALONG the strip (a phone swipe, a tablet swipe and a desktop wheel then give comparable amounts): vn = vel x (warpRefPx / length); out = vRef x (vn x warpGain / vRef) ^ warpPow (a power curve: gentle swipes barely bend, hard flicks clearly do)
  warpRefPx: 1080, warpGain: 0.2, warpPow: 1, warpVRef: 1500,
  warpFall: 1.9, // R24g: the warp's FALL time after the speed drops (s; slower than the rise, so the bend lingers); the rise time is frameWarp.riseSec
  // R24g: real flick inertia on touch (the lite modes; the desktop drag keeps WORK.dragFriction / dragMaxCoast): release speed from the last 100 ms of the finger (no fling if it
  // stopped more than 80 ms before the lift) x flingGain, no coast under flingMin screen lengths / s, friction time dragFriction (s), at most dragMaxCoast pitches; the soft snap
  // takes over when the speed is under snapAfterSpeed screen lengths / s, or snapDelay s after the last movement when there was no coast
  flingGain: 0.9, flingRef: 1.5, flingPow: 1.8, flingMin: 0.3, dragFriction: 0.9, dragMaxCoast: 12, flingKnee: 4, // (R24j: the glide distance follows FLING_PITCHES below, flingKnee = L/s e-fold of the approach to dragMaxCoast past the last knot)
  snapAfterSpeed: 0.06, snapDelay: 0.35, focusDelay: 0.25, // (R24h: Anh's values from a real iPhone; snapAfterSpeed is only the old hand-over, the glide now plans its own landing; focusDelay = s after the glide stopped before the focus builds)
  gapV: WORK.gapVert / WORK.frameH, // R24f: tall = a VERTICAL strip; the gap between images as a share of the image height (the wide vertical gap / frame height)
  // R24d: the frame-time guard: while the strip moves, a median over guardMs or a p95 over guardP95 steps the warp down: (a) the warp buffer x0.75, (b) x0.5, (c) warp off. Never back up in a visit.
  guard: true, guardMs: 20, guardP95: 30, guardFrames: 30,
};
// the tall image warp: the wide image warp with the strength scaled (read live: ?tune)
TALL.frameWarp = { ...WORK.frameWarp, strength: 1.39 * TALL.warpStrength, curl: 0.5, camDown: 1.25, camUp: 1.25, bowDown: 0, bowUp: 0.06, reach: 1, riseSec: 0.5, leanBuf: 0.15, leanSignDown: 1 }; // (R33: the phone / tablet pages keep the lean toward the motion in both directions) // (R24i: leanBuf = extra offscreen overscan along the strip for the axis lean, in screen lengths; the lean is capped by what it holds)
// R24e: tablet LANDSCAPE (R24b's test: layout-store.js isTabletAspect): the wide-style strip, no cards (cards: 0), the image `frameH` of the viewport height (width from the desktop ratio, at most 90 % of the width)
export const TABLET = { cards: 0, frameH: 0.62 };

export const TRANSITION_POLICY = { enabled: false, bulge: false, prepare: 'tap', maxDpr: 2 };
