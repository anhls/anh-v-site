// R34: new-project media. usage: node tools/r34-media.mjs duhat   (reads tools/r34-<project>.json = { slug, srcDir, items: [{ name, src, kind: 'img'|'loop', maxW?, fps?, crf? }] })
// img  -> WebP at 800 / 1600 / source width (never larger than the source), keys like the other pages: <slug>/<name>
// loop -> mp4 (H.264, faststart) + webm (VP9) + poster WebP, muted, width = source width capped at maxW (default 1440), no upscaling
// Writes public/media/<slug>/ and merges the entries into src/data/media-manifest.json (the format the page renderer reads).
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(resolve(ROOT, `tools/r34-${process.argv[2]}.json`), 'utf8'));
const only = process.argv[3] ? process.argv[3].split(',') : null;
const OUT = resolve(ROOT, 'public/media', cfg.slug);
const MANIFEST = resolve(ROOT, 'src/data/media-manifest.json');
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
mkdirSync(OUT, { recursive: true });
const ff = (...a) => execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...a], { stdio: 'inherit' });
const kb = (n) => `${(n / 1024).toFixed(0)}KB`;
const report = [];

for (const it of cfg.items) {
  if (only && !only.includes(it.name)) continue;
  const src = resolve(ROOT, cfg.srcDir, it.src), key = `${cfg.slug}/${it.name}`, srcBytes = statSync(src).size;
  if (it.kind === 'img') {
    const meta = await sharp(src).metadata();
    const top = Math.min(it.maxW || 1920, meta.width), widths = [...new Set([800, 1600].filter((w) => w < top).concat([top]))];
    const files = [];
    for (const w of widths) {
      const rel = `${cfg.slug}/${it.name}-${w}.webp`;
      const info = await sharp(src).resize({ width: w, withoutEnlargement: true }).webp({ quality: it.q || 82, alphaQuality: 92, effort: 5 }).toFile(resolve(ROOT, 'public/media', rel));
      files.push({ file: rel, width: info.width, height: info.height, bytes: info.size });
    }
    manifest[key] = { type: 'image', source: { width: meta.width, height: meta.height }, alpha: !!meta.hasAlpha, sig: `r34:${srcBytes}`, files };
    report.push([key, it.src, `${meta.width}x${meta.height}`, (srcBytes / 1e6).toFixed(1) + 'MB', files.map((f) => `${f.width}w ${kb(f.bytes)}`).join(' + '), files.reduce((s, f) => s + f.bytes, 0)]);
  } else {
    const meta = await sharp(src, { animated: true, limitInputPixels: false }).metadata();
    const ph = meta.pageHeight || meta.height, delays = (meta.delay || []).filter((d) => d > 0).sort((a, b) => a - b), med = delays.length ? delays[Math.floor(delays.length / 2)] : 40;
    const fps = it.fps || Math.max(10, Math.min(30, Math.round(1000 / Math.max(med, 20))));
    let w;
    // R35: it.crop = [w, h, x, y] in source pixels (trim a transparent border); it.bg = '#rrggbb' bakes the colour under a transparent GIF (outlines drawn in black need a light slide colour)
    const [cw, ch, cx, cy] = it.crop || [meta.width, ph, 0, 0];
    w = Math.min(it.maxW || 1440, cw); w -= w % 2;
    const h = Math.round((w * ch) / cw / 2) * 2;
    const pm = await sharp(src, { pages: 1, limitInputPixels: false }).metadata();
    const alpha = !!it.alpha;
    const base = `${it.crop ? `crop=${cw}:${ch}:${cx}:${cy},` : ''}fps=${fps},scale=${w}:${h}:flags=lanczos`;
    const bgIn = it.bg ? ['-f', 'lavfi', '-i', `color=c=0x${it.bg.replace('#', '')}:s=${meta.width}x${ph}:r=${fps}`] : [];
    const inArgs = (extra) => (it.bg ? [...bgIn, '-i', src, '-filter_complex', `[0][1]overlay=shortest=1,${base},format=${extra}`] : ['-i', src, '-vf', `${base},format=${extra}`]);
    const webm = `${cfg.slug}/${it.name}.webm`, mp4 = `${cfg.slug}/${it.name}.mp4`, poster = `${cfg.slug}/${it.name}-poster.webp`;
    ff(...inArgs(alpha ? 'yuva420p' : 'yuv420p'), '-c:v', 'libvpx-vp9', '-crf', String(it.crf || 34), '-b:v', '0', '-an', ...(alpha ? ['-auto-alt-ref', '0'] : []), resolve(ROOT, 'public/media', webm));
    ff(...inArgs('yuv420p'), '-c:v', 'libx264', '-crf', String((it.crf || 34) - 6), '-preset', 'slow', '-movflags', '+faststart', '-an', resolve(ROOT, 'public/media', mp4));
    await sharp(src, { pages: 1, limitInputPixels: false }).extract({ left: cx, top: cy, width: cw, height: ch }).flatten(alpha ? {} : { background: it.bg || '#000' }).resize({ width: Math.min(w, 1200) }).webp({ quality: 80 }).toFile(resolve(ROOT, 'public/media', poster));
    const files = [webm, mp4, poster].map((f) => ({ file: f, bytes: statSync(resolve(ROOT, 'public/media', f)).size }));
    manifest[key] = { type: 'video', width: w, height: h, alpha, webm, mp4, poster, sig: `r34:${srcBytes}`, files };
    report.push([key, it.src, `${meta.width}x${ph} x${meta.pages} @${fps}fps${alpha ? ' ALPHA' : ''}`, (srcBytes / 1e6).toFixed(1) + 'MB', `${w}x${h}: webm ${kb(files[0].bytes)} + mp4 ${kb(files[1].bytes)} + poster ${kb(files[2].bytes)}`, files[0].bytes + files[1].bytes + files[2].bytes]);
  }
  console.log(report[report.length - 1].slice(0, 5).join(' | '));
}
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
writeFileSync(resolve(ROOT, `tools/scratch/r34-${process.argv[2]}-report.json`), JSON.stringify(report));
console.log('total served by one visitor per item is only one webm OR mp4; sum of all files:', (report.reduce((s, r) => s + r[5], 0) / 1e6).toFixed(1), 'MB');
