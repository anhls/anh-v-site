// R48 r14: per-frame MOTION curve of the phone menu open / close at 60 fps (screencast frames resampled onto a 16.67 ms grid, held when the page paints nothing new).
// node tools/lib/menu-fps.mjs <path, no leading slash: work/ or "" for Home> [W=390] [H=844] [port=5200] [label]   (dev server must run). Pass = open AND close: no run of >= 3 frames < 0.1, no single frame > 3x its neighbours (frames < 2.0 ignored: the page's own shimmer), 2nd frame after the tap > 1.0
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import fs from 'fs';
const [path = "work/", W = 390, H = 844, port = 5200, label = 'menu-fps'] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome' });
const c = await b.newContext({ viewport: { width: +W, height: +H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, timezoneId: 'Asia/Ho_Chi_Minh' });
const p = await c.newPage(); const d = await c.newCDPSession(p);
await p.goto(`http://127.0.0.1:${port}/${path.replace(/^\//, '')}`); await p.waitForFunction(() => window.__siteReady || window.__work || document.querySelector('.tmenu__btn'), null, { timeout: 20000 }).catch(() => {});
await p.waitForTimeout(4500);
await p.evaluate(() => { window.__tapAt = 0; addEventListener('click', (e) => { if (e.target.closest?.('.tmenu__btn')) window.__tapAt = performance.timeOrigin + performance.now(); }, true); });
const frames = []; d.on('Page.screencastFrame', (f) => { frames.push({ t: f.metadata.timestamp * 1000, data: f.data }); d.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
// crop: the cards area (full width, 14 %..86 % of the height), downscaled to 1/2 for speed
const cropTop = Math.round(+H * 0.14), cropH = Math.round(+H * 0.72);
const grey = async (b64) => (await sharp(Buffer.from(b64, 'base64')).extract({ left: 0, top: cropTop, width: +W, height: cropH }).greyscale().raw().toBuffer());
const rec = async (name, act) => {
  frames.length = 0; await d.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 }); await p.waitForTimeout(300);
  await act(); await p.waitForTimeout(1400); await d.send('Page.stopScreencast');
  const tap = await p.evaluate(() => window.__tapAt), t0 = tap - 5 * 16.667; // 5 frames before the tap
  const n = Math.round((tap + 1300 - t0) / 16.667), grid = [];
  const bufs = []; for (const f of frames) bufs.push(await grey(f.data));
  let j = 0; for (let i = 0; i < n; i++) { const tt = t0 + i * 16.667; while (j + 1 < frames.length && frames[j + 1].t <= tt) j++; grid.push(frames[j].t <= tt ? j : -1); }
  const diffs = []; for (let i = 1; i < n; i++) { const a = grid[i - 1], q = grid[i]; if (a < 0 || q < 0 || a === q) { diffs.push(0); continue; } let s = 0; const A = bufs[a], B = bufs[q]; for (let k = 0; k < A.length; k++) s += Math.abs(A[k] - B[k]); diffs.push(+(s / A.length).toFixed(3)); }
  return { name, tapIdx: 5, diffs };
};
const SWEEP = 0.762; // open seconds (HOME_FLIGHT.sec * (crossTo - crossFrom))
const check = (r, sweepSec) => {
  const a = r.tapIdx - 1, lim = Math.min(r.diffs.length, r.tapIdx + Math.round(sweepSec * 60)); let z = a; for (let i = a; i < lim; i++) if (r.diffs[i] > 0.3) z = i + 1; // the window ends at the last frame that still moves (<= the sweep length) // diffs[i] = frame i+1 vs i; frame (tapIdx) is the first after the tap
  const seg = r.diffs.slice(a, z); let run = 0, maxRun = 0, jump = 0, jumpAt = -1;
  seg.forEach((v, i) => { if (v < 0.1) { run++; maxRun = Math.max(maxRun, run); } else run = 0; const nb = Math.max(seg[i - 1] ?? 0, seg[i + 1] ?? 0); if (nb > 0.05 && v > 3 * nb && v > 2.0) { jump = Math.max(jump, v / nb); jumpAt = i; } });
  return { maxDeadRun: maxRun, jumpRatio: +jump.toFixed(1), jumpAtFrame: jumpAt, second: seg[1], pass: maxRun < 3 && jump === 0 && seg[1] > 1.0 };
};
const open = await rec('open', () => p.tap('.tmenu__btn'));
await p.waitForTimeout(500);
const close = await rec('close', () => p.tap('.tmenu__btn'));
const res = { path, open: { ...check(open, SWEEP), curve: open.diffs }, close: { ...check(close, SWEEP / 2), curve: close.diffs } };
fs.writeFileSync(`${label}.json`, JSON.stringify(res));
for (const k of ['open', 'close']) { const r = res[k]; console.log(k, JSON.stringify({ ...r, curve: undefined })); console.log('  curve (frame 0 = 5 frames before tap, 16.7 ms each):', r.curve.slice(0, 70).join(' ')); }
await b.close();
