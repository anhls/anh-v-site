# Project pages inventory (Cowork, 2026-10-02, from the live HTML of anh-v.com/work/*; sections in page order)

Existing blocks (src/sections/project-page.js, from R19/R19b): hero, text (ScrollFadeText + label), split (cells: img / loop / copy / note), full, youtube, details, threeup; features: parallax mask (R19b), alpha loops, shared footer.
Legend: I = image, V = video loop, YT = YouTube, T = text. Live HTML only shows structure; motion (parallax etc.) must be measured per page as in R19b.

All 4 pages share Bitis's opening: Hero (I) -> text -> 2-up -> text -> media (YT or V) -> details (T|T). Same blocks, different content. => covered.

## tcb-priority (22 sections)
1 hero I | 2 text | 3 split I|I | 4 text | 5 youtube | 6 details | 7 split I|V | 8 text | 9 full I | 10 full I | 11 split I|I | 12 split I|I | 13 full V | 14 text | 15 NEW "Key Visual Exploration": heading + paragraph + a horizontal SCROLL of 6 image cards (Framer "Section > Scroll > Cards > Card") | 16 full I | 17 split I|I | 18 full I | 19 text | 20 NEW mosaic: 7 images in 4 columns (1 + 2 + 2 + 2 stacked) with a paragraph ("The graphic motif was developed ...") | 21 split I|I | 22 full I
New: (a) horizontal card scroller, (b) mosaic grid with stacked columns + copy.

## sulwhasoo (14 sections)
1 hero I | 2 text | 3 split I|I | 4 text | 5 full V | 6 details | 7 split I|I + copy ("The visual device, the Golden Ratio ...") | 8 split V|I + copy | 9 threeup I|I|I | 10 text | 11 split I|I + copy | 12 split with a STACKED cell: [I over I] | I + copy | 13 full I | 14 text (page ends on text)
New: (c) stacked cell (two images in one column) inside split. Captions in image blocks: check whether existing copy/note cells cover their placement.

## similac (13 sections)
1 hero I | 2 text | 3 split V|I | 4 text | 5 youtube | 6 details | 7 split V|V | 8 full V | 9 text | 10 split I|I | 11 full V | 12 split V|V | 13 full I
New: none (all existing blocks).

## forbes (18 sections)
1 hero I | 2 text | 3 split I|V | 4 text | 5 full V | 6 details | 7 text | 8 split V|I + copy | 9 split I|copy ("A procedural design system ...") | 10 full V | 11 full V | 12 split I|I | 13 text | 14 full I | 15 split V|I | 16 split I|I | 17 full I | 18 full I
New: none (copy cell placement to check).

## Summary
- Similac and Forbes: existing blocks only, pure data entry + media.
- Sulwhasoo: one small addition, stacked cell.
- Techcombank Priority: two new blocks, horizontal card scroller and mosaic grid; measure their motion on live (the scroller may be scroll-driven or draggable).
- For every page: measure parallax / reveals on live per block (R19b method), alpha check for GIF/PNG, media from live into ../_site-media/<slug>/ via sources.tsv, hero image + details text verbatim (Vietnamese diacritics, curly quotes).
- Suggested order: Similac (simplest, proves the template) -> Forbes -> Sulwhasoo (+stacked cell) -> TCB (+scroller, +mosaic). Could be 2 requests: R20 = Similac + Forbes, R21 = Sulwhasoo + TCB with the new blocks.

Decision (Anh, 2026-10-02): rebuild the 4 pages as they are on live for now; a redesign of the project pages comes later. So: faithful to live, quick mode, no extra polish beyond live; keep everything in blocks/data so the redesign can reuse the media pipeline and block features.
