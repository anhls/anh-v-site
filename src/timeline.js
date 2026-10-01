// One scroll timeline config. Every scroll-driven range is a page-scroll position in vh
// (1vh = 1% of the viewport height, measured from the top of the page). Tune the site by editing numbers here.
// SCALE (R11b, src/scale.js): above 1920x1080 the live site stops growing in some places. A plain number is uncapped vh
// (scales with the window). Distances (`yvh`, travelVh, liftVh) are vh at the 1080 reference and become fixed px above
// it. Positions written C(c, v) are c capped vh (fixed px above 1080) + v uncapped vh: live's px-based triggers
// (section #3, the project swaps, the float, the About drift) are a mix of the two, fitted at 1080 and 1440.
// Measured on anh-v.com at 1920x1080; see docs/HANDOFF.md "Home page structure (CORRECTED)"
// and docs/framer-extract/motion-spec.md (springs, eases and triggers read from the published Framer code).
//
// LINKED TIMINGS. Ranges that belong together are written as offsets from ONE shared anchor (the constants just
// below), so moving the anchor moves its partners. Everything else is a plain number and moves on its own.
//   MASK_SHRINK   the mask's first shrink starts      -> mask shrink [MASK_SHRINK, +70]
//                                                       About reveal [MASK_SHRINK + 54, +23 long]
//   MASK_RESHAPE  the mask reshapes to 25vw x 40vh    -> that reshape [MASK_RESHAPE, +35]
//   S3_RISE       section #3 rises into the mask      -> that rise [S3_RISE, +28] (its centre S3_MID is the anchor of SWAP_1)
//   SWAP_1        project index swap 1 (Techcombank -> Bitis)  -> that swap [SWAP_1, +34.7]
//                                                       top hero image (gallery2) peel [SWAP_1, +34.7] (same trigger)
//   SWAP_2        project index swap 2 (Bitis -> Sulwhasoo)    -> that swap [SWAP_2, +34.9]
//                                                       2nd hero image (gallery1) peel [SWAP_2, +34.9] (same trigger)
// The mask float (two wrappers) is measured on its own and is NOT linked: outer [128.2, +49.5], inner [189.3, +23.3].
// To retime a pair, change the anchor. To nudge only one partner relative to the other, change its offset.
import { C, plus } from './scale.js';

const MASK_SHRINK = 0;
const MASK_RESHAPE = 150;
// Section #3 rise: centred on a fixed 2268px (210 capped vh), 28vh long. Swap 1 is 108.6vh after that centre
// (uncapped), swap 2 is 84.9vh after swap 1. At 1080 these are the old 196 / 318.6 / 403.5.
const S3_MID = 210;
const S3_RISE = C(S3_MID, -14);
const SWAP_1 = C(S3_MID, 108.6);
const SWAP_2 = plus(SWAP_1, 84.9);
// span(start, length) -> [start, end]. `start` is a number (uncapped vh) or a C(...) position; length is uncapped vh.
const span = (start, length) => (typeof start === 'number' ? [+start.toFixed(2), +(start + length).toFixed(2)] : [start, plus(start, length)]);

export const TOTAL = 730; // page height in vh

// Smooth scroll (Lenis). Framer's "Intensity 30" = duration 3 with Lenis' default easing. Lower duration = snappier
// (try 2.5). `easing` is t (0..1) -> progress (0..1).
export const SCROLL = {
  duration: 3,
  easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
};

// Springs: [stiffness, damping, mass], Framer / motion units. Layers chase their scroll-mapped target through these
// (see src/effects/springs.js). Different springs = different lag = the floaty, weighted feel.
export const SPRING = {
  s3: [891, 90, 0.5],          // section #3 rise and zoom
  peel1: [148, 39, 0.1],       // top hero image peel (a little bounce)
  peel2: [148, 38, 0.1],       // second hero image peel
  overlay: [500, 60, 1],       // black overlay + bottom fade
  floatOuter: [10000, 200, 1], // mask float up: live snaps within ~55ms (critically damped)
  floatInner: [648, 58, 1],    // mask float back down
  indexRow: [500, 60, 1],      // project index row blocks
  nav: [650, 100, 0.7],        // nav + wordmark big/small switch (overdamped, settles in about 1s)
  hoverCursor: [500, 60, 1],   // caption / client hover images that follow the cursor (used by later sections)
  // The nav link hover roll is "duration 0.4s, bounce 0.2"; nav.js converts that with springFromBounce().
  linkRoll: { duration: 0.4, bounce: 0.2 },
};

// Where each part lives on the page [start, end] in vh. Layout only; used for section heights and z-order.
export const SECTIONS = {
  captions: [0, 261],
  about: [0, 190],
  index: [190, 590],
  selectedWork: [211, 461], // was "archive"
  moreProjects: [590, 730], // was "clients"
  footer: [620, 730],
};

// Loader. Seconds unless marked ms. Words start 1.1em (70px at 64px) below their own clipped line and rise, hold, then
// rise out; the black backdrop then collapses upward. Curves are Framer's real ones (overshoot ease), words 0.8s with
// delays 0 / 0.1 / 0.2, backdrop 1s with its leave delayed 0.3s.
export const LOADER = {
  minMs: 1000,      // shortest time the loader stays up, so it does not just flash on a cached load
  videoCapMs: 4000, // stop waiting for the hero video's first frame after this (it keeps streaming)
  maxMs: 5000,      // the loader never stays waiting longer than this, whatever is still loading
  // The loader only waits for what is visible on the first screen: font, wordmark, ticker, video first frame.
  // Hero images #2/#3 (not visible before ~40vh of scroll) start loading right after the loader is ready.
  ease: [0.59, 0.25, 0.12, 1.17],
  arrive: { rise: 1.1, duration: 0.8, stagger: 0.1 },
  leave: { duration: 0.8, stagger: 0.1 }, // last word leaves first
  wipe: { delay: 0.3, duration: 1, liftVh: 11.1 }, // delay counted from the start of leave; liftVh is a capped distance
};

// "Click Anywhere" ticker. Live: items are 182 x 9 px (9.479vw x 0.469vw at 1920), moving left at 100px/s = 5.21vw/s.
export const TICKER = { speedVwPerSec: 5.21, itemVw: 182 / 19.2, perHalf: 12 };

// Nav + wordmark switch: fires when the scroll TARGET (px) reaches this and reverses at 0; the big state also returns
// while the footer is in view (the big "^ V" at the bottom is the nav wordmark coming back).
export const NAV = { thresholdPx: 5 };

// Hero mask + strip. The mask timeline is scrubbed over `range`; overlays have their own range (runs past it).
// Entries with `spring` don't move the element directly: a scroll-scrubbed target is chased through that spring.
export const HERO = {
  scrub: 0.25, // decided: the loose scrub (a little lag behind the scroll)
  range: [0, 585],
  overlay: { at: [490, 630], spring: 'overlay' },
  // Mask size. `at` is [start, end] in vh of page scroll. These are Framer's own code numbers (0-70 / 150-185 /
  // 500-585); with scrub 0.25 they reproduce the widths measured on the live site in a real 1920x1080 window (R11).
  mask: [
    { at: span(MASK_SHRINK, 70), from: { width: '100vw', height: '100vh' }, to: { width: '17vw', height: '50vh' }, ease: 'expo.inOut' },
    { at: span(MASK_RESHAPE, 35), to: { width: '25vw', height: '40vh' }, ease: 'expo.out' },
    { at: [500, 585], to: { width: '100vw', height: '100vh' }, ease: 'expo.inOut' },
  ],
  // The mask floats: two wrappers around it move vertically (centre path 50% -> 22% -> 50% of the screen height).
  float: [
    // Targets come straight from the scroll position (no scrub), so only the spring adds lag.
    { el: 'floatOuter', at: span(C(228.2, -100), 49.5), from: { yvh: 0 }, to: { yvh: -27.78 }, spring: 'floatOuter' },
    { el: 'floatInner', at: span(C(210.3, -21), 23.3), from: { yvh: 0 }, to: { yvh: 27.78 }, spring: 'floatInner' },
  ],
  // Strip inside the mask. `yvh` is translateY in vh; other props go straight to GSAP.
  strip: [
    { el: 's1', at: [40, 140], from: { yvh: 0, scale: 1.3 }, to: { yvh: -185.2, scale: 1 } },
    { el: 's2', at: [0, 90], from: { yvh: 55.6, scale: 2 }, to: { yvh: 0, scale: 1 } },
    { el: 's3', at: span(S3_RISE, 28), from: { yvh: 125, scale: 1.2 }, to: { yvh: 0, scale: 1.1 }, spring: 's3' },
    { el: 's3', at: [C(119.4, 180.6), C(260.6, 259.4)], to: { scale: 1.2 }, spring: 's3' }, // fitted to live at 1080 and 1440
    { el: 'gallery2', at: span(SWAP_1, 34.7), from: { yvh: 0 }, to: { yvh: -138.9 }, spring: 'peel1' },
    { el: 'gallery1', at: span(SWAP_2, 34.9), from: { yvh: 0 }, to: { yvh: -138.9 }, spring: 'peel2' },
  ],
  // Details that were missing: the video fades up and the ticker fades out while it rises (no springs).
  details: {
    video: { at: [0, 90], from: { opacity: 0.15 }, to: { opacity: 0.8 } },
    ticker: { at: [0, 90], from: { opacity: 1, yvh: 0 }, to: { opacity: 0, yvh: -46.3 } }, // -500px at 1080
  },
};

// About. reveal: words light up between these page-scroll positions (fitted to the live letter shares, R7 and R11b). drift: from `from` vh of page scroll the text block moves at `speed` x
// scroll speed (0.7 = slower than the page; the Framer parallax layers multiply to 0.7125); that one is a plain number.
// wordFade: each word eases its opacity over this long. arrow: the ABOUT arrow nudges right and back, forever.
export const ABOUT = {
  // Fitted to live at 1080 and 1440 (the reveal start/end move faster than the window height); at 1080 this is [54, 77].
  reveal: [C(-16, 70), C(-62.7, 139.7)],
  // from: where the slow drift starts (a fixed 648px). lift: before and around it live also nudges the block down and
  // back: [scroll vh, extra y vh], both uncapped, linear between keys and 0 outside them (measured at 1080 and 1440).
  drift: { from: C(60), speed: 0.7, lift: [[0, 0], [26, 8], [52, 0]] },
  wordFade: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  arrow: { xVw: 30 / 19.2, duration: 1, pause: 0.5, ease: [0.44, 0, 0.56, 1] }, // 30px, mirrored, 0.5s pause between legs
};

// Project index (190-590vh). Three rows in the same place; a swap slides one row up and out and the next up from below,
// linear with scroll and chased through a spring. Each swap is linked to a hero image peel
// (top image = Techcombank, then Bitis, then Sulwhasoo).
export const INDEX = {
  swap: [span(SWAP_1, 34.7), span(SWAP_2, 34.9)], // [row1 -> row2, row2 -> row3]; the hero image peels use the same ranges
  travelVh: 18.52, // how far a row moves (200px at 1080); characters rise from the same distance
  // Per-character appear effects. They play ONCE per page load, in time (not scrubbed), when a row arrives:
  // row 1 when it is 50% in view, row 2 at the start of swap 1, row 3 at the start of swap 2.
  text: {
    side: { stagger: 0.02, duration: 0.3, ease: [0.44, 0, 0.56, 1] },             // labels and years
    titleFirst: { stagger: 0.05, duration: 1, ease: [0.87, 0.01, 0.13, 1.01] },   // row 1 title
    titleNext: { stagger: 0.05, duration: 0.2, ease: [0.87, 0.01, 0.13, 1.01] },  // row 2 and 3 titles
  },
};

// Selected Work cards (R13). Measured on live (1920 and 2560) and read from its published code; see docs/status.md.
// These are the DEFAULTS; the dev tuning panel (?tune) edits this object live and "copy values" prints it as JSON.
//   aura*            (R13e/f) the repulsion aura around the frame (the masked image in the middle). Distances in px at 1920, rect to rect.
//                    auraMargin = how far out it reaches (and how early cards start to part); auraStrength = sideways push at the frame
//                    edge, eased in with a smoothstep ^ auraFalloff; auraVertical = gentle up/down push away from the frame;
//                    auraClearance 0..1 and auraMinGap = once settled a card keeps at least this gap from the frame (1 = always);
//                    auraWeight = overall heaviness of the motion (multiplies the settle time). Replaces live's parting.
//   mouseSmoothing   spring stiffness for the mouse offset (live fitted: 650, damping 100).
//   depthRange       (depth spread) 1 = live layer distances (20/25/50/75/100). 0 = every card moves like the back layer; 2 = twice the spread.
//                    R13c: the same weighting also scales parting and push (front card 1, back card 20 / (20 + 80 * depthRange)). Also the lag.
//   lagStrength      NEW (not on live). 0 = off. Multiplies the lag time constants below.
//   lagFrontSec / lagBackSec  time constant (seconds) for the front-most / deepest card: the card's scroll position chases the real one with this delay.
//   partingSoftness / partingBounce  (R13b, NOT live) the parting offset follows live's targets through a spring instead of
//                    live's 0.2-per-frame ease. Softness = the spring's duration in seconds (higher = slower, floatier);
//                    bounce 0 = no overshoot, 0.3 = drifts about 5% past and settles back.
// Anh's tuned values (R13b): mouse 1.3, depth range 0.85, lag 0.9 / 0.03 s / 0.25 s.
export const CARDS = {
  // R13e: the aura around the frame replaces live's parting (partingSoftness / partingBounce still shape the settle).
  auraMargin: 580,
  auraStrength: 175,
  auraVertical: 120,
  auraFalloff: 1,
  auraClearance: 1,
  auraMinGap: 50,
  auraWeight: 1,
  // R13g: card-to-card separation on the targets. sepMaxCover = share of the SMALLER card that may be hidden by another (0.2 = 20%);
  // sepStrength scales the push-apart (0 = off); sepPasses = relaxation passes per frame.
  sepMaxCover: 0.2,
  sepStrength: 1,
  sepPasses: 3,
  partingSoftness: 0.8,
  partingBounce: 0.1,
  mouseStrength: 0.5,
  mouseStiffness: 1375,
  mouseDamping: 100,
  depthRange: 0.15,
  lagStrength: 0.9,
  lagFrontSec: 0.03,
  lagBackSec: 0.25,
  // R13c: mouse push-away. Cards within pushRadius (px at 1920, measured from the card's edge) of the pointer are pushed away
  // from it, up to pushStrength px at the pointer, fading with (1 - distance / radius) ^ pushFalloff (1 = linear, 2 = softer
  // edge), times the depth weight, on a spring (pushStiffness / pushDamping).
  pushRadius: 245,
  pushStrength: 60,
  pushFalloff: 1.9,
  pushStiffness: 190,
  pushDamping: 30,
};
// R13c: the card layout is generated from a seed (src/data/layout.js) out of each card's Framer position. Positions in the
// data are the starting point; same seed + values = same layout every time. scatter: max px a card may move sideways;
// centreShare: share of cards pulled to start near or across the centre line, within centreBand px of it; minGap: px kept
// between cards on neighbouring depths; yJitter: max vh a card may move up or down.
export const LAYOUT = { seed: 37315, scatter: 225, centreShare: 0.3, centreBand: 560, minGap: 81, yJitter: 8 };
// Live's constants, fixed (not tunable): parting target = t * (0.01W + 0.19W * (1 - f)) * 1.1 sideways and
// t * (0.01H + 0.29H * (1 - f)) * 1.1 down (live eases to them at 0.2 per 60 fps frame; we use the CARDS spring); a card is armed once 10% of it has been visible.
export const PARTING = { xMax: 0.2, xMin: 0.01, yMax: 0.3, yMin: 0.01, z: 1.1, lerp: 0.2, armed: 0.1 };
// Where the cards sit: the section starts 211.11 capped vh down the page (2280px at 1080 and above); card y is vh from there.
export const CARD_LAYOUT = { sectionTopCappedVh: 2280 / 10.8 };

// Hero cursor effects (R15). Specs read from the published Framer code (Clickable_Frame, CursorImageTrail, caption hover).
// Click spawner: a click in the top 100vh spawns an image (height random between minVh and sizeVh of the window), rises
// floatVh over its lifetime and fades once its centre is above the top edge. rot = max random rotation (deg) at the end,
// rotFrom = max random rotation at spawn. All px sizes below are at 1920 and follow the capped scale (src/scale.js).
export const SPAWNER = {
  sizeVh: 60, minVh: 30, lifetime: 8, fadeOut: 1, floatVh: 125,
  rot: [10, 2, 5], rotFrom: [0, 2, 5],
  spawnSec: 0.4, fromOpacity: 0, fromScale: 0.2, origin: 0.7, overlapPct: 8,
  maxImages: 8, perspective: 1200, offsetVw: 3,
};
// Caption hover image: 427x249 right of the cursor (+50 px), bottom edge at the cursor, chasing it on a spring.
export const CAPTION_HOVER = { w: 427, h: 249, offsetX: 50, spring: [500, 60, 1], fadeSec: 0.15 };
// Cursor image trail. Live: a new image whenever the pointer is more than `spacing` px from the last one (frequency 25 ->
// 200 - 24 * 199 / 49 = 102.5 px), each `size` px square, kept `visibleFor` s, then it shrinks away. Springs as live.
// Anh's range (not live's): starts when the hero mask shrink is `startMaskShare` done (width that share of the way from
// full screen to 17vw), runs through About and the project index, and fades out as the Selected Work section comes in:
// the fade begins when that section's top reaches `fadeAtScreen` of the screen height (0 = top, 1 = bottom) and is over
// `fadeLenVh` of scroll later. The intensity (1 -> 0, raised to `fadeCurve`) lowers the spawn rate and the opacity/scale.
export const TRAIL = {
  frequency: 17, visibleFor: 0.4, size: 200,
  spring: [500, 60, 1], from: { opacity: 0, scale: 0.5 }, out: { opacity: 0, scale: 0.2 },
  startMaskShare: 0.6, fadeAtScreen: 0.5, fadeLenVh: 132, fadeCurve: 1.6, minScale: 0.4, copiesPerImage: 2,
};
