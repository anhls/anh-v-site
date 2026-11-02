# R47 notes
- Data: tcb-priority gets `card: { loop: "tcb-priority/b19a", img: "/media/tcb-priority/b19a-poster.webp" }`; its hero block = the poster as `img` + `loop` (no aspect, parallax kept). No files renamed.
- Helper: src/util/card-media.js (cardRef / cardLoop). Used by work/core.js, effects/home-leave.js. The transition code (project-transition.js) only gets `setHeaderStill`.
- Work strip: a loop frame is a muted looping <video preload=none poster=...>; sources are set when the item activates (not on Save-Data / reduced motion); it plays only while the item is shown and near, the tab is visible, no transition runs.
- Flight: `stillOf(it)` = canvas snapshot (<=1600 px, JPEG .92, reused 1.2 s) of the shown frame, also stored as the header still; loopSync records the video time; the header video seeks to that time + elapsed, and shows the still until it really plays (class is-playing).
- Not done / limits: the back flight draws the header's frame (not a fresh card frame); lite uses the same path (tall page: tp-hero--card); WebKit / real iOS and the Cloudflare preview were not checked.
