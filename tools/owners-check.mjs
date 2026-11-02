// Advisory ownership check. Never blocks a commit for cross-side/shared edits.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const args=process.argv.slice(2), i=args.indexOf('--side');
const side=(i>=0 ? args[i+1] : process.env.OWNERS_SIDE || process.env.SIDE || '').toLowerCase();
if(!['desktop','lite'].includes(side)){console.log('Usage: npm run owners -- --side desktop|lite (or OWNERS_SIDE)');process.exit(0);}
const owners=new Map();let section='';
for(const line of fs.readFileSync(new URL('../docs/OWNERS.md',import.meta.url),'utf8').split(/\r?\n/)){
 const h=line.match(/^## (DESKTOP|LITE|SHARED)\s*$/);if(h){section=h[1].toLowerCase();continue;}
 const file=line.match(/^- `([^`]+)`/);if(file && section){if(owners.has(file[1]))console.log(`WARNING duplicate owner: ${file[1]}`);owners.set(file[1],section);}
}
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
for(const file of git('ls-files','src'))if(!owners.has(file))console.log(`WARNING missing owner: ${file}`);
const changed=new Set([...git('diff','--name-only','work-v2...HEAD'),...git('diff','--name-only'),...git('diff','--cached','--name-only')]);
let warnings=0,notes=0;
for(const file of [...changed].sort()){
 const owner=owners.get(file);
 if(owner==='shared'){console.log(`NOTE shared: ${file}`);notes++;}
 else if(owner && owner!==side){console.log(`WARNING ${owner} file edited by ${side}: ${file}`);warnings++;}
 else if(!owner){console.log(`NOTE unlisted outside src: ${file}`);notes++;}
}
console.log(`owners (${side}): ${warnings} cross-side warning(s), ${notes} note(s); advisory only`);
