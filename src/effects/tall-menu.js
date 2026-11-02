import '../styles/tall.css';
import data from '../data/data.json';
import { CONTACT } from '../timeline.js';
import { TALL_MENU as TM } from '../settings/tall.js';
import { transitionPolicy } from './transition-policy.js';
import { MENU_SWEEP, frontTime, sweepGeom, gridBlockPx, createMenuSmear } from './menu-smear.js';
import { getWm } from '../util/wm-handle.js';
import { weakReason } from '../util/device.js';

// R24a / R48: the burger + full-screen menu of the tall mode (phones, tablet portrait).
// Layout (R48 r5, placed by ink in placeMenu()): burger TOP-LEFT (two thin lines that pivot into an X), two flavour lines, the clock (two right-aligned lines on the flavour rows, right ink edge on the big wordmark's V),
// the nav (Clash Display, Capitalised) with a thin LINE before the current page (it draws out from the left and pushes the word).
// R48 r7 motion: the open / close is the Home -> Work flight's PIXEL SWIPE language, sideways (menu-smear.js): a wide SMEAR ZONE travels ahead of a per-row ragged panel edge (left -> right on open, the exact reverse,
// twice as fast, on close). The items blur in one after the other once the edge has passed TM.startShare of the width: flavour 1, flavour 2, clock, Work, About, Contact, then the line push (close = the exact reverse).
// Tapping Contact moves the line to Contact (the card opens as that finishes; it moves back when the card closes). There is NO wordmark in the panel: the page's own single wordmark is above everything
// (z-index in tall.css); on the pages where it is small (Work, projects) the menu grows THAT element small -> big on open (big -> small on close). Reduced motion, ?gl=0, Save-Data, a weak device or no WebGL2 = a plain fade.
export const MENU_FX = { blurPx: 10, itemSec: 0.45 }; // itemSec = how long an item takes to blur in; the sweep itself (time, block size, strength, RGB split) is menu-smear.js MENU_SWEEP + HOME_FLIGHT + WORK_PTR

const hcmcTime = () => {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
  return `${p} GMT+7`;
};
const sm = (q) => { q = Math.min(1, Math.max(0, q)); return q * q * (3 - 2 * q); };

export function mountTallMenu() {
  const about = data.about;
  const flavour = data.menu?.flavour || [];
  const wmSrc = data.hero.wordmark;
  const wrap = document.createElement('div');
  const li = (inner) => `<li class="tmenu__fx">${inner}</li>`, arr = '<span class="tmenu__arr" aria-hidden="true"></span>';
  wrap.innerHTML = `
    <button type="button" class="tmenu__btn" aria-label="Open menu" aria-expanded="false" aria-controls="tmenu"><span></span><span></span></button>
    <div class="tmenu" id="tmenu" role="dialog" aria-modal="true" aria-label="Menu" data-view="list" hidden>
      <div class="tmenu__panel">
        <address class="tmenu__time tmenu__fx" aria-label="Local time in Ho Chi Minh City"><span>HCMC, Vietnam</span><span class="tmenu__clock"></span></address>
        <p class="tmenu__flav">${flavour.map((l) => `<span class="tmenu__fx">${l}</span>`).join('')}</p>
        <ul class="tmenu__list">
          ${li(`<a href="/work/">${arr}<span class="tmenu__w">Work</span></a>`)}
          ${li(`<button type="button" class="tmenu__about-btn">${arr}<span class="tmenu__w">About</span></button>`)}
          ${CONTACT.email ? li(`<a href="mailto:${CONTACT.email}" data-contact>${arr}<span class="tmenu__w">Contact</span></a>`) : ''}
        </ul>
        <div class="tmenu__about"><p class="tmenu__label">${about.label}</p><p class="tmenu__text">${about.text}</p></div>
      </div>
    </div>`;
  const btn = wrap.querySelector('.tmenu__btn'), menu = wrap.querySelector('.tmenu');
  const panel = menu.querySelector('.tmenu__panel'), timeEl = menu.querySelector('.tmenu__clock');
  document.body.append(...wrap.children);
  const workLink = menu.querySelector('a[href="/work/"]'), contactLink = menu.querySelector('a[data-contact]');
  if (contactLink) contactLink.dataset.contactWait = String(Math.round(TM.pushSec * 600)); // the card starts as the line push is ~60 % done

  const pageEls = () => [document.getElementById('app'), document.querySelector('a.wordmark'), document.querySelector('a.twm'), document.querySelector('nav.nav'), document.querySelector('.skip')].filter(Boolean);
  const focusables = () => (menu.dataset.view === 'about' ? [btn, menu.querySelector('.tmenu__text')] : [btn, ...menu.querySelectorAll('a[href], button')]);
  const params = new URLSearchParams(location.search);
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || params.get('gl') === '0';

  // ---- time: HCMC, 24 h, updates on the minute
  let timeT = 0;
  const tick = () => { timeEl.textContent = hcmcTime(); timeT = setTimeout(tick, 60000 - (Date.now() % 60000) + 50); };
  const stopTime = () => { clearTimeout(timeT); timeT = 0; };

  // ---- the menu's ink layout (nav cap top, the current-page line, the clock's right edge on the wordmark's V)
  const inkOf = (font, text) => { const c = document.createElement('canvas').getContext('2d'); c.font = font; const m = c.measureText(text), f = m.fontBoundingBoxAscent ?? 0, d = m.fontBoundingBoxDescent ?? 0; c.font = font.replace(/(\d+(?:\.\d+)?)px/, (_, n) => `${n * 10}px`); const g = c.measureText(text); return { fa: f, fd: d, adv: m.width, asc: g.actualBoundingBoxAscent / 10, left: g.actualBoundingBoxLeft / 10, right: g.actualBoundingBoxRight / 10 }; };
  let vInk = 0; // the V's right ink edge as a share of the wordmark image's width (scanned once from the picture itself; the big wordmark is 81.875vw wide at x 0)
  const scanV = () => {
    const im = new Image();
    im.onload = () => { try { const w = 786, h = Math.max(1, Math.round(w * (im.naturalHeight || 345) / (im.naturalWidth || 1572))), c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, w, h); const d = x.getImageData(0, 0, w, h).data; let r = -1; for (let i = w - 1; i >= 0 && r < 0; i--) for (let j = 0; j < h; j++) if (d[(j * w + i) * 4 + 3] > 40) { r = i; break; } vInk = r >= 0 ? (r + 1) / w : 0; placeMenu(); } catch { vInk = 0; } };
    im.src = wmSrc;
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
    list.style.setProperty('--tm-word-shift', `${(TM.lineLenPx + vw(TM.lineGapVw)).toFixed(2)}px`); // the word's rest position after the line (line + gap)
    links.forEach((a) => { const ik = inkOf(font, a.textContent.trim()), bear = -ik.left; a.style.marginLeft = `${(-bear).toFixed(2)}px`; const ar = a.querySelector('.tmenu__arr'); if (ar) ar.style.left = `${bear.toFixed(2)}px`; });
    // the clock: its right ink edge on the V's right ink edge
    const time = menu.querySelector('.tmenu__time'), cs2 = getComputedStyle(time), f2 = `${cs2.fontWeight} ${cs2.fontSize} ${cs2.fontFamily}`, ls = parseFloat(cs2.letterSpacing) || 0;
    const hH = inkOf(f2, 'H'), lh = parseFloat(cs2.fontSize) * 1.5; // line-height 1.5, as the flavour text
    menu.style.setProperty('--tm-flav-top', `${(H * TM.flavTopPct / 100 - ((lh - (hH.fa + hH.fd)) / 2 + hH.fa - hH.asc)).toFixed(2)}px`);
    time.style.setProperty('--tm-clock-op', String(TM.clockOpacity));
    const vx = (vInk || 1) * 0.81875 * W;
    time.style.setProperty('--tm-clock-right', `${(W - vx).toFixed(2)}px`);
    time.querySelectorAll('span').forEach((sp) => { const ik = inkOf(f2, sp.textContent || '0'); sp.style.transform = `translateX(${(ik.adv - ik.right + ls).toFixed(2)}px)`; });
  };
  document.fonts?.ready?.then(placeMenu); scanV();

  // ---- the sweep (menu-smear.js). The renderer is made once, when the page is idle (the shader compile must not happen at the tap)
  let smear = null, smearTried = false, smearWhy = '', sweeping = false, pending = null;
  const noSmearReason = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced motion' : params.get('gl') === '0' ? '?gl=0' : navigator.connection?.saveData ? 'Save-Data' : !transitionPolicy().enabled ? 'transition policy off (weak device)' : weakReason() ? `weak device (${weakReason()})` : '');
  const warmSmear = () => {
    if (smearTried) return; smearTried = true;
    smearWhy = noSmearReason(); if (smearWhy) return;
    try { smear = createMenuSmear(); } catch (e) { smear = null; smearWhy = `renderer error: ${e.message}`; }
    if (!smear && !smearWhy) smearWhy = 'no WebGL2';
  };
  (window.requestIdleCallback || ((fn) => setTimeout(fn, 1200)))(warmSmear, { timeout: 4000 });
  const useSweep = () => { warmSmear(); const r = noSmearReason(); if (r) { smearWhy = r; return false; } if (smear && smear.lost) { smearWhy = 'WebGL context lost'; return false; } return !!smear && !smear.playing; };

  // the items, in Anh's order: flavour 1, flavour 2, clock, Work, About, Contact; then the line push
  const items = () => [...menu.querySelectorAll('.tmenu__flav .tmenu__fx'), menu.querySelector('.tmenu__time'), ...menu.querySelectorAll('.tmenu__list > li')];
  const plan = (open) => {
    const W = innerWidth, t30 = frontTime(TM.startShare * W, MENU_SWEEP.openSec), list = items(), D = MENU_SWEEP.closeDiv;
    const wins = list.map((el, i) => ({ el, a: t30 + i * TM.step, b: t30 + i * TM.step + MENU_FX.itemSec }));
    const push = { a: t30 + list.length * TM.step, b: t30 + list.length * TM.step + TM.pushSec };
    const T = Math.max(MENU_SWEEP.openSec, push.b, ...wins.map((w) => w.b));
    const at = (w) => (open ? { d: w.a, u: w.b - w.a } : { d: (T - w.b) / D, u: (w.b - w.a) / D }); // close = the exact reverse, twice as fast
    wins.forEach((w) => { const q = at(w); w.el.style.setProperty('--tm-delay', `${q.d.toFixed(3)}s`); w.el.style.setProperty('--tm-dur', `${q.u.toFixed(3)}s`); });
    const pq = at(push);
    return { T, push: pq, bandDelay: open ? 0 : (T - MENU_SWEEP.openSec) / D };
  };
  const plainItems = () => panel.querySelectorAll('.tmenu__fx').forEach((el) => { el.style.removeProperty('--tm-delay'); el.style.removeProperty('--tm-dur'); });

  // ---- the current-page line: .is-cur on a link = the line drawn out and the word pushed to its rest position (CSS transitions with the same duration / ease, so the word follows the line's tip)
  let curLink = null; // the link that has the line at rest (Work on /work/, none on Home)
  const links = () => [...menu.querySelectorAll('.tmenu__list a, .tmenu__list button')];
  const lineMove = (el, on, delay, dur) => { el.style.setProperty('--tm-push-delay', `${delay.toFixed(3)}s`); el.style.setProperty('--tm-push-dur', `${dur.toFixed(3)}s`); el.classList.toggle('is-cur', on); };
  const lineNow = () => links().forEach((a) => { a.style.setProperty('--tm-push-delay', '0s'); a.style.setProperty('--tm-push-dur', '0s'); a.classList.remove('is-cur'); });
  let fromMenu = false;
  document.addEventListener('contact:tap', (e) => { // Contact tapped in the open menu: the line pulls back from the current word and draws out before Contact (one move, the same duration / ease)
    if (!open || !contactLink || e.detail !== contactLink || fromMenu) return;
    fromMenu = true; const dur = reduced() ? 0 : TM.pushSec;
    if (curLink) lineMove(curLink, false, 0, dur);
    lineMove(contactLink, true, 0, dur);
  });
  document.addEventListener('contact:closing', () => { // the card closes: the line moves back
    if (!fromMenu) return; fromMenu = false; const dur = reduced() ? 0 : TM.pushSec;
    if (contactLink) lineMove(contactLink, false, 0, dur);
    if (curLink) lineMove(curLink, true, 0, dur);
  });

  // ---- the page's text (Work: title, counter, year, tags) fades out under the smear zone as the edge reaches it, and back in when the zone leaves it
  let textEls = [];
  const collectText = () => {
    const rc = (el) => { const r = el?.getBoundingClientRect(); return r && r.width ? r.left + r.width / 2 : null; };
    textEls = [['.lite-title__text', '.lite-title'], ['.td__year'], ['.td__tags'], ['.td__counter']].map(([probe, target]) => { const p = document.querySelector(probe), t = target ? document.querySelector(target) : p; const cx = rc(p); return cx == null || !t ? null : { t, cx }; }).filter(Boolean);
  };
  const fadeText = (f) => { const Z = sweepGeom().zone; textEls.forEach((q) => { q.t.style.setProperty('--tm-fade', String(sm((q.cx - (f - sweepGeom().jag / 2)) / (Z * 0.8)).toFixed(3))); }); };
  const restoreText = () => { textEls.forEach((q) => q.t.style.removeProperty('--tm-fade')); textEls = []; };

  // ---- the page's own wordmark (Work / project pages: small, top centre) grows small -> big as the menu opens, big -> small as it closes (the same element; Home's big one is not touched)
  let wmRaf = 0;
  const wmRun = (toBig, sec, delay) => {
    const h = getWm(); if (!h) return; cancelAnimationFrame(wmRaf);
    const from = h.p, to = toBig ? 0 : 1; if (Math.abs(from - to) < 0.001) return;
    const t0 = performance.now() + delay * 1000;
    const step = (now) => { const u = Math.min(1, Math.max(0, (now - t0) / (sec * 1000))); h.drive(from + (to - from) * sm(u)); if (u < 1) wmRaf = requestAnimationFrame(step); };
    wmRaf = requestAnimationFrame(step);
  };

  let open = false, hideT = 0;
  const finishSweep = () => { sweeping = false; restoreText(); if (pending) { const q = pending; pending = null; set(q[0], q[1]); } };
  const afterReflow = (fn) => { void menu.offsetWidth; fn(); };
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
    const sw = !(on && wasOpen) && useSweep();
    const secOpen = MENU_SWEEP.openSec, secClose = secOpen / MENU_SWEEP.closeDiv;
    if (on) {
      if (wasOpen) { menu.dataset.view = view; (menu.querySelector(view === 'about' ? '.tmenu__text' : 'a[href], button') || btn).focus({ preventScroll: true }); return; }
      curLink = /^\/work\/?$/.test(location.pathname) ? workLink : null; fromMenu = false;
      tick();
      menu.classList.toggle('is-plain', !sw);
      lineNow();
      if (sw) panel.style.clipPath = 'polygon(0 0, 0 0, 0 0)'; else panel.style.clipPath = 'none';
      menu.hidden = false; menu.dataset.view = view; placeMenu();
      let pl = null;
      if (sw) { pl = plan(true); collectText(); } else plainItems();
      afterReflow(() => {
        menu.classList.add('is-open');
        if (curLink) { if (sw) lineMove(curLink, true, pl.push.d, pl.push.u); else { lineMove(curLink, true, 0, 0); } }
      });
      if (sw) {
        sweeping = true; wmRun(true, secOpen, 0);
        const ok = smear.play({ open: true, sec: secOpen, onFrame: ({ clip, f }) => { panel.style.clipPath = clip; fadeText(f); }, onDone: finishSweep });
        if (!ok) { sweeping = false; restoreText(); menu.classList.add('is-plain'); panel.style.clipPath = 'none'; plainItems(); wmRun(true, 0.25, 0); }
      } else wmRun(true, 0.25, 0);
      (menu.querySelector(view === 'about' ? '.tmenu__text' : 'a[href], button') || btn).focus({ preventScroll: true });
    } else {
      const done = () => { if (!open) { menu.hidden = true; stopTime(); lineNow(); } };
      menu.classList.toggle('is-plain', !sw);
      fromMenu = false;
      if (sw) {
        const pl = plan(false); collectText();
        links().forEach((a) => { if (a.classList.contains('is-cur')) lineMove(a, false, pl.push.d, pl.push.u); });
        menu.classList.remove('is-open');
        sweeping = true; panel.style.clipPath = 'none'; wmRun(false, secClose, pl.bandDelay);
        const ok = smear.play({ open: false, sec: secClose, delay: pl.bandDelay, onFrame: ({ clip, f }) => { panel.style.clipPath = clip; fadeText(f); }, onDone: () => { done(); finishSweep(); } });
        if (!ok) { sweeping = false; restoreText(); menu.classList.add('is-plain'); plainItems(); hideT = setTimeout(done, 260); wmRun(false, 0.25, 0); }
      } else { plainItems(); menu.classList.remove('is-open'); hideT = setTimeout(done, 260); wmRun(false, 0.25, 0); }
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
  const closeNow = () => { smear?.cancel(); sweeping = false; pending = null; restoreText(); clearTimeout(hideT); cancelAnimationFrame(wmRaf); open = false; btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', 'Open menu'); document.documentElement.classList.remove('tmenu-open'); pageEls().forEach((el) => el.removeAttribute('inert')); menu.classList.remove('is-open'); menu.hidden = true; stopTime(); lineNow(); };

  // ---- ?debug=menu: what the sweep does on this device (for Anh's phone)
  if (params.get('debug') === 'menu') {
    const box = document.createElement('pre');
    box.style.cssText = 'position:fixed;left:4px;right:4px;top:60px;z-index:99999;margin:0;padding:6px 8px;background:rgba(0,0,0,.78);color:#9f9;font:10px/1.35 ui-monospace,Menlo,monospace;pointer-events:none;white-space:pre-wrap';
    document.body.append(box);
    const show = () => {
      const r = noSmearReason(), st = smear?.stats, g = sweepGeom();
      box.textContent = [`smear: ${smear && !r ? 'ON' : 'FALLBACK (plain fade)'}${r ? ' - ' + r : smear ? '' : ' - ' + (smearTried ? smearWhy || 'renderer not made' : 'renderer not made yet (idle)')}`,
        `GL context: ${smear ? (smear.lost ? 'LOST' : 'ok') : '-'}   canvas dpr ${smear ? smear.dpr.toFixed(2) : '-'} (device ${devicePixelRatio})`,
        `grid: ${gridBlockPx().toFixed(2)} px blocks   zone: ${g.zone.toFixed(0)} px   jag: ${g.jag.toFixed(0)} px   sweep ${MENU_SWEEP.openSec.toFixed(2)} s / close ${(MENU_SWEEP.openSec / MENU_SWEEP.closeDiv).toFixed(2)} s`,
        `last sweep: ${st && st.frames ? `${st.frames} frames, ${st.avgMs.toFixed(1)} ms avg, ${st.maxMs.toFixed(1)} ms max` : '-'}`].join('\n');
    };
    setInterval(show, 300); show();
  }
  return { open: () => set(true), close: () => set(false), closeNow, isOpen: () => open, link: workLink };
}
