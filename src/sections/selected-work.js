import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CARDS, PARTING } from '../timeline.js';
import { registerPointer, pointerEnabled } from '../effects/pointer.js';
import { capW } from '../scale.js';

// Selected Work (was "archive"): 35 image cards scattered over a 250vh section, one element per card (CLAUDE.md rules 3 + 4).
// Everything below was measured on anh-v.com and read from its published code (see docs/status.md, R13), then summed into
// ONE transform per card per frame on the shared gsap ticker:
//   1. Parting (live, scroll): each card, from where it is on the screen, is pushed sideways away from the centre line and
//      down, strongest while it crosses the middle of the screen and for cards near the centre line; the offset is eased at
//      0.2 per 60 fps frame. It is not tied to the frame element. Eight cards have no scroll effect (`scroll: false`).
//   2. Mouse (live): Framer "Parallax Floating". offset = -(mouse - screen centre) / (half the screen) * distance, x and y,
//      on a spring. distance = the card's layer value (20..100 px). There is no radius. Only card 11 ignores the mouse.
//   3. Lag (NEW, not on live): each card's scroll position chases the real one with a delay that grows with depth.
// Positions are read once (load and resize); the loop only does arithmetic and writes transforms. The loop runs only while
// the cards can be on screen. Touch devices and prefers-reduced-motion: no mouse and no lag (parting stays).
export function buildSelectedWork(root, cards) {
  const section = root.querySelector('.selected-work');
  if (!section || !cards?.length) return;

  section.innerHTML = cards
    .map((c) => `<img class="sw__card" src="${c.src}" alt="" loading="lazy" decoding="async" draggable="false" style="--x:${c.x};--y:${c.y};--w:${c.w};--h:${c.h};z-index:${c.z}">`)
    .join('');
  const els = [...section.querySelectorAll('.sw__card')];

  const n = cards.length;
  const bx = new Float64Array(n); // base centre x (px from the left of the window)
  const by = new Float64Array(n); // base centre y (px from the top of the page)
  const bh = new Float64Array(n); // card height (px)
  const px = new Float64Array(n); // parting offset
  const py = new Float64Array(n);
  const sm = new Float64Array(n); // lagged scroll position
  const lastX = new Float64Array(n).fill(NaN);
  const lastY = new Float64Array(n).fill(NaN);
  const armed = new Uint8Array(n);
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
      bx[i] = W / 2 + c.x * scale;
      by[i] = top + (c.y * H) / 100;
      bh[i] = c.h * scale;
      lo = Math.min(lo, by[i] - bh[i] / 2);
      hi = Math.max(hi, by[i] + bh[i] / 2);
    });
    startScroll = lo - H;
    endScroll = hi + H * 0.5; // a little past the last card so the last easing finishes
  };
  measure();

  const live = pointerEnabled;
  // Shared mouse spring (every card's spring is the same and linear, so one normalised state serves all of them).
  const mouse = { tx: 0, ty: 0, x: 0, y: 0, vx: 0, vy: 0 };
  const effect = {
    move: (x, y) => {
      mouse.tx = (x - W / 2) / (W / 2);
      mouse.ty = (y - H / 2) / (H / 2);
    },
  };

  const tick = (_time, deltaMs) => {
    const dt = Math.min(deltaMs, 50) / 1000;
    const sy = window.scrollY;
    const ease = 1 - Math.pow(1 - PARTING.lerp, dt * 60); // live: 0.2 per 60 fps frame

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

    for (let i = 0; i < n; i++) {
      const c = cards[i];

      // Mouse offset ("away": opposite to the mouse).
      let mx = 0;
      let my = 0;
      if (live && c.mouse) {
        const d = (20 + (c.mouse - 20) * CARDS.depthRange) * CARDS.mouseStrength * scale;
        mx = -mouse.x * d;
        my = -mouse.y * d;
      }

      // Parting: needs the card's centre on screen INCLUDING its own offsets, like live (it reads the element's rect).
      if (c.scroll) {
        const h = bh[i];
        const cx = bx[i] + px[i] + mx;
        const cy = by[i] - sy + py[i] + my;
        if (!armed[i] && cy - h / 2 < H - PARTING.armed * h && cy + h / 2 > PARTING.armed * h) armed[i] = 1;
        if (armed[i]) {
          const dx = cx - W / 2;
          const f = Math.min(Math.abs(dx) / (W / 2), 1);
          const g = 1 - Math.min(Math.max((cy + h) / (H + 2 * h), 0), 1);
          if (g > 0 && g < 1) {
            const t = (1 - Math.abs(g - 0.5) * 2) * CARDS.partingStrength;
            const tx = t * (W * PARTING.xMin + (W * PARTING.xMax - W * PARTING.xMin) * (1 - f)) * (dx < 0 ? -1 : 1) * PARTING.z;
            const ty = t * (H * PARTING.yMin + (H * PARTING.yMax - H * PARTING.yMin) * (1 - f)) * PARTING.z;
            px[i] += (tx - px[i]) * ease;
            py[i] += (ty - py[i]) * ease;
          }
        }
      }

      // Lag: the card's scroll position trails the real one; deeper cards (smaller layer value) trail longer.
      let lag = 0;
      if (live && CARDS.lagStrength > 0) {
        const depth = Math.min(Math.max(1 - (((c.mouse || 100) - 20) / 80) * CARDS.depthRange, 0), 1.5); // 0 front .. 1 back
        const tau = CARDS.lagStrength * (CARDS.lagFrontSec + (CARDS.lagBackSec - CARDS.lagFrontSec) * depth);
        sm[i] += (sy - sm[i]) * (tau > 0 ? 1 - Math.exp(-dt / tau) : 1);
        lag = sy - sm[i];
      } else sm[i] = sy;

      const x = px[i] + mx;
      const y = py[i] + my + lag;
      if (Math.abs(x - lastX[i]) > 0.02 || Math.abs(y - lastY[i]) > 0.02 || lastX[i] !== lastX[i]) {
        els[i].style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
        lastX[i] = x;
        lastY[i] = y;
      }
    }
  };

  // Run the loop and the pointer listener only while the cards can be on screen.
  let on = false;
  let unregister = null;
  const toggle = (active) => {
    if (active === on) return;
    on = active;
    if (active) {
      sm.fill(window.scrollY);
      gsap.ticker.add(tick);
      if (live) unregister = registerPointer(effect);
    } else {
      gsap.ticker.remove(tick);
      if (unregister) { unregister(); unregister = null; }
    }
  };
  ScrollTrigger.create({
    start: () => startScroll,
    end: () => endScroll,
    onToggle: (self) => toggle(self.isActive),
    onRefresh: (self) => { measure(); toggle(self.isActive); },
  });

  return { cards: els };
}
