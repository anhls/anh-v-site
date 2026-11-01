// R45: the hand-off records between the homepage and the Work page (sessionStorage, one document leaves, the next paints the same picture from its first frame).
//   pxh = Home -> Work: where the first Work card is (rect), the file it shows, the small wordmark's style; the Work page paints the card on the page colour and removes it once its own strip is up.
//   pxg = Work -> Home: the homepage skips its loader and paints the hero frame full screen from its first frame, then lets the video take over.
//   pxhf = the hero's video frame (a jpeg data URL) saved at the click, so the way back grows into the very frame that was left (the poster is the fallback).
const MAX_AGE = 30000;
export function writeHandoff(key, rec) { try { sessionStorage.setItem(key, JSON.stringify({ ...rec, t: Date.now() })); } catch { /* private window: a plain page load */ } }
export function readHandoff(key) {
  try { const r = JSON.parse(sessionStorage.getItem(key) || 'null'); return r && Date.now() - r.t < MAX_AGE ? r : null; } catch { return null; }
}
export function clearHandoff(key) { try { if (key) sessionStorage.removeItem(key); else { sessionStorage.removeItem('pxh'); sessionStorage.removeItem('pxg'); } } catch { /* */ } }

export async function saveHeroFrame(video) {
  try {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh || video.readyState < 2) { sessionStorage.removeItem('pxhf'); return; }
    const w = Math.min(1600, vw), h = Math.round((w * vh) / vw);
    const bmp = await createImageBitmap(video, { resizeWidth: w, resizeHeight: h, resizeQuality: 'medium' }), c = new OffscreenCanvas(w, h);
    c.getContext('2d').drawImage(bmp, 0, 0); bmp.close();
    const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.82 });
    const url = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
    sessionStorage.setItem('pxhf', url);
  } catch { try { sessionStorage.removeItem('pxhf'); } catch { /* */ } }
}
export const readHeroFrame = () => { try { return sessionStorage.getItem('pxhf'); } catch { return null; } };
