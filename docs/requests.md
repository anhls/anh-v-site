# Requests (from Cowork / Anh to Claude Code)

Only open and upcoming work lives here. Finished requests move to docs/archive/ (R1-R10: archive/requests-R1-R10.md, R11: archive/requests-R11.md, R11b: archive/requests-R11b.md, R11c: archive/requests-R11c.md, R12: archive/requests-R12.md, R13: archive/requests-R13.md, R13b: archive/requests-R13b.md).

## R14 [done] media optimisation (item 7, git history, waits for Anh)
Why now: public/media holds 147MB of unconverted originals (PNGs up to 33MB, GIFs 23MB and 18MB). Every local load, compare run and tuning session is slower for it, Cloudflare Pages refuses files over 25MB, and the files sit in git history.
1. One batch script (tools/media.mjs; sharp for images, ffmpeg for video) that reads the originals in ../_site-media (via sources.tsv) and writes web versions into the repo. It skips files already converted (re-runs take seconds) and writes a manifest (file, width, height, bytes) the site reads.
2. Images: WebP (AVIF where it is clearly smaller) at the size they are actually displayed, plus 2x for sharp screens (srcset), never larger than the original. Keep transparency for cut-out PNGs. Visually check a few cut-outs and the hero at 2560.
3. GIFs -> short MP4 + WebM loops (muted, autoplay, loop, playsinline, poster frame); card 30 can use motion-sources/Final_VIS3.mp4, card 25 the PNG sequence in motion-sources/watch_anim/.
4. Hero video: compress from the best source available (only the 720x540 live file exists so far), add a poster frame. Swap framerusercontent.com URLs for local files wherever a local original exists (hero, captions, More Projects strip, cards); list what still comes from live.
5. Loading: preload only first-screen media (hero video poster, wordmark, Clash Display woff2); lazy-load cards and below-the-fold images.
6. Report: total page weight before -> after, largest remaining file (must be < 25MB, ideally < 2MB), compare 1920 + 2560 unchanged.
7. Git history: the originals added in f18bf0d stay in history (~147MB). The repo has no remote yet, so BEFORE the first push to GitHub they can be removed from history (git filter-repo or a fresh squashed start). Propose the method and ask Anh before rewriting anything; make a backup copy of the repo folder first.
Also commit the untracked plan files in docs/plans/.

## Queued (plans agreed with Anh, in this order; each becomes a request after the one before is committed)
1. R15 hero interactions (click spawner, caption hover image, image trail with Anh's range): docs/plans/r15-hero-interactions.md
2. R13c depth-driven parting + mouse push-away: docs/plans/r13c-depth-interaction.md
3. R13d back-to-top A+ (A fallback): docs/plans/r13d-back-to-top.md
4. Selected Work step 2, WebGL edge bend: docs/plans/selected-work-section.md
5. Project pages (Bitis template first), Works page, tablet/phone, launch prep, then back-to-top "rewind" polish.

## Later: Selected Work step 2 (WebGL edge bend)
Plan: docs/plans/selected-work-section.md step 2. After Anh tunes R13 with the panel.

## Later: responsive (tablet/phone)
Structure is ready (vw/vh units, timeline.js, CSS custom properties), but portrait screens need their own values: mask 17vw x 50vh becomes a thin strip, About runs to 15 lines on a phone, captions crowd. Also use small/large viewport units (svh/lvh) for the sticky blocks and ScrollTrigger.config({ ignoreMobileResize: true }) so the mobile address bar doesn't make things jump. Follow HANDOFF "Responsive plan".

## Media checklist note (R14 covers it)
Waits for Anh's original files. Convert the two GIFs to MP4/WebM loops, serve images as WebP/AVIF sized to display size (srcset), preload only hero media, lazy-load archive and project images, compress the hero video and add a poster frame, preload the Clash Display woff2.
