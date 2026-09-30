import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { INDEX } from '../timeline.js';

// Project index (190-590vh): the 100vh sticky block (filled here) holds three rows stacked in the SAME place.
// Each row is a full-width band that clips its content: label (PRJ - 01), title (centred) and year move together.
// Two swaps slide one row up and out while the next rises from below, linear with scroll. The swap ranges come
// from src/timeline.js (INDEX.swap) and are linked to the hero image peels there.
export function buildIndex(root, projects) {
  const list = projects.filter((p) => p.index); // the projects that have an index number (PRJ-01..03)
  const sticky = root.querySelector('.index__sticky');
  if (!sticky || list.length === 0) return;

  const letters = (title) => [...title].map((c) => `<span class="index__char" aria-hidden="true">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
  sticky.innerHTML = list.map((p) => `
    <a class="index__band" href="/work/${p.slug}.html" aria-label="${p.title}, ${p.year}">
      <span class="index__label">${p.index.replace('-', ' - ')}</span>
      <span class="index__title">${letters(p.title)}</span>
      <span class="index__year">${p.year ?? ''}</span>
    </a>`).join('');

  const bands = [...sticky.querySelectorAll('.index__band')];
  const rows = bands.map((band) => ({
    band,
    block: [band.querySelector('.index__label'), band.querySelector('.index__title'), band.querySelector('.index__year')],
    sides: [band.querySelector('.index__label'), band.querySelector('.index__year')],
    chars: [...band.querySelectorAll('.index__char')],
  }));

  const vh = (n) => () => (window.innerHeight * n) / 100;
  const travel = vh(INDEX.travelVh);
  const swaps = INDEX.swap.slice(0, rows.length - 1);
  const base = swaps[0][0];
  const end = swaps[swaps.length - 1][1];
  const stagger = INDEX.letterStagger;

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { start: vh(base), end: vh(end), scrub: true, invalidateOnRefresh: true },
  });

  // Rise/leave for one row. `incoming` rises from below (+travel -> 0), otherwise it leaves upward (0 -> -travel).
  const move = (row, incoming, at, len) => {
    const from = incoming ? { y: travel } : { y: 0 };
    const to = incoming ? { y: 0 } : { y: () => -travel() };
    // A later "leaving" tween must not reset a row that an earlier tween already moved.
    const opts = { immediateRender: incoming };
    if (stagger > 0) {
      // Labels and years slide as a block; the title's letters rise one after another, finishing at the end of the range.
      tl.fromTo(row.sides, from, { ...to, duration: len, ...opts }, at);
      const n = row.chars.length;
      // Keep the whole stagger inside the swap range: long titles get a smaller step, the last letter ends with the range.
      const step = Math.min(stagger, (len * 0.75) / Math.max(1, n - 1));
      const each = len - step * (n - 1);
      if (incoming) {
        tl.set(row.chars, { y: travel, immediateRender: true }, 0); // all letters start below the band
        tl.to(row.chars, { y: 0, duration: each, stagger: step }, at);
      } else {
        tl.fromTo(row.chars, { y: 0 }, { y: () => -travel(), duration: each, stagger: step, immediateRender: false }, at);
      }
    } else {
      tl.fromTo(row.block, from, { ...to, duration: len, ...opts }, at);
    }
  };

  swaps.forEach(([a, b], i) => {
    const at = (a - base) / 100;
    const len = (b - a) / 100;
    move(rows[i], false, at, len);
    move(rows[i + 1], true, at, len);
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
