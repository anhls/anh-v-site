// R52 fix: the bottom safe area (env(safe-area-inset-bottom), px) as a number, for the JS that places the big AV wordmark. The CSS side reads the same env() as --safe-b (tall.css .twm); both
// give the same px, so the big AV sits at the identical rect on Home, Work, project pages, the open menu and the R52 hand-off layer: ABOVE the safe area (0 where there is none: desktop, Safari with its toolbar).
let probe = null, cached = -1;
export function safeBottom(fresh) {
  if (!fresh && cached >= 0) return cached;
  try {
    if (!probe) { probe = document.createElement('div'); probe.setAttribute('aria-hidden', 'true'); probe.style.cssText = 'position:fixed;left:0;bottom:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom,0px)'; document.body.append(probe); }
    cached = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
  } catch { cached = 0; }
  return cached;
}
