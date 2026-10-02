// R23e: shared by the dev tuning panels (homepage, Work page, project pages; only ever imported while ?tune is in the URL).
//  - tuneStore(page): slider values kept in localStorage (key per page), re-applied by the panel on the next load, cleared by "Reset to defaults".
//    Values that change WHICH cards exist (they need a reload and are applied through the URL: dark share, front share, band limits, seed)
//    are not stored: pass them in `skip` (prefixes).
//  - makeCollapse(box, hideEls, btn): a header button that hides everything but the header (so the page, the toggle and the cards stay
//    clickable); values stay live while collapsed; the state is kept for the session (sessionStorage, shared by the pages).
export function tuneStore(page, skip = []) {
  const KEY = `tune-values:${page}`;
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const skipped = (id) => skip.some((s) => id.startsWith(s));
  return {
    values: () => { const v = read(); for (const id of Object.keys(v)) if (skipped(id)) delete v[id]; return v; },
    set(id, value) { if (skipped(id)) return; try { const o = read(); o[id] = value; localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* storage blocked */ } },
    clear() { try { localStorage.removeItem(KEY); } catch { /* storage blocked */ } },
  };
}

export function makeCollapse(box, hideEls, btn) {
  const get = () => { try { return sessionStorage.getItem('tune-collapsed') === '1'; } catch { return false; } };
  const width = box.style.width;
  const apply = (c) => {
    hideEls.forEach((e) => { e.style.display = c ? 'none' : ''; });
    btn.textContent = c ? '\u25B8 expand' : '\u25BE collapse';
    btn.setAttribute('aria-expanded', String(!c));
    box.style.width = c ? 'auto' : width;
    box.style.overflow = c ? 'visible' : 'auto';
  };
  btn.style.cssText = 'all:unset;cursor:pointer;opacity:.85;font-size:11px;padding:2px 4px';
  btn.addEventListener('click', () => { const c = !get(); try { sessionStorage.setItem('tune-collapsed', c ? '1' : '0'); } catch { /* storage blocked */ } apply(c); });
  apply(get());
}
