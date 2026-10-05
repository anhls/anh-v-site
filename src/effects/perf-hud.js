// R31: `?perf` overlay + report. Loaded only with ?perf (see util/perf-mark.js), as its own chunk. One rAF sampler (frame time = the gap between
// rAF callbacks), the graph is drawn at 10 Hz, phase marks come from `pm()` (performance.mark + a label on the graph). A phase = the frames between two
// marks of a run. Runs are kept in sessionStorage so the forward run (the page is left right after it) and the back runs are in one report.
const KEY = 'perfRuns';
const RUN_START = { 'fwd:click': 'fwd', 'back:arrive': 'back' };
const RUN_END = { 'fwd:end': 1, 'back:idle-load-end': 1 };
const r2 = (v) => Math.round(v * 100) / 100;
const pct = (a, q) => (a.length ? a[Math.min(a.length - 1, Math.floor(q * a.length))] : null);

let frames = []; // [t, dt]
let uploads = []; // [t, bytes]
let longTasks = []; // { t, dur, attr }
let gpu = []; // [t, ms]
let marks = []; // for the graph: { name, t, idx }
let cur = null; // the run in progress { kind, marks: [{name,t}], phases: [] }
let saved = (() => { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null') || { fwd: [], back: [], base: null }; } catch { return { fwd: [], back: [], base: null }; } })();
let glApi = null;
let baselineAbort = false;

const stats = (t0, t1) => {
  const f = frames.filter((x) => x[0] > t0 && x[0] <= t1).map((x) => x[1]);
  const s = [...f].sort((a, b) => a - b);
  const up = uploads.filter((x) => x[0] > t0 && x[0] <= t1);
  const lt = longTasks.filter((x) => x.t >= t0 && x.t <= t1);
  const g = gpu.filter((x) => x[0] > t0 && x[0] <= t1).map((x) => x[1]).sort((a, b) => a - b);
  return {
    durationMs: r2(t1 - t0), frames: f.length,
    median: r2(pct(s, 0.5) ?? 0), p95: r2(pct(s, 0.95) ?? 0), p99: r2(pct(s, 0.99) ?? 0), max: r2(s[s.length - 1] ?? 0),
    over16_7: f.filter((v) => v > 16.7).length, over33: f.filter((v) => v > 33).length, over50: f.filter((v) => v > 50).length,
    longTasks: lt.map((x) => ({ start: r2(x.t - t0), dur: r2(x.dur), attr: x.attr })),
    uploads: { count: up.length, bytes: up.reduce((a, x) => a + x[1], 0) },
    gpuMs: g.length ? { frames: g.length, median: r2(pct(g, 0.5)), p95: r2(pct(g, 0.95)), max: r2(g[g.length - 1]) } : 'n/a',
  };
};

const persist = () => { try { sessionStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* */ } };
const pushRun = (run) => {
  const list = saved[run.kind];
  const i = list.findIndex((r) => r.id === run.id);
  if (i >= 0) list[i] = run; else list.push(run);
  if (list.length > 8) list.shift();
  persist();
};

const mark = (name, t = performance.now()) => {
  try { performance.mark(name); } catch { /* */ }
  marks.push({ name, t, idx: frames.length });
  const kind = RUN_START[name];
  if (kind) cur = { id: `${kind}-${Math.round(t)}`, kind, startedAt: new Date().toISOString(), marks: [], phases: [], clock: t, last: null };
  if (!cur) return;
  const prev = cur.last;
  if (prev) cur.phases.push({ name: `${prev.name} -> ${name}`, ...stats(prev.t, t) });
  cur.last = { name, t };
  cur.marks.push({ name, t: r2(t - cur.clock) });
  cur.canvas = canvasInfo();
  pushRun(cur);
  if (RUN_END[name]) cur = null;
};

const canvasInfo = () => { const c = glApi?.canvas; return c ? { w: c.width, h: c.height, dpr: r2(devicePixelRatio || 1), textures: glApi.stats().loaded, textureMb: r2(glApi.stats().textureMb) } : null; };

const environment = () => {
  let renderer = 'n/a', version = 'n/a', maxTex = 'n/a';
  try {
    const c = document.createElement('canvas'), g = c.getContext('webgl2') || c.getContext('webgl');
    if (g) {
      version = g.getParameter(g.VERSION); maxTex = g.getParameter(g.MAX_TEXTURE_SIZE);
      const e = g.getExtension('WEBGL_debug_renderer_info');
      renderer = e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER);
      g.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch { /* */ }
  const t0 = performance.now(); let x = 0; for (let i = 0; i < 3e6; i++) x += Math.sqrt(i); const bench = performance.now() - t0;
  return {
    userAgent: navigator.userAgent, screen: `${screen.width}x${screen.height}`, window: `${innerWidth}x${innerHeight}`, dpr: devicePixelRatio,
    gpuRenderer: renderer, webgl: version, maxTextureSize: maxTex, hardwareConcurrency: navigator.hardwareConcurrency, deviceMemory: navigator.deviceMemory ?? 'n/a',
    throttled: 'not detectable from the page; the JS speed test below is a machine score (3M sqrt, lower = faster)', jsBenchMs: r2(bench + (x < 0 ? 1 : 0)),
    page: location.pathname + location.search, time: new Date().toISOString(),
  };
};

const buildReport = () => ({
  tool: 'anh-v-site ?perf (R31)', environment: environment(), canvasNow: canvasInfo(),
  baselinePlainScroll5s: saved.base || 'not taken yet (needs 5 s on the Work page with no input right after load)',
  lastForward: saved.fwd[saved.fwd.length - 1] || null, lastBack: saved.back[saved.back.length - 1] || null,
  forwardRuns: saved.fwd, backRuns: saved.back,
  tallGuard: window.__tallGuard ? { ...window.__tallGuard, note: 'R24d frame-time guard of the phone / tablet Work page: step 0 = full warp, 1 = warp pass x0.75, 2 = x0.5, 3 = warp off' } : 'not a phone / tablet Work page',
});

export function attachGl(api) {
  glApi = api;
  if (!api) return;
  api.onUpload = (bytes) => uploads.push([performance.now(), bytes]);
  const ctx = api.canvas.getContext('webgl2'); // the existing context
  const ext = ctx?.getExtension('EXT_disjoint_timer_query_webgl2');
  if (!ext) return;
  const pending = [], free = [], orig = api.draw;
  const poll = () => {
    while (pending.length) {
      const [q, t] = pending[0];
      if (!ctx.getQueryParameter(q, ctx.QUERY_RESULT_AVAILABLE)) break;
      pending.shift();
      if (!ctx.getParameter(ext.GPU_DISJOINT_EXT)) { const ms = ctx.getQueryParameter(q, ctx.QUERY_RESULT) / 1e6; if (ms > 0.002) gpu.push([t, ms]); }
      free.push(q);
    }
  };
  api.draw = (...a) => {
    poll();
    if (pending.length > 6) return orig(...a);
    const q = free.pop() || ctx.createQuery();
    ctx.beginQuery(ext.TIME_ELAPSED_EXT, q);
    const r = orig(...a);
    ctx.endQuery(ext.TIME_ELAPSED_EXT);
    pending.push([q, performance.now()]);
    return r;
  };
}

export function mountPerf() {
  if (window.__pm) return;
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:2147483000;pointer-events:none;font:11px/1.35 ui-monospace,Consolas,monospace;color:#bff5c8;background:rgba(0,0,0,.78);padding:6px 8px;border-radius:4px;width:262px';
  box.innerHTML = '<canvas width="480" height="104" style="width:240px;height:52px;display:block"></canvas><pre style="margin:4px 0;white-space:pre-wrap;font:inherit"></pre><button style="pointer-events:auto;font:inherit;cursor:pointer">Copy report</button> <button class="r" style="pointer-events:auto;font:inherit;cursor:pointer">Reset</button><textarea hidden readonly style="pointer-events:auto;width:100%;height:90px;margin-top:4px;font-size:9px"></textarea>';
  document.body.append(box);
  const cv = box.querySelector('canvas'), g = cv.getContext('2d'), pre = box.querySelector('pre'), ta = box.querySelector('textarea');
  const [copyBtn, resetBtn] = box.querySelectorAll('button');
  copyBtn.onclick = async () => {
    const json = JSON.stringify(buildReport(), null, 1);
    ta.value = json; // (kept in the textarea; shown only when the clipboard is refused or does not answer within 1.5 s)
    let ok = false;
    try { await Promise.race([navigator.clipboard.writeText(json).then(() => { ok = true; }), new Promise((r) => setTimeout(r, 1500))]); } catch { /* shown below */ }
    if (ok) { copyBtn.textContent = 'Copied'; setTimeout(() => { copyBtn.textContent = 'Copy report'; }, 1500); } else { ta.hidden = false; ta.select(); }
  };
  resetBtn.onclick = () => { saved = { fwd: [], back: [], base: null }; persist(); ta.hidden = true; };

  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) longTasks.push({ t: e.startTime, dur: e.duration, attr: (e.attribution || []).map((a) => a.containerType || a.name).join(',') || 'self' }); }).observe({ type: 'longtask', buffered: true });
  } catch { /* not supported */ }

  window.__pm = mark;
  for (const [n, t] of window.__pmq || []) mark(n, t);
  window.__pmq = null;

  // 5 s baseline of plain Work scrolling (synthetic wheel at about 1800 px/s) from 1 s after mount; not while arriving from a project, not after real input
  const base = { t0: 0, started: false, done: !!saved.base || !!document.getElementById('pxb') };
  for (const ev of ['pointerdown', 'keydown', 'wheel']) addEventListener(ev, (e) => { if (e.isTrusted) baselineAbort = true; }, { capture: true, passive: true });

  let last = 0, drawAt = 0;
  const tick = (now) => {
    if (last) {
      frames.push([now, now - last]);
      if (frames.length > 40000) frames = frames.slice(-20000);
      if (uploads.length > 4000) uploads = uploads.slice(-2000);
      if (gpu.length > 20000) gpu = gpu.slice(-10000);
    }
    last = now;
    if (!base.done) {
      if (baselineAbort) base.done = true;
      else if (!base.started && now > 1000) { base.started = true; base.t0 = now; }
      else if (base.started) {
        if (now - base.t0 < 5000) window.dispatchEvent(new WheelEvent('wheel', { deltaY: 30, bubbles: true, cancelable: true }));
        else { base.done = true; saved.base = { note: 'synthetic wheel 30 px per frame, no transition', ...stats(base.t0, now) }; persist(); }
      }
    }
    if (now - drawAt > 100) { drawAt = now; paint(now); }
    requestAnimationFrame(tick);
  };
  const paint = (now) => {
    const N = 120, f = frames.slice(-N), W = cv.width, H = cv.height, bw = W / N;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#bff5c8';
    f.forEach((x, i) => { const v = Math.min(x[1], 50); g.fillStyle = x[1] > 33 ? '#ff5a5a' : x[1] > 16.7 ? '#ffc857' : '#6ee7a0'; g.fillRect(i * bw, H - (v / 50) * H, Math.max(1, bw - 1), (v / 50) * H); });
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(0, H - (16.7 / 50) * H); g.lineTo(W, H - (16.7 / 50) * H); g.stroke();
    g.font = '14px monospace'; g.fillStyle = '#fff';
    const start = frames.length - f.length;
    let row = 0;
    for (const m of marks) { const x = (m.idx - start) * bw; if (x < 0 || x > W) continue; g.fillRect(x, 0, 1, H); g.fillText(m.name.replace(/^(fwd|back):/, (s) => s[0] === 'f' ? 'f:' : 'b:'), Math.min(x + 2, W - 120), 12 + (row++ % 3) * 14); }
    const l1 = frames.filter((x) => x[0] > now - 1000), l2 = frames.filter((x) => x[0] > now - 2000);
    const worst = l2.reduce((a, x) => Math.max(a, x[1]), 0);
    const up = uploads.filter((x) => x[0] > now - 1000).reduce((a, x) => a + x[1], 0);
    const c = glApi?.canvas, st = glApi?.stats?.();
    const heap = performance.memory ? `${(performance.memory.usedJSHeapSize / 1048576).toFixed(0)} MB` : 'n/a';
    pre.textContent = `${(f[f.length - 1]?.[1] ?? 0).toFixed(1)} ms  ${l1.length} fps  worst(2s) ${worst.toFixed(1)} ms\ncanvas ${c ? `${c.width}x${c.height}` : 'none'} @DPR ${r2(devicePixelRatio)}\ntextures ${st ? st.loaded : 'n/a'}  up/1s ${(up / 1048576).toFixed(1)} MB  heap ${heap}\n${cur ? `run: ${cur.kind} (${cur.marks[cur.marks.length - 1].name})` : base.done ? 'idle' : 'baseline...'}`;
  };
  requestAnimationFrame(tick);
}
