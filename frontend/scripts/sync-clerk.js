/**
 * Copy Clerk browser bundle + lazy-loaded chunks to public/ so
 * REACT_APP_CLERK_JS_URL=/clerk.browser.js works offline / without CDN.
 */
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'node_modules', '@clerk', 'clerk-js', 'dist');
const destDir = path.join(__dirname, '..', 'public');

if (!fs.existsSync(srcDir)) {
  // @clerk/clerk-js is a devDependency — skip silently when not installed (e.g. production CI).
  process.exit(0);
}

const isClerkBrowserAsset = (filename) =>
  filename === 'clerk.browser.js' || /_clerk\.browser_[^_]+_\d+\.\d+\.\d+\.js$/.test(filename);

const srcFiles = fs.readdirSync(srcDir).filter(isClerkBrowserAsset);

// Remove stale Clerk assets from a previous @clerk/clerk-js version.
for (const existing of fs.readdirSync(destDir)) {
  if (isClerkBrowserAsset(existing)) {
    fs.unlinkSync(path.join(destDir, existing));
  }
}

for (const file of srcFiles) {
  fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
}

console.log(`Synced ${srcFiles.length} Clerk browser assets to public/`);
