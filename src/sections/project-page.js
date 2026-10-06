import { imgAttrs, videoInfo } from '../util/media.js';

// Builds a project page from data.json (projects[].page.blocks). Block types: hero, text, split, full, youtube, details, threeup.
// Cell kinds inside split / threeup: img, loop (muted looping video), copy (heading + paragraph), note (paragraph pinned to the bottom), abs (media items
// placed by % of the cell), figure (image + paragraphs under it), empty. Sizes in px are the 1920x1080 values and become --uy / --ux units.
const SAFARI = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Free-layout css: values may use `Nu` (N px at 1920 wide) and `Nv` (N px at 1080 high), scaled by --ux / --uy (fixed above 1920x1080), also inside calc().
const unit = (v) => {
  const raw = String(v);
  const r = raw.replace(/(-?\d+(?:\.\d+)?)([uv])(?![a-z%])/g, (m, n, k) => (k === 'u' ? `(var(--ux) * ${(n / 19.2).toFixed(4)})` : `(var(--uy) * ${(n / 10.8).toFixed(4)})`));
  return r === raw || /calc\(/.test(raw) || !/\(var/.test(r) ? r : `calc(${r})`;
};
const cssText = (o) => Object.entries(o || {}).map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}:${unit(v)}`).join(';');
const lines = (a) => a.map(esc).join('<br>');
// text with **bold** parts (Framer rich text: bold = weight 700, full white on the 50 % white paragraph)
const rich = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

const uy = (px) => `calc(var(--uy) * ${(px / 10.8).toFixed(3)})`;
const par = (c, inner) => (c.parallax ? `<div class="pj__par" data-y="${c.parallax.y}" data-s="${c.parallax.s}" data-ds="${c.parallax.ds}"${c.parallax.k ? ` data-k="${c.parallax.k}"` : ''} style="transform:scale(${c.parallax.s});transform-origin:${c.parallax.ox || '50%'} ${c.parallax.oy || '50%'}">${inner}</div>` : inner);

const img = (c, sizes, eager = false) => {
  const style = [c.w ? `--w:${c.w}%` : '', c.h ? `--h:${c.h}%` : '', c.hcss ? `--hpx:${c.hcss}` : c.hpx ? `--hpx:${uy(c.hpx)}` : '', c.aspect ? `aspect-ratio:${c.aspect}` : ''].filter(Boolean).join(';');
  return par(c, `<img class="pj__img pj__img--${c.fit || 'cover'}" ${imgAttrs(c.ref, sizes)} alt="${c.alt || ''}" ${eager ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"'}${style ? ` style="${style}"` : ''}>`);
};

const loop = (c) => {
  const v = videoInfo(c.ref);
  const style = [c.w && c.w <= 100 ? `--w:${c.w}%` : '', c.w > 100 ? `--wvw:${(c.w / 19.2).toFixed(3)}vw` : '', c.h ? `--h:${c.h}%` : '', c.hcss ? `--hpx:${c.hcss}` : c.hpx ? `--hpx:${uy(c.hpx)}` : '', c.aspect ? `aspect-ratio:${c.aspect}` : ''].filter(Boolean).join(';');
  // Transparent loop: WebM with alpha (Chrome / Firefox); Safari plays no WebM alpha, so it gets the animated WebP with alpha instead.
  if (v.alpha && SAFARI) return par(c, `<img class="pj__img pj__img--${c.fit || 'cover'}" src="${v.webp}" alt="" loading="lazy" decoding="async"${style ? ` style="${style}"` : ''}>`);
  return par(c, `<video class="pj__img pj__img--${c.fit || 'cover'}" muted loop playsinline preload="none" data-poster="${v.poster}" data-webm="${v.webm}" data-mp4="${v.mp4 || ''}"${style ? ` style="${style}"` : ''}></video>`);
};

const media = (c, sizes) => (c.kind === 'loop' ? loop(c) : img(c, sizes));

const cell = (c, sizes = '50vw') => {
  if (!c) return '<div class="pj__cell"></div>';
  const top = c.align === 'start' ? ' pj__cell--top' : '';
  const wst = c.wpx ? ` style="flex:none;width:calc(var(--ux) * ${(c.wpx / 19.2).toFixed(3)})"` : ''; // fixed-width cell (the other one takes the rest)
  if (c.kind === 'img') return `<div class="pj__cell${top}"${wst}>${img(c, sizes)}</div>`;
  if (c.kind === 'loop') return `<div class="pj__cell${top}"${wst}>${loop(c)}${c.note ? `<p class="pj__note pj__note--pin">${esc(c.note)}</p>` : ''}</div>`;
  if (c.kind === 'abs') {
    return `<div class="pj__cell">${c.items.map((it) => `<div class="pj__item" style="left:${it.x}%;top:${it.y}%;width:${it.w}%;height:${it.h}%">${media(it, sizes)}</div>`).join('')}</div>`;
  }
  if (c.kind === 'figure') {
    return `<div class="pj__cell pj__cell--figure">${media(c, sizes)}<p class="pj__small pj__paras">${rich(c.paras.join('\n'))}</p></div>`;
  }
  if (c.kind === 'copy') {
    return `<div class="pj__cell pj__cell--copy${c.heading ? ' pj__cell--head' : ''}">${c.heading ? `<h2 class="pj__h2">${lines(c.heading)}</h2>` : ''}<p class="pj__small"${c.width ? ` style="--pw:${(c.width / 19.2).toFixed(3)}vw"` : ''}>${rich(c.body)}</p></div>`;
  }
  if (c.kind === 'note') return `<div class="pj__cell"><p class="pj__note pj__note--pin pj__note--low">${esc(c.body)}</p></div>`;
  return '<div class="pj__cell"></div>';
};

// Words in inline-block spans, letters in spans with --i (reading order), so one CSS variable (--f) per block drives every letter.
function fadeText(text) {
  let i = 0;
  const html = text.split(/(\s+)/).map((w) => (/^\s+$/.test(w) || w === '' ? w : `<span class="pj__w">${Array.from(w).map((ch) => `<span style="--i:${i++}">${esc(ch)}</span>`).join('')}</span>`)).join('');
  return { html, n: i };
}

const stageItem = (it) => {
  if (it.kind === 'group') return `<div class="pj__sg" style="${cssText(it.css)}">${it.items.map(stageItem).join('')}</div>`;
  if (it.kind === 'text') return `<p class="pj__small pj__si pj__st${it.light ? ' pj__st--light' : ''}" style="${cssText(it.css)}">${rich(it.body)}</p>`;
  if (it.kind === 'heading') return `<h2 class="pj__h2 pj__si" style="${cssText(it.css)}">${lines(it.lines)}</h2>`;
  return `<div class="pj__si" style="${cssText(it.css)}">${media(it, '50vw')}</div>`;
};

const block = {
  hero: (b) => `<section class="pj__sec pj__hero">${img({ ref: b.img, fit: 'cover', parallax: b.parallax, alt: document.title.replace(/ \| Anh V$/, '') }, '100vw', true)}</section>`,
  text: (b) => {
    const t = fadeText(b.text);
    const st = [b.hvh ? `height:${b.hvh}vh` : b.hpx ? `height:${uy(b.hpx)}` : '', b.pad ? `--padx:calc(var(--ux) * ${(b.pad / 19.2).toFixed(3)})` : ''].filter(Boolean).join(';');
    return `<section class="pj__text${b.hvh || b.hpx ? ' pj__text--fixed' : ''}"${st ? ` style="${st}"` : ''}><div class="pj__inner"><div class="pj__fade" style="--n:${t.n};--f:0">${t.html}</div><span class="pj__label">${esc(b.label)}</span></div></section>`;
  },
  split: (b) => `<section class="pj__sec pj__split"${b.hpx ? ` style="height:${uy(b.hpx)}"` : ''}${b.grow ? ` data-grow="${uy(b.grow.hpx)}"` : ''}>${cell(b.left)}${cell(b.right)}</section>`,
  full: (b) => `<section class="pj__sec pj__full${b.align === 'start' ? ' pj__full--top' : ''}" style="${b.hpx ? `height:${uy(b.hpx)};--tall:${uy(b.hpx)};` : ''}${b.tall ? `--tall:${(b.tall / 10.8).toFixed(3)}vh` : ''}">${media(b.img, '100vw')}${b.note ? `<p class="pj__note pj__note--pin pj__note--center" style="width:calc(var(--ux) * ${(b.note.w / 19.2).toFixed(3)});bottom:calc(var(--uy) * ${(b.note.bottom / 10.8).toFixed(3)})">${esc(b.note.body)}</p>` : ''}</section>`,
  youtube: (b) => `<section class="pj__sec pj__yt" data-yt="${b.id}" data-title="${esc(b.title)}"><button class="pj__ytbtn" type="button" aria-label="Play video: ${esc(b.title)}"><img class="pj__img pj__img--cover" alt="" data-src="https://i.ytimg.com/vi/${b.id}/maxresdefault.jpg" data-fallback="https://i.ytimg.com/vi/${b.id}/hqdefault.jpg"><span class="pj__play"></span></button></section>`,
  details: (b) => `<section class="pj__details"><div class="pj__dl">${b.title.map((t) => `<p class="pj__h2">${esc(t)}</p>`).join('')}</div><div class="pj__dr"><p class="pj__h4">${esc(b.heading)}</p><div class="pj__rows">${b.rows.map(([k, v]) => `<div class="pj__row"><span>${esc(k)}</span><span>${lines(v)}</span></div>`).join('')}</div><p class="pj__small pj__body">${rich(b.body)}</p></div></section>`,
  // Free layout block: items placed with css (units above). height: { vh } or { px } (a fixed px height like live's 4070 mosaic).
  stage: (b) => `<section class="pj__stage${b.visible ? ' pj__stage--visible' : ''}" style="height:${b.h && b.h.css ? unit(b.h.css) : b.h && b.h.px ? uy(b.h.px) : `${(b.h && b.h.vh) || 100}vh`}">${b.items.map(stageItem).join('')}</section>`,
  // Pinned horizontal scroller (live: TCB "Key Visual Exploration"): a sticky 100vh stage inside a tall section; every layer slides on its own
  // linear tx(scroll) between `from` and `to` while the page scroll goes from `start` to `end` px into the section.
  scroller: (b) => `<section class="pj__scroller" data-start="${b.start}" data-end="${b.end}" style="height:${uy(b.hpx)}"><div class="pj__pin">${b.layers.map((l) => `<div class="pj__layer${l.z ? ' pj__layer--top' : ''}" data-from="${l.from}" data-to="${l.to}" style="${cssText(l.css)}">${(l.items || []).map(stageItem).join('')}</div>`).join('')}</div></section>`,
  threeup: (b) => `<section class="pj__sec pj__three">${b.cells.map((c) => `<div class="pj__cell pj__cell--3">${img(c, '33vw')}${c.caption ? `<p class="pj__small pj__cap"${c.capColor ? ` style="color:${esc(c.capColor)}"` : ''}>${esc(c.caption)}</p>` : ''}</div>`).join('')}</section>`,
};

// cubic-bezier(0.4, 0, 0.2, 1), same approximation as the Framer component
function bezier(x1, y1, x2, y2) {
  const A = (a, b) => 1 - 3 * b + 3 * a;
  const B = (a, b) => 3 * b - 6 * a;
  const C = (a) => 3 * a;
  const calc = (t, a, b) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t;
  const slope = (t, a, b) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a);
  return (x) => {
    let g = x;
    for (let i = 0; i < 4; i++) { const s = slope(g, x1, x2); if (s === 0) break; g -= (calc(g, x1, x2) - x) / s; }
    return calc(g, y1, y2);
  };
}
const ease = bezier(0.4, 0, 0.2, 1);
const PAR = { k: 0.0298, e: 200 }; // parallax scale rate constants (see buildProjectPage)
const FADE = { start: 0.1, end: 0.6 }; // ScrollFadeText (direction down, animation from end): raw scroll progress window

export function buildProjectPage(root, page, lenis) {
  root.innerHTML = page.blocks.map((b) => block[b.t](b)).join('') + '<div class="footer pj__footer"></div>';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Text fade: --f per block = share of the letters lit (0..1), updated only for blocks near the screen.
  const fades = [...root.querySelectorAll('.pj__fade')];
  const live = new Set();
  const setF = (el) => {
    const raw = 1 - Math.min(Math.max(el.getBoundingClientRect().top / window.innerHeight, 0), 1);
    const p = Math.min(Math.max((raw - FADE.start) / (FADE.end - FADE.start), 0), 1);
    el.style.setProperty('--f', (1 - ease(1 - p)).toFixed(4));
  };
  fades.forEach(setF);
  const fadeIo = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) live.add(e.target); else { live.delete(e.target); setF(e.target); } }), { rootMargin: '10% 0px' });
  fades.forEach((f) => fadeIo.observe(f));
  lenis.on('scroll', () => live.forEach(setF));
  window.addEventListener('resize', () => fades.forEach(setF));

  // Growing block (live: Similac's 150 px strip turns into a 960 px block the moment it is within 10 % of a screen below the viewport, and stays).
  root.querySelectorAll('[data-grow]').forEach((sec) => {
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { io.disconnect(); sec.style.height = sec.dataset.grow; window.dispatchEvent(new Event('resize')); /* ScrollTrigger (footer / wordmark) re-measures the longer page */ } }, { rootMargin: '0px 0px 10% 0px' });
    io.observe(sec);
  });

  // Parallax masks (live Framer overrides, measured R19b): the media sits in a 100vh mask and is moved / scaled by the PAGE scroll position, directly
  // (no spring): ty = y * scrollY, scale = s + ds * rate * scrollY, with rate = K / (innerHeight + E) (fitted on 720..2160 px tall windows). Transform only.
  const pars = [...root.querySelectorAll('.pj__par')];
  let rate = PAR.k / (window.innerHeight + PAR.e);
  const seen = new Set();
  const place = (el, sy) => { el.style.transform = `translate3d(0, ${(el.dataset.y * sy).toFixed(2)}px, 0) scale(${(+el.dataset.s + el.dataset.ds * (el.dataset.k ? el.dataset.k / (window.innerHeight + PAR.e) : rate) * sy).toFixed(5)})`; };
  if (!reduce && pars.length) {
    const byMask = new Map(pars.map((el) => [el.parentElement, el]));
    const parIo = new IntersectionObserver((es) => es.forEach((e) => {
      const el = byMask.get(e.target);
      if (e.isIntersecting) { seen.add(el); el.style.willChange = 'transform'; place(el, window.scrollY); } else { seen.delete(el); el.style.willChange = ''; }
    }));
    byMask.forEach((_, mask) => parIo.observe(mask)); // the mask decides what is on screen
    lenis.on('scroll', () => { const sy = window.scrollY; seen.forEach((el) => place(el, sy)); });
    window.addEventListener('resize', () => { rate = PAR.k / (window.innerHeight + PAR.e); seen.forEach((el) => place(el, window.scrollY)); });
  } else pars.forEach((el) => { el.style.transform = `scale(${el.dataset.s})`; }); // reduced motion: the start pose, no movement

  // Pinned horizontal scrollers: transform only, only while the section is near the screen; reduced motion = a plain horizontally scrolling row.
  root.querySelectorAll('.pj__scroller').forEach((sec) => {
    const layers = [...sec.querySelectorAll('.pj__layer')];
    if (reduce) { sec.classList.add('pj__scroller--plain'); return; }
    let top = 0, kx = 1, ky = 1, on = false;
    const measure = () => { top = sec.getBoundingClientRect().top + window.scrollY; kx = Math.min(window.innerWidth, 1920) / 1920; ky = Math.min(window.innerHeight, 1080) / 1080; };
    const start = +sec.dataset.start, end = +sec.dataset.end;
    const update = () => {
      const u = Math.min(Math.max((window.scrollY - top - start * ky) / ((end - start) * ky), 0), 1);
      layers.forEach((l) => { l.style.transform = `translate3d(${((+l.dataset.from + u * (+l.dataset.to - +l.dataset.from)) * kx).toFixed(2)}px,0,0)`; });
    };
    measure(); update();
    new IntersectionObserver((es) => { on = es[0].isIntersecting; if (on) { measure(); update(); } }, { rootMargin: '20% 0px' }).observe(sec);
    lenis.on('scroll', () => { if (on) update(); });
    window.addEventListener('resize', () => { measure(); update(); });
  });

  // Videos: source chosen and loaded on first approach, played only while on screen (still poster with reduced motion).
  const vidIo = new IntersectionObserver((es) => es.forEach((e) => {
    const v = e.target;
    if (e.isIntersecting) {
      if (!v.dataset.ready) {
        v.dataset.ready = '1';
        v.poster = v.dataset.poster;
        v.src = v.dataset.webm && (v.canPlayType('video/webm; codecs="vp9"') || !v.dataset.mp4) ? v.dataset.webm : v.dataset.mp4;
      }
      if (!reduce) v.play().catch(() => {});
    } else v.pause();
  }), { rootMargin: '30% 0px' });
  root.querySelectorAll('video[data-mp4]').forEach((v) => vidIo.observe(v));

  // YouTube: a still until it is clicked; the player (youtube-nocookie) is created only then.
  root.querySelectorAll('.pj__yt').forEach((sec) => {
    const im = sec.querySelector('img');
    const io = new IntersectionObserver((es) => {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      im.onerror = () => { im.onerror = null; im.src = im.dataset.fallback; };
      im.src = im.dataset.src;
    }, { rootMargin: '80% 0px' });
    io.observe(sec);
    sec.querySelector('button').addEventListener('click', () => {
      sec.innerHTML = `<iframe class="pj__frame" src="https://www.youtube-nocookie.com/embed/${sec.dataset.yt}?autoplay=1&rel=0&modestbranding=1" title="${sec.dataset.title}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    });
  });
}
