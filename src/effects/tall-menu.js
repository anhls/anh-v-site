import '../styles/tall.css';
import data from '../data/data.json';
import { CONTACT, WORK_PTR } from '../timeline.js';

// R24a / R48: the burger + full-screen menu of the tall mode (phones, tablet portrait).
// R48 layout: burger TOP-LEFT (two thin lines that pivot from their centre into an X), HCMC time top-right, two flavour lines at ~1/3 of the height, the nav (Clash Display,
// Capitalised, "→" before the current page) stacked lower-left above the big AV wordmark, which is the panel's bottom element (same place / size as the phone home's wordmark).
// R48 motion: a SIDEWAYS PIXEL SWIPE (open = a ragged, blocky front sweeps left -> right, close = right -> left; the cells are the Work hover-smear grid's size, WORK_PTR.pixelGrid
// columns) while the page behind blurs out and the menu content blurs in, staggered (flavour + nav, then time, wordmark last). Time-based (rAF + performance.now); the front is
// exactly the full panel / nothing at rest. Reduced motion or ?gl=0 = a plain fade. Focus trap, Esc, aria, inert page as before (R46c modal lock untouched).
// Known difference: the front is a stepped clip of the panel plus a faint veil one band ahead; the page pixels themselves are not displaced (a DOM page cannot be sampled
// by the grid shader the way the Work pictures are).
export const MENU_FX = { sec: 0.55, closeSec: 0.5, band: 0.34, veil: 0.1, blurPx: 10, pageBlurPx: 8 }; // band = ragged front depth (share of the width); veil = the faint lead band opacity

const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2); // in-out cubic
const hcmcTime = () => {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
  return `HCMC, ${p}`;
};

export function mountTallMenu() {
  const about = data.about;
  const flavour = data.menu?.flavour || [];
  const path = location.pathname.replace(/\/+$/, '');
  const onWork = path === '/work';
  const wmSrc = data.hero.wordmark;
  const arrow = '<span class="tmenu__arr" aria-hidden="true">→</span>';
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <button type="button" class="tmenu__btn" aria-label="Open menu" aria-expanded="false" aria-controls="tmenu"><span></span><span></span></button>
    <div class="tmenu" id="tmenu" role="dialog" aria-modal="true" aria-label="Menu" data-view="list" hidden>
      <div class="tmenu__veil" aria-hidden="true"></div>
      <div class="tmenu__panel">
        <time class="tmenu__time tmenu__fx" data-d="2" aria-label="Local time in Ho Chi Minh City"></time>
        <p class="tmenu__flav tmenu__fx" data-d="0">${flavour.map((l) => `<span>${l}</span>`).join('')}</p>
        <ul class="tmenu__list tmenu__fx" data-d="1">
          <li><a href="/work/">${onWork ? arrow : ''}Work</a></li>
          <li><button type="button" class="tmenu__about-btn">About</button></li>
          ${CONTACT.email ? `<li><a href="mailto:${CONTACT.email}" data-contact>Contact</a></li>` : ''}
        </ul>
        <div class="tmenu__about"><p class="tmenu__label">${about.label}</p><p class="tmenu__text">${about.text}</p></div>
        <img class="tmenu__wm tmenu__fx" data-d="3" src="${wmSrc}" alt="" draggable="false">
      </div>
    </div>`;
  const btn = wrap.querySelector('.tmenu__btn'), menu = wrap.querySelector('.tmenu');
  const panel = menu.querySelector('.tmenu__panel'), veil = menu.querySelector('.tmenu__veil'), timeEl = menu.querySelector('.tmenu__time'), wmImg = menu.querySelector('.tmenu__wm');
  document.body.append(...wrap.children);
  const pageEls = () => [document.getElementById('app'), document.querySelector('a.wordmark'), document.querySelector('a.twm'), document.querySelector('nav.nav'), document.querySelector('.skip')].filter(Boolean);
  const focusables = () => (menu.dataset.view === 'about' ? [btn, menu.querySelector('.tmenu__text')] : [btn, ...menu.querySelectorAll('a[href], button')]);
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).get('gl') === '0';

  // ---- time: HCMC, 24 h, updates on the minute
  let timeT = 0;
  const tick = () => { timeEl.textContent = hcmcTime(); timeEl.dateTime = new Date().toISOString(); timeT = setTimeout(tick, 60000 - (Date.now() % 60000) + 50); };
  const stopTime = () => { clearTimeout(timeT); timeT = 0; };

  // ---- the pixel swipe front
  let raf = 0, p = 0, anim = null, cols = 0, rows = 0, W = 0, H = 0, cell = 1;
  const geom = () => { W = innerWidth; H = innerHeight; cols = Math.max(8, Math.round(WORK_PTR.pixelGrid)); cell = W / cols; rows = Math.max(4, Math.round(H / cell)); };
  const clip = (q, lead) => {
    // per row: the edge = q x (W + band) - band x h(row), snapped to whole cells; q 0 = nothing, q 1 = the whole panel (exactly). lead = the region AHEAD of the front (the veil)
    if (!lead && q <= 0) return 'polygon(0 0, 0 0, 0 0)';
    if (!lead && q >= 1) return 'none';
    const B = MENU_FX.band * W, rh = H / rows, pts = [];
    const edge = (r) => { const h = hash(r); let e = q * (W + B) - B * h; e = Math.round(e / cell) * cell; return Math.max(0, Math.min(W, e)); };
    pts.push(lead ? `${W}px 0` : '0 0');
    for (let r = 0; r < rows; r++) { const e = edge(r); pts.push(`${e}px ${r * rh}px`, `${e}px ${(r + 1) * rh}px`); }
    pts.push(lead ? `${W}px ${H}px` : `0 ${H}px`);
    return `polygon(${pts.join(',')})`;
  };
  const draw = (q) => {
    p = q;
    panel.style.clipPath = clip(q, false);
    veil.style.clipPath = q > 0 && q < 1 ? clip(q, true) : 'polygon(0 0, 0 0, 0 0)';
    veil.style.opacity = q > 0 && q < 1 ? String(Math.min(1, q * 6, (1 - q) * 6 + 0.2)) : '0';
  };
  const run = (to, sec, onDone) => {
    cancelAnimationFrame(raf);
    const from = p, t0 = performance.now(), dur = Math.max(0.05, sec * Math.abs(to - from)) * 1000;
    const step = (now) => {
      const u = Math.min(1, (now - t0) / dur);
      draw(from + (to - from) * ease(u));
      if (u < 1) raf = requestAnimationFrame(step); else { draw(to); onDone?.(); }
    };
    raf = requestAnimationFrame(step);
  };

  // ---- the big wordmark in the panel: when the page's own wordmark is small (project pages) it grows from there as the panel opens
  const placeWm = () => {
    const real = document.querySelector('a.wordmark');
    wmImg.style.transition = 'none'; wmImg.style.transform = '';
    if (!real) return;
    const a = real.getBoundingClientRect(), b = wmImg.getBoundingClientRect();
    if (a.width > 0 && b.width > 0 && a.width < b.width * 0.9) {
      const s = a.width / b.width;
      wmImg.style.transformOrigin = '0 0';
      wmImg.style.transform = `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${s})`;
    }
    void wmImg.offsetWidth;
    wmImg.style.transition = '';
  };

  let open = false, hideT = 0;
  const set = (on, view = 'list') => {
    if (on === open && menu.dataset.view === view) return;
    const wasOpen = open;
    open = on;
    btn.setAttribute('aria-expanded', String(on));
    btn.setAttribute('aria-label', on ? 'Close menu' : 'Open menu');
    document.documentElement.classList.toggle('tmenu-open', on);
    pageEls().forEach((el) => { if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert'); });
    clearTimeout(hideT);
    const plain = reduced();
    menu.classList.toggle('is-plain', plain);
    if (on) {
      if (wasOpen) { menu.dataset.view = view; (menu.querySelector(view === 'about' ? '.tmenu__text' : 'a[href], button') || btn).focus({ preventScroll: true }); return; }
      geom(); tick();
      menu.hidden = false; menu.dataset.view = view;
      if (!plain) { draw(0); placeWm(); }
      void menu.offsetWidth;
      menu.classList.add('is-open');
      if (plain) { panel.style.clipPath = 'none'; veil.style.opacity = '0'; }
      else run(1, MENU_FX.sec);
      (menu.querySelector(view === 'about' ? '.tmenu__text' : 'a[href], button') || btn).focus({ preventScroll: true });
    } else {
      menu.classList.remove('is-open');
      const done = () => { if (!open) { menu.hidden = true; stopTime(); } };
      if (plain) hideT = setTimeout(done, 260); else { placeWm(); run(0, MENU_FX.closeSec, done); }
      btn.focus({ preventScroll: true });
    }
  };
  btn.addEventListener('click', () => set(!open));
  menu.querySelector('.tmenu__about-btn').addEventListener('click', () => set(true, 'about'));
  menu.querySelector('.tmenu__text').tabIndex = -1;
  addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); set(false); return; }
    if (e.key !== 'Tab') return;
    const f = focusables(), i = f.indexOf(document.activeElement);
    e.preventDefault();
    f[i < 0 ? 0 : (i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
  });
  addEventListener('resize', () => { if (open || p > 0) { geom(); if (p > 0 && p < 1) draw(p); } });
  // R45b: close with no animation (the Home -> Work flight starts from the tapped link and IS the transition)
  const closeNow = () => { cancelAnimationFrame(raf); clearTimeout(hideT); open = false; p = 0; btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', 'Open menu'); document.documentElement.classList.remove('tmenu-open'); pageEls().forEach((el) => el.removeAttribute('inert')); menu.classList.remove('is-open'); menu.hidden = true; stopTime(); };
  return { open: () => set(true), close: () => set(false), closeNow, isOpen: () => open, link: menu.querySelector('a[href="/work/"]') };
}
