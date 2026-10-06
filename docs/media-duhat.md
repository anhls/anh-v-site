# Duhat media map (R34)

Sources: `tools/scratch/duhat-src/media/` (extracted from Anh's own .pptx export, not in git). Rebuild one item: edit `tools/r34-duhat.json`, run `node tools/r34-media.mjs duhat <name,...>`. Output: `public/media/duhat/`, entries in `src/data/media-manifest.json`. Loops = mp4 + webm + poster, images = WebP at 800 / 1600 / source width (flat tone circles at 1280, quality 90).

| name (`duhat/<name>`) | source | source size | source weight | output |
|---|---|---|---|---|
| hero | image59.png | 1920x1080 | 4.5MB | 800w 64KB + 1600w 159KB + 1920w 201KB |
| ring | image33.gif | 838x468 x44 @25fps | 14.6MB | 838x468: webm 1435KB + mp4 477KB + poster 111KB |
| couple | image13.png | 2048x1415 | 5.3MB | 800w 53KB + 1600w 126KB + 1920w 160KB |
| words | image28.png | 1920x1080 | 0.3MB | 800w 16KB + 1600w 36KB + 1920w 45KB |
| t-ngang | image1.png | 1920x1080 | 0.0MB | 800w 2KB + 1280w 4KB |
| t-sac | image12.png | 1920x1080 | 0.1MB | 800w 5KB + 1280w 9KB |
| t-huyen | image5.png | 1920x1080 | 0.1MB | 800w 7KB + 1280w 12KB |
| t-nang | image2.png | 1920x1080 | 0.0MB | 800w 8KB + 1280w 13KB |
| t-hoi | image4.png | 1920x1080 | 0.1MB | 800w 9KB + 1280w 14KB |
| t-nga | image9.png | 1920x1080 | 0.0MB | 800w 6KB + 1280w 11KB |
| circles | image19.png | 1920x1080 | 0.2MB | 800w 15KB + 1600w 33KB + 1920w 41KB |
| phone-a | image49.png | 1800x1348 | 2.8MB | 800w 56KB + 1600w 133KB + 1800w 151KB |
| phone-b | image38.png | 1200x1500 | 1.7MB | 800w 56KB + 1200w 91KB |
| gesture | image17.gif | 1800x1348 x55 @13fps | 3.1MB | 1440x1078: webm 199KB + mp4 263KB + poster 78KB |
| key-stack | image25.png | 941x1672 | 0.9MB | 800w 25KB + 941w 31KB |
| keychain | image26.png | 948x1659 | 1.3MB | 800w 43KB + 948w 54KB |
| key | image39.png | 1200x1200 | 0.5MB | 800w 10KB + 1200w 19KB |
| vinyl | image44.png | 2048x1357 | 3.1MB | 800w 21KB + 1600w 68KB + 1920w 93KB |
| adapt-a | image57.gif | 800x425 x44 @25fps | 6.1MB | 800x426: webm 143KB + mp4 88KB + poster 14KB |
| adapt-b | image48.png | 1599x1627 | 0.4MB | 800w 13KB + 1599w 29KB |
| type-a | image46.png | 1668x1618 | 0.5MB | 800w 20KB + 1600w 41KB + 1668w 44KB |
| type-b | image55.png | 1734x1734 | 0.3MB | 800w 13KB + 1600w 30KB + 1734w 33KB |
| mood-a | image35.gif | 600x600 x175 @25fps | 1.6MB | 600x600: webm 807KB + mp4 398KB + poster 20KB |
| mood-b | image61.gif | 720x900 x117 @25fps | 24.2MB | 720x900: webm 3198KB + mp4 1175KB + poster 49KB |
| mood-c | image43.gif | 800x450 x22 @25fps | 3.8MB | 800x450: webm 364KB + mp4 162KB + poster 36KB |
| mood-d | image52.gif | 800x450 x21 @25fps | 3.1MB | 800x450: webm 266KB + mp4 94KB + poster 29KB |
| gear-a | image54.gif | 450x800 x209 @30fps | 13.6MB | 450x800: webm 202KB + mp4 77KB + poster 7KB |
| gear-b | image60.gif | 450x800 x261 @25fps | 19.3MB | 450x800: webm 1292KB + mp4 543KB + poster 21KB |

Block order and which name sits where: `src/data/data.json` -> projects[slug=duhat].page.blocks. Dropped on purpose: slide 13 tone-to-action map (tiny 411x226 UI PNGs: not sharp enough at page size), slide 17 Visual Cue Inspo, the title slides, image50 (deck logo), image58 / image29 / image51 / image3 loops (not needed for the rhythm).
