# Nam Long media map (R34 part 2)

Sources: `tools/scratch/namlong-src/media/` (extracted from Anh's copy of the proposal deck, not in git). Rebuild one item: edit `tools/r34-nam-long.json`, run `node tools/r34-media.mjs nam-long <name,...>`. Output: `public/media/nam-long/`, entries in `src/data/media-manifest.json`.

| name (`nam-long/<name>`) | source | source size | source weight | output |
|---|---|---|---|---|
| hero | image133.png | 1920x1080 | 4.3MB | 800w 18KB + 1600w 51KB + 1920w 78KB |
| story | image82.jpg | 1920x1440 | 0.2MB | 800w 14KB + 1600w 41KB + 1920w 59KB |
| bamboo | image126.gif | 1200x675 x85 @25fps | 36.4MB | 1200x676: webm 361KB + mp4 160KB + poster 44KB |
| n-white | image116.png | 2048x2048 | 0.5MB | 800w 54KB + 1600w 131KB + 1920w 167KB |
| n-mark | image120.png | 1168x1358 | 0.0MB | 800w 21KB + 1168w 15KB |
| system | image117.png | 2048x1153 | 1.5MB | 800w 18KB + 1600w 46KB + 1920w 59KB |
| fund | image173.png | 1920x1080 | 2.1MB | 800w 20KB + 1600w 44KB + 1920w 56KB |
| booklet | image156.png | 1920x1080 | 1.6MB | 800w 21KB + 1600w 53KB + 1920w 69KB |
| magazine | image177.png | 2048x1365 | 1.8MB | 800w 26KB + 1600w 84KB + 1920w 111KB |
| award | image193.png | 1010x1024 | 1.8MB | 800w 98KB + 1010w 135KB |
| trophy | image197.gif | 1920x1080 x83 @25fps | 19.5MB | 1440x810: webm 1319KB + mp4 619KB + poster 26KB |
| stage-a | image200.png | 1920x987 | 1.9MB | 800w 40KB + 1600w 147KB + 1920w 200KB |
| stage-b | image204.png | 1521x844 | 2.5MB | 800w 76KB + 1521w 241KB |
| social-a | image248.png | 1920x1080 | 2.9MB | 800w 54KB + 1600w 145KB + 1920w 183KB |
| social-b | image249.png | 1677x693 | 1.5MB | 800w 47KB + 1600w 120KB + 1677w 123KB |
| closing | image246.png | 1352x760 | 1.7MB | 800w 49KB + 1352w 104KB |

Scope kept as briefed: only slides 45-130 (creative lead); none of slides 1-44, no agency logo / name / footer. NOT used although listed in the brief: image121 / image235 (bamboo clips carrying a TECHCOMBANK PRIVATE logo + subtitle = another brand's film), image112 / image124 (reference film footage), image251 / image250 / image212 / image217 / image221 (concert and TVC stills from other productions), image184 (an auditorium photo, not the CSR visual), the CSR / event photographs with real people (image136-139, 159-163, 180-195), image93 (off-palette abstract). Client name is the data.json fields `client` and the details row.
