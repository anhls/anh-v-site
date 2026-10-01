import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { BACK_TOP } from '../timeline.js';
import { snapAllLayers } from './springs.js';

// "Go Back To Top" without the long scroll (R13g). Instead of scrolling the whole page back up (replaying every scrubbed
// animation, 35 cards and image loads), cover the page with ONE black overlay (opacity only), jump to the top while it is
// hidden, snap every scrub tween and spring to its top state, and fade the overlay out again.
//   A+  the overlay sits just below the big AV wordmark, so the wordmark never moves or flickers (it is big at the footer and
//       big at the top). The nav links (also identical in both places) stay too.
//   A   the overlay is above everything, wordmark included (weak devices; no frame-time measuring).
//   reduced motion: instant jump with a very short plain fade.
const param = new URLSearchParams(location.search).get('top');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const weak = () => {
  const mem = navigator.deviceMemory;
  return navigator.hardwareConcurrency <= BACK_TOP.weakCores || (mem !== undefined && mem <= BACK_TOP.weakMemoryGb) || navigator.connection?.saveData === true;
};
const useAPlus = () => (param === 'aplus' ? true : param === 'a' ? false : !weak());

let overlay = null;
let busy = false;

function getOverlay(aPlus) {
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'btt-overlay';
    overlay.setAttribute('aria-hidden', 'true');
  }
  const wordmark = document.querySelector('.wordmark');
  // A+: same z-index as the wordmark but earlier in the page, so the wordmark stays on top. A: above everything.
  overlay.style.zIndex = aPlus ? '9' : '11';
  if (aPlus && wordmark) wordmark.before(overlay); else document.body.append(overlay);
  return overlay;
}

export function backToTop(lenis) {
  if (busy) return;
  const y = window.scrollY;
  if (y < 2) return;
  busy = true;
  const aPlus = useAPlus();
  const el = getOverlay(aPlus);
  const out = reduced ? BACK_TOP.reducedFade : BACK_TOP.fadeOut;
  const back = reduced ? BACK_TOP.reducedFade : BACK_TOP.fadeIn;
  lenis?.stop();
  el.style.pointerEvents = 'auto'; // swallow clicks while covered
  window.__bttPath = aPlus ? 'aplus' : 'a'; // dev / checks

  const jump = () => {
    if (lenis) lenis.scrollTo(0, { immediate: true, force: true }); else window.scrollTo(0, 0);
    window.scrollTo(0, 0);
    ScrollTrigger.update();
    // scrubbed timelines chase the scroll with a short lag: finish that now, then put every spring on its target
    ScrollTrigger.getAll().forEach((st) => { const tw = st.getTween?.(); if (tw) tw.progress(1); });
    snapAllLayers();
    window.__bttJumpedAt = performance.now();
  };

  gsap.to(el, {
    opacity: 1, duration: out, ease: BACK_TOP.ease,
    onComplete: () => {
      jump();
      // hold one moment: the loops that run on the ticker (cards, trail) get a frame or two to settle, then reveal
      gsap.delayedCall(BACK_TOP.settleMs / 1000, () => {
        snapAllLayers();
        gsap.to(el, {
          opacity: 0, duration: back, ease: BACK_TOP.ease,
          onComplete: () => { el.style.pointerEvents = 'none'; lenis?.start(); busy = false; },
        });
      });
    },
  });
}
