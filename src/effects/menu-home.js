// R52: the big AV in the open phone menu goes Home "as if the menu were closed ON the homepage".
// The page that is left (Work, a project) writes the record `pxm` (localStorage, 10 s, deleted on read: like pxg / pxh) holding a SNAPSHOT of its open menu
// (the markup with every position placeMenu() set inline, the burger as an X, the rules of tall.css it needs) and the viewport; index.html paints that snapshot as
// the layer #pxg[data-menu] from the first frame, src/tall-home.js skips the loader and hands the layer over to the live menu, which plays its normal close.
export const MENU_HOME_MAX_AGE = 10000;

// the rules the snapshot needs: everything of the phone menu / wordmark in tall.css (the homepage has not loaded tall.css when it paints its first frame)
const rulesText = () => {
  const out = [];
  const take = (rules) => { for (const r of rules) { const t = r.cssText; if (t.includes('tmenu') || t.includes('.twm') || t.includes('--tall-small')) out.push(t); } };
  for (const sh of document.styleSheets) { try { take(sh.cssRules); } catch { /* a sheet from another origin */ } }
  return out.join('\n');
};

export function writeMenuHome({ menu, btn, vInk, view, cur = -1, shift = 0 }) {
  try {
    const m = menu.cloneNode(true), b = btn.cloneNode(true);
    for (const n of [m, b, ...m.querySelectorAll('[id]')]) n.removeAttribute('id');
    m.removeAttribute('hidden'); m.removeAttribute('inert'); m.removeAttribute('role'); m.removeAttribute('aria-modal'); m.classList.remove('is-plain');
    m.dataset.view = view || 'list'; m.querySelector('.tmenu__panel').style.clipPath = 'none';
    // the items at REST (a tap during the sweep must not freeze a half-blurred item) and Home has no current-page line
    m.querySelectorAll('.tmenu__fx').forEach((e) => { e.style.opacity = '1'; e.style.filter = 'none'; e.style.transform = 'none'; });
    // R52b: the current-page line stays DRAWN (cur = the index of that link, -1 = none) and its word stays pushed: the hand-off frame = the last frame of the page that was left; the pull-back is the first step of the close
    const links = [...m.querySelectorAll('.tmenu__list a, .tmenu__list button')];
    links.forEach((a, i) => {
      const on = i === cur, ar = a.querySelector('.tmenu__arr'), w = a.querySelector('.tmenu__w');
      a.classList.toggle('is-cur', on);
      if (ar) { ar.style.transformOrigin = '0 50%'; ar.style.transform = on ? 'scaleX(1)' : 'scaleX(0)'; }
      if (w) w.style.transform = on ? `translateX(${shift}px)` : 'none';
    });
    b.setAttribute('aria-expanded', 'true'); b.removeAttribute('aria-controls'); b.tabIndex = -1;
    const rec = { t: Date.now(), W: innerWidth, H: innerHeight, view: view || 'list', vInk: vInk || 0, css: rulesText(), cur, html: b.outerHTML + m.outerHTML };
    localStorage.setItem('pxm', JSON.stringify(rec));
    return true;
  } catch { return false; }
}
export const clearMenuHome = () => { try { localStorage.removeItem('pxm'); } catch { /* */ } };
