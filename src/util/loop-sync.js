// R47: the Work card plays a loop that the project header continues. When a flight starts, the card records which moment it showed (`mark(ref, t)`); the header's <video> for the same ref
// starts at that moment plus the time since (`startAt(ref)`), so the picture does not jump when the card grows into the header.
const marks = new Map(), stills = new Map();
export const loopSync = {
  mark(ref, t) { marks.set(ref, { t, at: performance.now() }); },
  startAt(ref, dur) { const m = marks.get(ref); if (!m || !dur) return 0; return ((m.t + (performance.now() - m.at) / 1000) % dur + dur) % dur; },
  still(ref, img) { if (img) stills.set(ref, img); return stills.get(ref) || null; }, // the snapshot picture of the card's last flight start (the header shows it until its own video plays)
  clear(ref) { marks.delete(ref); },
};
