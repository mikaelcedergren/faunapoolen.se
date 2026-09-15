import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { HtmlParser } from '@angular/compiler';

const root = resolve(import.meta.dirname, '..');
const baseline = JSON.parse(
  readFileSync(join(root, 'tests/fixtures/blog-seo-baseline.json'), 'utf8'),
);
const parser = new HtmlParser();
function walk(nodes, predicate) {
  return nodes.flatMap((n) => [...(predicate(n) ? [n] : []), ...walk(n.children ?? [], predicate)]);
}
function attr(node, name) {
  return node?.attrs?.find((a) => a.name === name)?.value;
}
function plain(nodes) {
  return nodes
    .map((n) => (typeof n.value === 'string' ? n.value : plain(n.children ?? [])))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function read(path) {
  return parser.parse(readFileSync(join(root, 'dist/browser', path), 'utf8'), path).rootNodes;
}
for (const [slug, locales] of Object.entries(baseline))
  for (const [locale, original] of Object.entries(locales)) {
    test(`${locale}: ${slug} retains its existing article and SEO`, () => {
      const prefix = locale === 'sv' ? '' : locale + '/';
      const path = prefix + 'blog/posts/' + slug + '.html';
      const nodes = read(path);
      const body = walk(nodes, (n) => attr(n, 'id') === 'guide-body')[0];
      assert.ok(body, 'Article is rendered before JavaScript');
      const headings = walk(body.children, (n) => n.name === 'h2');
      assert.ok(headings.length, 'Article has a reading structure');
      headings.forEach((heading, index) => {
        const id = `guide-section-${index + 1}`;
        assert.equal(attr(heading, 'id'), id, 'Contents target exists before JavaScript');
        assert.equal(
          walk(nodes, (n) => n.name === 'a' && attr(n, 'href') === '/' + path + '#' + id).length,
          1,
          'Contents link stays on its own article',
        );
      });
      assert.equal(
        createHash('sha256').update(plain(body.children)).digest('hex'),
        original.bodyHash,
        'Protected article body changed',
      );
      assert.equal(
        plain(walk(nodes, (n) => n.name === 'h1')[0].children),
        original.title.replace(/\s+/g, ' ').trim(),
      );
      assert.deepEqual(
        walk(body.children, (n) => n.name === 'a').map((n) => attr(n, 'href')),
        original.links,
      );
      assert.deepEqual(
        walk(body.children, (n) => n.name === 'img').map((n) => attr(n, 'src')),
        original.images,
      );
      assert.ok(walk(nodes, (n) => n.name === 'img' && attr(n, 'src') === original.image).length);
      assert.equal(
        plain(walk(nodes, (n) => n.name === 'title')[0].children),
        original.metadata.title,
      );
      const meta = (key) =>
        attr(
          walk(
            nodes,
            (n) => n.name === 'meta' && (attr(n, 'name') === key || attr(n, 'property') === key),
          )[0],
          'content',
        );
      for (const [field, key] of Object.entries({
        description: 'description',
        keywords: 'keywords',
        ogTitle: 'og:title',
        ogDescription: 'og:description',
        ogImage: 'og:image',
      }))
        if (original.metadata[field]) assert.equal(meta(key), original.metadata[field], field);
      assert.equal(meta('og:type'), original.metadata.ogType ?? 'website');
      assert.equal(meta('robots'), undefined);
      const url = 'https://faunapoolen.se/' + path;
      assert.equal(
        attr(walk(nodes, (n) => n.name === 'link' && attr(n, 'rel') === 'canonical')[0], 'href'),
        url,
      );
      assert.equal(meta('og:url'), url);
      const alternates = Object.fromEntries(
        walk(nodes, (n) => n.name === 'link' && attr(n, 'hreflang')).map((n) => [
          attr(n, 'hreflang'),
          attr(n, 'href'),
        ]),
      );
      for (const language of ['sv', 'en', 'da'])
        assert.equal(
          alternates[language],
          `https://faunapoolen.se/${language === 'sv' ? '' : language + '/'}blog/posts/${slug}.html`,
        );
      assert.equal(alternates['x-default'], alternates.sv);
      const ld = JSON.parse(
        walk(nodes, (n) => n.name === 'script' && attr(n, 'type') === 'application/ld+json')[0]
          .children.map((n) => n.value)
          .join(''),
      );
      assert.ok(
        ld['@graph'].some(
          (n) =>
            n['@type'] === (original.metadata.ogType === 'article' ? 'BlogPosting' : 'WebPage'),
        ),
      );
      if (original.metadata.datePublished)
        assert.equal(meta('article:published_time'), original.metadata.datePublished);
    });
  }
test('sitemap contains only the complete public canonical catalogue', () => {
  const xml = readFileSync(join(root, 'dist/browser/sitemap.xml'), 'utf8');
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(urls.length, 60);
  assert.equal(new Set(urls).size, 60);
  assert.ok(!urls.some((url) => /admin|404/.test(url)));
  for (const url of urls) {
    const path = new URL(url).pathname;
    read(path.endsWith('/') ? path.slice(1) + 'index.html' : path.slice(1));
  }
});
