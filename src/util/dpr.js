// R22j: a window moved to a screen with another pixel ratio at the SAME css size (a 1080p screen and a 4K screen at 200%) fires no resize event, so the GL
// canvases kept their old pixel size (blurry or wasteful). This re-fires one `resize` whenever devicePixelRatio changes: every canvas and layout already
// re-reads its size on that event.
export function watchDpr() {
  const arm = () => {
    const mq = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener('change', () => { window.dispatchEvent(new Event('resize')); arm(); }, { once: true });
  };
  arm();
}
