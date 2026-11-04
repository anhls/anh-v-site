# Working on anh-v-site with Google Antigravity (set up 2026-11-04)

Antigravity follows the same rules as Codex and Claude Code: AGENTS.md (read automatically), plus the files in
.agents/rules/ (house.md pulls in CLAUDE.md; design-new-pages.md holds the new-page design rules).

## Once
1. Install Antigravity and open the folder as the workspace:
   desktop work -> D:\Portfolio website\anh-v-site, phone/tablet work -> D:\Portfolio website\anh-v-site-mobile.
2. Check that its Rules list shows AGENTS.md, house.md and design-new-pages.md.

## Each request
1. In the folder: `git pull`.
2. Prompt: "Read AGENTS.md, then do R<n> from docs/codex/R<n>.md". It works on the branch the brief names, commits and pushes.
3. Come back to the Claude Portfolio chat and say "check R<n>": Cowork reviews, merges into work-v2 and logs it in Notion.

## Rules of thumb
- One agent per folder at a time: never run Antigravity and Codex / Claude Code in the same folder at once.
- One agent per request inside Antigravity too: no parallel subagents or /teamwork.
- Start with a small request and read the diff first: it runs a different model, so it may read briefs differently.
