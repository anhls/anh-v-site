import { imgAttrs, videoInfo } from '../util/media.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CARDS, LAYOUT, CARD_HOVER, POOL } from '../timeline.js';
import { frameState } from './hero.js';
import { generateLayout } from '../data/layout.js';
import { springFromBounce } from '../effects/springs.js';
import { registerPointer, pointerEnabled } from '../effects/pointer.js';
import { capW } from '../scale.js';
import { createCardsGL } from '../effects/cards-gl.js';

// Selected Work (was "archive"): 35 image cards scattered over a 250vh section, one element per card (CLAUDE.md rules 3 + 4).
// Everything below was measured on anh-v.com and read from its published code (see docs/status.md, R13), then summed into
// ONE transform per card per frame on the shared gsap ticker:
//   1. Aura (R13e, replaces live's screen-position parting): cards are pushed away from the frame (the masked image in the
//      middle), measured rect to rect from the hero's own state (frameState). A continuous field (R13f): sideways push on the
//      card's own side, eased in, guaranteed minimum gap once settled, plus a gentle vertical push. Scaled by depth.
//   2. Mouse (live): Framer "Parallax Floating". offset = -(mouse - screen centre) / (half the screen) * distance, x and y,
//      on a spring. distance = the card's layer value (20..100 px). There is no radius. Only card 11 ignores the mouse.
//      R13b: live's targets are kept, but the offset follows them through a spring (CARDS.partingSoftness / partingBounce)
//      instead of live's 0.2-per-frame ease, so cards drift a little past and settle back.
//   2b. Push (NEW, R13c): cards near the pointer are pushed away from it (distance measured from the card's edge), fading to 0 at
//      CARDS.pushRadius, scaled by depth, on a spring. The mouse drift above is now the gentle background layer (mouseStrength).
//   3. Lag (NEW, not on live): each card's scroll position chases the real one with a delay that grows with depth.
// Positions are read once (load and resize); the loop only does arithmetic and writes transforms. The loop runs only while
// the cards can be on screen and until everything has settled. Touch devices and prefers-reduced-motion: no mouse and no lag (parting stays).
export function buildSelectedWork(root, cards) {
  const section = root.querySelector('.selected-work');
  if (!section || !cards?.length) return;

  // R13c: positions come from the seeded generator (src/data/layout.js), starting from the positions cards-gen.js gives each card (R22).
  const layoutParams = () => ({ ...LAYOUT, seed: LAYOUT.seed + POOL.seed });
  let pos = generateLayout(cards, layoutParams());
  section.innerHTML = cards
    .map((c, i) => {
      const style = `--x:${pos[i].x};--y:${pos[i].y};--w:${c.w};--h:${c.h};z-index:${c.z}`;
      const vid = videoInfo(c.src);
      // R17: the dark layer of the "dark bg frame" cards (DOM fallback only; the WebGL path draws it itself), right after its card
      const dark = pointerEnabled && c.dark ? `<div class="sw__dark" aria-hidden="true" style="${style}"></div>` : '';
      // Animated cards: muted looping video (WebM with alpha first, MP4 as fallback), played only while near the screen.
      if (vid) return `<video class="sw__card" muted loop playsinline preload="none" poster="${vid.poster}" draggable="false" style="${style}">${vid.webm ? `<source src="${vid.webm}" type="video/webm">` : ''}<source src="${vid.mp4}" type="video/mp4"></video>${dark}`;
      return `<img class="sw__card" ${imgAttrs(c.src, `${(c.w / 19.2).toFixed(1)}vw`)} alt="" loading="lazy" decoding="async" draggable="false" style="${style}">${dark}`;
    })
    .join('');
  const els = [...section.querySelectorAll('.sw__card')];
  const darkEls = els.map((el) => (el.nextElementSibling?.classList.contains('sw__dark') ? el.nextElementSibling : null));
  const vids = els.filter((el) => el.tagName === 'VIDEO');
  if (vids.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((list) => list.forEach((e) => { if (e.isIntersecting) e.target.play().catch(() => {}); else e.target.pause(); }), { rootMargin: '25% 0px' });
    vids.forEach((v) => io.observe(v));
  }

  const n = cards.length;
  const bx = new Float64Array(n); // base centre x (px from the left of the window)
  const by = new Float64Array(n); // base centre y (px from the top of the page)
  const bh = new Float64Array(n); // card height (px)
  const bw = new Float64Array(n); // card width (px)
  const qx = new Float64Array(n); // push offset (spring position), velocity, target
  const qy = new Float64Array(n);
  const vqx = new Float64Array(n);
  const vqy = new Float64Array(n);
  const tqx = new Float64Array(n);
  const tqy = new Float64Array(n);
  const px = new Float64Array(n); // aura offset (spring position)
  const py = new Float64Array(n);
  const vpx = new Float64Array(n); // aura spring velocity
  const vpy = new Float64Array(n);
  const tpx = new Float64Array(n); // aura target (R13e)
  const tpy = new Float64Array(n);
  const sm = new Float64Array(n); // lagged scroll position
  const hp = new Float64Array(n); // R17 hover progress (0..1, critically damped spring) and its velocity
  const hv = new Float64Array(n);
  const fox = new Float64Array(n); // last applied offset (x, y) per card: the hit test and the hover push read these, not the DOM
  const foy = new Float64Array(n);
  const lastS = new Float64Array(n).fill(NaN);
  const lastD = new Float64Array(n).fill(NaN);
  const srcs = new Int32Array(n); // cards whose hover progress is above zero (push sources)
  let hov = -1; // the card under the pointer (topmost), -1 = none
  const lastX = new Float64Array(n).fill(NaN);
  const lastY = new Float64Array(n).fill(NaN);
  let W = innerWidth;
  let H = innerHeight;
  let scale = 1;
  let startScroll = 0;
  let endScroll = 0;

  // Read once on load and on every refresh (resize): base positions, from the same numbers the CSS uses.
  const measure = () => {
    W = innerWidth;
    H = innerHeight;
    scale = capW() / 1920;
    const top = section.getBoundingClientRect().top + window.scrollY;
    let lo = Infinity;
    let hi = -Infinity;
    cards.forEach((c, i) => {
      bx[i] = W / 2 + pos[i].x * scale;
      by[i] = top + (pos[i].y * H) / 100;
      bh[i] = c.h * scale;
      bw[i] = c.w * scale;
      lo = Math.min(lo, by[i] - bh[i] / 2);
      hi = Math.max(hi, by[i] + bh[i] / 2);
    });
    startScroll = lo - H * 1.5; // switch on well before the first card is visible, so everything is already settled when it shows
    endScroll = hi + H * 0.5;
  };
  measure();

  // R16: WebGL cards (bend + grain). null = the DOM cards stay (no WebGL, reduced motion, weak device, ?gl=0, or context lost).
  const gl = createCardsGL({ section, els, cards, bx, by, bw, bh, onLost: () => { section.classList.remove('sw--gl'); gl.destroy(); glOn = false; lastX.fill(NaN); lastY.fill(NaN); if (!ticking) { ticking = true; gsap.ticker.add(tick); } } });
  let glOn = !!gl;
  if (gl) {
    section.classList.add('sw--gl'); gl.resize(W, H); gl.show(false);
    cards.forEach((c, i) => { gl.hd[i] = pointerEnabled && gl.darkCard[i] ? CARD_HOVER.darkRest : 0; });
  }
  darkEls.forEach((d) => { if (d) d.style.opacity = CARD_HOVER.darkRest; });
  let prevSy = window.scrollY;

  const live = pointerEnabled;
  // R22: a click on the hovered card opens its project page (the reveal has already played while the pointer was on it).
  if (live) window.addEventListener('click', () => { if (hov >= 0 && on && cards[hov].slug) window.location.href = `/work/${cards[hov].slug}.html`; });
  let on = false; // the section's range is active (cards can be on screen)
  let ticking = false; // the loop is registered on the ticker
  // Shared mouse spring (every card's spring is the same and linear, so one normalised state serves all of them).
  const mouse = { tx: 0, ty: 0, x: 0, y: 0, vx: 0, vy: 0, px: 0, py: 0, known: false }; // px, py: the raw pointer (for the push)
  const effect = {
    move: (x, y) => {
      mouse.px = x;
      mouse.py = y;
      mouse.known = true;
      mouse.tx = (x - W / 2) / (W / 2);
      mouse.ty = (y - H / 2) / (H / 2);
    },
    leave: () => { mouse.px = -1e5; mouse.py = -1e5; }, // the pointer left the window: nothing is hovered, nothing is pushed
  };

  const aura = { X: 0, Y: 0 };
  const amx = new Float64Array(n); // per-frame drift / lag (kept between the two passes of the loop)
  const amy = new Float64Array(n);
  const alag = new Float64Array(n);
  const ex = new Float64Array(n); // estimated centre (screen px) at the targets, for the card-to-card separation
  const ey = new Float64Array(n);
  const sepOn = new Uint8Array(n);
  const sbw = new Float64Array(n); // card size used by the separation (enlarged while hovered)
  const sbh = new Float64Array(n);
  const tick = (_time, deltaMs) => {
    const dt = Math.min(deltaMs, 50) / 1000;
    const sy = window.scrollY;
    let vel = (sy - prevSy) / Math.max(dt, 1e-3); // signed scroll speed in px/s (Lenis drives sy)
    if (Math.abs(vel) > 20000) vel = 0; // a jump (back to top), not a scroll
    prevSy = sy;
    const pSteps = Math.max(1, Math.ceil(dt / 0.004));
    const ph = dt / pSteps;
    let moving = false;
    const far = !on && (sy < startScroll - H || sy > endScroll + H);
    // Depth weight: front card 1, back card 20 / (20 + 80 * depthRange) (the same spread as the drift distances).
    const wDen = 20 + 80 * CARDS.depthRange;
    const pushOn = live && mouse.known && CARDS.pushStrength > 0;
    const R = CARDS.pushRadius * scale;
    const pushMax = CARDS.pushStrength * scale;
    const [uk, uc] = [CARDS.pushStiffness, CARDS.pushDamping];

    // R17 hover: the topmost card under the pointer (hit test on last frame's cached positions, 6 px of hysteresis for the card
    // that is already hovered), then every card's hover progress on a critically damped spring (measured on live, CARD_HOVER).
    let hoverMoving = false;
    let nSrc = 0;
    let maxP = 0;
    if (live) {
      let best = -1;
      if (mouse.known && !far) {
        let bestKey = -1;
        for (let i = 0; i < n; i++) {
          // the hit area is the card as drawn: enlarged by its hover progress (the card grows under the pointer, so it must not
          // un-hover), plus 6 px of hysteresis for the card that is already hovered
          const g = 1 + (CARD_HOVER.scale - 1) * hp[i];
          const m = i === hov ? 6 * scale : 0;
          if (Math.abs(mouse.px - bx[i] - fox[i]) <= (bw[i] * g) / 2 + m && Math.abs(mouse.py - (by[i] - sy + foy[i])) <= (bh[i] * g) / 2 + m) {
            const key = cards[i].z * 1000 + i;
            if (key > bestKey) { bestKey = key; best = i; }
          }
        }
      }
      hov = best;
      for (let i = 0; i < n; i++) {
        const goal = i === hov ? 1 : 0;
        if (hp[i] === goal && hv[i] === 0) continue;
        for (let q = 0; q < pSteps; q++) {
          hv[i] += (CARD_HOVER.stiffness * (goal - hp[i]) - CARD_HOVER.damping * hv[i]) * ph;
          hp[i] += hv[i] * ph;
        }
        if (hp[i] < 0) { hp[i] = 0; hv[i] = 0; } else if (hp[i] > 1) { hp[i] = 1; hv[i] = 0; }
        if (Math.abs(goal - hp[i]) < 0.0005 && Math.abs(hv[i]) < 0.002) { hp[i] = goal; hv[i] = 0; } else hoverMoving = true;
        if (hp[i] > 0.002) hp[i] > maxP && (maxP = hp[i]);
      }
      for (let i = 0; i < n; i++) if (hp[i] > 0.002) srcs[nSrc++] = i;
    }
    const pw = 1 - maxP; // the pointer's own push gives way to the hovered card's push
    const hsPush = CARD_HOVER.pushStrength * scale;
    const hRad = CARD_HOVER.pushRadius * scale;

    // Mouse spring, sub-stepped so a stiff setting stays stable.
    if (live) {
      const steps = Math.max(1, Math.ceil(dt / 0.004));
      const h = dt / steps;
      const k = CARDS.mouseStiffness;
      const c = CARDS.mouseDamping;
      for (let s = 0; s < steps; s++) {
        mouse.vx += (k * (mouse.tx - mouse.x) - c * mouse.vx) * h;
        mouse.vy += (k * (mouse.ty - mouse.y) - c * mouse.vy) * h;
        mouse.x += mouse.vx * h;
        mouse.y += mouse.vy * h;
      }
    }

    // The frame (R13e): centred horizontally, vertically at H/2 plus the two float offsets. Read from the hero's own state.
    const fw = frameState.w;
    const fh = frameState.h;
    const fcx = W / 2;
    const fcy = H / 2 + frameState.fo + frameState.fi;
    const aMargin = CARDS.auraMargin * scale;
    const aStrength = CARDS.auraStrength * scale;
    const aGap = CARDS.auraMinGap * scale;
    const aVert = CARDS.auraVertical * scale;

    // Aura target for a card whose centre is (dx, dy) from the frame centre: sets aura.X / aura.Y (px). Built from continuous
    // functions only, so the target never jumps:
    //  - sideways: the card keeps its own side of the frame (`side`, fixed by the layout; no direction flip as it passes the
    //    centre line). Soft push = auraStrength x smoothstep(1 - gap / margin) ^ falloff, and at least the distance that leaves
    //    auraMinGap between the rects, faded in over the last auraMargin px of vertical approach (anticipation, zero slope).
    //  - vertical: a gentle push away from the frame, its sign eased through zero over the frame's half height.
    const auraAt = (dx, dy, hw, hh, side, w) => {
      const gx = dx * side - hw - fw / 2; // gap along x on the card's own side (very negative if it sits across the line)
      const gy = Math.abs(dy) - hh - fh / 2;
      const gap = gx > 0 || gy > 0 ? Math.hypot(Math.max(gx, 0), Math.max(gy, 0)) : Math.max(gx, gy);
      const u = Math.min(Math.max(1 - Math.max(gap, 0) / aMargin, 0), 1);
      const s = (u * u * (3 - 2 * u)) ** CARDS.auraFalloff;
      let X = aStrength * s * w;
      const tv = Math.min(Math.max((gy - aGap) / aMargin, 0), 1);
      X = Math.max(X, CARDS.auraClearance * (1 - tv * tv * (3 - 2 * tv)) * Math.max(aGap - gx, 0));
      aura.X = side * X;
      aura.Y = aVert * s * w * (dy / Math.hypot(dy, (fh / 2 + hh) * 0.5 + 1));
    };

    for (let i = 0; i < n; i++) {
      const c = cards[i];
      const w = (20 + (c.mouse - 20) * CARDS.depthRange) / wDen;

      // Mouse offset ("away": opposite to the mouse) = the gentle background drift.
      let mx = 0;
      let my = 0;
      if (live) {
        const d = (20 + (c.mouse - 20) * CARDS.depthRange) * CARDS.mouseStrength * scale;
        const keep = 1 - hp[i] * (1 - CARD_HOVER.drift); // the hovered card keeps only a little of the drift
        mx = -mouse.x * d * keep;
        my = -mouse.y * d * keep;
      }

      // Lag: the card's scroll position trails the real one; deeper cards (smaller layer value) trail longer.
      let lag = 0;
      if (live && CARDS.lagStrength > 0 && !far) {
        const depth = Math.min(Math.max(1 - (((c.mouse || 100) - 20) / 80) * CARDS.depthRange, 0), 1.5); // 0 front .. 1 back
        const tau = CARDS.lagStrength * (CARDS.lagFrontSec + (CARDS.lagBackSec - CARDS.lagFrontSec) * depth);
        sm[i] += (sy - sm[i]) * (tau > 0 ? 1 - Math.exp(-dt / tau) : 1);
        lag = sy - sm[i];
        if (Math.abs(lag) > 0.05) moving = true;
      } else sm[i] = sy; // lag is off, or the section is more than a screen beyond the on-screen range: drop it (invisible)

      // Push: away from the pointer. Distance is from the pointer to the card's edge (0 inside the card); direction is from the
      // pointer to the card's centre. Reads only cached numbers (base position + current offsets).
      tqx[i] = 0; tqy[i] = 0;
      if (live && mouse.known && !far) {
        const cxm = bx[i] + px[i] + mx; // the card's centre WITHOUT its own push (so the push cannot feed back into itself)
        const cym = by[i] - sy + py[i] + my + lag;
        const own = 1 - hp[i]; // a hovered card stops: its push eases to 0
        const L = 0.35 * Math.min(bw[i], bh[i]);
        // pointer as the source (fades out while a card is hovered). The direction is divided by max(distance, L), so it stays
        // continuous (and fades to zero) when the pointer is on or near the card centre: no swinging.
        if (pushOn && pw > 0.001 && own > 0.001) {
          const dxm = cxm - mouse.px;
          const dym = cym - mouse.py;
          const exm = Math.max(Math.abs(dxm) - bw[i] / 2, 0);
          const eym = Math.max(Math.abs(dym) - bh[i] / 2, 0);
          const r = Math.hypot(exm, eym);
          if (r < R) {
            const f = (1 - r / R) ** CARDS.pushFalloff;
            const inv = 1 / Math.max(Math.hypot(dxm, dym), L);
            tqx[i] += dxm * inv * pushMax * f * w * pw * own;
            tqy[i] += dym * inv * pushMax * f * w * pw * own;
          }
        }
        // hovered cards as the source: neighbours are pushed away from the (enlarged) hovered rectangle, rect to rect
        if (own > 0.001 && hsPush > 0) {
          for (let k = 0; k < nSrc; k++) {
            const s = srcs[k];
            if (s === i) continue;
            const grow = 1 + (CARD_HOVER.scale - 1) * hp[s];
            const dxm = cxm - (bx[s] + fox[s]);
            const dym = cym - (by[s] - sy + foy[s]);
            const exm = Math.max(Math.abs(dxm) - (bw[s] * grow + bw[i]) / 2, 0);
            const eym = Math.max(Math.abs(dym) - (bh[s] * grow + bh[i]) / 2, 0);
            const r = Math.hypot(exm, eym);
            if (r < hRad) {
              const f = (1 - r / hRad) ** CARDS.pushFalloff;
              const inv = 1 / Math.max(Math.hypot(dxm, dym), L);
              tqx[i] += dxm * inv * hsPush * f * w * hp[s] * own;
              tqy[i] += dym * inv * hsPush * f * w * hp[s] * own;
            }
          }
        }
      }
      for (let q = 0; q < pSteps; q++) {
        vqx[i] += (uk * (tqx[i] - qx[i]) - uc * vqx[i]) * ph;
        vqy[i] += (uk * (tqy[i] - qy[i]) - uc * vqy[i]) * ph;
        qx[i] += vqx[i] * ph;
        qy[i] += vqy[i] * ph;
      }
      if (Math.abs(vqx[i]) + Math.abs(vqy[i]) > 0.05 || Math.abs(tqx[i] - qx[i]) + Math.abs(tqy[i] - qy[i]) > 0.05) moving = true;

      // Aura (R13e/f): the card's rect (without its own aura offset) against the frame's rect; see auraAt.
      if (!far && fw > 0) {
        auraAt(bx[i] + mx + qx[i] - fcx, by[i] - sy + lag + my + qy[i] - fcy, bw[i] / 2, bh[i] / 2, pos[i].x < 0 ? -1 : 1, w);
        tpx[i] = aura.X;
        tpy[i] = aura.Y;
      } else { tpx[i] = 0; tpy[i] = 0; }
      amx[i] = mx; amy[i] = my; alag[i] = lag;
    }

    // Card-to-card separation (R13g), on the TARGETS: where the aura / push / drift leave two cards covering more than
    // sepMaxCover of the smaller one, move both apart along the axis that needs the least travel (front card a bit more).
    // Springs still do the travelling, so nothing snaps. The frame wins: a card is never moved into its keep-clear zone.
    // Only cards on (or near) the screen take part, so cards entering from below are already separated while still off screen.
    if (!far && CARDS.sepStrength > 0 && CARDS.sepMaxCover < 1) {
      const margin = H * 0.6;
      for (let i = 0; i < n; i++) { const g = 1 + (CARD_HOVER.scale - 1) * hp[i]; sbw[i] = bw[i] * g; sbh[i] = bh[i] * g; } // a hovered card counts at its enlarged size
      for (let i = 0; i < n; i++) {
        ex[i] = bx[i] + amx[i] + qx[i] + tpx[i];
        ey[i] = by[i] - sy + alag[i] + amy[i] + qy[i] + tpy[i];
        sepOn[i] = ey[i] + sbh[i] / 2 > -margin && ey[i] - sbh[i] / 2 < H + margin ? 1 : 0;
      }
      const passes = Math.max(1, Math.round(CARDS.sepPasses));
      const maxCover = CARDS.sepMaxCover * 0.75; // aim a little under the limit: the blended axes and the frame clamp leave a few % over
      for (let pass = 0; pass < passes; pass++) {
        for (let i = 0; i < n; i++) {
          if (!sepOn[i]) continue;
          for (let j = i + 1; j < n; j++) {
            if (!sepOn[j]) continue;
            const dx = ex[j] - ex[i];
            const dy = ey[j] - ey[i];
            const ox = (sbw[i] + sbw[j]) / 2 - Math.abs(dx);
            const oy = (sbh[i] + sbh[j]) / 2 - Math.abs(dy);
            if (ox <= 0 || oy <= 0) continue;
            const small = Math.min(sbw[i] * sbh[i], sbw[j] * sbh[j]);
            if ((ox * oy) / small <= maxCover) continue;
            // travel needed along x (to bring the overlap area down to maxCover) or along y; x costs more near the screen edge,
            // where a card would be shoved off screen (smooth weight), so a narrow gutter separates vertically instead
            const needX = ox - (maxCover * small) / oy;
            const needY = oy - (maxCover * small) / ox;
            const outer = Math.abs(ex[i]) > Math.abs(ex[j]) ? i : j;
            const over = Math.max(Math.abs(ex[outer]) + sbw[outer] / 2 - W / 2, 0) / (0.25 * W); // how far the outer card already bleeds off
            const costX = needX * (1 + 2 * Math.min(over, 1));
            // blend the two axes (weights from the costs, sharpened) instead of switching, so the target never jumps when the
            // cheaper axis changes
            const kx = costX ** -4;
            const ky = needY ** -4;
            const wX = kx / (kx + ky);
            const lead = Math.min(Math.max((cards[i].mouse - cards[j].mouse) / 50, -1), 1) * 0.15; // front card moves a bit more
            let mi = 0.5 + lead; // share of the travel taken by card i
            if (hp[i] > 0 || hp[j] > 0) { // a hovered card has priority: the other card takes the travel
              const wi = mi * (1 - hp[i]);
              const wj = (1 - mi) * (1 - hp[j]);
              mi = wi + wj > 1e-6 ? wi / (wi + wj) : 0.5;
            }
            const sx = dx === 0 ? (pos[j].x >= pos[i].x ? 1 : -1) : Math.sign(dx);
            const sv = dy === 0 ? 1 : Math.sign(dy);
            const mxv = needX * wX * CARDS.sepStrength;
            const myv = needY * (1 - wX) * CARDS.sepStrength;
            ex[i] -= sx * mxv * mi; ex[j] += sx * mxv * (1 - mi);
            ey[i] -= sv * myv * mi; ey[j] += sv * myv * (1 - mi);
          }
        }
        // the frame wins: pull a card back out of the frame's keep-clear zone if separation pushed it in
        if (fw > 0) {
          for (let i = 0; i < n; i++) {
            if (!sepOn[i]) continue;
            const side = pos[i].x < 0 ? -1 : 1;
            const minDx = sbw[i] / 2 + fw / 2 + aGap;
            const minDy = sbh[i] / 2 + fh / 2 + aGap;
            const dxs = (ex[i] - fcx) * side;
            const dyv = ey[i] - fcy;
            if (Math.abs(dyv) < minDy && dxs < minDx) { // inside the zone: leave by the nearer way, but never further in than the aura had it
              const baseDxs = (bx[i] + amx[i] + qx[i] + tpx[i] - fcx) * side;
              if (dxs < baseDxs) ex[i] += side * (Math.min(baseDxs, minDx) - dxs);
            }
          }
        }
      }
      for (let i = 0; i < n; i++) {
        if (!sepOn[i]) continue;
        tpx[i] = ex[i] - bx[i] - amx[i] - qx[i];
        tpy[i] = ey[i] - (by[i] - sy) - alag[i] - amy[i] - qy[i];
      }
    }

    for (let i = 0; i < n; i++) {
      const c = cards[i];
      const w = (20 + (c.mouse - 20) * CARDS.depthRange) / wDen;
      const mx = amx[i], my = amy[i], lag = alag[i];
      // The R13b spring settles the aura offset (it keeps running toward the last target, so nothing freezes mid-motion).
      // Every card settles with the base softness x auraWeight; the deepest ones are up to 1.25x heavier, none are faster.
      const [pk, pc] = springFromBounce(CARDS.partingSoftness * CARDS.auraWeight * (1 + 0.25 * (1 - w)), CARDS.partingBounce);
      for (let q = 0; q < pSteps; q++) {
        vpx[i] += (pk * (tpx[i] - px[i]) - pc * vpx[i]) * ph;
        vpy[i] += (pk * (tpy[i] - py[i]) - pc * vpy[i]) * ph;
        px[i] += vpx[i] * ph;
        py[i] += vpy[i] * ph;
      }
      if (Math.abs(vpx[i]) + Math.abs(vpy[i]) > 0.05 || Math.abs(tpx[i] - px[i]) + Math.abs(tpy[i] - py[i]) > 0.05) moving = true;

      const x = px[i] + mx + qx[i];
      const y = py[i] + my + lag + qy[i];
      fox[i] = x;
      foy[i] = y;
      // R17: hover scale of the card and opacity of its dark layer (live: 1 -> 1.2, and the layer fades out)
      const sc = 1 + (CARD_HOVER.scale - 1) * hp[i];
      const dk = live ? (1 - hp[i]) * CARD_HOVER.darkRest : 0;
      const posChanged = Math.abs(x - lastX[i]) > 0.02 || Math.abs(y - lastY[i]) > 0.02 || lastX[i] !== lastX[i];
      if (posChanged || Math.abs(sc - lastS[i]) > 0.0002 || lastS[i] !== lastS[i] || Math.abs(dk - lastD[i]) > 0.002) {
        if (glOn) { gl.ox[i] = x; gl.oy[i] = y; gl.hs[i] = sc; gl.hp[i] = hp[i]; if (gl.darkCard[i]) gl.hd[i] = dk; gl.markDirty(); }
        else {
          els[i].style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${sc.toFixed(4)})`;
          const d = darkEls[i];
          if (d) { d.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${(1 + (CARD_HOVER.darkScale - 1) * hp[i]).toFixed(4)})`; d.style.opacity = dk.toFixed(3); }
        }
        lastX[i] = x;
        lastY[i] = y;
        lastS[i] = sc;
        lastD[i] = dk;
      }
    }
    if (hoverMoving) moving = true;
    if (glOn && gl.draw(sy, dt, vel, scale)) moving = true; // R16: draw the cards; true while the bend is still settling
    if (live && (Math.abs(mouse.tx - mouse.x) > 0.0005 || Math.abs(mouse.vx) > 0.0005 || Math.abs(mouse.ty - mouse.y) > 0.0005 || Math.abs(mouse.vy) > 0.0005)) moving = true;
    // Off-screen: stop the loop only once every offset has settled.
    if (!on && !moving) { gsap.ticker.remove(tick); ticking = false; if (glOn) gl.show(false); }
  };

  // Run the loop and the pointer listener only while the cards can be on screen.
  let unregister = null;
  const toggle = (active) => {
    if (active === on) return;
    on = active;
    if (active) {
      // Start from the pointer's real position (no spring-in). The lag starts at zero when the loop was idle (it only idles once
      // the lag has died away); if the loop is still settling, the lag simply carries on.
      if (!ticking) sm.fill(window.scrollY);
      if (live) {
        unregister = registerPointer(effect); // sets the target to the current pointer, if it has moved at all
        mouse.x = mouse.tx; mouse.y = mouse.ty; mouse.vx = 0; mouse.vy = 0;
      }
      if (!ticking) { ticking = true; gsap.ticker.add(tick); }
      if (glOn) { prevSy = window.scrollY; gl.show(true); }
    } else if (unregister) { unregister(); unregister = null; } // the loop itself stops once everything has settled
  };
  ScrollTrigger.create({
    start: () => startScroll,
    end: () => endScroll,
    onToggle: (self) => toggle(self.isActive),
    onRefresh: (self) => { measure(); if (glOn) gl.resize(W, H); toggle(self.isActive); },
  });

  // Dev panel: regenerate the layout from LAYOUT and re-measure (keeps the springs, so cards glide to their new spots).
  const relayout = () => {
    pos = generateLayout(cards, layoutParams());
    els.forEach((el, i) => { for (const t of [el, darkEls[i]]) { t?.style.setProperty('--x', pos[i].x); t?.style.setProperty('--y', pos[i].y); } });
    measure();
    if (glOn) gl.resize(W, H);
    ScrollTrigger.refresh();
    if (!ticking) { ticking = true; gsap.ticker.add(tick); }
  };
  return { cards: els, gl: () => gl, hover: () => ({ hov, hp }), relayout, positions: () => pos, debug: () => ({ px, py, tpx, tpy, bx, by, bw, bh }) };
}
