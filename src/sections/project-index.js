import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { INDEX, SPRING } from '../timeline.js';
import { springLayer } from '../effects/springs.js';
import { bezier } from '../util/bezier.js';

// Project index (190-590vh): the 100vh sticky block (filled here) holds three rows stacked in the SAME place.
// Each row is a full-width band that clips its content: label (PRJ - 01), title (centred) and year.
// Two things move them, both driven from src/timeline.js (INDEX):
//   1. Row blocks: two swaps slide one row up and out while the next rises from below, linear with scroll,
//      chased through a spring (SPRING.indexRow). Linked to the hero image peels there.
//   2. Characters: every character rises from 200px below its band, in TIME, once per page load, when its row
//      arrives (row 1 at 50% in view, row 2 at the start of swap 1, row 3 at the start of swap 2).
export function buildIndex(root, projects) {
  const list = projects.filter((p) => p.index); // the projects that have an index number (PRJ-01..03)
  const sticky = root.querySelector('.index__sticky');
  if (!sticky || list.length === 0) return;

  const chars = (text, cls) => [...String(text)].map((c) => `<span class="index__char ${cls}" aria-hidden="true">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
  sticky.innerHTML = list.map((p) => `
    <a class="index__band" href="/work/${p.slug}.html" aria-label="${p.title}, ${p.year}">
      <span class="index__inner">
        <span class="index__label">${chars(p.index.replace('-', ' - '), 'is-side')}</span>
        <span class="index__title">${chars(p.title, 'is-title')}</span>
        <span class="index__year">${chars(p.year ?? '', 'is-side')}</span>
      </span>
    </a>`).join('');

  const bands = [...sticky.querySelectorAll('.index__band')];
  const rows = bands.map((band) => ({
    band,
    inner: band.querySelector('.index__inner'),
    side: [...band.querySelectorAll('.index__char.is-side')],
    title: [...band.querySelectorAll('.index__char.is-title')],
    target: { y: 0 },
  }));

  const vh = (n) => () => (window.innerHeight * n) / 100;
  const travel = vh(INDEX.travelVh);
  const swaps = INDEX.swap.slice(0, rows.length - 1);
  const base = swaps[0][0];
  const end = swaps[swaps.length - 1][1];

  // --- 1. Row blocks ---------------------------------------------------------------------------------------
  // A scrubbed timeline writes each row's target y; a spring layer per row chases it and moves the block.
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { start: vh(base), end: vh(end), scrub: true, invalidateOnRefresh: true },
  });
  swaps.forEach(([a, b], i) => {
    const at = (a - base) / 100;
    const len = (b - a) / 100;
    // Row i leaves upward; row i+1 rises from below. A later "leaving" tween must not reset a row an earlier tween moved.
    tl.fromTo(rows[i].target, { y: 0 }, { y: () => -travel(), duration: len, immediateRender: i === 0 }, at);
    tl.fromTo(rows[i + 1].target, { y: travel }, { y: 0, duration: len }, at);
  });
  rows.forEach((row) => {
    springLayer({ target: row.target, springs: { y: SPRING.indexRow }, apply: (v) => gsap.set(row.inner, { y: v.y }) });
  });

  // --- 2. Characters ---------------------------------------------------------------------------------------
  // All characters start hidden below their band; the rise plays once when the row arrives.
  rows.forEach((row) => gsap.set([...row.side, ...row.title], { y: travel }));
  const { side, titleFirst, titleNext } = INDEX.text;
  const rise = (els, cfg) => gsap.to(els, { y: 0, duration: cfg.duration, stagger: cfg.stagger, ease: bezier(...cfg.ease) });
  const arrive = (row, titleCfg) => { rise(row.side, side); rise(row.title, titleCfg); };

  ScrollTrigger.create({ trigger: rows[0].band, start: 'center bottom', once: true, onEnter: () => arrive(rows[0], titleFirst) });
  swaps.forEach(([a], i) => {
    ScrollTrigger.create({ start: vh(a), end: 'max', once: true, onEnter: () => arrive(rows[i + 1], titleNext) });
  });

  // Only the row that is showing can be clicked (the bands sit on top of each other).
  let active = -1;
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      const y = (self.scroll() / window.innerHeight) * 100;
      const now = swaps.filter(([a, b]) => y >= (a + b) / 2).length;
      if (now !== active) { active = now; bands.forEach((b, i) => b.classList.toggle('is-active', i === now)); }
    },
  });
  bands[0].classList.add('is-active');
}
