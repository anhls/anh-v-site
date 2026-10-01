import { SPRING } from '../timeline.js';
import { springLayer, springFromBounce } from '../effects/springs.js';

// Footer (110vh, absolute at the bottom of the page). Measured on live: "Go Back To Top" (12px) sits centred, a 30px box
// ending 30px above the page bottom, with a 1px line through the middle of the text. At rest the line is a 1px dot; on
// hover it grows across the whole text on a spring (0.4s, bounce 0.2). Clicking scrolls to the top (smooth, via Lenis).
// The big AV wordmark returning here is the nav wordmark (src/effects/nav.js), not part of this footer.
export function buildFooter(root, data, lenis) {
  const footer = root.querySelector('.footer');
  if (!footer) return;
  footer.innerHTML = `<a class="footer__top" href="#top"><span class="footer__text">${data.topLabel}</span><span class="footer__line"></span></a>`;
  const link = footer.querySelector('.footer__top');
  const line = footer.querySelector('.footer__line');

  let min = 0.011; // 1px of the text width
  const measure = () => { min = 1 / link.offsetWidth; };
  measure();
  window.addEventListener('resize', measure);

  const target = { r: 0 };
  springLayer({
    target,
    springs: { r: springFromBounce(SPRING.linkRoll.duration, SPRING.linkRoll.bounce) },
    apply: (v) => { line.style.transform = `scaleX(${Math.max(min, v.r)})`; },
  });
  link.addEventListener('pointerenter', () => { target.r = 1; });
  link.addEventListener('pointerleave', () => { target.r = 0; });
  link.addEventListener('click', (e) => {
    e.preventDefault();
    if (lenis) lenis.scrollTo(0); else window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
