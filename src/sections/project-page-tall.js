import '../styles/tall-project.css';
import { imgAttrs, imgInfo, videoInfo } from '../util/media.js';
import { FLIGHT } from '../settings/shared.js';
import { saveLiteBack } from '../work/tall-back.js';

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
// width / height of a media cell: the data's own aspect, else the converted file's size
const arOf = (c) => {
  if (c.aspect) return c.aspect;
  const v = c.kind === 'loop' ? videoInfo(c.ref) : null;
  if (v?.w && v?.h) return v.w / v.h;
  const m = imgInfo(c.ref);
  return m ? m.source.width / m.source.height : 0;
};
const img = (ref, alt = '') => `<img class="tp-media" ${imgAttrs(ref, '(min-width: 800px) 70vw, 100vw')} alt="${esc(alt)}" loading="lazy" decoding="async">`;
const loop = (c) => {
  const v = videoInfo(c.ref);
  if (!v) return img(c.ref);
  const ar = v.w && v.h ? `aspect-ratio:${v.w} / ${v.h}` : 'aspect-ratio:4 / 3';
  if (v.alpha && SAFARI) return `<img class="tp-media" src="${v.webp}" alt="" loading="lazy" decoding="async" style="${ar}">`;
  return `<video class="tp-media" muted loop playsinline preload="none" data-poster="${v.poster}" data-webm="${v.webm}" data-mp4="${v.mp4 || ''}" style="${ar}" aria-hidden="true"></video>`;
};
const media = (c) => (c.kind === 'loop' ? loop(c) : img(c.ref, c.alt));
const mediaPiece = (c, extra = {}) => ({ k: 'media', html: media(c), ar: arOf(c), ...extra });

// ---- R44 rules (docs/codex/R44-notes.md; the per-block override is block.phone = { mode, hide }, see docs/HANDOFF.md "Phone project page")
const SAME_AR = 0.1; // a swipe set = 3 or more media in a row whose aspect ratios are within 10 %
const SET_MIN = 3;
const SMALL_SHARE = 45; // a picture drawn narrower than this share of the desktop page width keeps the side margins on the phone, wider ones go edge to edge
const COMP_MAX_AR = 3; // a composition wider than 3:1 would be unreadable at phone width: its pictures are stacked instead
const sameAr = (a, b) => a > 0 && b > 0 && Math.abs(a - b) / Math.max(a, b) <= SAME_AR;

// ---- pieces: { k: 'media' | 'text' | 'h2' | 'comp', html, ar?, small? }
const text = (body, light) => ({ k: 'text', html: `<p class="tp-body tp-fade${light ? ' tp-body--light' : ''}">${rich(body)}</p>` });
const h2 = (ls) => ({ k: 'h2', html: `<h2 class="tp-h2 tp-lines">${lines(ls)}</h2>` });
const piecesOfCell = (c) => {
  if (!c) return [];
  if (c.kind === 'img' || c.kind === 'loop') return [mediaPiece(c), ...(c.note ? [text(c.note)] : [])];
  if (c.kind === 'abs') return c.items.map((it) => mediaPiece(it));
  if (c.kind === 'figure') return [mediaPiece(c), text(c.paras.join('\n'))];
  if (c.kind === 'copy') return [...(c.heading ? [h2(c.heading)] : []), text(c.body)];
  if (c.kind === 'note') return [text(c.body)];
  return [];
};

// stage geometry: a stage is a 1920 x H0 design canvas; css lengths are u (1 px of the 1920 width), v (1 px of the 1080 height), % (of the canvas), or a calc() of those
const lenOf = (s, base) => {
  if (s == null) return null;
  let sum = 0;
  for (const m of String(s).replace(/calc\(|\)/g, '').replace(/([+-])\s+/g, '$1').matchAll(/([+-]?\d*\.?\d+)\s*(%|v|u)?/g)) sum += m[2] === '%' ? (parseFloat(m[1]) * base) / 100 : parseFloat(m[1]);
  return sum;
};
const rectOf = (it, W, H0) => {
  const c = it.css || {};
  let w = lenOf(c.width, W), h = lenOf(c.height, H0);
  if (w == null && h == null) return null;
  const ar = arOf(it) || 1.5;
  if (h == null) h = w / ar;
  if (w == null) w = h * ar;
  let l = c.left != null ? lenOf(c.left, W) : c.right != null ? W - lenOf(c.right, W) - w : 0;
  let t = c.top != null ? lenOf(c.top, H0) : c.bottom != null ? H0 - lenOf(c.bottom, H0) - h : 0;
  if (/translateX\(-50%\)/.test(c.transform || '')) l -= w / 2;
  if (/translateY\(-50%\)/.test(c.transform || '')) t -= h / 2;
  return { l, t, w, h };
};
const overlap = (a, b) => Math.min(a.l + a.w, b.l + b.w) - Math.max(a.l, b.l) > 1 && Math.min(a.t + a.h, b.t + b.h) - Math.max(a.t, b.t) > 1;
const flatItems = (its) => its.flatMap((it) => (it.kind === 'group' ? flatItems(it.items) : [it]));
const cellHtml = (it, r, bb) => `<div class="tp-cell" style="left:${(((r.l - bb.l) / bb.w) * 100).toFixed(3)}%;top:${(((r.t - bb.t) / bb.h) * 100).toFixed(3)}%;width:${((r.w / bb.w) * 100).toFixed(3)}%;height:${((r.h / bb.h) * 100).toFixed(3)}%;--fit:${it.fit || 'cover'}">${media(it)}</div>`;
// ONE composition per group of overlapping pictures (placement and overlaps kept, scaled to the phone width); pictures that touch nothing are plain stacked media;
// text and headings are lifted out of the stage (headings first, the text after the pictures)
const piecesOfStage = (b, mode) => {
  const W = 1920, H0 = b.h?.vh ? b.h.vh * 10.8 : b.h?.px || 1080;
  const mediaIts = [], texts = [], heads = [];
  for (const it of flatItems(b.items)) {
    if (it.kind === 'text') texts.push(text(it.body, it.light));
    else if (it.kind === 'heading') heads.push(h2(it.lines));
    else mediaIts.push({ it, r: rectOf(it, W, H0) || { l: 0, t: 0, w: W, h: W / (arOf(it) || 1.5) } });
  }
  const par = mediaIts.map((_, i) => i), find = (i) => (par[i] === i ? i : (par[i] = find(par[i])));
  for (let i = 0; i < mediaIts.length; i++) for (let j = i + 1; j < mediaIts.length; j++) if (overlap(mediaIts[i].r, mediaIts[j].r)) par[find(j)] = find(i);
  const groups = new Map();
  mediaIts.forEach((m, i) => { const k = find(i); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(m); });
  const single = ({ it, r }) => {
    const small = (r.w / W) * 100 < SMALL_SHARE;
    if (it.fit === 'cover' && it.css?.height && it.css?.width) return { k: 'media', html: `<div class="tp-crop" style="aspect-ratio:${r.w.toFixed(1)} / ${r.h.toFixed(1)}">${media(it)}</div>`, ar: r.w / r.h, small };
    return mediaPiece(it, { small });
  };
  const units = [];
  for (const g of groups.values()) {
    const top = Math.min(...g.map((m) => m.r.t));
    if (g.length === 1 || mode === 'flatten' || mode === 'stack') { g.forEach((m) => units.push({ top: m.r.t, piece: single(m) })); continue; }
    const x0 = Math.max(0, Math.min(...g.map((m) => m.r.l))), y0 = Math.max(0, Math.min(...g.map((m) => m.r.t)));
    const x1 = Math.min(W, Math.max(...g.map((m) => m.r.l + m.r.w))), y1 = Math.min(H0, Math.max(...g.map((m) => m.r.t + m.r.h)));
    const bb = { l: x0, t: y0, w: x1 - x0, h: y1 - y0 };
    if (bb.w <= 0 || bb.h <= 0) continue;
    if (bb.w / bb.h > COMP_MAX_AR) { g.forEach((m) => units.push({ top: m.r.t, piece: single(m) })); continue; }
    units.push({ top, piece: { k: 'comp', html: `<div class="tp-comp" style="aspect-ratio:${bb.w.toFixed(1)} / ${bb.h.toFixed(1)}">${g.map(({ it, r }) => cellHtml(it, r, bb)).join('')}</div>`, small: (bb.w / W) * 100 < SMALL_SHARE } });
  }
  units.sort((a, c) => a.top - c.top);
  return [...heads, ...units.map((u) => u.piece), ...texts];
};
const piecesOfStageItem = (it) => {
  if (it.kind === 'group') return it.items.flatMap(piecesOfStageItem);
  if (it.kind === 'text') return [text(it.body, it.light)];
  if (it.kind === 'heading') return [h2(it.lines)];
  return [mediaPiece(it)];
};

// assemble pieces: stacked by default (one item per row, full width); a run of 3+ consecutive media of the same aspect (within 10 %) is ONE swipe set with a "1 / N" count.
// mode (the block's phone hint): 'swipe' = every run of media is a set, 'stack' / 'flatten' = never a set. reveal = the enter effect of a stacked picture ('mask' | 'grow')
const assemble = (pieces, { mode = '', reveal = 'mask' } = {}) => {
  const out = []; let run = [];
  const stacked = (p) => `<div class="tp-block tp-${reveal}${p.small ? ' tp-inset' : ''}">${p.html}</div>`;
  const flush = () => {
    if (!run.length) return;
    const parts = []; let cur = [];
    for (const p of run) { if (cur.length && mode !== 'swipe' && !sameAr(p.ar, cur[0].ar)) { parts.push(cur); cur = []; } cur.push(p); }
    if (cur.length) parts.push(cur);
    for (const part of parts) {
      const set = mode !== 'stack' && mode !== 'flatten' && (part.length >= SET_MIN || (mode === 'swipe' && part.length > 1));
      if (set) out.push(`<div class="tp-set tp-fade"><div class="tp-row" role="group" aria-label="Images, swipe sideways" tabindex="0">${part.map((p) => `<div class="tp-item">${p.html}</div>`).join('')}</div><p class="tp-count" aria-hidden="true">1 / ${part.length}</p></div>`);
      else part.forEach((p) => out.push(stacked(p)));
    }
    run = [];
  };
  for (const p of pieces) {
    if (p.k === 'media') run.push(p);
    else { flush(); out.push(p.k === 'comp' ? stacked(p) : `<div class="tp-pad">${p.html}</div>`); }
  }
  flush();
  return out.join('');
};

// page.phone.skip (data.json): the project keeps the earlier phone layout (every 2+ media a swipe row, stages flattened) until Anh's review of it (R44: Duhat, Nam Long)
const modeOf = (b) => (b._legacy ? 'swipe' : b.phone?.mode);
const heroImg = (b) => b.phone?.ref || b.img; // R44: the phone crop (a picture made for the tall screen) when the project has one
const blocks = {
  hero: (b) => b.loop ? `<section class="tp-hero" style="height:auto;aspect-ratio:${b.aspect}">${loop({ ref: b.loop })}</section>` : `<section class="tp-hero"${b.aspect ? ` style="height:auto;aspect-ratio:${b.aspect}"` : ''}>${img(heroImg(b), document.title.replace(/ \| Anh V$/, '')).replace('loading="lazy" decoding="async"', 'fetchpriority="high"')}</section>`,
  text: (b) => `<section class="tp-text tp-pad"><span class="tp-label">${esc(b.label)}</span><p class="tp-lead tp-lines">${esc(b.text.trim())}</p></section>`,
  split: (b) => assemble([...piecesOfCell(b.left), ...piecesOfCell(b.right)], { mode: modeOf(b), reveal: b.grow ? 'grow' : 'mask' }),
  full: (b) => assemble([...piecesOfCell(b.img), ...(b.note ? [text(b.note.body)] : [])], { mode: modeOf(b) }),
  row: (b) => assemble(b.items.map((c) => ({ ...mediaPiece(c), small: (b.width ?? 100) < SMALL_SHARE, html: `${media(c)}${c.cap ? `<p class="tp-cap">${esc(c.cap)}</p>` : ''}` })), { mode: modeOf(b) }),
  threeup: (b) => assemble(b.cells.map((c) => ({ k: 'media', ar: arOf({ ref: c.ref, kind: 'img' }), html: `${img(c.ref, c.alt)}${c.caption ? `<p class="tp-cap">${esc(c.caption)}</p>` : ''}` })), { mode: modeOf(b) }),
  youtube: (b) => `<section class="tp-yt tp-fade" data-yt="${b.id}" data-title="${esc(b.title)}"><button class="tp-ytbtn" type="button" aria-label="Play video: ${esc(b.title)}"><img class="tp-media" alt="" data-src="https://i.ytimg.com/vi/${b.id}/maxresdefault.jpg" data-fallback="https://i.ytimg.com/vi/${b.id}/hqdefault.jpg"><span class="tp-play"></span></button></section>`,
  details: (b) => `<section class="tp-details tp-pad tp-fade"><div class="tp-titles">${b.title.map((t) => `<p class="tp-h2">${esc(t)}</p>`).join('')}</div><p class="tp-h4">${esc(b.heading)}</p><div class="tp-rows">${b.rows.map(([k, v]) => `<div class="tp-row2"><span>${esc(k)}</span><span>${lines(v)}</span></div>`).join('')}</div><p class="tp-body">${rich(b.body)}</p></section>`,
  stage: (b) => assemble(piecesOfStage(b, b._legacy ? 'flatten' : b.phone?.mode), { mode: modeOf(b) }),
  scroller: (b) => assemble(b.layers.flatMap((l) => (l.items || []).flatMap(piecesOfStageItem)), { mode: modeOf(b) }),
};

// R44: the enter effects, each played ONCE per block when it comes into view (time-based CSS transitions, no scroll-linked work); reduced motion = the final state at once.
//   .tp-lines  text: line by line (the words are tagged with their line when the block enters: lines rise 8 px and fade in, 60 ms apart)
//   .tp-mask   a picture opens from the centre of its frame, scale 1.06 -> 1;   .tp-grow  the growing strip: a full-width picture opens from a strip;   .tp-fade  anything else (set, video, details)
// R42: returns a dispose() (observers, video sources) for the in-place Work -> project swap.
// R41d: a generator so the idle build can append the blocks a few at a time (one yield per chunk, each a short task on a phone); buildProjectPageTall runs it to the end (the same DOM).
export function buildProjectPageTall(root, page, lenis) {
  const g = buildProjectPageTallSteps(root, page, lenis);
  let r; do r = g.next(); while (!r.done);
  return r.value;
}
export function* buildProjectPageTallSteps(root, page, lenis) {
  const offs = [];
  const saveBack = () => saveLiteBack(root);
  addEventListener('pagehide', saveBack); offs.push(() => removeEventListener('pagehide', saveBack));
  const html = page.blocks.map((b) => (blocks[b.t] && !b.phone?.hide ? blocks[b.t](page.phone?.skip ? { ...b, _legacy: true } : b) : '')); // (read while the caller has the project's title set: the hero's alt text uses it)
  root.innerHTML = '<div class="tp"></div><div class="footer pj__footer"></div>';
  const tp = root.firstElementChild;
  for (let i = 0; i < html.length; i += 2) { tp.insertAdjacentHTML('beforeend', html.slice(i, i + 2).join('')); yield; }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.style.setProperty('--flight-z', String(FLIGHT.zEnd)); // R41: the zoomed picture IS the header (same value the transition ends on)

  // enter effects: class is-in once the block is within 8 % of a screen of the viewport; text is split into lines first (one layout read per block, once)
  const tagLines = (el) => {
    const words = [];
    const walk = (node) => {
      for (const n of [...node.childNodes]) {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          for (const part of n.textContent.split(/(\s+)/)) {
            if (!part) continue;
            if (/^\s+$/.test(part)) frag.append(part);
            else { const w = document.createElement('span'); w.className = 'tp-w'; w.textContent = part; frag.append(w); words.push(w); }
          }
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.nodeName !== 'BR') walk(n);
      }
    };
    walk(el);
    let top = -1e9, line = -1;
    for (const w of words) { const t = w.offsetTop; if (Math.abs(t - top) > 2) { top = t; line++; } w.style.setProperty('--l', String(Math.min(line, 10))); }
    el.classList.add('is-split');
  };
  const enters = [...root.querySelectorAll('.tp-lines, .tp-mask, .tp-grow, .tp-fade')];
  if (reduce) enters.forEach((f) => f.classList.add('is-in', 'is-split'));
  else {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      const t = e.target; io.unobserve(t);
      if (t.classList.contains('tp-lines')) { tagLines(t); requestAnimationFrame(() => t.classList.add('is-in')); } else t.classList.add('is-in');
    }), { rootMargin: '0px 0px -8% 0px' });
    enters.forEach((f) => io.observe(f));
    offs.push(() => io.disconnect());
  }

  // swipe sets: the "n / N" count follows the item that is mostly in view (an observer inside the row: no scroll listener, no layout read)
  root.querySelectorAll('.tp-set').forEach((set) => {
    const row = set.querySelector('.tp-row'), count = set.querySelector('.tp-count'), items = [...row.children];
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) count.textContent = `${items.indexOf(e.target) + 1} / ${items.length}`; }), { root: row, threshold: 0.6 });
    items.forEach((it) => io.observe(it));
    offs.push(() => io.disconnect());
  });

  // videos: the source is chosen and loaded on first approach, played only while on screen (the poster only with reduced motion or Save-Data)
  const vidIo = new IntersectionObserver((es) => es.forEach((e) => {
    const v = e.target;
    if (e.isIntersecting) {
      if (!v.dataset.ready) { v.dataset.ready = '1'; v.poster = v.dataset.poster; if (!saveData) v.src = v.dataset.webm && (v.canPlayType('video/webm; codecs="vp9"') || !v.dataset.mp4) ? v.dataset.webm : v.dataset.mp4; }
      if (!reduce && !saveData) v.play().catch(() => {});
    } else v.pause();
  }), { rootMargin: '30% 0px' });
  root.querySelectorAll('video[data-mp4]').forEach((v) => vidIo.observe(v));
  offs.push(() => { vidIo.disconnect(); root.querySelectorAll('video').forEach((v) => { v.pause(); v.removeAttribute('src'); v.load(); }); });

  // YouTube: a still until it is tapped; the player (youtube-nocookie) is created only then
  root.querySelectorAll('.tp-yt').forEach((sec) => {
    const im = sec.querySelector('img');
    const io = new IntersectionObserver((es) => { if (!es[0].isIntersecting) return; io.disconnect(); im.onerror = () => { im.onerror = null; im.src = im.dataset.fallback; }; im.src = im.dataset.src; }, { rootMargin: '80% 0px' });
    io.observe(sec);
    offs.push(() => io.disconnect());
    sec.querySelector('button').addEventListener('click', () => { sec.innerHTML = `<iframe class="tp-frame" src="https://www.youtube-nocookie.com/embed/${sec.dataset.yt}?autoplay=1&rel=0&modestbranding=1" title="${sec.dataset.title}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`; });
  });
  return () => offs.splice(0).forEach((f) => f());
}
