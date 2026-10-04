import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SPRING, MORE_PROJECTS_FIT } from '../timeline.js';
import { springLayer, springFromBounce } from '../effects/springs.js';
import { registerPointer, pointerEnabled } from '../effects/pointer.js';
import { capW } from '../scale.js';
import { lineHover } from './footer.js';
import { imgAttrs } from '../util/media.js';

// More Projects (was "clients"): a 100vh sticky block over the darkening full-screen image. Left label, right "See more work" link (dot-to-line hover like the footer), and a
// centred list of names (5 projects), each in a clipped band. Measured on the live site: the list is
// static (no roll in); hovering a name rolls it up (a second copy of the text is stacked 74px below) while every other
// name greys out, both on a spring (0.4s, bounce 0.2). Each project has an image (400 x 500) that follows the cursor
// (+200px x, 20px below the cursor, centred) on the shared pointer loop; the images sit in a vertical strip that slides
// to the hovered name.
export function buildMoreProjects(root, data) {
  const sticky = root.querySelector('.more-projects__sticky');
  if (!sticky || !data) return;

  const entries = data.items.map((p) => ({ name: p.name, href: `/work/${p.slug}.html` }));
  const cursorHtml = pointerEnabled
    ? `<div class="more-projects__cursor" aria-hidden="true"><div class="more-projects__strip">${data.items.map((p) => `<img ${imgAttrs(p.image, '21vw', true)} alt="" decoding="async" />`).join('')}</div></div>`
    : '';
  // R16c: the strip's images are decoded a few seconds after load, one at a time, instead of when the section scrolls into view:
  // decoding them on arrival cost one ~35 ms frame at ~565vh (traced: the main thread waits for the raster / commit of those big images).
  const warmStrip = () => {
    const imgs = [...sticky.querySelectorAll('.more-projects__strip img')];
    imgs.forEach((im, k) => setTimeout(() => { (im.decode ? im.decode() : Promise.resolve()).catch(() => {}); }, 3000 + k * 400));
  };
  sticky.innerHTML = `
    <span class="more-projects__label">${data.label}</span>
    <a class="more-projects__more footer__top" href="${data.more.href}"><span class="footer__text">${data.more.name}</span><span class="footer__line"></span></a>
    <ul class="more-projects__list">${entries.map((e) => `
      <li><a class="more-projects__item" href="${e.href}"><span class="more-projects__roll"><span class="more-projects__t">${e.name}</span><span class="more-projects__t" aria-hidden="true">${e.name}</span></span></a></li>`).join('')}
    </ul>
    ${cursorHtml}`;

  lineHover(sticky.querySelector('.more-projects__more'));

  // R13g: keep the list (and the label / "See more work" link beside it) clear of the big wordmark that comes back at the
  // footer. A rule from the wordmark's top edge, not a fitted number: the list keeps a gap above it, never goes above the
  // safe top, and shrinks to at most minScale when it cannot fit. Measured on load and resize only.
  const listEl = sticky.querySelector('.more-projects__list');
  const fit = () => {
    const F = MORE_PROJECTS_FIT;
    const Wn = window.innerWidth;
    const Hn = window.innerHeight;
    const wmTop = Hn - (Wn * 0.81875 * 345) / 1572; // the nav wordmark's top edge when it is big (same formula as nav.js)
    const gap = Math.max(F.gapMinPx, (Hn * F.gapVh) / 100);
    const safeTop = (Hn * F.safeTopVh) / 100;
    const h = listEl.offsetHeight;
    if (!h) return;
    const scale = Math.min(1, Math.max(F.minScale, (wmTop - gap - safeTop) / h));
    const hs = h * scale;
    let shift = Math.min(0, wmTop - gap - (Hn / 2 + hs / 2)); // up, only when needed
    shift = Math.max(shift, safeTop - (Hn / 2 - hs / 2)); // not above the safe top
    sticky.style.setProperty('--mp-shift', `${Math.round(Math.min(0, shift) * 10) / 10}px`);
    sticky.style.setProperty('--mp-scale', scale.toFixed(4));
  };
  fit();
  window.addEventListener('resize', fit);
  if (document.fonts?.ready) document.fonts.ready.then(fit);

  if (!pointerEnabled) return; // touch / reduced motion: a plain list of links

  const rollSpring = springFromBounce(SPRING.linkRoll.duration, SPRING.linkRoll.bounce);
  const list = sticky.querySelector('.more-projects__list');
  const cursor = sticky.querySelector('.more-projects__cursor');
  const strip = sticky.querySelector('.more-projects__strip');

  // Cached measurements (read on load and on refresh, never per frame).
  let rollPx = 74;
  let boxH = 500;
  let offX = 200;
  let offY = 20;
  const measure = () => {
    const t = list.querySelectorAll('.more-projects__t');
    rollPx = t[1].offsetTop - t[0].offsetTop;
    boxH = cursor.offsetHeight;
    offX = (capW() * 200) / 1920;
    offY = (capW() * 20) / 1920;
  };

  // One spring layer per name: r = roll (0..1), g = greyed out (0..1, shown as the opacity of the first copy).
  const rows = [...list.querySelectorAll('li')].map((li) => {
    const roll = li.querySelector('.more-projects__roll');
    const first = li.querySelector('.more-projects__t');
    const target = { r: 0, g: 0 };
    springLayer({
      target,
      springs: { r: rollSpring, g: rollSpring },
      apply: (v) => {
        roll.style.transform = `translate3d(0, ${-v.r * rollPx}px, 0)`;
        first.style.opacity = (1 - v.g * 0.69).toFixed(3);
      },
    });
    return target;
  });

  // The image cursor: x, y follow the pointer, s is the strip offset (px), o the opacity.
  const cur = { x: 0, y: 0, s: 0, o: 0 };
  const curLayer = springLayer({
    target: cur,
    springs: { x: SPRING.hoverCursor, y: SPRING.hoverCursor, s: SPRING.hoverCursor, o: SPRING.hoverCursor },
    apply: (v) => {
      cursor.style.transform = `translate3d(${v.x}px, ${v.y}px, 0)`;
      cursor.style.opacity = Math.min(1, Math.max(0, v.o)).toFixed(3);
      strip.style.transform = `translate3d(0, ${-v.s}px, 0)`;
    },
  });

  let placed = false; // the first time the image shows, jump to the pointer instead of flying in from the corner
  let px = 0;
  let py = 0;
  const follow = (x, y) => {
    px = x;
    py = y;
    cur.x = x + offX;
    cur.y = y + offY - boxH / 2;
  };
  const effect = { move: follow };
  let unregister = null;

  const hover = (i) => {
    rows.forEach((t, k) => { t.r = k === i ? 1 : 0; t.g = k === i ? 0 : 1; });
    cur.s = i * boxH;
    cur.o = 1;
    if (!placed) { follow(px, py); curLayer.snap(); placed = true; }
  };
  const rest = () => { rows.forEach((t) => { t.r = 0; t.g = 0; }); cur.o = 0; placed = false; };
  list.querySelectorAll('li').forEach((li, i) => li.addEventListener('pointerenter', (e) => { if (e.pointerType === 'touch') return; follow(e.clientX, e.clientY); hover(i); }));
  list.addEventListener('pointerleave', rest);

  // Only listen to the pointer while the section is on screen.
  measure();
  ScrollTrigger.create({
    trigger: sticky.parentElement,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => {
      if (self.isActive && !unregister) unregister = registerPointer(effect);
      else if (!self.isActive && unregister) { unregister(); unregister = null; rest(); }
    },
    onRefresh: measure,
  });
  warmStrip();
}
