// "Weak device" rule shared by the back-to-top fallback (R13g) and the WebGL cards fallback (R16): 4 cores or fewer, 4 GB or less
// memory (when the browser reports it), or Save-Data on. No frame-time measuring.
export const weakDevice = (cores = 4, memoryGb = 4) => {
  const mem = navigator.deviceMemory;
  return navigator.hardwareConcurrency <= cores || (mem !== undefined && mem <= memoryGb) || navigator.connection?.saveData === true;
};
