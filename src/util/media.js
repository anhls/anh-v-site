// Looks up converted media (written by tools/media.mjs) for a path or a live URL in data.json.
// Anything not in the manifest (still hosted on the live site) is returned unchanged.
import manifest from '../data/media-manifest.json';

const byLive = manifest.__byLive || {};

function entry(ref) {
  if (!ref) return null;
  const clean = ref.split('?')[0];
  const key = byLive[clean] || clean.replace(/^\/media\//, '').replace(/\.[a-z0-9]+$/i, '');
  const m = manifest[key];
  return m && m.type ? m : null;
}

// Attributes for an <img>: src (largest file) + srcset (all widths) + sizes. `sizes` says how wide the image is drawn, e.g. "50vw".
export function imgAttrs(ref, sizes = '100vw', defer = false) {
  const d = defer ? 'data-' : '';
  const m = entry(ref);
  if (!m || m.type !== 'image') return `${d}src="${ref}"`;
  const files = [...m.files].sort((a, b) => a.width - b.width);
  const srcset = files.map((f) => `/media/${f.file} ${f.width}w`).join(', ');
  return `${d}src="/media/${files[files.length - 1].file}" ${d}srcset="${srcset}" sizes="${sizes}" width="${m.source.width}" height="${m.source.height}"`;
}

// Source URL for places that need a plain string (poster, background): the largest converted file.
export function imgSrc(ref) {
  const m = entry(ref);
  if (!m || m.type !== 'image') return ref;
  return `/media/${m.files.reduce((a, f) => (f.width > a.width ? f : a)).file}`;
}

// Video info ({webm, mp4, poster}, paths from /media) when the reference was converted to a video, else null.
export function videoInfo(ref) {
  const m = entry(ref);
  if (!m || m.type !== 'video') return null;
  return { webm: m.webm && `/media/${m.webm}`, mp4: `/media/${m.mp4}`, poster: `/media/${m.poster}` };
}
