// Click sound. There is no background music: one short sound plays when someone clicks inside the
// "Click Anywhere" area (the top 100vh of the page, the same area the image spawner will use), once per click.
// Live behaviour (checked on anh-v.com): each click sets currentTime = 0 and plays, so a new click restarts it.
// The live file is a 0.5s clip hosted on framerusercontent.com (about 16 KB).
// TODO (Anh): self-host this file or supply your own licensed sound, then point data.hero.clickSound at it.
export function initClickSound(src) {
  if (!src) return;
  const audio = new Audio(src);
  audio.preload = 'auto';
  audio.loop = false;

  document.addEventListener('click', (e) => {
    if (e.target.closest('a, button')) return;
    if (e.pageY > window.innerHeight) return; // top 100vh of the page only
    audio.currentTime = 0;
    audio.play().catch(() => {}); // browsers may block it before the first interaction; nothing to do
  });
}
