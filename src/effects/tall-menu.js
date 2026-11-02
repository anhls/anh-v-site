import '../styles/tall.css';
import data from '../data/data.json';
import { CONTACT, WORK_PTR } from '../timeline.js';
import { TALL_MENU as TM } from '../settings/tall.js';
import { transitionPolicy } from './transition-policy.js';
import { MENU_SWEEP, unsmooth, createMenuSmear } from './menu-smear.js';

// R24a / R48: the burger + full-screen menu of the tall mode (phones, tablet portrait).
// R48 layout: burger TOP-LEFT (two thin lines that pivot from their centre into an X), HCMC time top-right, two flavour lines at ~1/3 of the height, the nav (Clash Display,
// Capitalised, "→" before the current page) stacked lower-left above the big AV wordmark, which is the panel's bottom element (same place / size as the phone home's wordmark).
// R48 r6 motion: the open / close is the Home -> Work flight's PIXEL SWIPE, sideways (menu-smear.js): a full-height band sweeps left -> right on open (right -> left on close, twice as fast) and smears the page's own
// pictures under it with the flight's grid / strength / RGB split; behind the band the panel colour; the items blur in as the band passes their x. Reduced motion, ?gl=0, Save-Data, a weak device or no WebGL2 = a plain fade.
// Focus trap, Esc, aria, inert page as before (R46c modal lock untouched).
export const MENU_FX = { blurPx: 10, itemSec: 0.45 }; // R48 r6: the sweep itself (time, block size, strength, RGB split) is the Home -> Work flight's: menu-smear.js MENU_SWEEP (the close is twice as fast), HOME_FLIGHT + WORK_PTR; itemSec = how long an item takes to blur in

const hcmcTime = () => {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
  return `${p} GMT+7`;
};

export function mountTallMenu() {
  const about = data.about;
  const flavour = data.menu?.flavour || [];
  const wmSrc = data.hero.wordmark;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <button type="button" class="tmenu__btn" aria-label="Open menu" aria-expanded="false" aria-controls="tmenu"><span></span><span></span></button>
    <div class="tmenu" id="tmenu" role="dialog" aria-modal="true" aria-label="Menu" data-view="list" hidden>
      <div class="tmenu__panel">
        <address class="tmenu__time tmenu__fx" data-d="2" aria-label="Local time in Ho Chi Minh City"><span>HCMC, Vietnam</span><span class="tmenu__clock"></span></address>
        <p class="tmenu__flav tmenu__fx" data-d="0">${flavour.map((l) => `<span>${l}</span>`).join('')}</p>
        <ul class="tmenu__list tmenu__fx" data-d="1">
          <li><a href="/work/"><span class="tmenu__arr" aria-hidden="true" hidden></span>Work</a></li>
          <li><button type="button" class="tmenu__about-btn">About</button></li>
          ${CONTACT.email ? `<li><a href="mailto:${CONTACT.email}" data-contact>Contact</a></li>` : ''}
        </ul>
        <div class="tmenu__about"><p class="tmenu__label">${about.label}</p><p class="tmenu__text">${about.text}</p></div>
        <img class="tmenu__wm tmenu__fx" data-d="3" src="${wmSrc}" alt="" draggable="false">
      </div>
    </div>`;
  const btn = wrap.querySelector('.tmenu__btn'), menu = wrap.querySelector('.tmenu');
  const panel = menu.querySelector('.tmenu__panel'), timeEl = menu.querySelector('.tmenu__clock'), wmImg = menu.querySelector('.tmenu__wm');
  document.body.append(...wrap.children);

  const pageEls = () => [document.getElementById('app'), document.querySelector('a.wordmark'), document.querySelector('a.twm'), document.querySelector('nav.nav'), document.querySelector('.skip')].filter(Boolean);
  const focusables = () => (menu.dataset.view === 'about' ? [btn, menu.querySelector('.tmenu__text')] : [btn, ...menu.querySelectorAll('a[href], button')]);
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).get('gl') === '0';

  // ---- time: HCMC, 24 h, updates on the minute
  let timeT = 0;
  const tick = () => { timeEl.textContent = hcmcTime(); timeT = setTimeout(tick, 60000 - (Date.now() % 60000) + 50); };
  const stopTime = () => { clearTimeout(timeT); timeT = 0; };

  // ---- R48 r5: the menu's ink layout (nav cap top, the current-page line, the clock's right edge on the wordmark's V)
  const inkOf = (font, text) => { const c = document.createElement('canvas').getContext('2d'); c.font = font; const m = c.measureText(text), f = m.fontBoundingBoxAscent ?? 0, d = m.fontBoundingBoxDescent ?? 0; c.font = font.replace(/(\d+(?:\.\d+)?)px/, (_, n) => `${n * 10}px`); const g = c.measureText(text); return { fa: f, fd: d, adv: m.width, asc: g.actualBoundingBoxAscent / 10, left: g.actualBoundingBoxLeft / 10, right: g.actualBoundingBoxRight / 10 }; };
  let vInk = 0; // the V's right ink edge as a share of the wordmark image's width (scanned once from the picture itself)
  const scanV = () => {
    const go = () => { try { const w = 786, h = Math.max(1, Math.round(w * (wmImg.naturalHeight || 345) / (wmImg.naturalWidth || 1572))), c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(wmImg, 0, 0, w, h); const d = x.getImageData(0, 0, w, h).data; let r = -1; for (let i = w - 1; i >= 0 && r < 0; i--) for (let j = 0; j < h; j++) if (d[(j * w + i) * 4 + 3] > 40) { r = i; break; } vInk = r >= 0 ? (r + 1) / w : 0; placeMenu(); } catch { vInk = 0; } };
    if (wmImg.complete && wmImg.naturalWidth) go(); else wmImg.addEventListener('load', go, { once: true });
  };
  const placeMenu = () => {
    const W = innerWidth, H = innerHeight, vw = (n) => (n * W) / 100, links = [...menu.querySelectorAll('.tmenu__list a, .tmenu__list button')];
    if (!links.length) return;
    const cs = getComputedStyle(links[0]), font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, P = vw(TM.navPitchVw), k = inkOf(font, 'Work');
    const capOff = (P - (k.fa + k.fd)) / 2 + k.fa - k.asc; // from the top of a line to the top of its capitals
    const list = menu.querySelector('.tmenu__list');
    list.style.setProperty('--tm-pitch', `${P.toFixed(2)}px`);
    list.style.setProperty('--tm-list-top', `${(H * TM.navTopPct / 100 - capOff).toFixed(2)}px`);
    list.style.setProperty('--tm-line-y', `${(capOff + k.asc / 2 - TM.lineThickPx / 2).toFixed(2)}px`);
    list.style.setProperty('--tm-line-len', `${TM.lineLenPx}px`); list.style.setProperty('--tm-line-h', `${TM.lineThickPx}px`);
    links.forEach((a) => { const t = a.textContent.trim(), ik = inkOf(font, t), bear = -ik.left, has = a.querySelector('.tmenu__arr') && !a.querySelector('.tmenu__arr').hidden; a.style.marginLeft = `${(-bear).toFixed(2)}px`; a.style.paddingLeft = has ? `${(TM.lineLenPx + vw(TM.lineGapVw)).toFixed(2)}px` : ''; const ar = a.querySelector('.tmenu__arr'); if (ar) ar.style.left = `${bear.toFixed(2)}px`; });
    // the clock: its right ink edge on the V's right ink edge
    const time = menu.querySelector('.tmenu__time'), cs2 = getComputedStyle(time), f2 = `${cs2.fontWeight} ${cs2.fontSize} ${cs2.fontFamily}`, ls = parseFloat(cs2.letterSpacing) || 0;
    const hH = inkOf(f2, 'H'), lh = parseFloat(cs2.fontSize) * 1.5; // line-height 1.5, as the flavour text
    menu.style.setProperty('--tm-flav-top', `${(H * TM.flavTopPct / 100 - ((lh - (hH.fa + hH.fd)) / 2 + hH.fa - hH.asc)).toFixed(2)}px`);
    time.style.setProperty('--tm-clock-op', String(TM.clockOpacity));
    const vx = vInk ? vInk * wmImg.offsetWidth : wmImg.offsetWidth;
    time.style.setProperty('--tm-clock-right', `${(W - vx).toFixed(2)}px`);
    time.querySelectorAll('span').forEach((sp) => { const ik = inkOf(f2, sp.textContent || '0'); sp.style.transform = `translateX(${(ik.adv - ik.right + ls).toFixed(2)}px)`; });
  };
  document.fonts?.ready?.then(placeMenu); scanV();

  // ---- R48 r6: the sweep = the Home -> Work flight's pixel swipe, sideways (menu-smear.js). The renderer is made once, when the page is idle (the shader compile must not happen at the tap)
  let smear = null, smearTried = false, sweeping = false, pending = null;
  const canSmear = () => !reduced() && !navigator.connection?.saveData && transitionPolicy().enabled;
  const warmSmear = () => { if (smearTried || !canSmear()) return; smearTried = true; try { smear = createMenuSmear(); } catch { smear = null; } };
  (window.requestIdleCallback || ((fn) => setTimeout(fn, 1200)))(warmSmear, { timeout: 4000 });
  const setEdge = (px) => { panel.style.clipPath = px >= innerWidth ? 'none' : `inset(0 ${(innerWidth - px).toFixed(2)}px 0 0)`; };
  // each item blurs in as the band passes its x (and out as the band passes it again); the close is twice as fast
  const stagger = (open, sec) => {
    const W = innerWidth, lo = -W / 38, hi = W + W / 38;
    panel.querySelectorAll('.tmenu__fx').forEach((el) => {
      const r = el.getBoundingClientRect(), cx = r.width ? r.left + r.width / 2 : 0, along = open ? cx : W - cx;
      el.style.setProperty('--tm-delay', `${(unsmooth((along - lo) / (hi - lo)) * sec).toFixed(3)}s`);
      el.style.setProperty('--tm-dur', `${(open ? MENU_FX.itemSec : MENU_FX.itemSec / MENU_SWEEP.closeDiv).toFixed(3)}s`);
    });
  };
  const plainItems = () => panel.querySelectorAll('.tmenu__fx').forEach((el) => { el.style.removeProperty('--tm-delay'); el.style.removeProperty('--tm-dur'); });
  const bgColor = () => getComputedStyle(panel).backgroundColor;
  // ---- the big wordmark in the panel: when the page's own wordmark is small (project pages) it grows from there as the panel opens
  const placeWm = (toSmall) => {
    const real = document.querySelector('a.wordmark');
    wmImg.style.transition = 'none'; wmImg.style.transform = '';
    let small = '';
    if (real) {
      const a = real.getBoundingClientRect(), b = wmImg.getBoundingClientRect();
      if (a.width > 0 && b.width > 0 && a.width < b.width * 0.9) { wmImg.style.transformOrigin = '0 0'; small = `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width})`; }
    }
    if (!small) { wmImg.style.transition = ''; return; }
    if (!toSmall) wmImg.style.transform = small; // open: start small, grow to big
    void wmImg.offsetWidth;
    wmImg.style.transition = '';
    wmImg.style.transform = toSmall ? small : ''; // close: shrink to the page's own small wordmark
  };

  let open = false, hideT = 0;
  const finishSweep = () => { sweeping = false; if (pending) { const q = pending; pending = null; set(q[0], q[1]); } };
  const set = (on, view = 'list') => {
    if (sweeping && on !== open) { pending = [on, view]; return; } // (a tap during the sweep waits for it to end)
    if (on === open && menu.dataset.view === view) return;
    const wasOpen = open;
    open = on;
    btn.setAttribute('aria-expanded', String(on));
    btn.setAttribute('aria-label', on ? 'Close menu' : 'Open menu');
    document.documentElement.classList.toggle('tmenu-open', on);
    pageEls().forEach((el) => { if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert'); });
    clearTimeout(hideT);
    if (!on || !wasOpen) { warmSmear(); }
    const sw = !reduced() && canSmear() && smear && !smear.lost && !smear.playing;
    const secOpen = MENU_SWEEP.openSec, secClose = secOpen / MENU_SWEEP.closeDiv;
    if (on) {
      if (wasOpen) { menu.dataset.view = view; (menu.querySelector(view === 'about' ? '.tmenu__text' : 'a[href], button') || btn).focus({ preventScroll: true }); return; }
      menu.querySelector('.tmenu__arr').hidden = !/^\/work\/?$/.test(location.pathname); // the current-page line: only on the Work page itself
      tick();
      menu.classList.toggle('is-plain', !sw);
      if (sw) setEdge(0); else panel.style.clipPath = 'none';
      menu.hidden = false; menu.dataset.view = view; placeMenu();
      if (sw) { placeWm(false); stagger(true, secOpen); } else plainItems();
      void menu.offsetWidth;
      menu.classList.add('is-open');
      if (sw) {
        sweeping = true;
        if (!smear.play({ open: true, sec: secOpen, bg: bgColor(), onEdge: setEdge, onDone: finishSweep })) { sweeping = false; menu.classList.add('is-plain'); panel.style.clipPath = 'none'; plainItems(); }
      }
      (menu.querySelector(view === 'about' ? '.tmenu__text' : 'a[href], button') || btn).focus({ preventScroll: true });
    } else {
      const done = () => { if (!open) { menu.hidden = true; stopTime(); } };
      menu.classList.toggle('is-plain', !sw);
      if (sw) { stagger(false, secClose); placeWm(true); }
      menu.classList.remove('is-open');
      if (!sw) { plainItems(); hideT = setTimeout(done, 260); }
      else {
        sweeping = true; setEdge(innerWidth);
        if (!smear.play({ open: false, sec: secClose, bg: bgColor(), onEdge: setEdge, onDone: () => { done(); finishSweep(); } })) { sweeping = false; menu.classList.add('is-plain'); plainItems(); hideT = setTimeout(done, 260); }
      }
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
  addEventListener('resize', () => { placeMenu(); });
  // R45b: close with no animation (the Home -> Work flight starts from the tapped link and IS the transition)
  const closeNow = () => { smear?.cancel(); sweeping = false; pending = null; clearTimeout(hideT); open = false; btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', 'Open menu'); document.documentElement.classList.remove('tmenu-open'); pageEls().forEach((el) => el.removeAttribute('inert')); menu.classList.remove('is-open'); menu.hidden = true; stopTime(); };
  return { open: () => set(true), close: () => set(false), closeNow, isOpen: () => open, link: menu.querySelector('a[href="/work/"]') };
}
