import { WORK, WORK_V2, WORK_UI, TALL, BEND } from '../timeline.js';
import { capW } from '../scale.js';
import { buildProjectCards, workMetrics } from './cards.js';
import { pickSize, ruleSignature } from './layout-store.js';
import { createGuard } from './tall-guard.js';
import { initNav } from '../effects/nav.js';
import { weakReason } from '../util/device.js';

export function createMode() {
  const v2 = !WORK.cards, geometry = v2 ? WORK_V2 : WORK;
  return {
    v2, geometry, noCards: v2, showToggle: !v2, allowPointer: true, applyFocus: true,
    validateStored: true, rendererOptions: {lite: false}, dragSamples: 12,
    diagnosticKind: {lite: false, kind: 'desktop'}, debugSettings: TALL, overrides: {},
    loadLayouts: async () => null,
    initialVertical: (back, store) => back ? back.mode === 'vertical' : store.get() === 'vertical',
    mountMenu() {
      if (v2 && WORK_UI.hideNav) return;
      const nav = document.createElement('nav'); nav.className = 'nav';
      nav.innerHTML = [['About', '/#2section'], ['Works', '/work/'], ['Contact', '/#contact']]
        .map(([n, h]) => `<a href="${h}" data-link="${n}"><span class="roll"><span>${n}</span><span>${n}</span></span></a>`).join('');
      document.body.prepend(nav);
    },
    earlyNav: async () => {},
    lateNav: (wordmark, lenis, scrolled, back) => initNav(wordmark, lenis, {gateFrame:false, position:() => scrolled() ? 1e9 : 0, startBig:!!back && !back.leave.wm}),
    cards: (pool, slugs) => v2 ? slugs.map(() => []) : buildProjectCards(pool, slugs),
    metrics: (W, H) => workMetrics(W, H, capW() / 1920),
    pick: (LD, W, H) => pickSize(LD, W, H), signature: ruleSignature,
    imageWidth: () => Math.round(geometry.frameW), scale: () => capW() / 1920,
    frame(W, H) {
      let w = geometry.frameW * W / 100, h = geometry.frameH * H / 100;
      if (v2) { const r = (geometry.frameW * 1920) / (geometry.frameH * 1080); w = Math.min(w, h * r); h = w / r; }
      return {w, h};
    },
    layouts: ['side', 'vertical'],
    layoutMetrics(mode, W, H, fw, fh, scale) {
      const v = mode === 'vertical';
      return {vertical:v, alongF:v ? fh : fw, crossF:v ? fw : fh, scale, gap:v ? geometry.gapVert * H / 100 : geometry.gapSide * W / 100, gapPx:WORK.dupGap * (v ? H : W) / 100, viewAlong:v ? H : W, viewCross:v ? W : H};
    },
    linkLayouts() {}, guard: (setScale) => createGuard({setScale, enabled:false}),
    capBend() {}, syncWarp() {}, guardFrame() {}, drawSpeed: (v) => v,
    glOffReason: () => weakReason(BEND.weakCores, BEND.weakMemoryGb) || 'noWebGL2',
    ambient: () => true, lead: () => true,
    snapSec: () => WORK.snapSec, snapDelay: () => WORK.snapDelay,
    snapVelocity: () => 0,
    rest: ({snap, now, lastWheel, vel, motionAt}) => ({ok:!!snap || (now - lastWheel > WORK.snapDelay * 1000 && Math.abs(vel) < 250), motionAt}),
    perFrame: ({swipePeak}) => swipePeak,
    release(d, now, by, {S, cur}) {
      const s = d.samples.filter(q => now - q[0] < 90);
      if (s.length >= 2) {
        const v = -((s[s.length - 1][1] - s[0][1]) / Math.max((s[s.length - 1][0] - s[0][0]) / 1000, 0.008));
        if (Math.abs(v) > 30) { const F0 = Math.max(WORK.dragFriction, 0.05), cap = WORK.dragMaxCoast * cur().pitch, nat = Math.abs(v) * F0, F = nat <= cap ? F0 : (cap * (1 + WORK.dragCoastKnee * Math.log(nat / cap))) / Math.abs(v); return {inertia:{from:S, v0:v, F, t0:now}}; }
      }
      return {};
    },
    coast({inertia, now, S, glOn, reduced, cur}) {
      const t = (now - inertia.t0) / 1000, e = Math.exp(-t / inertia.F), spd = inertia.v0 * e;
      S = inertia.from + inertia.v0 * inertia.F * (1 - e);
      let snap = null, resetSnapForce = false;
      if (Math.abs(spd) < 5) inertia = null;
      else if (WORK.dragSnapBlend > 0 && Math.abs(spd) < WORK.dragSnapBlend && glOn && !reduced) {
        const pt = cur().pitch, k = Math.round((S + spd * inertia.F) / pt);
        if (Math.abs(k * pt - S) > 0.5) { resetSnapForce = true; snap = {from:S, to:k * pt, t0:now, force:0}; }
        inertia = null;
      }
      return {S, inertia, snap, resetSnapForce};
    },
  };
}
