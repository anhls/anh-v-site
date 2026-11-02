// R46 Part B: the ONE switch for hiding projects. A project with `"hidden": true` in src/data/data.json (nothing is deleted) is left out of everything the site and its tools read:
// the vite plugin (vite.config.js) filters the data.json import, the build inputs, and the tools (layout solver / checks, work-pool) read it through loadData().
// Turning a project back on = set `"hidden": false` (or remove the key) and rebuild; if its Work-page layout is needed again run `npm run pool && npm run layout` (and the tall / tablet solvers).
import fs from 'node:fs';
export function visible(d) {
  const hide = new Set((d.projects || []).filter((p) => p.hidden).map((p) => p.slug));
  if (!hide.size) return d;
  const o = JSON.parse(JSON.stringify(d));
  o.projects = o.projects.filter((p) => !hide.has(p.slug));
  if (o.hero?.captions) o.hero.captions = o.hero.captions.filter((c) => !hide.has(c.slug));
  if (o.moreProjects?.items) o.moreProjects.items = o.moreProjects.items.filter((c) => !hide.has(c.slug));
  return o;
}
export const loadData = (file = 'src/data/data.json') => visible(JSON.parse(fs.readFileSync(file, 'utf8')));
