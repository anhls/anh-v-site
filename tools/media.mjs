// Media batch: ../_site-media (via sources.tsv) -> optimised web files in public/media + src/data/media-manifest.json.
// Run: npm run media            (skips files whose source has not changed)
//      npm run media -- --force (redo everything)
// Images -> WebP at two widths (1x = displayed size at a 2560 screen, 2x = double), never larger than the original.
// Animated cards -> WebM (VP9, alpha where the source has it) + MP4 (H.264, on black) + a poster WebP.
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, copyFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, '../_site-media');
const OUT = resolve(ROOT, 'public/media');
const MANIFEST = resolve(ROOT, 'src/data/media-manifest.json');
const FORCE = process.argv.includes('--force');
const VERSION = 1; // bump when the encoding settings below change

const old = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
const manifest = {};
const cards = JSON.parse(readFileSync(resolve(ROOT, 'src/data/data.json'), 'utf8')).selectedWorkCards;
const outDir = (d) => (d === 'archive' ? 'selected-work' : d); // archive/ in the source folder is selected-work/ on the site

// Rows of sources.tsv: site path, original, live URL, notes.
const rows = readFileSync(resolve(SRC, 'sources.tsv'), 'utf8').split(/\r?\n/).slice(1).filter(Boolean).map((l) => {
  const [site, original, live] = l.split('\t');
  return { site, live: (live || '').split('?')[0] };
});

// Largest size (px at 1920) a card is drawn at, by file; sizes come from data.json (cover-fit, so the larger side counts).
const cardBox = {};
for (const c of cards) if (c.src.startsWith('/media/')) cardBox[basename(c.src, extname(c.src))] = { w: c.w, h: c.h };

// Display width (px at 1920) per folder when there is no card box. Hero stills are full-bleed.
const DEFAULT_W = { captions: 1920, hero: 1920, 'selected-work': 400 };

const sig = (p) => { const s = statSync(p); return `${VERSION}:${s.size}:${Math.round(s.mtimeMs)}`; };
const fresh = (key, s) => !FORCE && old[key]?.sig === s && old[key].files.every((f) => existsSync(resolve(OUT, f.file)));
const ff = (...a) => execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...a], { stdio: 'inherit' });

async function image(row) {
  const dir = outDir(row.site.split('/')[0]);
  const name = basename(row.site, extname(row.site));
  const key = `${dir}/${name}`;
  const file = resolve(SRC, row.site);
  const s = sig(file);
  if (fresh(key, s)) { manifest[key] = old[key]; return; }
  const meta = await sharp(file).metadata();
  const box = cardBox[name];
  const aspect = meta.width / meta.height;
  // Cover-fit: the image must cover w x h, so the needed width is the larger of w and h*aspect.
  const need = box ? Math.max(box.w, box.h * aspect) : DEFAULT_W[dir] ?? 1920;
  const w1 = Math.min(meta.width, Math.round(need * (2560 / 1920)));
  const w2 = Math.min(meta.width, w1 * 2);
  const widths = [...new Set([w1, w2])];
  mkdirSync(resolve(OUT, dir), { recursive: true });
  const files = [];
  for (const w of widths) {
    const rel = `${dir}/${name}-${w}.webp`;
    const info = await sharp(file).resize({ width: w, withoutEnlargement: true }).webp({ quality: 80, alphaQuality: 90, effort: 5 }).toFile(resolve(OUT, rel));
    files.push({ file: rel, width: info.width, height: info.height, bytes: info.size });
  }
  manifest[key] = { type: 'image', source: { width: meta.width, height: meta.height }, alpha: !!meta.hasAlpha, sig: s, files };
  console.log('image', key, `${meta.width}x${meta.height}`, '->', files.map((f) => `${f.width}w ${(f.bytes / 1024).toFixed(0)}KB`).join(', '));
}

// Animated sources. input = ffmpeg input args; alpha = the source has transparency (WebM keeps it, MP4 is on black).
const VIDEOS = [
  // card id 6 on live (150x84): only the original GIF exists
  { name: 'card-img-06', input: ['-i', resolve(SRC, 'archive/card-img-06.gif')], watch: resolve(SRC, 'archive/card-img-06.gif'), alpha: false, maxW: 1280, note: 'GIF 1280x720, 20 fps' },
  // card id 30 on live (343x343): PNG sequence (alpha), 25 fps like the live GIF
  { name: 'watch-anim', input: ['-framerate', '25', '-i', resolve(SRC, 'motion-sources/watch_anim/watch_anim_Main_%04d.png')], watch: resolve(SRC, 'motion-sources/watch_anim/watch_anim_Main_0000.png'), alpha: true, maxW: 700, note: 'PNG sequence 700x700, 121 frames, 25 fps' },
  // card id 35 on live (219x219): WebM keeps the GIF's alpha, MP4 comes from the video master
  { name: 'card-img-30', input: ['-i', resolve(SRC, 'archive/card-img-30.gif')], mp4Input: ['-i', resolve(SRC, 'motion-sources/Final_VIS3.mp4')], watch: resolve(SRC, 'archive/card-img-30.gif'), alpha: true, maxW: 1000, note: 'WebM from GIF 1000x1000 (alpha), MP4 from Final_VIS3.mp4' },
];

async function video(v) {
  const key = `selected-work/${v.name}`;
  const s = [v.watch, ...(v.mp4Input ? [v.mp4Input[1]] : [])].map(sig).join('|');
  if (fresh(key, s)) { manifest[key] = old[key]; return; }
  mkdirSync(resolve(OUT, 'selected-work'), { recursive: true });
  // Delivered at 2x of a 2560 screen, capped at the source size; the card is small so this is plenty.
  const box = cards.find((c) => c.src.includes(v.name));
  const w = Math.min(v.maxW, box ? Math.round(box.w * (2560 / 1920) * 2) : v.maxW);
  const scale = `scale=${w}:-2:flags=lanczos`;
  const webm = `selected-work/${v.name}.webm`, mp4 = `selected-work/${v.name}.mp4`, poster = `selected-work/${v.name}-poster.webp`;
  ff(...v.input, '-vf', `${scale},format=${v.alpha ? 'yuva420p' : 'yuv420p'}`, '-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0', '-an', ...(v.alpha ? ['-auto-alt-ref', '0'] : []), resolve(OUT, webm));
  ff(...(v.mp4Input || v.input), '-vf', `${scale},format=yuv420p`, '-c:v', 'libx264', '-crf', '28', '-preset', 'slow', '-movflags', '+faststart', '-an', resolve(OUT, mp4));
  const pm = await sharp(v.watch, { pages: 1 }).metadata();
  await sharp(v.watch, { pages: 1 }).resize({ width: Math.min(w, 800) }).webp({ quality: 80 }).toFile(resolve(OUT, poster));
  const h = Math.round(w * pm.height / pm.width);
  const files = [webm, mp4, poster].map((f) => ({ file: f, bytes: statSync(resolve(OUT, f)).size }));
  manifest[key] = { type: 'video', width: w, height: h, alpha: v.alpha, webm, mp4, poster, sig: s, files };
  console.log('video', key, `${w}x${h}`, files.map((f) => `${basename(f.file)} ${(f.bytes / 1024).toFixed(0)}KB`).join(', '), '|', v.note);
}

function hero() {
  const key = 'hero/video';
  const file = resolve(SRC, 'hero/video.mp4');
  const s = sig(file);
  if (fresh(key, s)) { manifest[key] = old[key]; return; }
  mkdirSync(resolve(OUT, 'hero'), { recursive: true });
  // Source is already 720x540 at ~210 kbps: re-encoding would only lose quality. Drop the (unused, muted) audio track and keep the video as is.
  ff('-i', file, '-an', '-c:v', 'copy', '-movflags', '+faststart', resolve(OUT, 'hero/video.mp4'));
  ff('-i', file, '-frames:v', '1', '-q:v', '2', resolve(OUT, 'hero/poster.jpg'));
  return sharp(resolve(OUT, 'hero/poster.jpg')).webp({ quality: 80 }).toFile(resolve(OUT, 'hero/poster.webp')).then((info) => {
    const files = [{ file: 'hero/video.mp4', bytes: statSync(resolve(OUT, 'hero/video.mp4')).size }, { file: 'hero/poster.webp', bytes: info.size }];
    manifest[key] = { type: 'video', width: info.width, height: info.height, alpha: false, mp4: 'hero/video.mp4', poster: 'hero/poster.webp', sig: s, files };
    console.log('hero video', files.map((f) => `${f.file} ${(f.bytes / 1024).toFixed(0)}KB`).join(', '));
  });
}

function copySvgs() {
  mkdirSync(resolve(OUT, 'brand'), { recursive: true });
  for (const n of ['wordmark.svg', 'ticker.svg']) {
    copyFileSync(resolve(SRC, 'brand', n), resolve(OUT, 'brand', n));
    manifest[`brand/${n.replace('.svg', '')}`] = { type: 'svg', file: `brand/${n}`, files: [{ file: `brand/${n}`, bytes: statSync(resolve(OUT, 'brand', n)).size }] };
  }
}

const animated = new Set(['card-img-06', 'card-img-30']);
for (const row of rows) {
  const [folder, f] = row.site.split('/');
  if (!['archive', 'captions', 'hero'].includes(folder) || !/\.(png|jpe?g)$/i.test(f)) continue;
  if (animated.has(basename(f, extname(f)))) continue;
  await image(row);
}
for (const v of VIDEOS) await video(v);
await hero();
copySvgs();

// Live URL -> local key, so data.json can keep naming live URLs while the site serves local files.
const byLive = {};
for (const row of rows) {
  if (!row.live) continue;
  const [folder, f] = row.site.split('/');
  const key = `${outDir(folder)}/${basename(f, extname(f))}`;
  if (manifest[key]) byLive[row.live] = key;
}
byLive['https://framerusercontent.com/images/nR62Oa7NyQO1PwrJeyiW8TKmQ.gif'] = 'selected-work/watch-anim'; // card id 30 (343x343)
byLive['https://framerusercontent.com/assets/Fj182DxNzTt7FJdPdgdLo4CAM0.mp4'] = 'hero/video';
manifest.__byLive = byLive;

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n');
const all = Object.values(manifest).flatMap((m) => m.files || []);
const total = all.reduce((a, f) => a + f.bytes, 0);
const big = all.reduce((a, f) => (f.bytes > a.bytes ? f : a), { bytes: 0 });
console.log(`\n${all.length} files, ${(total / 1048576).toFixed(1)} MB total; largest ${big.file} ${(big.bytes / 1048576).toFixed(2)} MB`);
