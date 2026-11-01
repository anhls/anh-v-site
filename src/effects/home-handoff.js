// R45: the hand-off records between the homepage and the Work page (localStorage, one document leaves, the next paints the same picture from its first frame).
// R45c: localStorage, not sessionStorage: a PRERENDERED page (Speculation Rules) has its own copy of the session storage from the moment the prerender started, so a record written later (at the click) would never reach it. Records are read at ACTIVATION.
//   pxh = Home -> Work: where the first Work card is (rect), the file it shows, the small wordmark's style; the Work page paints the card on the page colour and removes it once its own strip is up.
//   pxg = Work -> Home: the homepage skips its loader and paints the hero frame full screen from its first frame, then lets the video take over.
//   pxhf = the hero's video frame (a jpeg data URL) saved at the click, so the way back grows into the very frame that was left (the poster is the fallback).
const MAX_AGE = 10000; // localStorage is shared by every tab and survives restarts: a record older than 10 s is ignored, and every read deletes it (no replay from a second tab or tomorrow)
export function writeHandoff(key, rec) { try { localStorage.setItem(key, JSON.stringify({ ...rec, t: Date.now() })); } catch { /* private window: a plain page load */ } }
export function readHandoff(key) {
  try { const r = JSON.parse(localStorage.getItem(key) || 'null'); localStorage.removeItem(key); return r && Date.now() - r.t < MAX_AGE ? r : null; } catch { return null; }
}
export function clearHandoff(key) { try { if (key) localStorage.removeItem(key); else { localStorage.removeItem('pxh'); localStorage.removeItem('pxg'); } } catch { /* */ } }

export async function saveHeroFrame(video) {
  try {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh || video.readyState < 2) { localStorage.removeItem('pxhf'); localStorage.removeItem('pxhft'); return; }
    const w = Math.min(1600, vw), h = Math.round((w * vh) / vw);
    const bmp = await createImageBitmap(video, { resizeWidth: w, resizeHeight: h, resizeQuality: 'medium' }), c = new OffscreenCanvas(w, h);
    c.getContext('2d').drawImage(bmp, 0, 0); bmp.close();
    const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.82 });
    const url = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
    writeHeroFrame(url);
  } catch { try { localStorage.removeItem('pxhf'); } catch { /* */ } }
}
export const writeHeroFrame = (url) => { try { localStorage.setItem('pxhf', url); localStorage.setItem('pxhft', String(Date.now())); } catch { /* */ } };
// timestamped like the records: ignored after 10 s, deleted when read
export const readHeroFrame = () => { try { const u = localStorage.getItem('pxhf'), t = +localStorage.getItem('pxhft'); localStorage.removeItem('pxhf'); localStorage.removeItem('pxhft'); return u && Date.now() - t < MAX_AGE ? u : null; } catch { return null; } };
