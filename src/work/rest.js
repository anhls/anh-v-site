// R41d: ONE definition of "the strip is at rest", and the queue of heavy jobs that may only run then.
// At rest = the strip speed is under a small threshold for `holdMs`, no finger is down, no snap / coast / morph is running. A touch (`interrupt`) ends rest at once and nothing queued
// runs until the strip is calm again. One job per frame at most, and `gapMs` between jobs, so a rest job is never two in one frame.
// `timed(name, fn)` wraps a job (queued or not) and, with ?perf, records how long it blocked the main thread, how fast the strip was moving and how long ago the finger left
// (the ?perf report field `restJobs`; iOS Safari has no Long Tasks API, so this is the only way to see what ran and for how long).
import { perfOn } from '../util/perf-mark.js';

const log = [];
let ctx = () => ({});
export const setRestContext = (fn) => { ctx = fn; };
export function timed(name, fn) {
  if (!perfOn) return fn();
  const t0 = performance.now();
  try { return fn(); } finally {
    const ms = performance.now() - t0, c = ctx();
    log.push({ name, ms: +ms.toFixed(2), stripSpeed: c.speed, sinceTouchEnd: c.sinceTouchEnd, restForMs: c.restFor, moving: !!c.moving });
    if (log.length > 150) log.shift();
  }
}
export const restJobs = () => {
  const by = {};
  for (const j of log) { const b = (by[j.name] ||= { count: 0, maxMs: 0, ranWhileMoving: 0 }); b.count++; b.maxMs = Math.max(b.maxMs, j.ms); if (j.moving) b.ranWhileMoving++; }
  return { note: 'ms = main-thread time of the synchronous part of each job; moving = the strip was not at rest when it ran (should stay 0)', summary: by, worstMs: log.reduce((a, j) => Math.max(a, j.ms), 0), ranWhileMoving: log.filter((j) => j.moving).length, jobs: log.slice(-60) };
};

export function createRest({ holdMs = 150, speedMax = 12, gapMs = 45 } = {}) {
  let stillSince = 0, lastRun = 0;
  const jobs = new Map(); // key -> { name, fn, after }
  const api = {
    holdMs,
    // call once per frame with the state of the strip
    update(now, { speed = 0, touching = false, snap = false, inertia = false, morph = false } = {}) {
      if (touching || snap || inertia || morph || Math.abs(speed) > speedMax) stillSince = 0; else if (!stillSince) stillSince = now;
    },
    restFor(now = performance.now()) { return stillSince ? now - stillSince : 0; },
    ok(now = performance.now()) { return stillSince > 0 && now - stillSince >= holdMs; },
    interrupt() { stillSince = 0; }, // a finger / wheel / key: rest is over at once
    // queue a job (a later one with the same key replaces it); it runs once the strip has been at rest for `after` ms (at least holdMs)
    schedule(key, name, fn, after = holdMs) { jobs.set(key, { name, fn, after: Math.max(after, holdMs) }); },
    cancel(key) { if (key === undefined) jobs.clear(); else jobs.delete(key); },
    pending: () => jobs.size,
    // call once per frame after update(): runs at most one due job
    step(now) {
      if (!jobs.size || !stillSince || now - lastRun < gapMs) return;
      const rest = now - stillSince;
      for (const [key, j] of jobs) {
        if (rest < j.after) continue;
        jobs.delete(key); lastRun = now;
        try { timed(j.name, j.fn); } catch (err) { if (import.meta.env.DEV) console.error('[rest job]', j.name, err); }
        return;
      }
    },
  };
  return api;
}
