import { gsap } from 'gsap';
import '../styles/tall.css';
import data from '../data/data.json';
import { CONTACT } from '../timeline.js';
import { TALL_MENU as TM } from '../settings/tall.js';
import { transitionPolicy } from './transition-policy.js';
import { MENU_SWEEP, frontTime, sweepGeom, gridBlockPx, createMenuSmear, outEase } from './menu-smear.js';
import { getWm, wmState } from '../util/wm-handle.js';
import { setPagePaused, isPagePaused } from '../util/page-pause.js';
import { weakReason } from '../util/device.js';
import { writeMenuHome, clearMenuHome } from './menu-home.js';
import { offList } from '../util/off.js';

// R24a / R48: the burger + full-screen menu of the tall mode (phones, tablet portrait).
// Layout (R48 r5, placed by ink in placeMenu()): burger TOP-LEFT (two thin lines that pivot into an X), two flavour lines, the clock (two right-aligned lines on the flavour rows, right ink edge on the big wordmark's V),
// the nav (Clash Display, Capitalised) with a thin LINE before the current page (it draws out from the left and pushes the word).
// R48 r7 motion: the open / close is the Home -> Work flight's PIXEL SWIPE language, sideways (menu-smear.js): a wide SMEAR ZONE travels ahead of a per-row ragged panel edge (left -> right on open, the exact reverse,
// twice as fast, on close). The items blur in one after the other once the edge has passed TM.startShare of the width: flavour 1, flavour 2, clock, Work, About, Contact, then the line push (close = the exact reverse).
// Tapping Contact moves the line to Contact (the card opens as that finishes; it moves back when the card closes). There is NO wordmark in the panel: the page's own single wordmark is above everything
// (z-index in tall.css); on the pages where it is small (Work, projects) the menu grows THAT element small -> big on open (big -> small on close). Reduced motion, ?gl=0, Save-Data, a weak device or no WebGL2 = a plain fade.
const PAUSE_SHARE = 0.3; // R48 r14

let hcmcFmt = null; // (made once: constructing an Intl formatter costs ~10 ms on a phone, never in the tap frame)
const hcmcTime = () => {
  const p = (hcmcFmt ||= new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })).format(new Date());
  return `${p} GMT+7`;
};
const sm = (q) => { q = Math.min(1, Math.max(0, q)); return q * q * (3 - 2 * q); };
let inkCtx;

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
  menu.setAttribute('inert', ''); // (closed: laid out + composited but invisible, not focusable)
  const panel = menu.querySelector('.tmenu__panel'), timeEl = menu.querySelector('.tmenu__clock');
  document.body.append(...wrap.children);
  const workLink = menu.querySelector('a[href="/work/"]'), contactLink = menu.querySelector('a[data-contact]');
  if (contactLink) contactLink.dataset.contactWait = String(Math.round(TM.pushSec * 600)); // the card starts as the line push is ~60 % done

  // R52: the page's ONE wordmark is NOT locked: while the menu is open it is the link Home (it is above the menu, big at the bottom)
  const pageEls = () => [document.getElementById('app'), document.querySelector('nav.nav'), document.querySelector('.skip')].filter(Boolean);
  const homeWm = () => getWm()?.el || document.querySelector('a.twm');
  const focusables = () => (menu.dataset.view === 'about' ? [btn, menu.querySelector('.tmenu__text'), homeWm()] : [btn, ...menu.querySelectorAll('a[href], button'), homeWm()]).filter(Boolean);
  const wmLabel = (on) => homeWm()?.setAttribute('aria-label', on ? 'Home' : 'Anh V, home');
  const params = new URLSearchParams(location.search);
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || params.get('gl') === '0';

  // ---- time: HCMC, 24 h, updates on the minute
  let timeT = 0;
  const tick = () => { timeEl.textContent = hcmcTime(); timeT = setTimeout(tick, 60000 - (Date.now() % 60000) + 50); };
  const stopTime = () => { clearTimeout(timeT); timeT = 0; };

  // ---- the menu's ink layout (nav cap top, the current-page line, the clock's right edge on the wordmark's V)
  const inkOf = (font, text) => { const c = (inkCtx ||= document.createElement('canvas').getContext('2d')); c.font = font; const m = c.measureText(text), f = m.fontBoundingBoxAscent ?? 0, d = m.fontBoundingBoxDescent ?? 0; c.font = font.replace(/(\d+(?:\.\d+)?)px/, (_, n) => `${n * 10}px`); const g = c.measureText(text); return { fa: f, fd: d, adv: m.width, asc: g.actualBoundingBoxAscent / 10, left: g.actualBoundingBoxLeft / 10, right: g.actualBoundingBoxRight / 10 }; };
  let vInk = 0; // the V's right ink edge as a share of the wordmark image's width (scanned once from the picture itself; the big wordmark is 81.875vw wide at x 0)
  const scanV = () => {
    const im = new Image();
    im.onload = () => { try { const w = 786, h = Math.max(1, Math.round(w * (im.naturalHeight || 345) / (im.naturalWidth || 1572))), c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, w, h); const d = x.getImageData(0, 0, w, h).data; let r = -1; for (let i = w - 1; i >= 0 && r < 0; i--) for (let j = 0; j < h; j++) if (d[(j * w + i) * 4 + 3] > 40) { r = i; break; } vInk = r >= 0 ? (r + 1) / w : 0; placeMenu(); } catch { vInk = 0; } };
    im.src = wmSrc;
  };
  let placedKey = '';
  const placeMenu = (force) => {
    const key = innerWidth + 'x' + innerHeight + ':' + (document.fonts?.status || ''); if (!force && key === placedKey) return; placedKey = key;
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
  // R48 r12: warm-up in slices on idle (never in the tap frame): the renderer, then the page snapshot, then one throw-away draw; and the snapshot again on pointerdown (the ~50-100 ms before the click)
  const idle = (fn, t = 2000) => (window.requestIdleCallback || ((f) => setTimeout(f, 300)))(fn, { timeout: t });
  // pointerdown / touchstart on the burger (the ~50-100 ms before the click): the page snapshot, the clock text, the layout of the menu, the timeline: everything the tap frame would otherwise do
  let prepped = 0;
  const prep = () => {
    if (open || sweeping || performance.now() - prepped < 300) return; prepped = performance.now();
    prepWork();
  };
  const IS_WORK = /^\/work\/?$/;
  const prepWork = () => { if (open || sweeping) return; smear?.prime(); timeEl.textContent = hcmcTime(); placeMenu(); curLink = IS_WORK.test(location.pathname) ? workLink : null; if (smear) { buildTl(false); tl.progress(0); } };
  // idle, in slices (each its own idle callback): clock formatter + renderer, snapshot, menu layout + timeline, the throw-away draw
  idle(() => { hcmcTime(); warmSmear(); idle(() => { smear?.prime(); idle(() => { prepWork(); idle(() => smear?.warmDraw()); }); }); }, 4000);
  btn.addEventListener('pointerdown', prep, { passive: true });
  btn.addEventListener('touchstart', prep, { passive: true });
  const useSweep = () => { warmSmear(); const r = noSmearReason(); if (r) { smearWhy = r; return false; } if (smear && smear.lost) { smearWhy = 'WebGL context lost'; return false; } return !!smear && !smear.playing; };

  // the items, in Anh's order: flavour 1, flavour 2, clock, Work, About, Contact; then the line push
  const items = () => [...menu.querySelectorAll('.tmenu__flav .tmenu__fx'), menu.querySelector('.tmenu__time'), ...menu.querySelectorAll('.tmenu__list > li')];
  // R48 r10: the whole entrance is ONE GSAP timeline (items: opacity 0 -> 1, blur -> 0, y +8 -> 0, each itemSec with itemEase; their STARTS spread over staggerAmount with staggerEase; then the line push with pushEase).
  // It starts when the sweep band has passed startShare of the width. Close = the same timeline reversed at closeSpeed (the band waits for the reversed timeline to reach the sweep's length).
  let tl = null;
  let tlKey = '';
  const buildTl = (reuse) => {
    const key = innerWidth + '|' + (curLink ? curLink.textContent : '');
    if (reuse && tl && key === tlKey) { tl.pause(0); return tl; }
    tlKey = key;
    tl?.kill();
    const list = items(), t30 = frontTime(TM.startShare * innerWidth, MENU_SWEEP.openSec), cur = curLink;
    gsap.set(list, { opacity: 0, filter: 'blur(' + TM.blurPx + 'px)', y: TM.riseY });
    tl = gsap.timeline({ paused: true, onComplete: () => animating(false), onReverseComplete: () => animating(false) });
    tl.to({}, { duration: MENU_SWEEP.openSec }, 0);
    tl.to(list, { opacity: 1, filter: 'blur(0px)', y: 0, duration: TM.itemSec, ease: TM.itemEase, stagger: { amount: TM.staggerAmount, ease: TM.staggerEase } }, t30);
    if (cur) {
      const at = t30 + TM.staggerAmount + TM.pushLag;
      tl.fromTo(cur.querySelector('.tmenu__arr'), { scaleX: 0 }, { scaleX: 1, duration: TM.pushSec, ease: TM.pushEase }, at);
      tl.fromTo(cur.querySelector('.tmenu__w'), { x: 0 }, { x: wordShift(), duration: TM.pushSec, ease: TM.pushEase }, at);
    }
    return tl;
  };
  const wordShift = () => parseFloat(getComputedStyle(menu).getPropertyValue('--tm-word-shift')) || 43;
  const showPlain = () => { tl?.kill(); tl = null; gsap.set(items(), { opacity: 1, filter: 'none', y: 0 }); };

  // ---- the current-page line: .is-cur on a link = the line drawn out and the word pushed to its rest position (CSS transitions with the same duration / ease, so the word follows the line's tip)
  let curLink = null; // the link that has the line at rest (Work on /work/, none on Home)
  const links = () => [...menu.querySelectorAll('.tmenu__list a, .tmenu__list button')];
  const arrOf = (el) => el.querySelector('.tmenu__arr'), wordOf = (el) => el.querySelector('.tmenu__w');
  const lineTw = new Map(); // link -> its own line tweens (only OUR line tweens are killed: killTweensOf would also kill the entrance timeline's push tween, which is reused between opens)
  // R48 merge fix (Cowork): kill only THIS link's tweens; killing all of them made the Contact tap stop Work's pull-back (both lines stayed drawn)
  const lineKill = (el) => { (el ? [el] : [...lineTw.keys()]).forEach((k) => { (lineTw.get(k) || []).forEach((t) => t.kill()); lineTw.delete(k); }); };
  const lineSet = (el, on) => { lineKill(el); gsap.set(arrOf(el), { scaleX: on ? 1 : 0, transformOrigin: '0 50%' }); gsap.set(wordOf(el), { x: on ? wordShift() : 0 }); el.classList.toggle('is-cur', on); };
  const lineMove = (el, on, delay, dur) => { lineKill(el); const o = { duration: dur, delay, ease: TM.pushEase }; lineTw.set(el, [gsap.to(arrOf(el), { scaleX: on ? 1 : 0, transformOrigin: '0 50%', ...o }), gsap.to(wordOf(el), { x: on ? wordShift() : 0, ...o })]); el.classList.toggle('is-cur', on); };
  const lineNow = () => links().forEach((a) => lineSet(a, false));
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
    const step = (now) => { const u = Math.min(1, Math.max(0, (now - t0) / (sec * 1000))); h.drive(from + (to - from) * outEase(u)); if (u < 1) wmRaf = requestAnimationFrame(step); };
    wmRaf = requestAnimationFrame(step);
  };

  // R52c: the homepage's equivalent of the page pause. The hero <video> keeps decoding and compositing full screen under the opaque panel (Anh's iPhone: Home 30 fps, Work 60: GPU-bound): once the band covers
  // PAUSE_SHARE of the width the video is PAUSED (its last frame stays on screen, the smear canvas has the same still); it plays again when the sweep that closes the menu has ended (same time position: no jump).
  let heroPaused = false;
  const heroPause = (on) => { const v = document.querySelector('.thero__video'); if (!v) return; if (on) { if (!v.paused) { v.pause(); heroPaused = true; } } else if (heroPaused) { heroPaused = false; try { v.play?.().catch(() => {}); } catch { /* */ } } };
  // R52c: the CSS blur / will-change on the items exist only while their own tween runs (a blur(0px) filter keeps every item a full-screen-cost compositing layer at rest)
  const animating = (on) => items().forEach((el) => { if (on) el.style.willChange = 'filter, opacity, transform'; else { el.style.willChange = ''; el.style.filter = 'none'; } });
  let open = false, hideT = 0, lockT = 0;
  // R48 r13: the page lock (inert on the page + overflow hidden = a big style / hit-test invalidation) is NOT done in the tap frames: after the sweep on open, when the menu is gone on close
  const lockPage = (on) => { document.documentElement.classList.toggle('tmenu-lock', on); pageEls().forEach((el) => { if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert'); }); };
  const mark = (name) => { try { (window.__tmLabels ||= []).push(name + ' @' + (performance.now() - (window.__tmTap || 0)).toFixed(1)); } catch { /* */ } };
  let takingOver = false, takeOverResolve = null;
  const endTakeOver = () => { if (!takingOver && !takeOverResolve) return; takingOver = false; const r = takeOverResolve; takeOverResolve = null; r?.(); };
  const finishSweep = () => { sweeping = false; restoreText(); endTakeOver(); if (pending) { const q = pending; pending = null; set(q[0], q[1]); } };
  const afterReflow = (fn) => { void menu.offsetWidth; fn(); };
  const set = (on, view = 'list') => {
    if (takingOver && on) return;
    const tapT = performance.now(); if (on) { window.__tmTap = tapT; window.__tmLabels = []; }
    if (sweeping && on !== open) { pending = [on, view]; return; } // (a tap during the sweep waits for it to end)
    if (on === open && menu.dataset.view === view) return;
    const wasOpen = open;
    open = on;
    btn.setAttribute('aria-expanded', String(on));
    btn.setAttribute('aria-label', on ? 'Close menu' : 'Open menu');
    document.documentElement.classList.toggle('tmenu-open', on); wmLabel(on);
    clearTimeout(hideT); clearTimeout(lockT);
    const sw = !(on && wasOpen) && useSweep();
    const secOpen = MENU_SWEEP.openSec, secClose = secOpen / MENU_SWEEP.closeDiv;
    if (on) {
      if (wasOpen) { menu.dataset.view = view; (menu.querySelector(view === 'about' ? '.tmenu__text' : 'a[href], button') || btn).focus({ preventScroll: true }); return; }
      curLink = /^\/work\/?$/.test(location.pathname) ? workLink : null; fromMenu = false;
      timeEl.textContent = hcmcTime(); timeT = setTimeout(tick, 60000 - (Date.now() % 60000) + 50);
      menu.classList.toggle('is-plain', !sw);
      lineNow();
      if (sw) panel.style.clipPath = 'polygon(0 0, 0 0, 0 0)'; else panel.style.clipPath = 'none';
      menu.removeAttribute('inert'); menu.hidden = false; menu.dataset.view = view; placeMenu(); mark('unhide+placeMenu');
      if (sw) { buildTl(true); mark('timeline'); collectText(); mark('collectText'); } else showPlain();
      afterReflow(() => {
        menu.classList.add('is-open');
        if (sw) { animating(true); tl.timeScale(1).play(0); } else if (curLink) lineSet(curLink, true);
      });
      if (sw) {
        sweeping = true; wmRun(true, secOpen, 0); mark('wordmark start'); lockT = setTimeout(() => lockPage(true), secOpen * 1000 + 60);
        // R48 r14: the page loop keeps running until the band has passed PAUSE_SHARE of the width (a freeze before the sweep moves read as a stall); then it pauses under the opaque sweep
        const W0 = innerWidth, ok = smear.play({ open: true, sec: secOpen, tapT, onFrame: ({ clip, f }) => { panel.style.clipPath = clip; fadeText(f); if (!isPagePaused() && f >= PAUSE_SHARE * W0) { setPagePaused(true); heroPause(true); } }, onDone: finishSweep });
        mark('smear.play (frame 0 drawn)');
        if (!ok) { sweeping = false; restoreText(); menu.classList.add('is-plain'); panel.style.clipPath = 'none'; showPlain(); if (curLink) lineSet(curLink, true); wmRun(true, 0.25, 0); }
      } else { wmRun(true, 0.25, 0); lockPage(true); }
      (menu.querySelector(view === 'about' ? '.tmenu__text' : 'a[href], button') || btn).focus({ preventScroll: true });
    } else {
      const done = () => { if (!open) { menu.hidden = true; menu.setAttribute('inert', ''); lockPage(false); stopTime(); lineNow(); setPagePaused(false); animating(false); heroPause(false); } };
      menu.classList.toggle('is-plain', !sw);
      fromMenu = false;
      if (sw) {
        if (!tl) { buildTl(); tl.progress(1); }
        heroPause(true); animating(true);
        const bandDelay = 0; // R48 r14: the band starts AT the tap (it used to wait for the items' blur-out: ~3 dead frames); the items sit inside the panel, so the band's clip hides them as it passes
        collectText();
        menu.classList.remove('is-open');
        tl.timeScale(MENU_SWEEP.closeDiv).reverse();
        sweeping = true; panel.style.clipPath = 'none'; wmRun(false, secClose, bandDelay);
        const ok = smear.play({ open: false, sec: secClose, delay: bandDelay, onFrame: ({ clip, f }) => { panel.style.clipPath = clip; fadeText(f); }, onDone: () => { done(); finishSweep(); } });
        if (!ok) { sweeping = false; restoreText(); tl?.kill(); menu.classList.add('is-plain'); hideT = setTimeout(() => { done(); endTakeOver(); }, 260); wmRun(false, 0.25, 0); heroPause(false); }
      } else { tl?.kill(); menu.classList.remove('is-open'); hideT = setTimeout(() => { done(); endTakeOver(); }, 260); wmRun(false, 0.25, 0); heroPause(false); }
      if (!takingOver) btn.focus({ preventScroll: true }); // (R52: arriving on Home by the AV: nothing was focused, the focus ring must not show on the burger)
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
  const closeNow = () => { heroPause(false); smear?.cancel(); sweeping = false; pending = null; restoreText(); clearTimeout(hideT); cancelAnimationFrame(wmRaf); setPagePaused(false); tl?.kill(); open = false; btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', 'Open menu'); document.documentElement.classList.remove('tmenu-open'); wmLabel(false); clearTimeout(lockT); lockPage(false); menu.classList.remove('is-open'); menu.hidden = true; menu.setAttribute('inert', ''); stopTime(); lineNow(); endTakeOver(); };

  // ---- R52: the big AV in the open menu = Home, played as a menu CLOSE on the homepage.
  // On Home: just the normal close. Elsewhere (Work, a project, in place or a document): the snapshot of this open menu goes into the record `pxm`, the page navigates to '/' at once (the menu already covers
  // the page: nothing has to animate before leaving) and the homepage paints that snapshot from its first frame (index.html), then takeOver() below plays the close. Capture phase: the Work page's own
  // wordmark click (the card flight home) must not run for this path.
  const onHome = () => document.documentElement.classList.contains('tall-home');
  let leaving = 0;
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a.wordmark, a.twm');
    if (!a || !open || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    if (onHome()) { set(false); return; }
    if (leaving) return;
    leaving = setTimeout(() => { leaving = 0; clearMenuHome(); }, 3000); // (a navigation that did not leave: the record must not outlive it)
    const here = fromMenu ? contactLink : curLink; // (the link that has the line)
    writeMenuHome({ menu, btn, vInk, view: menu.dataset.view, cur: here ? links().indexOf(here) : -1, shift: wordShift() });
    location.href = '/';
  }, true);
  // restored from the back-forward cache (Back from Home): this page comes back as it was left, with the menu open: close it with no animation, the wordmark small again
  addEventListener('pageshow', (e) => { if (!e.persisted) return; clearTimeout(leaving); leaving = 0; clearMenuHome(); if (open && !onHome()) { closeNow(); getWm()?.drive?.(1); } });

  // R52b: the close on a just-loaded homepage ran at ~30 fps (the first raster of the blurred items, the clip-path mask, the smear's real grid, the shader paths: all first-time work inside the close). The layer still covers the screen
  // (z-index 70, above the smear canvas at 49), so the SAME close is played once, invisibly, before the real one: same timeline, same sweep, same clip; then everything is put back to the open rest state. Capped at ~600 ms.
  const dryClose = () => new Promise((res) => {
    if (!tl || !smear) { res(); return; }
    let done = false; const stop = () => { if (done) return; done = true; clearTimeout(cap); smear.cancel(); tl.pause(); tl.progress(1); animating(false); panel.style.clipPath = 'none'; res(); };
    const cap = setTimeout(stop, 600);
    tl.timeScale(2).reverse(); animating(true); // (a warm-up: twice the speed, it only has to touch every path once)
    const ok = smear.play({ open: false, sec: MENU_SWEEP.openSec / 2, onFrame: ({ clip }) => { panel.style.clipPath = clip; }, onDone: stop });
    if (!ok) stop();
  });
  // Home, arriving with the record: the live menu is put into its OPEN rest state under the painted layer (#pxg[data-menu], same pixels), the layer goes in the frame the close starts. Resolves when the close has ended.
  const takeOver = async ({ rec, layer, video }) => {
    if (rec?.vInk) vInk = rec.vInk;
    warmSmear();
    try { await document.fonts?.ready; } catch { /* */ }
    open = true; fromMenu = false; sweeping = false; pending = null;
    curLink = rec?.cur >= 0 ? links()[rec.cur] || null : null; // (R52b: the line of the page that was left: the close pulls it back first)
    btn.setAttribute('aria-expanded', 'true'); btn.setAttribute('aria-label', 'Close menu');
    document.documentElement.classList.add('tmenu-open'); wmLabel(true);
    timeEl.textContent = hcmcTime(); clearTimeout(timeT); timeT = setTimeout(tick, 60000 - (Date.now() % 60000) + 50);
    const sw = useSweep();
    menu.classList.toggle('is-plain', !sw); lineNow(); panel.style.clipPath = 'none';
    menu.removeAttribute('inert'); menu.hidden = false; menu.dataset.view = rec?.view || 'list'; placeMenu(true);
    if (sw) { buildTl(false); tl.progress(1); animating(false); } else { showPlain(); if (curLink) lineSet(curLink, true); }
    menu.classList.add('is-open'); lockPage(true);
    // the homepage is "live" when the hero video has a frame (capped: a video that never loads must not hold the menu; the poster is then the picture that is revealed)
    const t0 = performance.now(); try { video?.play?.().catch(() => {}); } catch { /* */ }
    while (video && !(video.readyState >= 2 && video.currentTime > 0) && performance.now() - t0 < 1500) await new Promise((r) => requestAnimationFrame(r));
    if (sw) { heroPause(true); smear.prime(); smear.warmDraw(); if (performance.now() - t0 < 600) { await dryClose(); smear.prime(); smear.warmDraw(); } } // (a video that was slow to start already held the layer: no more waiting)
    for (let i = 0; i < 4; i++) await new Promise((r) => requestAnimationFrame(r)); // (a few frames under the cover: the first raster / composite of the live menu and the smear layer must not fall into the close's first frame)
    try { window.__r45vt?.skipTransition(); } catch { /* */ } // (the held Work frame; the layer has the same picture)
    layer?.remove(); document.documentElement.classList.remove('pxg-on');
    await new Promise((r) => { takeOverResolve = r; takingOver = true; set(false); });
  };

  // ---- ?debug=menu: what the sweep does on this device (for Anh's phone)
  if (params.get('debug') === 'menu') {
    const box = document.createElement('pre');
    box.style.cssText = 'position:fixed;left:4px;right:4px;top:60px;z-index:99999;margin:0;padding:6px 8px;background:rgba(0,0,0,.78);color:#9f9;font:10px/1.35 ui-monospace,Menlo,monospace;pointer-events:none;white-space:pre-wrap';
    document.body.append(box);
    const show = () => {
      const r = noSmearReason(), st = smear?.stats, lo = smear?.lastOpen, g = sweepGeom();
      box.textContent = [`wordmark handle: ${wmState()}`, `smear: ${smear && !r ? 'ON' : 'FALLBACK (plain fade)'}${r ? ' - ' + r : smear ? '' : ' - ' + (smearTried ? smearWhy || 'renderer not made' : 'renderer not made yet (idle)')}`,
        `GL context: ${smear ? (smear.lost ? 'LOST' : 'ok') : '-'}   canvas dpr ${smear ? smear.dpr.toFixed(2) : '-'} (device ${devicePixelRatio})`,
        `grid: ${gridBlockPx().toFixed(1)} px blocks (MENU_SWEEP.blockPx ${MENU_SWEEP.blockPx} @430, ${gridBlockPx() ? Math.round(innerWidth / gridBlockPx()) : '-'} across)   ease ${MENU_SWEEP.ease}   glide ${MENU_SWEEP.glide} blocks   zone: ${g.zone.toFixed(0)} px   jag: ${g.jag.toFixed(0)} px   sweep ${MENU_SWEEP.openSec.toFixed(2)} s / close ${(MENU_SWEEP.openSec / MENU_SWEEP.closeDiv).toFixed(2)} s`,
        `last OPEN: tap -> sweep frame 0 ${lo && lo.tapSync != null ? lo.tapSync : '-'} ms, -> first painted ${lo && lo.tapToFirst != null ? lo.tapToFirst : '-'} ms, first 3 frame times ${lo ? lo.first3.join(' / ') : '-'} ms, snapshot ${lo ? (lo.usedPrimed ? 'taken ' + lo.primedAgo + ' ms before the tap (prime cost ' + (lo.primeMs ?? 0).toFixed(1) + ' ms)' : 'taken IN the tap (not primed)') : '-'}`,
        `tap-frame tasks (ms after the tap): ${(window.__tmLabels || []).join(', ') || '-'}   frame starts (ms after the tap): ${lo && lo.frameT ? lo.frameT.join(' / ') : '-'}`,
        `R52c: hero video ${document.querySelector('.thero__video') ? (document.querySelector('.thero__video').paused ? 'PAUSED' : 'playing') : '- (no hero here)'}   items with a blur filter / will-change right now: ${items().filter((e) => e.style.filter && e.style.filter !== 'none').length} / ${items().filter((e) => e.style.willChange).length}   close speed x${MENU_SWEEP.closeDiv}`,
        `bisect switches: off=${offList() || '(none)'}   smeardpr=${new URLSearchParams(location.search).get('smeardpr') || '(default ' + (smear ? smear.dpr.toFixed(2) : '-') + ')'}   (add &smeardpr=1.25 to the URL to try a lower smear resolution)`,
        `last sweep: ${st && st.frames ? `${st.frames} frames, ${st.avgMs.toFixed(1)} ms avg, ${st.maxMs.toFixed(1)} ms max, ${st.long} frames > 20 ms (page loop paused under the sweep: ${isPagePaused() ? "yes" : "no"})` : '-'}`].join('\n');
    };
    setInterval(show, 300); show();
  }
  return { open: () => set(true), close: () => set(false), closeNow, takeOver, isOpen: () => open, link: workLink };
}
