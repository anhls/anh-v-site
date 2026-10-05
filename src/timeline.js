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

// R25: opening a project from a main image / the homepage frame (src/effects/project-transition.js): the picture grows from its place to the
// project page's header (the full screen) along easeInOutCirc; the rest fades to black. sec = the move, fadeSec = how fast the rest goes dark and the
// Work counter / toggle fade, crossFrom / crossTo = the part of the move over which the homepage frame still crossfades into the header image
// (the frame shows its own still, not the header image).
// R28: pushSec = the first part of the move in which the cards and the two neighbours move away from the image (Work page; the same numbers play
// in reverse on the way back), pushScale = how far (1 = the focus push at full progress, 0 = off), pushFar = the far cards' share (focusPushOthers).
export const TRANSITION = { sec: 0.9, fadeSec: 0.5, crossFrom: 0.3, crossTo: 0.85, pushSec: 0.6, pushScale: 1, pushFar: 0.6,
  // R30: the clearing push (Work page): with pushClear 1 every card and the neighbouring images travel straight away from the clicked image until they are
  // fully off screen (+ clearMargin px at 1920) by the end of pushSec, near items first (clearStagger = the share of pushSec the far ones start later), so
  // the black layer is not needed (blackMax = how dark it gets on the Work page path). pushClear 0 + blackMax 1 = the R28 transition.
  pushClear: 1, clearMargin: 40, clearStagger: 0.25, blackMax: 0 };

// Smooth scroll (Lenis). Framer's "Intensity 30" = duration 3 with Lenis' default easing. Lower duration = snappier
// (try 2.5). `easing` is t (0..1) -> progress (0..1).
// R23d: gainCap / gainFrom / gainTo / gainDecay = the wheel acceleration (src/util/scroll-gain.js): the distance per wheel tick is multiplied
// by 1 (slow notches) rising to gainCap as the wheel speed goes from gainFrom to gainTo (px/s); gainDecay = seconds the speed is held.
export const SCROLL = {
  gainCap: 2.5, gainFrom: 700, gainTo: 3500, gainDecay: 0.74, gainMinDelta: 50,
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
  pushRadius: 125,
  pushStrength: 95,
  pushFalloff: 1.9,
  pushStiffness: 50,
  pushDamping: 30,
};
// R13c: the card layout is generated from a seed (src/data/layout.js) out of each card's Framer position. Positions in the
// data are the starting point; same seed + values = same layout every time. scatter: max px a card may move sideways;
// centreShare: share of cards pulled to start near or across the centre line, within centreBand px of it; minGap: px kept
// between cards on neighbouring depths; yJitter: max vh a card may move up or down.
export const LAYOUT = { seed: 92708, scatter: 225, centreShare: 0.3, centreBand: 560, minGap: 81, yJitter: 8 };
// R22: Selected Work cards are generated from the project image pool (src/data/cards-gen.js). POOL.seed picks the images and
// every per-card value (?seed=N in the URL overrides it, for the seed audition); count = cards on the page. CARD_SIZE: three
// size tiers (px at 1920, scaled with scale.js): each card is fitted inside its tier's box keeping the image's ratio (clamped to
// maxRatio, cropped with cover), short side at least minShort. weights = share small / medium / large. Large cards sit in front
// (mouse 100, z 5) and push most, small ones at the back. x range = start distance from the centre line (px), y range = vh from the section top; both are the starting
// point for LAYOUT.
const urlParams = new URLSearchParams(location.search);
const urlSeed = urlParams.get('seed');
export const POOL = { seed: urlSeed !== null && urlSeed !== '' ? Number(urlSeed) : 4, count: 35 };
export const CARD_SIZE = {
  tiers: [{ w: 200, h: 170 }, { w: 290, h: 250 }, { w: 384, h: 324 }],
  weights: [0.5, 0.35, 0.15], maxRatio: 2.2, minShort: 120,
  xMin: 330, xMax: 1070, yTop: 78, yBottom: 363, bandSlack: 6,
};
// R23d depth of the Selected Work cards, homepage and Work page (src/data/depth.js): seeded per card, not tied to the size. `slot` = where the
// main image (homepage centre frame, Work page image) sits in the depth range 0 (far) .. 1 (near); `frontShare` = the share of the cards in
// front of it (?front=0.5 in the URL overrides, for the tune panels). Drift follows the depth: far cards 20 px, near cards 100 px (CARDS).
const urlFront = parseFloat(urlParams.get('front'));
export const DEPTH = { slot: 0.5, frontShare: Number.isFinite(urlFront) ? urlFront : 0.5 };
// R23 / R23b Work page (/work/). Sizes: frame w / h in vw / vh of the window (the same frame in both modes: along the strip it is w
// for the side scroll and h for the vertical one); gapSide (vw) / gapVert (vh) = the thin space between two frames (about 1-2 card
// widths / heights; a card of a neighbour may overlap into it). Every project's frame owns its cards (R23c): they scatter around it like
// the homepage cards (layout.js, LAYOUT values; the centre stays clear), left and right of the column in the vertical mode, above and
// below the strip in the side mode; a card may overlap the image edge by up to overlapMax of its size across the strip, never has to.
// minGap = the least space kept between neighbouring-depth cards (the homepage uses LAYOUT.minGap 81; the strip has less room across);
// slack = how far past its project's length a card may drift, as a share of one project's pitch. seed = layout (with LAYOUT.seed).
// wheel = strip px per wheel px. Warp (the homepage cylinder warp, cards-gl.js, driven by the strip's speed): warpStrength (the
// homepage WARP strength is 1.15), warpRiseSec / warpSettleSec = how fast it grows while moving / eases back flat after the wheel stops.
// Toggle morph: morphSec (total), morphStagger (cards start up to this many s after the images), morphEase = ease-in exponent (R23d: slow
// start, speeding up), morphLanding = share of the time for the short soft landing at the end.
// R23e: snapDelay (s of quiet wheel) / snapWindow (share of the pitch) / snapSec (s, easeInOutCirc): the soft snap to the nearest project;
// focusScale (image growth) / focusPush (px at 1920, the cards move out) / focusNeighbour (share of the pitch) / focusRampSec (pop guard).
// dupGap = the least distance (vw in the side mode, vh in the vertical one) between a duplicate and its twin.
export const WORK = {
  seed: 3, frameW: 42, frameH: 46, gapSide: 16, gapVert: 26, overlapMax: 0.2, minGap: 24, slack: 0.3, wheel: 2.5, // (R24j: 0.75 -> 2.5, the ?tune "Wheel speed")
  // R22h: two separate warps, each with its own look and its own timing (all driven by the strip's speed, flat at rest): cardWarp = the cards (the
  // shared cylinder, today's values), frameWarp = the main images (their own shader, src/work/frame-warp-shader.js; starts from FRAME_WARP's strength
  // and is wider and slower than the cards': a gentler curl, a farther camera). strength = size of the warp (1.15 = the homepage cards), curl =
  // angle (radians) the sheet has turned at full strength, camDown / camUp = camera distance in screen heights (smaller = stronger perspective),
  // bowDown / bowUp = a shallow dome, reach = share of the strip's length that bends (1 - reach stays flat in the middle), sym = weight of the
  // leading side, riseSec / settleSec = how fast it grows while the strip moves / eases flat after it stops.
  cardWarp: { strength: 1.15, riseSec: 1.5, settleSec: 1.4, curl: 0.5, camDown: 1.25, camUp: 1.25, bowDown: 0, bowUp: 0.05, reach: 1, sym: 1 },
  frameWarp: { strength: 1.39, riseSec: 2.2, settleSec: 1.9, curl: 0.5, camDown: 1.25, camUp: 1.25, bowDown: 0, bowUp: 0.06, reach: 1, sym: 1, speedRef: 5, speedPow: 1.4, speedKnee: 2, lean: 0.4, leanSign: 1, leanMax: 0.45, leanBuf: 0.3 }, // R24i: lean = how far (screen lengths along the strip, at warp amount 1) the cylinder axis moves toward where the images travel on screen; leanSign -1 flips it; leanMax caps the shift; lean 0 = the centred axis of before
  morphSec: 2, morphStagger: 0.45, morphEase: 3, morphLanding: 0.12, dupGap: 40,
  snapDelay: 1, snapWindow: 0.5, snapSec: 2, focusScale: 1.14, focusPush: 95, focusNeighbour: 0.06, focusRampSec: 1.25, focusPushRadius: 400, focusPushOthers: 0.6,
  // R22e overshoot (src/util/overshoot.js; 0 = the old curve): the end passes the target by this share of the distance / value once, then settles.
  // overshootSettle = the share of a clocked animation (snap, morph, drag release) the settle takes; followerSettleSec = the same in seconds for the
  // focus (its bump plays when a build completes). The R25 transition and the homepage animations do not use it.
  // R22i drag release: the strip keeps its release speed and loses it by friction (speed x exp(-t / dragFriction) s, so a fling carries speed x dragFriction px);
  // dragMaxCoast = most it may coast, in pitches; dragSnapBlend 0 = off, else the soft snap may start once the coast is slower than this (px/s at 1920).
  dragFriction: 0.6, dragMaxCoast: 1.5, dragCoastKnee: 0.6, dragSnapBlend: 0, // (R24j: past the cap the coast keeps growing slowly: cap x (1 + knee x ln(natural / cap)); 0 = the old hard cap)
  // R22f ease curves (src/util/ease.js) shared by the soft snap, the focus build and the toggle morph: easeType 'sine' | 'quad' | 'cubic' | 'circ'
  // (circ = the old snap / focus curve; for the morph, circ keeps the morphEase power curve), easeSoftness 0..1 = blend with a straight line.
  // The project name has no overshoot (it rises along its plain ease).
  easeType: 'sine', easeSoftness: 0.25,
  // R22g: overshoot force = smoothstep of the move's own peak speed (px/s at 1920): none below forceFrom, the full amount from forceTo (0, 0 = always
  // full, the old fixed behaviour).
  // R22h ambient drift (work/ambient.js): once the strip has rested ambDelay s and the focus has built, everything eases a few px toward the NEXT
  // project (a visual offset only; the snap, counter, focus and seam never see it). The main images drift together: at most ambFrame px at 1920,
  // exponential approach with time constant ambTau s. Each card (seeded per card): travel = ambFrame x a multiple drawn from ambCardMulMin..Max x
  // its depth weight, time constant ambTau +- ambTauVar (share), start delay up to ambStagger s, a cross-axis lean up to ambCross of its travel
  // (either sign), and an optional sway of ambSway px (0 = off). Any input returns every offset to 0 over ambReturnSec s.
  ambDelay: 2, ambFrame: 20, ambTau: 15, ambReturnSec: 0.8, ambCardMulMin: 2, ambCardMulMax: 4.5, ambTauVar: 0.3, ambStagger: 1.5, ambCross: 0.25, ambSway: 0,
  // R22i focusAfterMorph: after a toggle the focus effect and the ambient drift stay off: 'input' = until the next input once the morph is over, a number =
  // seconds after the morph ends, 0 = as before (the focus builds right away).
  focusAfterMorph: 'input',
  // R22i speed lead (work/ambient.js): while the strip moves each card runs ahead of it by lead x speed x 0.4 s (lead = leadMin..leadMax, seeded per card,
  // x the depth weight), at most leadMaxPx (px at 1920), and eases back on its own spring (leadStiffness / leadDamping, leadVar = seeded spread of the
  // stiffness) when the strip slows. Driven by wheel / glide / drag / coast only (not the snap, the toggle, the ambient drift or the focus).
  leadMin: 0.1, leadMax: 0.5, leadMaxPx: 160, leadCapPerCard: 1, leadStiffness: 40, leadDamping: 11, leadVar: 0.2,
  forceFrom: 450, forceTo: 1500,
  snapOvershoot: 0.04, focusOvershootScale: 0.025, focusOvershootPush: 0.025, morphOvershoot: 0.05, overshootSettle: 0.4, followerSettleSec: 0.45,
};
// Cards per project (R23b, the same rules as BAND_LIMITS on the homepage): count and total area (px2 at 1920) of the cards along one
// project's edges. Over a max: dropped by the seeded hash; under a min: duplicates of the project's own images.
export const WORK_LIMITS = (() => { try { const u = JSON.parse(urlParams.get('wlimits')); if (u && u.maxN) return u; } catch {} return { minN: 7, maxN: 12, minA: 150000, maxA: 330000 }; })(); // ?wlimits={...} overrides (tune panel)
// R22d: cards per band (px2 at 1920, from the old curated layout: tools/band-limits.mjs, min 75% / max 130% of its count and area).
// Order: Techcombank, swap zone 1, Bitis, swap zone 2, Sulwhasoo (the same five bands as cardBands() in cards-gen.js). Over a max
// (count or area): extra cards are dropped by the seeded hash. Under a min: topped up with duplicates of the band's own featured
// images (placed >= dupMinGapVh from the twin, other side, other tier, always dark). sideSlice = window (cards in y order) in which
// left and right may differ by at most sideSliceMax; per whole band by at most 1. ?limits=[...] in the URL overrides (tune panel).
export const BAND_LIMITS = (() => { try { const u = JSON.parse(urlParams.get('limits')); if (Array.isArray(u)) return u; } catch {} return [
  { minN: 9, maxN: 16, minA: 450000, maxA: 790000 },
  { minN: 4, maxN: 7, minA: 320000, maxA: 560000 },
  { minN: 4, maxN: 7, minA: 150000, maxA: 260000 },
  { minN: 3, maxN: 5, minA: 270000, maxA: 470000 },
  { minN: 7, maxN: 12, minA: 590000, maxA: 1020000 },
]; })();
// R22e / R29: pairOverlapMax = most any two cards may overlap (a share of the smaller card's area; 0 = none). R29 (Anh, 2026-10-06) retired 'no point under 3
// cards' and the dark-on-dark cap: a CLUSTER (cards linked by an overlap of at least clusterLink of the smaller card, in any checked state) holds at most
// maxDarkPerCluster dark-layer cards, and at least minLightShare of the cards of a project (Work, per mode) / the homepage are light (src/data/overlap.js).
const urlPairOv = parseFloat(urlParams.get('pairov')); // ?pairov= (the tune panels' Apply)
export const BAND_RULES = { dupMinGapVh: 40, sideSlice: 6, sideSliceMax: 2, maxDarkRun: 2, pairOverlapMax: Number.isFinite(urlPairOv) ? urlPairOv : 0.3, clusterLink: 0.05, maxDarkPerCluster: 2, minLightShare: 0.6 };
// R29: the states the card rules are checked in (the ones mostly seen). Everything else (the corners of the mouse drift, the aura at full strength, the
// overshoot peaks, the speed lead, the ambient drift on the way, the project transitions, any two of these together) is accepted as a brief overlap.
//   Work page, per mode, in the view centred on every project (so the loop seam is covered): rest; the mouse drift at `drift` of its maximum in the four
//   diagonal directions (typical, not the corners); the focus push at full progress without the overshoot bump; the ambient drift at its END position.
//   Homepage Selected Work: rest; the drift at `drift`; the aura at `aura` of its strength (a card hovered next to the frame), not the maximum.
export const LAYOUT_STATES = { rest: true, drift: 0.5, focus: true, ambientEnd: true, aura: 0.5 };
// R17 card hover, measured on live (1920x1080, frame-by-frame, tools/scratch/r17-live2.mjs): the card under the pointer scales
// 1 -> 1.2 on a critically damped spring (stiffness ~250, damping ~31, no overshoot, ~0.6 s). the "dark bg frame" cards (since R22d: a seeded share, CARD_HOVER.darkShare, of the cards flagged `dark` by cards-gen.js) are covered at rest by an opaque rgb(10,10,10) layer 4 px bigger on every side that fades out (opacity = 1 - progress)
// while it scales 1 -> 1.15 on the same progress. Added here: the hovered card stops (its pointer push fades out, drift drops to
// `drift`) and becomes the source of the push-away for its neighbours (pushStrength px / pushRadius px at 1920, rect to rect, the
// same falloff and depth weight as the pointer push). darkRest scales the dark layer (1 = live, 0 = no dark layers).
// R22d: darkShare = share of the cards that get the dark rest layer (seeded draw per card; ?dark=0.5 in the URL overrides, for the tune panel).
const urlDark = parseFloat(urlParams.get('dark'));
export const CARD_HOVER = {
  darkShare: Number.isFinite(urlDark) ? urlDark : 0.5, scale: 1.2, darkScale: 1.15, darkPad: 4, darkRest: 1, stiffness: 250, damping: 31.6, drift: 0.25, pushStrength: 95, pushRadius: 125,
};
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
// R17: live (measured, tools/scratch/r17-cap4.mjs): the caption TITLE turns orange rgb(240,74,14) at once on hover and fades back
// to its resting colour in ~0.35 s; the image fades in over ~0.2 s with no scale, swaps hard between captions and disappears at once.
// Ours (Anh's brief): the image reveals with opacity + a small scale from the cursor-side corner (revealSec, fromScale), fades out
// (hideSec) and crossfades between captions; textOutSec = the colour fade back. revealSec / hideSec / fromScale / textOutSec on ?tune.
export const CAPTION_HOVER = { w: 427, h: 249, offsetX: 50, spring: [500, 60, 1], revealSec: 0.35, hideSec: 0.25, fromScale: 0.94, textColor: '#f04a0e', textOutSec: 0.38, lineInSec: 0.42, lineOutSec: 0 };
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

// Back to top (R13g). A+ = everything except the big AV wordmark fades to black (one overlay, opacity only), the page jumps to
// the top while hidden, then fades back in around the wordmark. A = the same with the overlay above the wordmark too (weak
// devices). Reduced motion: instant jump with a very short fade. Force a path with ?top=aplus or ?top=a.
//   fadeOut / fadeIn  seconds; settle  ms the page stays covered after the jump (springs and scrubs are snapped, this is a safety margin)
export const BACK_TOP = {
  fadeOut: 0.4, fadeIn: 0.6, settleMs: 140, reducedFade: 0.08, ease: 'power2.inOut',
  // The fallback rule: weak device = 4 cores or fewer, 4 GB or less memory (when the browser says), or Save-Data on.
  weakCores: 4, weakMemoryGb: 4,
};
// More Projects list vs the returning wordmark (R13g): the list keeps `gap` (the larger of gapVh of the window height and
// gapMinPx) above the wordmark's top edge, never goes above safeTopVh, and shrinks to at most minScale when it cannot fit.
export const MORE_PROJECTS_FIT = { gapVh: 5, gapMinPx: 28, safeTopVh: 12, minScale: 0.85 };

// R16: Selected Work WebGL cards. The 35 cards are drawn as textured planes on ONE canvas (src/effects/cards-gl.js); the top and bottom
// edges bow into an arc while the page scrolls. maxArc = deepest bow in px at 1920 (capped at 30% of the card height) at full speed;
// cardBend = share of the per-card bend kept (R16b: 0 = none, the screen-space WARP below does the bending; 1 = the R16 per-card arcs);
// arcShape = 1 round arc like the Codrops reference (keeps curving into the corners), higher = flatter corners;
// speedRef = scroll speed (px/s) that counts as "full speed" at sensitivity 1 (shaped with tanh, so it eases in and saturates);
// returnSpeed = spring speed (rad/s) of the return to flat; overshoot = share of the arc the edge passes beyond flat on the way back
// (one gentle pass, 0.12 = 12%); depthExtreme = bend strength of the front and back cards as a share of the middle ones, depthBand =
// width of the strong middle band (0..1 of the depth range); grain = film grain amplitude (0 = off), grainSpeed = how much scroll
// speed adds to it; grainRate = grain frames per second. dprCap = canvas pixel ratio cap, dprCapLarge above 2560 px wide.
export const BEND = {
  arcShape: 1, cardBend: 0, maxArc: 14, speedRef: 1750, sensitivity: 2.15, returnSpeed: 10, overshoot: 0.13,
  depthExtreme: 0.19, depthBand: 0.6,
  grain: 0.044, grainSpeed: 0.6, grainRate: 12,
  dprCap: 2, dprCapLarge: 1.5, weakCores: 4, weakMemoryGb: 4, textureBudgetMb: 256,
};

// R16b / R16e: one screen-wide warp over all the cards (cards-gl.js + warp-shader.js), a real CYLINDER projection (warp-model.js): the card
// field is a sheet that bends around a horizontal axis near the top / bottom edge, AWAY from the viewer when scrolling down (smaller, rows
// compress, sides pinch in) and TOWARD it when scrolling up (bigger, spreads out), seen through a pinhole camera. Driven by the same
// scroll-speed spring as BEND (sensitivity, returnSpeed, overshoot). strengthUp / strengthDown scale the bend (0 = off); reach = share of the
// half height that wraps (0.6 = the outer 60%); sym = weight of the leading edge (0 = only the trailing edge bends); curl = angle in radians
// the sheet has turned after the band at full strength; camDown / camUp = camera distance in screen heights (smaller = stronger perspective);
// bowDown / bowUp = a shallow dome added across the sheet (rows bow with their middle farthest out, sides shrink toward the centre line).
// pinch / pinchDown / arc / persp are the older three-term model, now used only by the FRAME canvas (FRAME_WARP has its own copies).
// R16f: which way the warp turns. The shaders' positive amount is the 'recede' look; WARP_DIR = -1 shows it when scrolling UP and the
// 'bulge toward the viewer' look when scrolling DOWN. The Down / Up settings below always mean the real scroll direction on screen.
export const WARP_DIR = -1;
export const WARP = { strengthUp: 1.15, strengthDown: 1.15, reach: 1, sym: 1, curl: 0.5, camDown: 1.25, camUp: 1.25, bowDown: 0, bowUp: 0.05, pinch: 0.07, pinchDown: 0.2, arc: 0.255, persp: 0.43 };

// R16c: the centre frame (hero mask) warps while the page scrolls, on its own canvas (effects/frame-gl.js). At rest the normal DOM
// frame shows; when the scroll speed passes `threshold` (px/s) the canvas takes over at the same pixels, applies the same kind of warp
// as the cards (scroll down recedes, up inflates; the spring, sensitivity and overshoot come from BEND) and hands back once it has
// sprung flat. on = 0 turns it off; videoMode 0 = show the video's poster while warping (crossfade `fadeSec`), 1 = the frozen current
// frame. The DOM video is paused while the canvas shows the frame and resumes when it hands back.
export const FRAME_WARP = {
  on: 1, strengthUp: 1.39, strengthDown: 1.39, reach: 1, pinch: 0.11, pinchDown: 0.11, arc: 0, persp: 0.18, sym: 1,
  threshold: 400, deadzone: 580, coverZoom: 1, fadeSec: 0.15, videoMode: 1, lodBias: 0, softScaled: 1,
};

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
TALL.frameWarp = { ...WORK.frameWarp, strength: WORK.frameWarp.strength * TALL.warpStrength, riseSec: 0.5, leanBuf: 0.15 }; // (R24i: leanBuf = extra offscreen overscan along the strip for the axis lean, in screen lengths; the lean is capped by what it holds)
// R24e: tablet LANDSCAPE (R24b's test: layout-store.js isTabletAspect): the wide-style strip, no cards (cards: 0), the image `frameH` of the viewport height (width from the desktop ratio, at most 90 % of the width)
export const TABLET = { cards: 0, frameH: 0.62 };
// R24a: the menu's Contact item stays hidden until this is set (a mailto: link); Anh has no address yet.
export const CONTACT = { email: '' };
