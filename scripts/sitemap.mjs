import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { HtmlParser } from '@angular/compiler';
import { PUBLIC_CANONICAL_PATHS } from '../server/src/public-routes.ts';

const ORIGIN = 'https://faunapoolen.se';
const parser = new HtmlParser();
function elements(nodes, name) {
  return nodes.flatMap((node) => [
    ...(node.name === name ? [Object.fromEntries(node.attrs.map((a) => [a.name, a.value]))] : []),
    ...elements(node.children ?? [], name),
  ]);
}
const escapeXml = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

/** Prove the exact public catalogue before writing; duplicate outputs may not hide in a Map. */
export function writeSitemap(browserDirectory) {
  const expected = new Set(PUBLIC_CANONICAL_PATHS.map((path) => ORIGIN + path));
  const pages = new Map();
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(file);
        continue;
      }
      if (!entry.name.endsWith('.html') || entry.name === 'index.csr.html') continue;
      const nodes = parser.parse(readFileSync(file, 'utf8'), file).rootNodes;
      if (
        elements(nodes, 'meta').some(
          (meta) => meta.name === 'robots' && /\bnoindex\b/.test(meta.content),
        )
      )
        continue;
      const links = elements(nodes, 'link');
      const canonicals = links.filter((link) => link.rel === 'canonical');
      if (!canonicals.length) continue; // Redirect documents have no indexing identity.
      if (canonicals.length !== 1) throw new Error(`Multiple canonical claims: ${file}`);
      const canonical = canonicals[0].href;
      if (!expected.has(canonical)) throw new Error(`Unexpected public canonical: ${canonical}`);
      if (pages.has(canonical)) throw new Error(`Duplicate canonical output: ${canonical}`);
      const pathname = '/' + relative(browserDirectory, file).replace(/index\.html$/, '');
      if (new URL(canonical).pathname !== pathname)
        throw new Error(`Canonical does not identify its rendered file: ${file}`);
      const alternates = links.filter((link) => link.rel === 'alternate' && link.hreflang);
      if (alternates.length !== 4 || new Set(alternates.map((link) => link.hreflang)).size !== 4)
        throw new Error(`Incomplete language alternates: ${canonical}`);
      for (const alternate of alternates) {
        if (
          !['sv', 'en', 'da', 'x-default'].includes(alternate.hreflang) ||
          !expected.has(alternate.href)
        )
          throw new Error(`Invalid language counterpart: ${canonical}`);
      }
      pages.set(canonical, alternates);
    }
  }
  visit(browserDirectory);
  const missing = [...expected].filter((url) => !pages.has(url));
  if (missing.length) throw new Error(`Missing canonical pages: ${missing.join(', ')}`);
  for (const [url, alternates] of pages) {
    const group = alternates
      .map((link) => `${link.hreflang}:${link.href}`)
      .sort()
      .join('|');
    for (const { href } of alternates) {
      const other = pages
        .get(href)
        .map((link) => `${link.hreflang}:${link.href}`)
        .sort()
        .join('|');
      if (group !== other) throw new Error(`Non-reciprocal language counterparts: ${url}`);
    }
  }
  const body = [...pages]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([url, alternates]) =>
        `  <url>\n    <loc>${escapeXml(url)}</loc>\n${alternates.map(({ hreflang, href }) => `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${escapeXml(href)}" />`).join('\n')}\n  </url>`,
    )
    .join('\n');
  writeFileSync(
    join(browserDirectory, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`,
  );
}
