#!/usr/bin/env node
// Post-build flatten. Angular SSG prerenders every route to `<route>/index.html`. Our product/blog
// URLs are literal `*.html` files (e.g. /koi-pond-series.html, /blog/posts/<slug>.html), so routes
// whose path ends in `.html` come out as a DIRECTORY `koi-pond-series.html/index.html`. This walks
// dist/browser and flattens each such leaf directory into a flat file `koi-pond-series.html`,
// leaving section/container dirs (about/, blog/, blog/posts/, en/, ...) untouched. Result:
// dist/browser mirrors the live URL tree exactly, so plain static serving preserves every URL.
import {
  cpSync,
  existsSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeSitemap } from './sitemap.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const BROWSER = process.env.SITE_RELEASE_BROWSER_DIR
  ? resolve(process.env.SITE_RELEASE_BROWSER_DIR)
  : join(ROOT, 'dist', 'browser');

if (!existsSync(BROWSER)) {
  console.error(`[flatten] ${BROWSER} not found — run the build first.`);
  process.exit(1);
}

let count = 0;

function flatten(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = join(dir, entry.name);
    if (entry.name.endsWith('.html')) {
      // leaf `<route>.html/` directory → flatten to a flat file `<route>.html`
      const index = join(full, 'index.html');
      if (!existsSync(index)) {
        console.warn(`[flatten] skip ${full} (no index.html inside)`);
        continue;
      }
      const tmp = `${full}.__flat__`;
      renameSync(index, tmp); // move the page out of the directory
      rmdirSync(full); // throws if the directory still holds other files — a deliberate guard
      renameSync(tmp, full); // the page becomes the flat file `<route>.html`
      count++;
      console.log(`[flatten] ${full.slice(BROWSER.length + 1)}`);
    } else {
      flatten(full); // recurse into section/container dirs (about/, blog/, en/, ...)
    }
  }
}

flatten(BROWSER);
// Angular's redirect documents do not use src/index.html. They still belong to the
// sealed browser artifact and need the same source marker as every rendered page.
for (const entry of readdirSync(BROWSER, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.html')) continue;
  const file = join(entry.parentPath, entry.name);
  const html = readFileSync(file, 'utf8');
  if (
    /<title>Redirecting<\/title>/i.test(html) &&
    /<meta\s+http-equiv="refresh"/i.test(html) &&
    !html.includes('name="cx-build-id"')
  ) {
    if ((html.match(/<head>/gi) ?? []).length !== 1) {
      throw new Error(`Redirect document has no unique head: ${file}`);
    }
    writeFileSync(
      file,
      html.replace(/<head>/i, '<head>\n    <meta name="cx-build-id" content="__CX_BUILD_ID__">'),
    );
  }
}
// A local CSR build has no prerendered catalogue; production always does.
if (existsSync(join(BROWSER, 'en', 'blog', 'index.html'))) {
  // Production disables Angular's per-locale asset copying. Every locale uses the same
  // absolute /assets URLs, so publish the original files once at the browser root.
  cpSync(join(ROOT, 'public'), BROWSER, { recursive: true });
  const fonts = join(ROOT, 'node_modules', '@mikaelcedergren', 'cx-framework', 'fonts');
  for (const name of readdirSync(fonts)) {
    if (name.endsWith('.woff2')) cpSync(join(fonts, name), join(BROWSER, 'assets', 'fonts', name));
  }
  writeSitemap(BROWSER);
}

// Staged releases are sealed to exactly `browser/` + `release.json`, but `ng build` also writes
// license/route byproducts at the output root — staged mode must drop them before sealing.
if (process.env.SITE_RELEASE_DIR) {
  for (const name of ['3rdpartylicenses.txt', 'prerendered-routes.json']) {
    const file = join(resolve(process.env.SITE_RELEASE_DIR), name);
    if (existsSync(file)) {
      rmSync(file);
      console.log(`[flatten] removed staged build byproduct ${name}`);
    }
  }
}
console.log(`[flatten] done — ${count} file(s) flattened.`);
