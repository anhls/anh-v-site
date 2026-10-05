// R31: the only part of the ?perf report that lives in the normal bundles. `perfOn` is false (and `pm` returns at once) unless the page was opened with
// ?perf (the flag then stays for the tab so the Work -> project -> Back loop keeps measuring; ?perf=0 clears it). Phase marks go to the HUD
// (src/effects/perf-hud.js, its own lazy chunk) or wait in a queue until it has loaded.
export const perfOn = (() => {
  try {
    const q = new URLSearchParams(location.search).get('perf');
    if (q === '0') { sessionStorage.removeItem('perfOn'); return false; }
    if (q !== null) { sessionStorage.setItem('perfOn', '1'); return true; }
    return sessionStorage.getItem('perfOn') === '1';
  } catch { return false; }
})();
export const pm = (name) => {
  if (!perfOn) return;
  if (window.__pm) window.__pm(name, performance.now());
  else (window.__pmq ||= []).push([name, performance.now()]);
};
