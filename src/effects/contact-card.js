import '../styles/contact.css';
import data from '../data/data.json';
import { CONTACT } from '../timeline.js';
import { CONTACT_CARD as K } from '../settings/shared.js';

// R46 Part A + R46b: the contact card. Opened by contact-trigger.js from every [data-contact] link. Two cards: the main card (the content) and a BACK card behind it (plain dark, or contact.backCard image / video).
// On open both are thrown in from a random direction, spinning, and settle with a spring; a click / tap outside slides them out the way they came; both drag (Pointer Events, 6 px threshold) with a little tilt and
// inertia; a hard fling closes. Esc and the browser Back also close (one history state is pushed while it is open); a visually hidden Close button is kept for keyboard / screen readers. Focus moves into the card (a Tab
// trap) and returns to the trigger. All motion is time-based: physics runs in fixed 1/240 s steps, so 60 and 144 Hz look the same. Reduced motion = plain fade, no throw / tilt / inertia (drag still works).
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const C = data.contact || {};
const email = C.email || CONTACT.email;
const STEP = 1 / 240, rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let root = null, card = null, back = null, open = false, trigger = null, pushed = false, copyTimer = 0, raf = 0, last = 0, acc = 0, hideT = 0, closing = false, dragging = null, suppressClick = false;
const cards = []; // {el, main, x, y, r, vx, vy, vr, tx, ty, tr, rest, mode, entry:{x,y,r}, ...}

function build() {
  root = document.createElement('div');
  root.className = 'cc';
  const items = (C.items || []).map((it) => {
    if (it.kind === 'email') {
      return `<div class="cc__item cc__item--wide"><span class="cc__label" data-label="${esc(it.label)}">${esc(it.label)}</span><span class="cc__val"><button type="button" class="cc__copy" aria-label="Copy email address ${esc(email)}">${esc(email)}</button><a class="cc__mail" href="mailto:${esc(email)}">${esc(C.openMail || 'Open mail')}</a></span></div>`;
    }
    if (it.kind === 'links') {
      const links = (C.links || []).filter((l) => l.url && l.url.trim());
      if (!links.length) return '';
      return `<div class="cc__item"><span class="cc__label">${esc(it.label)}</span><span class="cc__val cc__links">${links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.name)}</a>`).join('')}</span></div>`;
    }
    return `<div class="cc__item"><span class="cc__label">${esc(it.label)}</span><span class="cc__val">${esc(it.text || '')}</span></div>`;
  }).join('');
  const bc = C.backCard || {};
  const media = bc.video ? `<video src="${esc(bc.video)}" loop muted playsinline autoplay></video>` : bc.image ? `<img src="${esc(bc.image)}" alt="" draggable="false">` : '';
  root.innerHTML = `<div class="cc__dim"></div>
    <div class="cc__back" aria-hidden="true">${media}</div>
    <div class="cc__card" role="dialog" aria-modal="true" aria-labelledby="cc-h" tabindex="-1">
      <h2 class="cc__h" id="cc-h">${esc(C.headline || 'Say hello')}</h2>
      <div class="cc__grid">${items}</div>
      <button type="button" class="cc__sr cc__close">${esc(C.close || 'Close')}</button>
    </div>`;
  card = root.querySelector('.cc__card'); back = root.querySelector('.cc__back');
  document.body.append(root);
  cards.push({ el: card, main: true }, { el: back, main: false });
  // nothing behind the card scrolls, spawns or plays a sound: wheel / touch / clicks stop here
  root.addEventListener('wheel', (e) => { e.preventDefault(); e.stopPropagation(); }, { passive: false });
  root.addEventListener('touchmove', (e) => { e.preventDefault(); e.stopPropagation(); }, { passive: false });
  root.addEventListener('click', (e) => { if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopPropagation(); } }, true); // the click that ends a drag is not a click
  root.addEventListener('click', (e) => { e.stopPropagation(); if (!e.target.closest('.cc__card, .cc__back')) close(); });
  root.addEventListener('pointerdown', (e) => { e.stopPropagation(); onDown(e); });
  root.addEventListener('dragstart', (e) => e.preventDefault());
  root.querySelector('.cc__close').addEventListener('click', () => close());
  const copy = root.querySelector('.cc__copy');
  copy?.addEventListener('click', async () => {
    const label = root.querySelector('.cc__label[data-label]');
    try {
      await navigator.clipboard.writeText(email);
      if (label) { label.textContent = C.copied || 'Copied'; clearTimeout(copyTimer); copyTimer = setTimeout(() => { label.textContent = label.dataset.label; }, 1600); }
    } catch { location.href = `mailto:${email}`; } // clipboard denied / unavailable: the mail link still works
  });
  addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = [...card.querySelectorAll('a[href], button')].filter((el) => el.offsetParent !== null || el.classList.contains('cc__sr'));
    if (!f.length) return;
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && (i === f.length - 1 || i < 0)) { e.preventDefault(); f[0].focus(); }
  });
  addEventListener('popstate', () => { if (open && !(history.state && history.state.cc)) { pushed = false; exit(); } else pushed = !!(history.state && history.state.cc); });
  addEventListener('resize', () => { if (open) sizeBack(); });
}

const draw = (c) => { c.el.style.transform = `translate(-50%, -50%) translate(${c.x.toFixed(2)}px, ${c.y.toFixed(2)}px) rotate(${c.r.toFixed(3)}deg)`; };
const sizeBack = () => { back.style.height = card.offsetHeight + 'px'; back.style.width = card.offsetWidth + 'px'; };
// distance from the screen centre along (dx, dy) at which a card is fully off screen
const offscreen = (dx, dy, c) => { const W = innerWidth, H = innerHeight, w = c.el.offsetWidth, h = c.el.offsetHeight; return (W / 2) * Math.abs(dx) + (H / 2) * Math.abs(dy) + Math.hypot(w, h) / 2 + 40; };

function launch() {
  const a = rnd(0, Math.PI * 2), spinSign = Math.random() < 0.5 ? -1 : 1;
  const rm = reduced();
  cards.forEach((c) => {
    const main = c.main, rMax = main ? K.rotMax : K.backRotMax;
    let rest = rnd(-rMax, rMax);
    if (!main) rest = Math.min(rMax, Math.max(Math.abs(rest), Math.min(3, rMax))) * (cards[0].rest < 0 ? 1 : -1); // the edge shows: opposite side of the main card
    const off = main ? 0 : K.backOffset * card.offsetWidth, oa = rnd(0, Math.PI * 2);
    c.rest = rest; c.tx = main ? 0 : Math.cos(oa) * off; c.ty = main ? 0 : Math.sin(oa) * off; c.tr = rest;
    const ang = a + (main ? 0 : rnd(-0.25, 0.25)), dx = Math.cos(ang), dy = Math.sin(ang), L = offscreen(dx, dy, c) * K.throwDist;
    c.entry = { x: dx * L, y: dy * L, r: rest + spinSign * K.spin * (main ? 1 : rnd(0.8, 1.2)) };
    c.x = rm ? c.tx : c.entry.x; c.y = rm ? c.ty : c.entry.y; c.r = rm ? rest : c.entry.r; c.vx = c.vy = c.vr = 0;
    c.mode = rm ? 'rest' : 'spring'; c.delay = rm ? 0 : (main ? K.backLead : 0); // the back card is thrown first, so it lands first
    c.el.style.zIndex = main ? 2 : 1;
    draw(c);
  });
}

function exit(fling) {
  if (!open || closing) return;
  closing = true; open = false;
  root.classList.remove('is-open'); // the dim fades out
  const rm = reduced();
  cards.forEach((c, i) => {
    c.mode = rm ? 'rest' : 'tween'; c.t = 0; c.delay = i === 0 ? 0 : K.outLag; c.p0 = { x: c.x, y: c.y, r: c.r };
    let ex = c.entry.x, ey = c.entry.y;
    if (fling) { const sp = Math.hypot(fling.vx, fling.vy) || 1, dx = fling.vx / sp, dy = fling.vy / sp; const L = offscreen(dx, dy, c); ex = dx * L; ey = dy * L; }
    c.pe = { x: ex, y: ey, r: c.r + (c.entry.r - c.rest) * 0.5 };
  });
  const total = rm ? 0.25 : K.outSec + K.outLag + 0.05;
  clearTimeout(hideT); hideT = setTimeout(() => { closing = false; if (!open) { root.classList.remove('is-on'); cancelAnimationFrame(raf); raf = 0; } }, total * 1000);
  const t = trigger; trigger = null;
  if (t && t.isConnected) t.focus({ preventScroll: true });
  tick0();
}

export function close() {
  if (!open) return;
  if (pushed) { pushed = false; try { history.back(); return; } catch { /* */ } } // popstate then slides it out
  exit();
}

// ---- physics (fixed step) ----
function stepCard(c, dt) {
  if (c.mode === 'spring') {
    if (c.delay > 0) { c.delay -= dt; return; }
    const w = K.omega, k = w * w, cp = 2 * K.zeta * w, cr = 2 * K.rotZeta * w;
    c.vx += (-k * (c.x - c.tx) - cp * c.vx) * dt; c.x += c.vx * dt;
    c.vy += (-k * (c.y - c.ty) - cp * c.vy) * dt; c.y += c.vy * dt;
    c.vr += (-k * (c.r - c.tr) - cr * c.vr) * dt; c.r += c.vr * dt;
    if (Math.abs(c.x - c.tx) + Math.abs(c.y - c.ty) < 0.15 && Math.abs(c.r - c.tr) < 0.03 && Math.abs(c.vx) + Math.abs(c.vy) < 2 && Math.abs(c.vr) < 0.5) { c.x = c.tx; c.y = c.ty; c.r = c.tr; c.mode = 'rest'; }
  } else if (c.mode === 'tween') {
    c.t += dt;
    const u = clamp((c.t - c.delay) / K.outSec, 0, 1), e = u * u * u; // ease-in: it gathers speed leaving
    c.x = c.p0.x + (c.pe.x - c.p0.x) * e; c.y = c.p0.y + (c.pe.y - c.p0.y) * e; c.r = c.p0.r + (c.pe.r - c.p0.r) * e;
    if (u >= 1) c.mode = 'rest';
  } else if (c.mode === 'drag') {
    const tilt = clamp(c.vxs * K.dragTilt / 1000, -K.tiltMax, K.tiltMax), w = 22;
    c.tr = reduced() ? c.rest : c.rest + tilt;
    c.vr += (-(w * w) * (c.r - c.tr) - 2 * w * c.vr) * dt; c.r += c.vr * dt;
  } else if (c.mode === 'inertia') {
    const f = Math.exp(-K.friction * dt), w = 14;
    c.vx *= f; c.vy *= f; c.x += c.vx * dt; c.y += c.vy * dt;
    const mx = innerWidth / 2 - 40, my = innerHeight / 2 - 40; // keep the card on screen
    if (Math.abs(c.x) > mx) { c.x = Math.sign(c.x) * mx; c.vx = 0; }
    if (Math.abs(c.y) > my) { c.y = Math.sign(c.y) * my; c.vy = 0; }
    c.vr += (-(w * w) * (c.r - c.rest) - 2 * w * c.vr) * dt; c.r += c.vr * dt;
    if (Math.hypot(c.vx, c.vy) < 8 && Math.abs(c.r - c.rest) < 0.05 && Math.abs(c.vr) < 0.5) { c.r = c.rest; c.mode = 'rest'; }
  }
}
function frame(now) {
  raf = 0;
  const dt = clamp((now - last) / 1000, 0, 0.05); last = now; acc += dt;
  while (acc >= STEP) { acc -= STEP; cards.forEach((c) => stepCard(c, STEP)); }
  cards.forEach(draw);
  if (cards.some((c) => c.mode !== 'rest')) raf = requestAnimationFrame(frame);
}
function tick0() { if (!raf) { last = performance.now(); acc = 0; raf = requestAnimationFrame(frame); } }

// ---- drag ----
function onDown(e) {
  if (!open || e.button > 0 || dragging) return;
  const el = e.target.closest('.cc__card, .cc__back'); if (!el) return;
  const c = cards.find((k) => k.el === el);
  dragging = { c, id: e.pointerId, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, lt: performance.now(), on: false, vx: 0, vy: 0, gx: 0, gy: 0 };
  addEventListener('pointermove', onMove); addEventListener('pointerup', onUp); addEventListener('pointercancel', onUp);
}
function onMove(e) {
  const d = dragging; if (!d || e.pointerId !== d.id) return;
  const c = d.c;
  if (!d.on) {
    if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < K.dragStart) return;
    d.on = true; c.mode = 'drag'; c.vxs = 0;
    d.gx = d.sx - (innerWidth / 2 + c.x); d.gy = d.sy - (innerHeight / 2 + c.y); // where on the card it was grabbed
    try { c.el.setPointerCapture(d.id); } catch { /* */ }
    root.classList.add('is-drag');
    const o = cards.find((k) => k !== c); c.el.style.zIndex = 3; o.el.style.zIndex = 1; // the dragged card comes to the front
    d.lx = e.clientX; d.ly = e.clientY; d.lt = performance.now();
    tick0();
  }
  const now = performance.now(), dtp = Math.max(1, now - d.lt) / 1000;
  const ivx = (e.clientX - d.lx) / dtp, ivy = (e.clientY - d.ly) / dtp, a = 1 - Math.exp(-dtp / 0.06);
  d.vx += (ivx - d.vx) * a; d.vy += (ivy - d.vy) * a; c.vxs = d.vx; d.lx = e.clientX; d.ly = e.clientY; d.lt = now;
  c.x = e.clientX - d.gx - innerWidth / 2; c.y = e.clientY - d.gy - innerHeight / 2;
  c.vx = c.vy = 0;
  tick0();
}
function onUp(e) {
  const d = dragging; if (!d || e.pointerId !== d.id) return;
  removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onUp);
  dragging = null;
  if (!d.on) return; // a plain click: the links / buttons work as usual
  suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); // the click that follows a drag is not a click
  root.classList.remove('is-drag');
  const c = d.c, idle = performance.now() - d.lt > 90; // a pause before release = no fling
  const vx = idle ? 0 : d.vx, vy = idle ? 0 : d.vy;
  if (reduced()) { c.mode = 'rest'; c.r = c.rest; draw(c); return; }
  if (Math.hypot(vx, vy) > K.flingSpeed) { c.vx = vx; c.vy = vy; exit({ vx, vy }); return; }
  c.vx = vx; c.vy = vy; c.mode = 'inertia'; tick0();
}

export function openContact(from) {
  if (open) return;
  if (!root) build();
  clearTimeout(hideT); closing = false;
  trigger = from || document.activeElement;
  open = true;
  root.classList.toggle('cc--rm', reduced());
  root.classList.add('is-on');
  sizeBack(); launch();
  void root.offsetWidth;
  root.classList.add('is-open'); // the dim fades in with the throw
  try { history.pushState({ ...(history.state || {}), cc: 1 }, ''); pushed = true; } catch { pushed = false; }
  card.focus({ preventScroll: true });
  tick0();
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('tune')) import('./contact-tune.js').then((m) => m.mountContactTune());
}
