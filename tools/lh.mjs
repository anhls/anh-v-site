// R24h: Lighthouse on the PRODUCTION build (dist/, run `npm run build` first) with its OWN preview server on a free port that this script starts and stops itself (killed by process
// tree, never by `pkill`), so an old preview server can never be measured by mistake. Prints the scores + LCP / FCP / TBT and which element is the LCP.
// usage: node tools/lh.mjs "/work/?mode=tall" [runs=1] [desktop]      (mobile profile unless the 3rd argument is `desktop`)
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const url = process.argv[2] || '/', runs = Number(process.argv[3] || 1), desktop = process.argv[4] === 'desktop';
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const port = await freePort();
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--outDir', process.env.DIST || 'dist', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
const stop = () => { try { if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); else server.kill('SIGKILL'); } catch { /* gone */ } };
process.on('exit', stop); process.on('SIGINT', () => { stop(); process.exit(1); });
for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://localhost:${port}/`); if (r.ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 250)); }
console.log(`preview on :${port} (own server, pid ${server.pid}) -> ${url}`);
const out = path.join(os.tmpdir(), `lh-${port}.json`);
for (let k = 0; k < runs; k++) {
  const args = ['--yes', 'lighthouse@12', `http://localhost:${port}${url}`, '--quiet', '--chrome-flags=--headless=new', '--output=json', `--output-path=${out}`];
  if (desktop) args.push('--preset=desktop'); else args.push('--form-factor=mobile');
  spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { stdio: 'ignore', shell: process.platform === 'win32' });
  const r = JSON.parse(fs.readFileSync(out, 'utf8')), a = r.audits, lcpEl = r.audits['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.selector;
  console.log(Object.entries(r.categories).map(([n, v]) => `${n.slice(0, 4)} ${Math.round(v.score * 100)}`).join(' / '), `| LCP ${a['largest-contentful-paint'].displayValue}  FCP ${a['first-contentful-paint'].displayValue}  TBT ${a['total-blocking-time'].displayValue}  CLS ${a['cumulative-layout-shift'].displayValue}  | LCP element: ${lcpEl}`);
}
stop();
