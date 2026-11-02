// R47: the ONE place that says what a project's Work card shows. Default = the hero image; `"card": { "loop": "<video ref>", "img": "<poster / still>" }` on a project makes the card a muted looping video
// (the poster is its first frame). Work strip, home flight, page-swap and the transition code all read the card media from here.
export const heroBlock = (p) => p.page.blocks.find((b) => b.t === 'hero');
export const cardRef = (p) => p.card?.img || heroBlock(p).img;
export const cardLoop = (p) => p.card?.loop || null;
