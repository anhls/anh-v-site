// R41d: every WebGL context the page creates goes through here, so the live count, the peak and every creation error / loss (with its reason) are known. iOS Safari keeps a
// small global budget of live contexts (and a released one is only freed later): when it is spent, creating one fails or the OLDEST context is lost. The ?perf report (field
// `glLedger`) shows them. `glOpen` = canvas.getContext('webgl2') + bookkeeping, `glClose` = WEBGL_lose_context + bookkeeping (idempotent).
const live = new Map(); // gl -> { name, t }
const led = { created: 0, failed: 0, lost: 0, closed: 0, peak: 0, events: [] };
const log = (kind, name, reason = '') => { led.events.push({ t: Math.round(performance.now()), kind, name, reason, live: live.size }); if (led.events.length > 60) led.events.shift(); };

export function glOpen(canvas, name, attrs, type = 'webgl2') {
  let gl = null, reason = '';
  const onErr = (e) => { reason = e.statusMessage || 'webglcontextcreationerror'; };
  canvas.addEventListener('webglcontextcreationerror', onErr, { once: true });
  try { gl = canvas.getContext(type, attrs); } catch (err) { reason = String(err && err.message || err); }
  canvas.removeEventListener('webglcontextcreationerror', onErr);
  if (!gl) { led.failed++; log('create-failed', name, reason || 'getContext returned null'); return null; }
  live.set(gl, { name, t: performance.now() });
  led.created++; led.peak = Math.max(led.peak, live.size); log('created', name);
  canvas.addEventListener('webglcontextlost', () => { if (live.delete(gl)) { led.lost++; log('lost', name, 'webglcontextlost (not closed by us)'); } });
  return gl;
}

export function glClose(gl, name = '') {
  if (!gl) return;
  const had = live.delete(gl);
  try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* already gone */ }
  if (had) { led.closed++; log('closed', name || 'context'); }
}

// one throw-away probe (GPU name / Apple check) shared by everything that needs it: ONE context for the whole page, closed at once, the answer cached
let probe = null;
export function gpuProbe() {
  if (probe) return probe;
  probe = { webgl: 'none', renderer: '', debugInfoExt: false };
  try {
    const c = document.createElement('canvas'), g = glOpen(c, 'probe') || glOpen(c, 'probe', undefined, 'webgl');
    if (g) {
      const e = g.getExtension('WEBGL_debug_renderer_info');
      probe = { webgl: typeof WebGL2RenderingContext !== 'undefined' && g instanceof WebGL2RenderingContext ? 2 : 1, renderer: String(e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER)), debugInfoExt: !!e,
        version: String(g.getParameter(g.VERSION)), maxTextureSize: g.getParameter(g.MAX_TEXTURE_SIZE) };
      glClose(g, 'probe');
    }
  } catch (err) { probe = { webgl: 'error ' + (err && err.message) }; }
  return probe;
}

export const glLedger = () => ({ live: live.size, liveNames: [...live.values()].map((v) => v.name), peak: led.peak, created: led.created, failed: led.failed, lost: led.lost, closed: led.closed, events: led.events.slice(-30) });
