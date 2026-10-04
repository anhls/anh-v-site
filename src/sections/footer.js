import { SPRING } from '../timeline.js';
import { springLayer, springFromBounce } from '../effects/springs.js';
import { backToTop } from '../effects/back-to-top.js';

// Footer (110vh, absolute at the bottom of the page). Measured on live: "Go Back To Top" (12px) sits centred, a 30px box
// ending 30px above the page bottom, with a 1px line through the middle of the text. At rest the line is a 1px dot; on
// hover it grows across the whole text on a spring (0.4s, bounce 0.2). Clicking runs the back-to-top transition (src/effects/back-to-top.js).
// The big AV wordmark returning here is the nav wordmark (src/effects/nav.js), not part of this footer.
// The dot-to-line hover, shared with the More Projects "See more work" link: the 1px line (.footer__line inside the link)
// grows across the text on pointer enter and shrinks back on leave.
export function lineHover(link) {
  const line = link.querySelector('.footer__line');
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
  link.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') target.r = 1; }); // R22j: a tap is not a hover
  link.addEventListener('pointerleave', () => { target.r = 0; });
  return measure;
}

export function buildFooter(root, data, lenis) {
  const footer = root.querySelector('.footer');
  if (!footer) return;
  footer.innerHTML = `<a class="footer__top" href="#top"><span class="footer__text">${data.topLabel}</span><span class="footer__line"></span></a>`;
  const link = footer.querySelector('.footer__top');
  lineHover(link);
  link.addEventListener('click', (e) => {
    e.preventDefault();
    backToTop(lenis);
  });
}
