import '../styles/contact.css';
import data from '../data/data.json';
import { CONTACT } from '../timeline.js';

// R46 Part A: the contact card (desktop + phone). Opened by contact-trigger.js from every [data-contact] link (the Work page "Reach out", the homepage nav "Contact", the phone menu "Contact").
// Closes with Close x, Esc, a click / tap outside, or the browser Back (one history state is pushed while it is open). role=dialog, aria-modal, labelled by the headline; focus moves into the card
// (a Tab trap) and returns to the trigger. All copy comes from data.json `contact`; an "Elsewhere" link with an empty URL is not rendered (and the item disappears when none is left).
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const C = data.contact || {};
const email = C.email || CONTACT.email;
let root = null, card = null, open = false, trigger = null, pushed = false, copyTimer = 0;

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
  root.innerHTML = `<div class="cc__dim"></div>
    <div class="cc__card" role="dialog" aria-modal="true" aria-labelledby="cc-h" tabindex="-1">
      <h2 class="cc__h" id="cc-h">${esc(C.headline || 'Say hello')}</h2>
      <div class="cc__grid">${items}</div>
      <div class="cc__foot"><button type="button" class="cc__close">${esc(C.close || 'Close')} &times;</button></div>
    </div>`;
  card = root.querySelector('.cc__card');
  document.body.append(root);
  // nothing behind the card scrolls, spawns or plays a sound: wheel / touch / clicks stop here
  root.addEventListener('wheel', (e) => { e.preventDefault(); e.stopPropagation(); }, { passive: false });
  root.addEventListener('touchmove', (e) => { if (!card.contains(e.target)) e.preventDefault(); e.stopPropagation(); }, { passive: false });
  root.addEventListener('click', (e) => { e.stopPropagation(); if (!card.contains(e.target)) close(); });
  root.addEventListener('pointerdown', (e) => e.stopPropagation());
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
    const f = [...card.querySelectorAll('a[href], button')].filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && (i === f.length - 1 || i < 0)) { e.preventDefault(); f[0].focus(); }
  });
  addEventListener('popstate', () => { if (open && !(history.state && history.state.cc)) hide(); pushed = !!(history.state && history.state.cc); });
}

function hide() {
  if (!open) return;
  open = false;
  root.classList.remove('is-open');
  setTimeout(() => { if (!open) root.classList.remove('is-on'); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220);
  const t = trigger; trigger = null;
  if (t && t.isConnected) t.focus({ preventScroll: true });
}

export function close() {
  if (!open) return;
  if (pushed) { pushed = false; try { history.back(); return; } catch { /* */ } } // popstate then hides it
  hide();
}

export function openContact(from) {
  if (open) return;
  if (!root) build();
  trigger = from || document.activeElement;
  open = true;
  root.classList.add('is-on');
  void root.offsetWidth; // (the card starts from its closed state, then rises)
  root.classList.add('is-open');
  try { history.pushState({ ...(history.state || {}), cc: 1 }, ''); pushed = true; } catch { pushed = false; }
  card.focus({ preventScroll: true });
}
