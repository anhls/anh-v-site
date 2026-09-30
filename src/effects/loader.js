import { gsap } from 'gsap';

// Full-screen loader: "Loading visual language" centred, and a "Loading — 39%" label that follows the cursor.
// Progress is real: it counts the hero assets (images + video) as they finish loading.
// Returns a promise that resolves once the loader has faded out.
export function runLoader(text, urls) {
  const el = document.createElement('div');
  el.className = 'loader';
  el.innerHTML = `<p class="loader__title">${text}</p><p class="loader__label">Loading — <span>0</span>%</p>`;
  document.body.prepend(el);

  const label = el.querySelector('.loader__label');
  const num = label.querySelector('span');

  // Label follows the cursor (eased). Sits top-left until the mouse moves.
  gsap.set(label, { x: 24, y: 24 });
  const moveX = gsap.quickTo(label, 'x', { duration: 0.5, ease: 'power3' });
  const moveY = gsap.quickTo(label, 'y', { duration: 0.5, ease: 'power3' });
  const onMove = (e) => { moveX(e.clientX + 16); moveY(e.clientY + 16); };
  window.addEventListener('mousemove', onMove);

  const total = urls.length + 1; // +1 for fonts
  let done = 0;
  const shown = { v: 0 };
  const tick = () => {
    done += 1;
    gsap.to(shown, { v: Math.round((done / total) * 100), duration: 0.5, ease: 'power2.out', onUpdate: () => { num.textContent = Math.round(shown.v); } });
  };

  const loadOne = (url) => new Promise((resolve) => {
    let finished = false;
    const end = () => { if (!finished) { finished = true; tick(); resolve(); } };
    if (/\.mp4$/i.test(url)) {
      const v = document.createElement('video');
      v.preload = 'auto';
      v.muted = true;
      v.addEventListener('loadeddata', end, { once: true });
      v.addEventListener('error', end, { once: true });
      v.src = url;
      setTimeout(end, 10000); // never block the site on a slow video
    } else {
      const img = new Image();
      img.onload = img.onerror = end;
      img.src = url;
    }
  });

  const fonts = document.fonts.ready.then(tick);

  return Promise.all([fonts, ...urls.map(loadOne)])
    .then(() => new Promise((r) => gsap.to(shown, { v: 100, duration: 0.3, onUpdate: () => { num.textContent = Math.round(shown.v); }, onComplete: r })))
    .then(() => new Promise((resolve) => {
      window.removeEventListener('mousemove', onMove);
      gsap.to(el, {
        opacity: 0, duration: 0.8, ease: 'power2.inOut', delay: 0.2,
        onComplete: () => { el.remove(); resolve(); },
      });
    }));
}
