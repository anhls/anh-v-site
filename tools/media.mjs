// Media batch: ../_site-media (via sources.tsv) -> optimised web files in public/media + src/data/media-manifest.json.
// Run: npm run media            (skips files whose source has not changed)
//      npm run media -- --force (redo everything)
// Images -> WebP at two widths (1x = displayed size at a 2560 screen, 2x = double), never larger than the original.
// Animated cards -> WebM (VP9, alpha where the source has it) + MP4 (H.264, on black) + a poster WebP.
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, copyFileSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, '../_site-media');
const OUT = resolve(ROOT, 'public/media');
const MANIFEST = resolve(ROOT, 'src/data/media-manifest.json');
const FORCE = process.argv.includes('--force');
const VERSION = 4; // bump when the encoding settings below change

const old = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
const manifest = {};
const data = JSON.parse(readFileSync(resolve(ROOT, 'src/data/data.json'), 'utf8'));
const cards = data.selectedWorkCards;
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
const DEFAULT_W = { captions: 430 /* hover previews only (22.24vw) */, hero: 1920, 'selected-work': 400, spawner: 648, trail: 200 };

// Images also used by the click spawner (drawn up to 60vh tall: 648 px high at 1080) or the cursor trail (200 px square), by live URL.
const liveKey = (u) => u.split('?')[0];
const spawnerUrls = new Set((data.spawnerImages || []).map(liveKey));
const trailUrls = new Set((data.trailImages || []).map(liveKey));

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
  const animated = extname(file).toLowerCase() === '.gif';
  const meta = await sharp(file, { animated }).metadata();
  const srcH = meta.pageHeight || meta.height; // an animated image reports all frames stacked in height
  const box = cardBox[name];
  const aspect = meta.width / srcH;
  // Cover-fit: the image must cover w x h, so the needed width is the larger of w and h*aspect.
  let need = box ? Math.max(box.w, box.h * aspect) : DEFAULT_W[dir] === 648 ? 648 * aspect : DEFAULT_W[dir] ?? 1920;
  if (spawnerUrls.has(row.live)) need = Math.max(need, 648 * aspect);
  if (trailUrls.has(row.live)) need = Math.max(need, 200);
  const w1 = Math.min(meta.width, Math.round(need * (2560 / 1920)));
  const w2 = Math.min(meta.width, w1 * 2);
  const widths = [...new Set([w1, w2])];
  mkdirSync(resolve(OUT, dir), { recursive: true });
  const files = [];
  for (const w of widths) {
    const rel = `${dir}/${name}-${w}.webp`;
    const info = await sharp(file, { animated }).resize({ width: w, withoutEnlargement: true }).webp({ quality: animated ? 70 : 80, alphaQuality: 90, effort: animated ? 4 : 5 }).toFile(resolve(OUT, rel));
    files.push({ file: rel, width: info.width, height: animated ? Math.round((info.width * srcH) / meta.width) : info.height, bytes: info.size });
  }
  manifest[key] = { type: 'image', source: { width: meta.width, height: srcH }, alpha: !!meta.hasAlpha, sig: s, files };
  console.log('image', key, `${meta.width}x${srcH}${animated ? ' animated' : ''}`, '->', files.map((f) => `${f.width}w ${(f.bytes / 1024).toFixed(0)}KB`).join(', '));
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

const cardGifs = new Set(['card-img-06', 'card-img-30']); // these become video loops (VIDEOS above)
for (const row of rows) {
  const [folder, f] = row.site.split('/');
  if (!['archive', 'captions', 'hero', 'spawner', 'trail'].includes(folder) || !/\.(png|jpe?g|gif)$/i.test(f)) continue;
  if (folder === 'archive' && cardGifs.has(basename(f, extname(f)))) continue;
  await image(row);
}
for (const v of VIDEOS) await video(v);
await hero();
copySvgs();

// ---- R19: project pages (public/media/<slug>/) ----------------------------------------------------------------------------------
// One entry per file a project page uses. Images: WebP at 800 / 1600 / 2560 wide (never above the source). Loops: WebM + MP4 + poster.
// `src` is relative to ../_site-media; files that the home page also uses (archive/ captions/ hero/) are read from there, not copied twice.
const PROJECT_MEDIA = {
  bitis09: {
    images: {
      hero: 'bitis09/img-hero.png', 'insight-a': 'bitis09/img-insight-a.jpg', soobin: 'archive/card-img-24.jpg', 'gallery-1': 'bitis09/img-gallery-1.jpg',
      billboard: 'hero/s3_middle.jpg', 'tagline-side': 'captions/caption-2.jpg', 'wrapup-a': 'bitis09/img-wrapup-a.png', 'look-a': 'archive/card-img-18.jpg',
      'look-b': 'archive/card-img-17.png', tet: 'archive/card-img-20.jpg', 'promo-a': 'bitis09/img-promo-a.png', 'promo-b': 'bitis09/img-promo-b.png',
      sketch: 'bitis09/img-sketch.png', finale: 'archive/card-img-02.jpg',
    },
    loops: {
      tagline: { src: 'bitis09/img-tagline.gif', maxW: 1920, alpha: true }, campaign: { src: 'bitis09/vid-live-1-campaign.mp4', maxW: 1440 },
      'timecross-a': { src: 'bitis09/vid-live-2-timecross-a.mp4', maxW: 1280 }, 'timecross-b': { src: 'bitis09/vid-live-3-timecross-b.mp4', maxW: 1280 },
      wrapup: { src: 'bitis09/vid-live-4-wrapup.mp4', maxW: 1600 }, concept: { src: 'bitis09/vid-live-5-concept.mp4', maxW: 1000 },
    },
  },
};

// R18: images that data.json still pointed at on the live host (they were loaded unoptimised from framerusercontent.com). The originals are
// downloaded once into tools/live-media/ (committed, small) and converted like the rest; data.json keeps the live URL, util/media.js maps it.
const LIVE_EXTRA = {
  'home/hero-s2': { live: 'https://framerusercontent.com/images/aZoZ5nVZFbgwsySGNQ5CXL2rQ.jpg', widths: [800, 1600, 2560] },
  // the billboard is also a small More Projects strip image: a small file set for the live-URL consumers (the hero layer keeps the big one)
  'home/billboard-small': { live: 'https://framerusercontent.com/images/AlABm8NL9nRp1XFUf62ccnFB8.jpg', widths: [640, 1280], src: 'hero/s3_middle.jpg' },
  'home/more-projects-tcb': { live: 'https://framerusercontent.com/images/QUzoZUsI26ew5csK6GR0cPOsKQ.jpg', widths: [640, 1280] },
};
async function liveExtra(key, v) {
  const file = v.src ? resolve(SRC, v.src) : resolve(ROOT, 'tools/live-media', `${key.replace('/', '-')}${extname(v.live)}`);
  if (!existsSync(file)) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from(await (await fetch(v.live)).arrayBuffer()));
  }
  const s = sig(file);
  if (fresh(key, s)) { manifest[key] = old[key]; return; }
  const meta = await sharp(file).metadata();
  const [dir, name] = key.split('/');
  mkdirSync(resolve(OUT, dir), { recursive: true });
  const files = [];
  for (const w of [...new Set(v.widths.map((x) => Math.min(x, meta.width)))]) {
    const out = `${dir}/${name}-${w}.webp`;
    const info = await sharp(file).resize({ width: w, withoutEnlargement: true }).webp({ quality: 80, effort: 5 }).toFile(resolve(OUT, out));
    files.push({ file: out, width: info.width, height: info.height, bytes: info.size });
  }
  manifest[key] = { type: 'image', source: { width: meta.width, height: meta.height }, alpha: false, sig: s, files };
  console.log('image', key, `${meta.width}x${meta.height}`, '->', files.map((f) => `${f.width}w ${(f.bytes / 1024).toFixed(0)}KB`).join(', '));
}
for (const [key, v] of Object.entries(LIVE_EXTRA)) await liveExtra(key, v);

async function projectImage(slug, name, rel) {
  const key = `${slug}/${name}`;
  const file = resolve(SRC, rel);
  const s = sig(file);
  if (fresh(key, s)) { manifest[key] = old[key]; return; }
  const meta = await sharp(file, { limitInputPixels: false }).metadata();
  mkdirSync(resolve(OUT, slug), { recursive: true });
  const widths = [...new Set([800, 1600, 2560].map((w) => Math.min(w, meta.width)))];
  const files = [];
  for (const w of widths) {
    const out = `${slug}/${name}-${w}.webp`;
    const info = await sharp(file, { limitInputPixels: false }).resize({ width: w, withoutEnlargement: true }).webp({ quality: 80, alphaQuality: 90, effort: 5 }).toFile(resolve(OUT, out));
    files.push({ file: out, width: info.width, height: info.height, bytes: info.size });
  }
  manifest[key] = { type: 'image', source: { width: meta.width, height: meta.height }, alpha: !!meta.hasAlpha, sig: s, files };
  console.log('image', key, `${meta.width}x${meta.height}`, '->', files.map((f) => `${f.width}w ${(f.bytes / 1024).toFixed(0)}KB`).join(', '));
}

async function projectLoop(slug, name, v) {
  const key = `${slug}/${name}`;
  const file = resolve(SRC, v.src);
  const s = sig(file);
  if (fresh(key, s)) { manifest[key] = old[key]; return; }
  mkdirSync(resolve(OUT, slug), { recursive: true });
  const probe = spawnSync(ffmpegPath, ['-hide_banner', '-i', file], { encoding: 'utf8' }).stderr.match(/, (\d{2,5})x(\d{2,5})[ ,]/);
  const sw = +probe[1], sh = +probe[2];
  const w = Math.min(v.maxW, sw) & ~1;
  const h = Math.round((w * sh) / sw / 2) * 2;
  const scale = `scale=${w}:${h}:flags=lanczos,format=yuv420p`;
  const webm = `${slug}/${name}.webm`, mp4 = `${slug}/${name}.mp4`, poster = `${slug}/${name}-poster.webp`;
  if (v.alpha) {
    // Transparent loop (never flattened onto a colour): VP9 WebM with alpha for Chrome / Firefox / Edge, an animated WebP with alpha
    // for Safari (it plays no WebM alpha) and as a poster. No MP4 (H.264 has no alpha).
    const webp = `${slug}/${name}.webp`;
    const aScale = `fps=25,scale=${w}:${h}:flags=lanczos,format=yuva420p`;
    ff('-i', file, '-vf', aScale, '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0', '-crf', '34', '-b:v', '0', '-an', resolve(OUT, webm));
    await sharp(file, { animated: true }).resize({ width: Math.min(w, 1280) }).webp({ quality: 75, alphaQuality: 90, effort: 5, loop: 0 }).toFile(resolve(OUT, webp));
    await sharp(file, { pages: 1 }).resize({ width: Math.min(w, 1280) }).webp({ quality: 78, alphaQuality: 90 }).toFile(resolve(OUT, poster));
    const af = [webm, webp, poster].map((f) => ({ file: f, bytes: statSync(resolve(OUT, f)).size }));
    manifest[key] = { type: 'video', width: w, height: h, alpha: true, webm, webp, poster, sig: s, files: af };
    console.log('loop (alpha)', key, `${w}x${h}`, af.map((f) => `${basename(f.file)} ${(f.bytes / 1024).toFixed(0)}KB`).join(', '));
    return;
  }
  ff('-i', file, '-vf', scale, '-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0', '-an', resolve(OUT, webm));
  ff('-i', file, '-vf', scale, '-c:v', 'libx264', '-crf', '27', '-preset', 'slow', '-movflags', '+faststart', '-an', resolve(OUT, mp4));
  const png = resolve(OUT, `${slug}/${name}-poster.png`);
  ff('-i', file, '-frames:v', '1', '-vf', `scale=${Math.min(w, 1280)}:-2`, png);
  await sharp(png).webp({ quality: 78 }).toFile(resolve(OUT, poster));
  unlinkSync(png);
  const files = [webm, mp4, poster].map((f) => ({ file: f, bytes: statSync(resolve(OUT, f)).size }));
  manifest[key] = { type: 'video', width: w, height: h, alpha: false, webm, mp4, poster, sig: s, files };
  console.log('loop', key, `${w}x${h}`, files.map((f) => `${basename(f.file)} ${(f.bytes / 1024).toFixed(0)}KB`).join(', '));
}

for (const [slug, m] of Object.entries(PROJECT_MEDIA)) {
  for (const [name, rel] of Object.entries(m.images)) await projectImage(slug, name, rel);
  for (const [name, v] of Object.entries(m.loops)) await projectLoop(slug, name, v);
}

// Live URL -> local key, so data.json can keep naming live URLs while the site serves local files.
const byLive = {};
// A live URL can appear in several folders (a card, a hover preview, a hero layer). The consumers that go through data.json URLs are all small
// (cards, hover previews, the More Projects strip, trail, spawner), so take the SMALLEST converted file set that still reaches 1000 px (2x of
// the biggest of them at 2560), never the full-bleed hero variant. R18: they used to get the 1800-2560 px hero file.
const cands = {};
for (const row of rows) {
  if (!row.live) continue;
  const [folder, f] = row.site.split('/');
  const key = `${outDir(folder)}/${basename(f, extname(f))}`;
  if (manifest[key]) (cands[row.live] ||= []).push(key);
}
const widest = (k) => Math.max(...manifest[k].files.map((x) => x.width || 0));
for (const [live, keys] of Object.entries(cands)) {
  const ok = keys.filter((k) => widest(k) >= 1000).sort((x, y) => widest(x) - widest(y));
  byLive[live] = ok[0] || keys.sort((x, y) => widest(y) - widest(x))[0];
}
byLive['https://framerusercontent.com/images/nR62Oa7NyQO1PwrJeyiW8TKmQ.gif'] = 'selected-work/watch-anim'; // card id 30 (343x343)
byLive['https://framerusercontent.com/assets/Fj182DxNzTt7FJdPdgdLo4CAM0.mp4'] = 'hero/video';
for (const [key, v] of Object.entries(LIVE_EXTRA)) byLive[v.live] = key;
manifest.__byLive = byLive;

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n');
const all = Object.values(manifest).flatMap((m) => m.files || []);
const total = all.reduce((a, f) => a + f.bytes, 0);
const big = all.reduce((a, f) => (f.bytes > a.bytes ? f : a), { bytes: 0 });
console.log(`\n${all.length} files, ${(total / 1048576).toFixed(1)} MB total; largest ${big.file} ${(big.bytes / 1048576).toFixed(2)} MB`);
