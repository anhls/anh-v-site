// R13f: plot live-vs-ours displacement for 4 representative cards -> tools/scratch/r13f-live-vs-ours.png
//   node tools/scratch/r13f-plot.mjs   (reads r13f-data.json, written by r13f-measure.mjs)
import sharp from 'sharp';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const D = JSON.parse(fs.readFileSync(new URL('./r13f-data.json', import.meta.url)));
const { sel, rec, H } = D;
const amp = (k) => Math.max(...rec[k].map((q) => Math.abs(q.ourX)));
const pickBy = (test, rank) => { const ks = sel.map((s, k) => k).filter((k) => test(sel[k].mouse)).sort((a, b) => amp(b) - amp(a)); return ks[Math.min(rank, ks.length - 1)]; };
const cards = [pickBy((m) => m >= 75, 0), pickBy((m) => m >= 75, 3), pickBy((m) => m <= 25, 0), pickBy((m) => m <= 25, 5)];
const labels = ['front, near the frame', 'front, farther out', 'back, near the frame', 'back, farther out'];
const CW = 440, CH = 190, PAD = 46, GAPX = 20;
let svg = '';
const rowsDef = [['X', 'sideways offset (px)'], ['Y', 'vertical offset (px)']];
const colour = { live: '#9aa0a6', ours: '#e8590c', tgt: '#e8590c' };
cards.forEach((k, ci) => {
  const r = rec[k];
  rowsDef.forEach(([ax, title], ri) => {
    const ox = PAD + ci * (CW + GAPX), oy = 100 + ri * (CH + 70);
    const key = (s) => r.map((q) => q[s + ax]);
    const live = key('live'), ours = key('our'), tgt = r.map((q) => q['ourT' + ax]);
    const all = [...live, ...ours, ...tgt];
    let lo = Math.min(0, ...all), hi = Math.max(0, ...all); const padv = (hi - lo) * 0.08 || 10; lo -= padv; hi += padv;
    const sx = (i) => ox + (i / (r.length - 1)) * CW, sy = (v) => oy + CH - ((v - lo) / (hi - lo)) * CH;
    const path = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
    svg += `<rect x="${ox}" y="${oy}" width="${CW}" height="${CH}" fill="#16181b" stroke="#2c3036"/>`;
    svg += `<line x1="${ox}" x2="${ox + CW}" y1="${sy(0)}" y2="${sy(0)}" stroke="#3a3f46"/>`;
    svg += `<path d="${path(live)}" fill="none" stroke="${colour.live}" stroke-width="2.4"/>`;
    svg += `<path d="${path(tgt)}" fill="none" stroke="${colour.tgt}" stroke-width="1" stroke-dasharray="4 3" opacity="0.7"/>`;
    svg += `<path d="${path(ours)}" fill="none" stroke="${colour.ours}" stroke-width="2.4"/>`;
    [lo, hi].forEach((v) => { svg += `<text x="${ox - 6}" y="${sy(v) + 4}" font-size="11" fill="#9aa0a6" text-anchor="end">${v.toFixed(0)}</text>`; });
    if (ri === 0) svg += `<text x="${ox}" y="${oy - 26}" font-size="14" font-weight="600" fill="#e8eaed">${labels[ci]} (card ${sel[k].id})</text>`;
    svg += `<text x="${ox}" y="${oy - 6}" font-size="11" fill="#9aa0a6">${title}, scroll &#8594;</text>`;
  });
});
const w = PAD + 4 * (CW + GAPX), h = 100 + 2 * (CH + 70) + 10;
svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" font-family="Arial, sans-serif"><rect width="100%" height="100%" fill="#0e0f11"/>
<text x="${PAD}" y="24" font-size="16" font-weight="700" fill="#e8eaed">R13f: live's parting (grey, on the same card positions, strength 1.15) vs our aura (orange; dashed = its target), ${D.W}x${D.H}, scroll ${D.SPEED} px/s</text>
<text x="${PAD}" y="44" font-size="12" fill="#9aa0a6">Each chart runs from the section coming in (left) to leaving (right). Flat orange on a sloped grey = the card is not near the frame, so only live moves it.</text>${svg}</svg>`;
await sharp(Buffer.from(svg)).png().toFile(fileURLToPath(new URL('./r13f-live-vs-ours.png', import.meta.url)));
console.log('saved tools/scratch/r13f-live-vs-ours.png', cards.map((k) => sel[k].id));
