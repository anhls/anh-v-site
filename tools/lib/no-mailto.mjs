// NOTE: assigning location.href is [LegacyUnforgeable] and cannot always be intercepted here, so run card / link tests HEADLESS (default) and read mailto hrefs instead of clicking them.
// Testing rule (Anh): a test must NEVER open the PC's mail app.
//  1) prefer headless runs for link / card checks;
//  2) in every run (headed especially) call `await blockMailto(ctxOrPage)` BEFORE page.goto: it adds an init script that catches clicks on a[href^="mailto:"] and
//     any location.href / assign / open to a mailto: URL (preventDefault + console.log('[mailto-blocked] <href>')), so the OS handler never fires;
//  3) check mailto links by reading their href (`await page.getAttribute('a.x', 'href')`), not by clicking them.
export const MAILTO_INIT = () => {
  const log = (h) => console.log('[mailto-blocked] ' + h);
  document.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('a[href^="mailto:"]:not([data-contact])'); if (a) { /* ([data-contact] links open the contact card, not the mail app) */ e.preventDefault(); log(a.getAttribute('href')); } }, true);
  const wrap = (obj, name) => { const f = obj[name]; if (typeof f !== 'function') return; obj[name] = function (u, ...r) { if (typeof u === 'string' && /^mailto:/i.test(u)) { log(u); return; } return f.call(this, u, ...r); }; };
  try { wrap(Location.prototype, 'assign'); wrap(Location.prototype, 'replace'); wrap(window, 'open'); } catch { /* */ }
  try { const d = Object.getOwnPropertyDescriptor(Location.prototype, 'href'); Object.defineProperty(Location.prototype, 'href', { ...d, set(v) { if (typeof v === 'string' && /^mailto:/i.test(v)) { log(v); return; } d.set.call(this, v); } }); } catch { /* */ }
};
export const blockMailto = (ctxOrPage) => ctxOrPage.addInitScript(MAILTO_INIT);
