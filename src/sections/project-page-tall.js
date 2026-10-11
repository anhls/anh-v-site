import '../styles/tall-project.css';
import { imgAttrs, videoInfo } from '../util/media.js';
import { FLIGHT } from '../settings/shared.js';

// R24a Part 4: a project page in the TALL mode (phones, tablet portrait): every block stacked in ONE column at the full width, from the same data
// (data.json projects[].page.blocks) as the desktop page (src/sections/project-page.js, not loaded here). Rules:
//   media 1 per row at full width (natural aspect); several media next to each other (a split / three-up / a stage's pictures) become a horizontal
//   swipe row (scroll-snap x mandatory, the next item peeking); the free-layout stages and the pinned scroller are flattened into reading order (stage items
//   by their top edge); videos play inline (muted, playsinline), only while in view, poster first, Save-Data respected (no fetch until tapped);
//   text at a readable size (>= 16 px body, lines under 34 em); the desktop scroll effects (letter fade, parallax masks, pinned scroller, growing strip) are
//   replaced by one simple enter fade per block (none under reduced motion).
const SAFARI = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const lines = (a) => a.map(esc).join('<br>');
const rich = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
const saveData = !!navigator.connection?.saveData;

// ---- media
const img = (ref, alt = '') => `<img class="tp-media" ${imgAttrs(ref, '(min-width: 800px) 70vw, 100vw')} alt="${esc(alt)}" loading="lazy" decoding="async">`;
const loop = (c) => {
  const v = videoInfo(c.ref);
  if (!v) return img(c.ref);
  const ar = v.w && v.h ? `aspect-ratio:${v.w} / ${v.h}` : 'aspect-ratio:4 / 3';
  if (v.alpha && SAFARI) return `<img class="tp-media" src="${v.webp}" alt="" loading="lazy" decoding="async" style="${ar}">`;
  return `<video class="tp-media" muted loop playsinline preload="none" data-poster="${v.poster}" data-webm="${v.webm}" data-mp4="${v.mp4 || ''}" style="${ar}" aria-hidden="true"></video>`;
};
const media = (c) => (c.kind === 'loop' ? loop(c) : img(c.ref, c.alt));

// ---- pieces: { k: 'media' | 'text' | 'h2' | 'cap', html }; consecutive media become a swipe row
const text = (body, light) => ({ k: 'text', html: `<p class="tp-body${light ? ' tp-body--light' : ''}">${rich(body)}</p>` });
const piecesOfCell = (c) => {
  if (!c) return [];
  if (c.kind === 'img' || c.kind === 'loop') return [{ k: 'media', html: media(c) }, ...(c.note ? [text(c.note)] : [])];
  if (c.kind === 'abs') return c.items.map((it) => ({ k: 'media', html: media(it) }));
  if (c.kind === 'figure') return [{ k: 'media', html: media(c) }, text(c.paras.join('\n'))];
  if (c.kind === 'copy') return [...(c.heading ? [{ k: 'h2', html: `<h2 class="tp-h2">${lines(c.heading)}</h2>` }] : []), text(c.body)];
  if (c.kind === 'note') return [text(c.body)];
  return [];
};
// a stage item's top edge in 1080-high units (for the reading order): `0`, `50%`, `198v`, `calc(50% - 69v)`; `u` terms are widths, ignored
const topOf = (it, H0) => {
  const t = String(it.css?.top ?? '0'); let sum = 0;
  for (const m of t.matchAll(/([+-]?\s*\d+(?:\.\d+)?)\s*(%|v|u)?/g)) { const n = parseFloat(m[1].replace(/\s+/g, '')); if (m[2] === '%') sum += (n * H0) / 100; else if (m[2] === 'v') sum += n; }
  return sum;
};
const piecesOfStageItem = (it) => {
  if (it.kind === 'group') return it.items.flatMap(piecesOfStageItem);
  if (it.kind === 'text') return [text(it.body, it.light)];
  if (it.kind === 'heading') return [{ k: 'h2', html: `<h2 class="tp-h2">${lines(it.lines)}</h2>` }];
  return [{ k: 'media', html: media(it) }];
};
const piecesOfStage = (b) => {
  const H0 = b.h?.vh ? b.h.vh * 10.8 : b.h?.px || 1080;
  return b.items.map((it, i) => ({ it, i, top: topOf(it, H0) })).sort((a, b2) => a.top - b2.top || a.i - b2.i).flatMap(({ it }) => piecesOfStageItem(it));
};

// assemble pieces into HTML: swipe rows for 2+ media in a row, one block (with the enter fade) per piece / row
const assemble = (pieces) => {
  const out = []; let run = [];
  const flush = () => {
    if (!run.length) return;
    out.push(run.length === 1 ? `<div class="tp-block tp-fade">${run[0]}</div>` : `<div class="tp-row tp-fade" role="group" aria-label="Images, swipe sideways" tabindex="0">${run.map((h) => `<div class="tp-item">${h}</div>`).join('')}</div>`);
    run = [];
  };
  for (const p of pieces) { if (p.k === 'media') run.push(p.html); else { flush(); out.push(`<div class="tp-pad tp-fade">${p.html}</div>`); } }
  flush();
  return out.join('');
};

const blocks = {
  hero: (b) => b.loop ? `<section class="tp-hero" style="height:auto;aspect-ratio:${b.aspect}">${loop({ ref: b.loop })}</section>` : `<section class="tp-hero"${b.aspect ? ` style="height:auto;aspect-ratio:${b.aspect}"` : ''}>${img(b.img, document.title.replace(/ \| Anh V$/, '')).replace('loading="lazy" decoding="async"', 'fetchpriority="high"')}</section>`,
  text: (b) => `<section class="tp-text tp-pad tp-fade"><span class="tp-label">${esc(b.label)}</span><p class="tp-lead">${esc(b.text.trim())}</p></section>`,
  split: (b) => assemble([...piecesOfCell(b.left), ...piecesOfCell(b.right)]),
  full: (b) => assemble([...piecesOfCell(b.img), ...(b.note ? [text(b.note.body)] : [])]),
  row: (b) => assemble(b.items.map((c) => ({ k: 'media', html: `${media(c)}${c.cap ? `<p class="tp-cap">${esc(c.cap)}</p>` : ''}` }))),
  threeup: (b) => assemble(b.cells.map((c) => ({ k: 'media', html: `${img(c.ref, c.alt)}${c.caption ? `<p class="tp-cap">${esc(c.caption)}</p>` : ''}` }))),
  youtube: (b) => `<section class="tp-yt tp-fade" data-yt="${b.id}" data-title="${esc(b.title)}"><button class="tp-ytbtn" type="button" aria-label="Play video: ${esc(b.title)}"><img class="tp-media" alt="" data-src="https://i.ytimg.com/vi/${b.id}/maxresdefault.jpg" data-fallback="https://i.ytimg.com/vi/${b.id}/hqdefault.jpg"><span class="tp-play"></span></button></section>`,
  details: (b) => `<section class="tp-details tp-pad tp-fade"><div class="tp-titles">${b.title.map((t) => `<p class="tp-h2">${esc(t)}</p>`).join('')}</div><p class="tp-h4">${esc(b.heading)}</p><div class="tp-rows">${b.rows.map(([k, v]) => `<div class="tp-row2"><span>${esc(k)}</span><span>${lines(v)}</span></div>`).join('')}</div><p class="tp-body">${rich(b.body)}</p></section>`,
  stage: (b) => assemble(piecesOfStage(b)),
  scroller: (b) => assemble(b.layers.flatMap((l) => (l.items || []).flatMap(piecesOfStageItem))),
};

export function buildProjectPageTall(root, page, lenis) {
  root.innerHTML = `<div class="tp">${page.blocks.map((b) => (blocks[b.t] ? blocks[b.t](b) : '')).join('')}</div><div class="footer pj__footer"></div>`;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.style.setProperty('--flight-z', String(FLIGHT.zEnd)); // R41: the zoomed picture IS the header (same value the transition ends on)

  // one simple enter fade per block (class is-in once it is within 12 % of a screen of the viewport); none under reduced motion
  const fades = [...root.querySelectorAll('.tp-fade')];
  if (reduce) fades.forEach((f) => f.classList.add('is-in'));
  else {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    fades.forEach((f) => io.observe(f));
  }

  // videos: the source is chosen and loaded on first approach, played only while on screen (the poster only with reduced motion or Save-Data)
  const vidIo = new IntersectionObserver((es) => es.forEach((e) => {
    const v = e.target;
    if (e.isIntersecting) {
      if (!v.dataset.ready) { v.dataset.ready = '1'; v.poster = v.dataset.poster; if (!saveData) v.src = v.dataset.webm && (v.canPlayType('video/webm; codecs="vp9"') || !v.dataset.mp4) ? v.dataset.webm : v.dataset.mp4; }
      if (!reduce && !saveData) v.play().catch(() => {});
    } else v.pause();
  }), { rootMargin: '30% 0px' });
  root.querySelectorAll('video[data-mp4]').forEach((v) => vidIo.observe(v));

  // YouTube: a still until it is tapped; the player (youtube-nocookie) is created only then
  root.querySelectorAll('.tp-yt').forEach((sec) => {
    const im = sec.querySelector('img');
    const io = new IntersectionObserver((es) => { if (!es[0].isIntersecting) return; io.disconnect(); im.onerror = () => { im.onerror = null; im.src = im.dataset.fallback; }; im.src = im.dataset.src; }, { rootMargin: '80% 0px' });
    io.observe(sec);
    sec.querySelector('button').addEventListener('click', () => { sec.innerHTML = `<iframe class="tp-frame" src="https://www.youtube-nocookie.com/embed/${sec.dataset.yt}?autoplay=1&rel=0&modestbranding=1" title="${sec.dataset.title}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`; });
  });
}
