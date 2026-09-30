# Requests (from Cowork / Anh to Claude Code)

Newest at the bottom. Claude Code marks each one [done] when finished and logs details in status.md.

## R1 [done]: Scaffold plan
Propose in chat, before creating anything: Vite setup, folder structure, data.json schema (projects, titles, years, media), and how GSAP/Lenis are loaded. See HANDOFF.md, "Next steps" 1.

## Answers to R1 open questions (from Anh, 2026-09-30)
1. Media: use the framerusercontent.com files as placeholders for now. Originals will be swapped in later by editing data.json only.
2. Archive card positions: read them from the live page yourself (https://www.anh-v.com).
3. Music: skip for now. Keep the audio hook in place but silent (no file, no hotlink). Anh will supply a licensed file later.
4. Font: Clash Display is confirmed. Keep the file already in public/fonts.
5. Git: see R2.

## R2 [open]: Git setup
Initialize a git repo in anh-v-site, add a sensible .gitignore check (node_modules, dist), and make the first commit. Explain each step plainly. No GitHub or remote yet.

## R3 [open]: Loader + hero pin (first home section only)
Build the loader ("Loading visual language" + percentage, cursor-following) and the 730vh hero stack with the GSAP pin timeline exactly as in HANDOFF.md ("Hero pin"). Use framerusercontent.com placeholders for media. Stop after this section so Anh can compare it side by side with anh-v.com. Commit when done, log in status.md, and list anything that needed guessing.
