/**
 * Reports the eager (initial-load) JS/CSS size and fails if it exceeds a budget.
 *
 * The "eager" set is derived from `build/index.html`: the entry script plus every
 * `modulepreload` link (the entry's transitive static imports). Route-level code
 * split with React.lazy is NOT in this set, so this measures what a user downloads
 * before the app becomes interactive.
 *
 * Override the budget with EAGER_JS_BUDGET_KB (default 4000 kB).
 */
import fs from 'node:fs';
import path from 'node:path';

const buildDir = path.resolve('build');
const indexPath = path.join(buildDir, 'index.html');

if (!fs.existsSync(indexPath)) {
  console.error('build/index.html not found. Run `npm run build` first.');
  process.exit(2);
}

const html = fs.readFileSync(indexPath, 'utf8');
const urls = [...html.matchAll(/(?:src|href)="\/(static\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);

let eagerJs = 0;
let eagerCss = 0;
const chunks = [];

for (const u of urls) {
  const file = path.join(buildDir, u);
  if (!fs.existsSync(file)) continue;
  const size = fs.statSync(file).size;
  chunks.push({ name: u.split('/').pop(), size });
  if (u.endsWith('.js')) eagerJs += size;
  else if (u.endsWith('.css')) eagerCss += size;
}

const kB = (n) => `${Math.round(n / 1024)} kB`;

console.log(`Eager JS:  ${kB(eagerJs)}`);
console.log(`Eager CSS: ${kB(eagerCss)}`);
console.log('Top eager chunks:');
for (const c of chunks.sort((a, b) => b.size - a.size).slice(0, 10)) {
  console.log(`  ${String(Math.round(c.size / 1024)).padStart(6)} kB  ${c.name}`);
}

const budgetKb = Number(process.env.EAGER_JS_BUDGET_KB || 4000);
if (eagerJs > budgetKb * 1024) {
  console.error(`\nERROR: eager JS ${kB(eagerJs)} exceeds budget ${kB(budgetKb * 1024)}.`);
  console.error('Reduce the initial-load bundle before merging.');
  process.exit(1);
}

console.log(`\nOK: eager JS within budget (${kB(budgetKb * 1024)}).`);
