// R44: builds the phone hero of a landscape poster whose title sits in the picture (Bitis: "EM OI, ANH NHO NHA"): a portrait canvas (the phone's shape, 9:19.5)
// with the whole poster at full width in the middle, its own blurred / darkened picture filling the rest, edges feathered so there is no visible box.
// node tools/r44-hero-phone.mjs bitis09/hero bitis09/hero-phone   (reads public/media/<in>-1920.webp, writes <out>-600/-1200.webp, prints the manifest entry)
import sharp from 'sharp';
import fs from 'node:fs';
const [inKey, outKey] = process.argv.slice(2);
const src = `public/media/${inKey}-1920.webp`, W = 1170, H = 2532;
const meta = await sharp(src).metadata(), fgH = Math.round(W * meta.height / meta.width), top = Math.round((H - fgH) * 0.44);
const bg = await sharp(src).resize(W, H, { fit: 'cover', position: 'centre' }).blur(90).modulate({ brightness: 0.5, saturation: 1.1 }).toBuffer();
const feather = 70;
const mask = Buffer.from(`<svg width="${W}" height="${fgH}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="${feather / fgH}" stop-color="#fff" stop-opacity="1"/><stop offset="${1 - feather / fgH}" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect width="${W}" height="${fgH}" fill="url(#g)"/></svg>`);
const fg = await sharp(src).resize(W, fgH).ensureAlpha().composite([{ input: await sharp(mask).png().toBuffer(), blend: 'dest-in' }]).png().toBuffer();
const full = await sharp(bg).composite([{ input: fg, left: 0, top }]).toBuffer();
fs.mkdirSync(`public/media/${outKey.split('/')[0]}`, { recursive: true });
const files = [];
for (const w of [600, 1170]) { const h = Math.round(H * w / W), f = `${outKey}-${w}.webp`; await sharp(full).resize(w, h).webp({ quality: 82 }).toFile(`public/media/${f}`); files.push({ file: f, width: w, height: h, bytes: fs.statSync(`public/media/${f}`).size }); }
console.log(JSON.stringify({ type: 'image', source: { width: W, height: H }, alpha: false, sig: 'r44-generated', files }));
