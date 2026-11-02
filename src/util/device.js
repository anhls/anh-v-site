import { gpuProbe } from './gl-ledger.js';
// "Weak device" rule shared by the back-to-top fallback (R13g) and the WebGL cards fallback (R16): 4 cores or fewer, 4 GB or less
// memory (when the browser reports it), or Save-Data on. No frame-time measuring.
// R24g: Apple devices are never flagged by the core / memory test: iOS reports 4 or 6 cores whatever the chip (an iPhone that renders a 3D scene at 120 Hz looked "weak"). They are
// recognised by the GPU renderer string ('Apple GPU' on iOS / iPadOS Safari, 'Apple M..' on a Mac). The renderer is read lazily, from a throw-away canvas, and ONLY when the core /
// memory test would have fired, so every other device (desktop Windows / Chrome included) gets exactly the result it had before; Save-Data still counts everywhere.
let apple = null;
export const appleGpu = () => {
  if (apple !== null) return apple;
  apple = false;
  try {
    apple = /apple/i.test(gpuProbe().renderer || ''); // (R41d: one shared, cached probe context)
  } catch { /* no WebGL: not Apple as far as we can tell */ }
  return apple;
};
// which test fired: '' (not weak), 'saveData', 'cores', 'memory' (the ?perf diagnosis names it)
export const weakReason = (cores = 4, memoryGb = 4) => {
  if (navigator.connection?.saveData === true) return 'saveData';
  const mem = navigator.deviceMemory, byCores = navigator.hardwareConcurrency <= cores, byMem = mem !== undefined && mem <= memoryGb;
  if (!byCores && !byMem) return '';
  if (appleGpu()) return '';
  return byCores ? 'cores' : 'memory';
};
export const weakDevice = (cores = 4, memoryGb = 4) => weakReason(cores, memoryGb) !== '';
