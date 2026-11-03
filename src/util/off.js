// R52d: BISECT switches for the phone Home (?off=hero,blend,... or ?off=all). Each key removes ONE suspect layer so a screen recording on the iPhone shows which one makes the Home menu / loader sweep drop to 30 fps.
// Nothing changes when the parameter is absent. Keys (docs/codex/R52d-notes.md): hero (the <video> + its wrapper, page colour), video (only the <video>: the poster stays), blend (the burger's mix-blend-mode),
// blur (the menu items' CSS blur filter + will-change), wm (the big wordmark), spawn (the tap spawner), loader (no loader). all = every key above (the 60 fps control). ?smeardpr=1 is a value switch (home-flight.js).
const raw = new URLSearchParams(location.search).get('off') || '';
const KEYS = ['hero', 'video', 'blend', 'blur', 'wm', 'spawn', 'loader'];
export const OFF = new Set(raw === 'all' ? KEYS : raw.split(',').map((s) => s.trim()).filter((s) => KEYS.includes(s)));
export const offList = () => [...OFF].join(',');
const CSS = {
  hero: '.thero{display:none!important}',
  video: '.thero__video{display:none!important}',
  blend: '.tmenu__btn{mix-blend-mode:normal!important}',
  blur: '.tmenu__fx{filter:none!important;will-change:auto!important}',
  wm: '.twm{display:none!important}',
};
export function applyOff() {
  if (!OFF.size) return;
  const css = [...OFF].map((k) => CSS[k]).filter(Boolean).join('\n');
  if (css) { const st = document.createElement('style'); st.id = 'off-css'; st.textContent = css; document.head.append(st); }
}
