// R50: the ONE phone / tablet Work title rule (text + size), used by the live title (src/work/tall-title.js) and the Home -> Work landing layer (src/effects/home-leave.js liteTitle).
// The full title when it fits at a size not under LITE_TITLE.minFullScale of the base size, else the short one; either way scaled down to fit inside the card with LITE_TITLE.sidePad on each side (letter-spacing counted).
import { LITE_TITLE } from '../settings/tall.js';
import { TITLE_SHORT, WORK_TITLE } from '../timeline.js';

export function fitLiteTitle(project, fw, ctx, family) {
  const baseSize = Math.max(LITE_TITLE.minSize, Math.min(LITE_TITLE.maxSize, fw * LITE_TITLE.frameShare));
  const wAt = (t, sz) => { ctx.font = `${WORK_TITLE.weight} ${sz}px ${family}`; return ctx.measureText(t).width + (WORK_TITLE.tracking || 0) * sz * t.length; };
  const avail = fw * (1 - 2 * LITE_TITLE.sidePad), full = project.title, short = project.titleShort || TITLE_SHORT[project.slug] || full;
  const fitSize = (t) => Math.min(baseSize, baseSize * avail / Math.max(wAt(t, baseSize), 1));
  const fullSize = fitSize(full), useFull = fullSize >= baseSize * LITE_TITLE.minFullScale || short === full;
  return { text: useFull ? full : short, size: useFull ? fullSize : fitSize(short) };
}
