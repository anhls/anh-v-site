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

// ---- R22h part 4: Active / Settled groups and parameter descriptions, shared by the three dev panels (homepage, Work, project pages).
// TUNE_SETTLED = the parameters nobody has changed for several builds, per panel, as the ids the panels store values under ('GROUP.key'). They sit in a
// collapsed "Settled" group (open state kept for the session); everything else is "Active". Move an id between the lists to move the slider; when
// unsure keep it out of the list (Active). A slider moved while it sits in Settled is promoted to Active (stored as '@active:<id>' with the other values,
// cleared by Reset to defaults). The descriptions live in tune-docs.js.
export const TUNE_SETTLED = {
  work: [
    'WORK.seed', 'WORK.frameH', 'WORK.gapSide', 'WORK.gapVert', 'WORK.overlapMax', 'WORK.minGap', 'WORK.cardWarp.strength', 'WORK.cardWarp.riseSec', 'WORK.morphEase', 'WORK.morphLanding', 'WORK.dupGap',
    'WORK.focusPush', 'WORK.focusPushRadius', 'WORK.focusPushOthers', 'WORK.dragFriction', 'WORK.dragMaxCoast', 'WORK.snapOvershoot', 'WORK.morphOvershoot', 'WORK.overshootSettle', 'WORK.followerSettleSec',
    'WORK.forceFrom', 'WORK.forceTo', 'SCROLL.gainCap', 'SCROLL.gainFrom', 'SCROLL.gainTo', 'WORK_LIMITS.minN', 'WORK_LIMITS.maxN', 'WORK_LIMITS.minA', 'HOVER.darkShare', 'DEPTH.frontShare',
  ],
  home: [
    'CAPTION.revealSec', 'CAPTION.hideSec', 'CAPTION.fromScale', 'CAPTION.lineInSec', 'CAPTION.lineOutSec', 'CAPTION.textOutSec',
    'TRAIL.frequency', 'TRAIL.visibleFor', 'TRAIL.startMaskShare', 'TRAIL.fadeAtScreen', 'TRAIL.fadeLenVh', 'TRAIL.fadeCurve', 'TRAIL.minScale',
    'LAYOUT.scatter', 'LAYOUT.centreShare', 'LAYOUT.centreBand', 'LAYOUT.minGap', 'LAYOUT.yJitter',
    'HOVER.scale', 'HOVER.stiffness', 'HOVER.damping', 'HOVER.darkRest', 'HOVER.darkScale', 'HOVER.drift', 'HOVER.pushStrength', 'HOVER.pushRadius',
    'FRAME.on', 'FRAME.strengthUp', 'FRAME.strengthDown', 'FRAME.reach', 'FRAME.pinch', 'FRAME.pinchDown', 'FRAME.arc', 'FRAME.persp', 'FRAME.sym', 'FRAME.coverZoom', 'FRAME.deadzone', 'FRAME.threshold', 'FRAME.videoMode', 'FRAME.fadeSec',
    'SCROLL.gainCap', 'SCROLL.gainFrom', 'SCROLL.gainTo',
  ],
  project: ['SCROLL.gainCap', 'SCROLL.gainFrom', 'SCROLL.gainTo'],
};

// One shared floating description: shown while the pointer is over a control or the control has keyboard focus, to the left of the panel.
let tipEl = null;
const tip = () => {
  if (tipEl) return tipEl;
  tipEl = document.createElement('div');
  tipEl.setAttribute('role', 'tooltip');
  tipEl.setAttribute('data-tune-tip', '');
  tipEl.id = 'tune-tip';
  tipEl.style.cssText = 'position:fixed;z-index:100000;width:250px;padding:8px 10px;background:#f2f2f2;color:#111;font:12px/1.4 system-ui,sans-serif;border-radius:6px;box-shadow:0 4px 18px rgba(0,0,0,.35);pointer-events:none;display:none';
  document.body.append(tipEl);
  return tipEl;
};
export function attachTip(row, text) {
  if (!text) return;
  const input = row.querySelector('input,select');
  row.setAttribute('data-tip', text);
  input?.setAttribute('aria-describedby', 'tune-tip');
  const show = () => {
    const t = tip(), r = row.getBoundingClientRect(), box = row.closest('[data-tune-panel],[data-tune-box]')?.getBoundingClientRect() || r;
    t.textContent = text;
    t.style.display = 'block';
    t.style.right = `${Math.max(8, innerWidth - box.left + 8)}px`;
    t.style.top = `${Math.min(Math.max(8, r.top), innerHeight - t.offsetHeight - 8)}px`;
  };
  const hide = () => { if (tipEl) tipEl.style.display = 'none'; };
  row.addEventListener('mouseenter', show);
  row.addEventListener('mouseleave', () => { if (document.activeElement !== input) hide(); });
  input?.addEventListener('focus', show);
  input?.addEventListener('blur', hide);
}

// tuneGroups(parent, panel, store, { docs }): an Active container and a collapsed Settled <details> (made when the first row needs it) inside `parent`.
// add(id, row): puts the row in its group (settled list, unless promoted), attaches its description, promotes it on the first move. header(el) adds a
// heading to Active. reset(): moves the promoted rows back (call it with store.clear()). Several groups may share one panel name (the homepage has one
// per section): the open state is shared.
export function tuneGroups(parent, panel, store, getDoc = () => '') {
  const settledIds = new Set(TUNE_SETTLED[panel] || []);
  const kept = store.values();
  const promoted = new Set(Object.keys(kept).filter((k) => k.startsWith('@active:')).map((k) => k.slice(8)));
  const active = document.createElement('div');
  parent.append(active);
  let settled = null, count = null;
  const OPEN = `tune-settled-open:${panel}`;
  const isOpen = () => { try { return sessionStorage.getItem(OPEN) === '1'; } catch { return false; } };
  const rows = [];
  const ensureSettled = () => {
    if (settled) return settled;
    settled = document.createElement('details');
    settled.setAttribute('data-settled', '');
    settled.style.cssText = 'margin-top:10px;border-top:1px solid rgba(255,255,255,.2);padding-top:6px';
    settled.open = isOpen();
    const sum = document.createElement('summary');
    sum.style.cssText = 'cursor:pointer;font-weight:600;opacity:.85';
    count = document.createElement('span');
    sum.append('Settled ', count);
    settled.append(sum);
    settled.addEventListener('toggle', () => { try { sessionStorage.setItem(OPEN, settled.open ? '1' : '0'); } catch { /* storage blocked */ } });
    parent.append(settled);
    return settled;
  };
  const recount = () => {
    const n = rows.filter((r) => r.inSettled).length;
    if (count) count.textContent = `(${n})`;
    if (settled) settled.style.display = n ? '' : 'none';
  };
  return {
    header: (el) => active.append(el),
    add(id, row) {
      const r = { id, row, inSettled: settledIds.has(id) && !promoted.has(id) };
      rows.push(r);
      (r.inSettled ? ensureSettled() : active).append(row);
      attachTip(row, getDoc(id));
      row.addEventListener('input', () => {
        if (!r.inSettled) return;
        r.inSettled = false;
        active.append(row);
        store.set(`@active:${id}`, 1);
        recount();
      });
      recount();
    },
    reset() { rows.forEach((r) => { if (!r.inSettled && settledIds.has(r.id)) { r.inSettled = true; ensureSettled().append(r.row); } }); promoted.clear(); recount(); },
  };
}
