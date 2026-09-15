import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** The rendered canonical catalogue owns the sitemap; redirects and private pages never enter it. */
export function writeSitemap(browserDirectory) {
  const urls = new Map();
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(file);
        continue;
      }
      if (!entry.name.endsWith('.html') || entry.name === 'index.csr.html') continue;
      const html = readFileSync(file, 'utf8');
      if (/<meta name="robots" content="[^"]*noindex/.test(html)) continue;
      const canonical = /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1];
      if (!canonical) continue;
      if (!canonical.startsWith('https://faunapoolen.se/'))
        throw new Error('Unexpected sitemap origin.');
      const alternates = [
        ...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g),
      ];
      urls.set(
        canonical,
        alternates
          .map(
            ([, lang, href]) =>
              `    <xhtml:link rel="alternate" hreflang="${lang}" href="${href}" />`,
          )
          .join('\n'),
      );
    }
  }
  visit(browserDirectory);
  if (urls.size !== 60)
    throw new Error(
      `Expected 60 public locale pages, found ${urls.size}. Review the route catalogue.`,
    );
  const body = [...urls]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([url, alternates]) => `  <url>\n    <loc>${url}</loc>\n${alternates}\n  </url>`)
    .join('\n');
  writeFileSync(
    join(browserDirectory, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`,
  );
}
