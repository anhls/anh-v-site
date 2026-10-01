# R14 (draft, right after R13b; Sonnet 4.6 is fine): media optimisation

Why now: public/media holds 147MB of unconverted originals (PNGs up to 33MB, GIFs 23MB and 18MB). Every local load, compare run and tuning session is slower for it, Cloudflare Pages refuses files over 25MB, and the files sit in git history.
1. One batch script (tools/media.mjs; sharp for images, ffmpeg for video) that reads the originals in ../_site-media (via sources.tsv) and writes web versions into the repo. It skips files already converted (re-runs take seconds) and writes a manifest (file, width, height, bytes) the site reads.
2. Images: WebP (AVIF where it is clearly smaller) at the size they are actually displayed, plus 2x for sharp screens (srcset), never larger than the original. Keep transparency for cut-out PNGs. Visually check a few cut-outs and the hero at 2560.
3. GIFs -> short MP4 + WebM loops (muted, autoplay, loop, playsinline, poster frame); card 30 can use motion-sources/Final_VIS3.mp4, card 25 the PNG sequence in motion-sources/watch_anim/.
4. Hero video: compress from the best source available (only the 720x540 live file exists so far), add a poster frame. Swap framerusercontent.com URLs for local files wherever a local original exists (hero, captions, More Projects strip, cards); list what still comes from live.
5. Loading: preload only first-screen media (hero video poster, wordmark, Clash Display woff2); lazy-load cards and below-the-fold images.
6. Report: total page weight before -> after, largest remaining file (must be < 25MB, ideally < 2MB), compare 1920 + 2560 unchanged.
7. Git history: the originals added in f18bf0d stay in history (~147MB). The repo has no remote yet, so BEFORE the first push to GitHub they can be removed from history (git filter-repo or a fresh squashed start). Propose the method and ask Anh before rewriting anything; make a backup copy of the repo folder first.
