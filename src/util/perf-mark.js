// R31: the only part of the ?perf report that lives in the normal bundles. `perfOn` is false (and `pm` returns at once) unless the page was opened with
// ?perf (the flag then stays for the tab so the Work -> project -> Back loop keeps measuring; ?perf=0 clears it). Phase marks go to the HUD
// (src/effects/perf-hud.js, its own lazy chunk) or wait in a queue until it has loaded.
// R41d: ?perf=quiet records everything but draws no HUD (no graph, no 10 Hz repaint, no synthetic baseline scroll), only a small Copy-report button: a screen recording then shows the page, not the overlay's own cost.
export const perfMode = (() => {
  try {
    const q = new URLSearchParams(location.search).get('perf');
    if (q === '0') { sessionStorage.removeItem('perfOn'); return ''; }
    if (q !== null) { const v = q === 'quiet' ? 'quiet' : '1'; sessionStorage.setItem('perfOn', v); return v; }
    return sessionStorage.getItem('perfOn') || '';
  } catch { return ''; }
})();
export const perfOn = perfMode === '1' || perfMode === 'quiet';
export const perfQuiet = perfMode === 'quiet';
export const pm = (name) => {
  if (!perfOn) return;
  if (window.__pm) window.__pm(name, performance.now());
  else (window.__pmq ||= []).push([name, performance.now()]);
};
