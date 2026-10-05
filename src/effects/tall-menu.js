import '../styles/tall.css';
import data from '../data/data.json';
import { CONTACT } from '../timeline.js';

// R24a: the burger button + full-screen menu of the tall mode (phones, tablet portrait). Items: Work (/work/), About (an overlay view with the About words),
// Contact (hidden until CONTACT.email in timeline.js is set). Black, Clash Display. Focus trap while open, Esc closes, aria-expanded / aria-controls, focus
// returns to the burger, reduced motion = no slide. The rest of the page is inert while the menu is open.
export function mountTallMenu() {
  const about = data.about;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <button type="button" class="tmenu__btn" aria-label="Open menu" aria-expanded="false" aria-controls="tmenu"><span></span><span></span></button>
    <div class="tmenu" id="tmenu" role="dialog" aria-modal="true" aria-label="Menu" data-view="list" hidden>
      <ul class="tmenu__list">
        <li><a href="/work/">Work</a></li>
        <li><button type="button" class="tmenu__about-btn">About</button></li>
        ${CONTACT.email ? `<li><a href="mailto:${CONTACT.email}">Contact</a></li>` : ''}
      </ul>
      <div class="tmenu__about"><p class="tmenu__label">${about.label}</p><p class="tmenu__text">${about.text}</p></div>
    </div>`;
  const btn = wrap.querySelector('.tmenu__btn'), menu = wrap.querySelector('.tmenu');
  document.body.append(...wrap.children);
  const inertEls = () => [document.getElementById('app'), document.querySelector('a.wordmark'), document.querySelector('nav.nav'), document.querySelector('.skip')].filter(Boolean);
  const focusables = () => (menu.dataset.view === 'about' ? [btn, menu.querySelector('.tmenu__text')] : [btn, ...menu.querySelectorAll('a[href], button')]);
  let open = false;
  const set = (on, view = 'list') => {
    if (on === open && menu.dataset.view === view) return;
    open = on;
    btn.setAttribute('aria-expanded', String(on));
    btn.setAttribute('aria-label', on ? 'Close menu' : 'Open menu');
    document.documentElement.classList.toggle('tmenu-open', on);
    inertEls().forEach((el) => { if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert'); });
    if (on) { menu.hidden = false; menu.dataset.view = view; void menu.offsetWidth; menu.classList.add('is-open'); (menu.querySelector(view === 'about' ? '.tmenu__text' : 'a[href], button') || btn).focus({ preventScroll: true }); }
    else { menu.classList.remove('is-open'); const done = () => { if (!open) menu.hidden = true; }; if (matchMedia('(prefers-reduced-motion: reduce)').matches) done(); else setTimeout(done, 360); btn.focus({ preventScroll: true }); }
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
  return { open: () => set(true), close: () => set(false), isOpen: () => open };
}
