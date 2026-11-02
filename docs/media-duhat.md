# Duhat media map (R34, revised R35)

Sources: `tools/scratch/duhat-src/media/` (extracted from Anh's own .pptx, not in git). Rebuild one item: edit `tools/r34-duhat.json`, run `node tools/r34-media.mjs duhat <name,...>`. Output: `public/media/duhat/`, entries in `src/data/media-manifest.json`. Loops = mp4 + webm + poster (transparent outline GIFs are baked on the deck's cream `#fbfbf2`, white / black on black; image29 is trimmed to its 356x200 content); images = WebP at 800 / 1600 / source width.

The page follows the deck slide by slide (blocks in `src/data/data.json`, projects[slug=duhat]): hero = slide 10's phone loop (image58) -> s1 image59 + image29 -> s2 image33 -> s3 image13 -> s4 image51 + image3 -> s5 image28 -> s6 image36 (+ details) -> s7 the six tone circles in the deck's grid order (ngã, ngang, sắc / huyền, nặng, hỏi, read from the slide XML positions) -> s8 image37 -> s9 image19 -> s10 image49 + image38 -> s11 image40 + image21 -> s12 image17 -> s13 the five tone rows (mark, circle loop, gesture button) -> s14 / s15 artifacts -> s17 visual cue -> s18 moodboard -> s19 / s20 adaptive text -> s21 gears. Slide 16 is empty; image50 is the deck's cream background, never used.

| name (`duhat/<name>`) | source | output |
|---|---|---|
| phone | image58.gif | 854x384: webm 652KB, mp4 361KB, webp 32KB |
| hero-still | image58.gif | 800w 31KB, 854w 31KB |
| hero | image59.png | 800w 64KB, 1600w 158KB, 1920w 201KB |
| hands | image29.gif | 356x200: webm 715KB, mp4 403KB, webp 9KB |
| ring | image33.gif | 838x468: webm 1434KB, mp4 477KB, webp 111KB |
| couple | image13.png | 800w 52KB, 1600w 125KB, 1920w 159KB |
| girl | image51.gif | 800x600: webm 1113KB, mp4 440KB, webp 74KB |
| ring-o | image3.gif | 832x816: webm 6KB, mp4 9KB, webp 6KB |
| words | image28.png | 800w 16KB, 1600w 35KB, 1920w 44KB |
| s6 | image36.gif | 1280x720: webm 363KB, mp4 435KB, webp 11KB |
| t-ngang | image1.png | 800w 2KB, 1280w 4KB |
| t-sac | image12.png | 800w 5KB, 1280w 8KB |
| t-huyen | image5.png | 800w 6KB, 1280w 11KB |
| t-nang | image2.png | 800w 7KB, 1280w 13KB |
| t-hoi | image4.png | 800w 8KB, 1280w 14KB |
| t-nga | image9.png | 800w 6KB, 1280w 10KB |
| pattern | image37.png | 800w 27KB, 1600w 66KB, 1920w 85KB |
| circles | image19.png | 800w 15KB, 1600w 32KB, 1920w 41KB |
| phone-a | image49.png | 800w 55KB, 1600w 132KB, 1800w 151KB |
| phone-b | image38.png | 800w 55KB, 1200w 90KB |
| breath | image40.png | 800w 19KB, 1600w 47KB, 1920w 59KB |
| breath-loop | image21.gif | 1080x1080: webm 432KB, mp4 236KB, webp 31KB |
| gesture | image17.gif | 1440x1078: webm 199KB, mp4 262KB, webp 78KB |
| g-sac | image7.gif | 838x566: webm 144KB, mp4 133KB, webp 6KB |
| b-sac | image24.png | 411w 4KB |
| m-sac | image6.png | 415w 1KB |
| g-huyen | image15.gif | 836x562: webm 141KB, mp4 130KB, webp 6KB |
| b-huyen | image16.png | 411w 4KB |
| m-huyen | image8.png | 392w 1KB |
| g-nang | image11.gif | 678x714: webm 194KB, mp4 171KB, webp 6KB |
| b-nang | image22.png | 411w 2KB |
| m-nang | image10.png | 262w 1KB |
| g-nga | image27.gif | 686x756: webm 224KB, mp4 200KB, webp 6KB |
| b-nga | image20.png | 411w 5KB |
| m-nga | image31.png | 565w 2KB |
| g-hoi | image18.gif | 730x730: webm 331KB, mp4 217KB, webp 6KB |
| b-hoi | image23.png | 411w 3KB |
| m-hoi | image14.png | 271w 1KB |
| key-stack | image25.png | 800w 25KB, 941w 31KB |
| key | image39.png | 800w 10KB, 1200w 18KB |
| keychain | image26.png | 800w 42KB, 948w 53KB |
| vinyl | image44.png | 800w 20KB, 1600w 68KB, 1920w 92KB |
| cue-a | image30.gif | 540x540: webm 74KB, mp4 37KB, webp 11KB |
| cue-img | image34.jpg | 480w 3KB |
| cue-b | image32.gif | 1080x1080: webm 133KB, mp4 154KB, webp 23KB |
| cue-c | image56.gif | 600x800: webm 147KB, mp4 94KB, webp 29KB |
| mood-a | image35.gif | 600x600: webm 806KB, mp4 398KB, webp 19KB |
| mood-b | image61.gif | 720x900: webm 3197KB, mp4 1175KB, webp 48KB |
| mood-c | image43.gif | 800x450: webm 364KB, mp4 161KB, webp 35KB |
| mood-d | image52.gif | 800x450: webm 266KB, mp4 93KB, webp 29KB |
| mood-e | image41.png | 640w 18KB |
| mood-f | image47.jpg | 735w 22KB |
| mood-g | image42.jpg | 735w 21KB |
| adapt-a | image57.gif | 800x426: webm 142KB, mp4 87KB, webp 13KB |
| adapt-c | image45.gif | 256x144: webm 154KB, mp4 79KB, webp 1KB |
| adapt-d | image53.gif | 800x426: webm 804KB, mp4 387KB, webp 23KB |
| adapt-b | image48.png | 800w 12KB, 1599w 28KB |
| type-a | image46.png | 800w 19KB, 1600w 41KB, 1668w 44KB |
| type-b | image55.png | 800w 13KB, 1600w 29KB, 1734w 33KB |
| gear-a | image54.gif | 450x800: webm 201KB, mp4 77KB, webp 7KB |
| gear-b | image60.gif | 450x800: webm 1292KB, mp4 543KB, webp 21KB |

Sum of all files (every format, so about double what one visitor downloads): 24.1 MB.
