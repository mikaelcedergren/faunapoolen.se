import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { HtmlParser } from '@angular/compiler';
import {
  expectedGuideBody,
  removedGuideContact,
  historicalGuideVatWording,
} from './guide-content-expectations.mjs';
import {
  PUBLIC_CANONICAL_PATHS,
  PUBLIC_PAGES,
  GUIDE_SLUGS,
  LEGACY_REDIRECTS,
  PROTECTED_GUIDE_IDS,
} from '../server/src/public-routes.ts';

const root = resolve(import.meta.dirname, '..');
const baseline = JSON.parse(
  readFileSync(join(root, 'tests/fixtures/blog-seo-baseline.json'), 'utf8'),
);
// The owner authorized rewrites of the ten other articles on 2026-09-17.
// Historical fixtures stay unchanged; only the approved contact deletion and VAT qualifier are allowed.
const protectedLocales = JSON.parse(
  readFileSync(join(root, 'tests/fixtures/protected-guide-locales.json'), 'utf8'),
);
const browserRoot = process.env.SITE_RELEASE_BROWSER_DIR
  ? resolve(process.env.SITE_RELEASE_BROWSER_DIR)
  : process.env.SITE_RELEASE_DIR
    ? resolve(process.env.SITE_RELEASE_DIR, 'browser')
    : join(root, 'dist/browser');
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
  return parser.parse(readFileSync(join(browserRoot, path), 'utf8'), path).rootNodes;
}
for (const [slug, locales] of Object.entries(baseline).filter(([slug]) =>
  PROTECTED_GUIDE_IDS.some((id) => GUIDE_SLUGS[id] === slug + '.html'),
))
  for (const [locale, original] of Object.entries(locales)) {
    test(`${locale}: ${slug} retains its existing article and SEO`, () => {
      const prefix = locale === 'sv' ? '' : locale + '/';
      const path = prefix + 'blog/posts/' + slug + '.html';
      const nodes = read(path);
      const body = walk(nodes, (n) => attr(n, 'id') === 'guide-body')[0];
      assert.ok(body, 'Article is rendered before JavaScript');
      assert.equal(
        plain(walk(nodes, (n) => attr(n, 'id') === 'guide-intro')[0].children),
        original.intro.replace(/\s+/g, ' ').trim(),
        'Original introduction remains visible',
      );
      const id = PROTECTED_GUIDE_IDS.find((id) => GUIDE_SLUGS[id] === slug + '.html');
      const removed = parser.parse(
        removedGuideContact(locale, id),
        'approved-contact-removal',
      ).rootNodes;
      const historicalBody = [...body.children, ...removed];
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
        createHash('sha256')
          .update(historicalGuideVatWording(plain(historicalBody), locale, id))
          .digest('hex'),
        original.bodyHash,
        'Protected article body changed',
      );
      assert.equal(
        plain(walk(nodes, (n) => n.name === 'h1')[0].children),
        original.title.replace(/\s+/g, ' ').trim(),
      );
      assert.deepEqual(
        walk(historicalBody, (n) => n.name === 'a').map((n) => attr(n, 'href')),
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
  const xml = readFileSync(join(browserRoot, 'sitemap.xml'), 'utf8');
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(
    [...urls].sort(),
    PUBLIC_CANONICAL_PATHS.map((path) => 'https://faunapoolen.se' + path).sort(),
  );
  assert.equal(new Set(urls).size, urls.length);
  assert.ok(!urls.some((url) => /admin|404/.test(url)));
  for (const url of urls) {
    const path = new URL(url).pathname;
    read(path.endsWith('/') ? path.slice(1) + 'index.html' : path.slice(1));
  }
});

const pathFile = (path) => (path.endsWith('/') ? path.slice(1) + 'index.html' : path.slice(1));
const translations = Object.fromEntries(
  ['en', 'sv', 'da'].map((locale) => [
    locale,
    JSON.parse(readFileSync(join(root, `src/locale/messages.${locale}.json`), 'utf8')).translations,
  ]),
);
for (const locale of ['en', 'sv', 'da']) {
  for (const id of PROTECTED_GUIDE_IDS) {
    test(`${locale}: protected ${id} retains every localized content field and introduction`, () => {
      const original = protectedLocales[locale][id];
      for (const [key, value] of Object.entries(original))
        assert.equal(
          translations[locale][key],
          key === `blog.${id}.bodyHtml` ? expectedGuideBody(value, locale, id) : value,
          key,
        );
      const prefix = locale === 'sv' ? '' : '/' + locale;
      const nodes = read(pathFile(prefix + '/blog/posts/' + GUIDE_SLUGS[id]));
      const body = walk(nodes, (n) => attr(n, 'id') === 'guide-body')[0];
      assert.equal(
        plain(body.children),
        plain(
          parser.parse(expectedGuideBody(original[`blog.${id}.bodyHtml`], locale, id), id)
            .rootNodes,
        ),
      );
      assert.equal(
        plain(walk(nodes, (n) => attr(n, 'id') === 'guide-intro')[0].children),
        original[`blog.${id}.intro`].replace(/\s+/g, ' ').trim(),
      );
      const article = walk(nodes, (n) => n.name === 'article')[0];
      const relatedSections = walk(
        article.children,
        (n) => n.name === 'section' && walk(n.children, (child) => child.name === 'cx-card').length,
      );
      assert.equal(relatedSections.length, 1, 'Protected article has one related-reading section');
      const recommendations = walk(relatedSections[0].children, (n) => n.name === 'cx-card').map(
        (card) => {
          const links = walk(card.children, (n) => n.name === 'a' && attr(n, 'href'));
          assert.equal(links.length, 1, 'Each related card has one destination');
          return {
            href: attr(links[0], 'href'),
            title: attr(links[0], 'aria-label'),
            text: plain(card.children),
          };
        },
      );
      assert.equal(
        recommendations.length,
        6,
        'Six related guides include the approved extra recommendation',
      );
      assert.deepEqual(
        recommendations.slice(0, 5),
        protectedLocales.related[locale][id].map(({ title, description, href }) => ({
          href,
          title,
          text: `${title} ${description}`.replace(/\s+/g, ' ').trim(),
        })),
        'Historical related titles, descriptions, destinations and order remain unchanged',
      );
      const extraId = 'naturpool-fran-forsta-samtal-till-bad';
      assert.deepEqual(recommendations[5], {
        href: prefix + '/blog/posts/' + GUIDE_SLUGS[extraId],
        title: translations[locale][`blog.${extraId}.title`],
        text: `${translations[locale][`blog.${extraId}.title`]} ${translations[locale][`blog.${extraId}.seo.description`]}`,
      });
      assert.equal(
        walk(nodes, (n) => attr(n, 'id') === 'measurement-title').length,
        0,
        'The oversized editorial statistics section is absent',
      );
    });
  }
  for (const [page, path] of Object.entries(PUBLIC_PAGES[locale])) {
    test(`${locale}: ${page} uses English page slugs and localized SEO before JavaScript`, () => {
      const nodes = read(pathFile(path));
      assert.equal(
        plain(walk(nodes, (n) => n.name === 'title')[0].children),
        translations[locale][`seo.${page}.title`],
      );
      assert.equal(
        attr(
          walk(nodes, (n) => n.name === 'meta' && attr(n, 'name') === 'description')[0],
          'content',
        ),
        translations[locale][`seo.${page}.description`],
      );
      assert.equal(walk(nodes, (n) => n.name === 'h1').length, 1);
      assert.ok(plain(nodes).length > 200, 'Useful page content is prerendered');
    });
  }
  for (const [id, slug] of Object.entries(GUIDE_SLUGS)) {
    if (PROTECTED_GUIDE_IDS.includes(id)) continue;
    test(`${locale}: revised/new guide ${id} renders its authored translation and useful links`, () => {
      const prefix = locale === 'sv' ? '' : '/' + locale;
      const nodes = read(pathFile(prefix + '/blog/posts/' + slug));
      const body = walk(nodes, (n) => attr(n, 'id') === 'guide-body')[0];
      const authored = parser.parse(translations[locale][`blog.${id}.bodyHtml`], id).rootNodes;
      assert.equal(plain(body.children), plain(authored), 'Localized article is complete');
      assert.equal(
        plain(walk(nodes, (n) => n.name === 'h1')[0].children),
        translations[locale][`blog.${id}.title`],
      );
      assert.ok(walk(body.children, (n) => n.name === 'h2').length >= 3);
      const links = walk(body.children, (n) => n.name === 'a').map((n) => attr(n, 'href'));
      assert.ok(
        links.some(
          (href) =>
            href?.startsWith(prefix + '/nature-pools/') ||
            href?.startsWith(prefix + '/waterscapes/') ||
            href?.startsWith(prefix + '/configure/') ||
            href === 'mailto:info@faunapoolen.se',
        ),
        'Article has a relevant offer or direct support destination',
      );
      for (const href of links.filter((href) => href?.startsWith('/'))) {
        const target = new URL(href, 'https://faunapoolen.se').pathname;
        assert.ok(
          PUBLIC_CANONICAL_PATHS.includes(target) || LEGACY_REDIRECTS[target.replace(/\/$/, '')],
          `Broken internal article destination: ${href}`,
        );
      }
    });
  }
}
for (const path of PUBLIC_CANONICAL_PATHS) {
  test(`canonical identity and reciprocal alternates: ${path}`, () => {
    const nodes = read(pathFile(path));
    if (path.includes('/blog/posts/')) {
      const cards = walk(nodes, (n) => n.name === 'cx-card');
      assert.equal(cards.length, 6, 'Every guide has six recommendations');
      const destinations = cards.map((card) => {
        const links = walk(card.children, (n) => n.name === 'a' && attr(n, 'href'));
        const images = walk(card.children, (n) => n.name === 'img');
        assert.equal(links.length, 1, 'A recommendation has one whole-card destination');
        assert.equal(images.length, 1, 'A recommendation has one article photograph');
        assert.equal(walk(card.children, (n) => n.name === 'h3').length, 1);
        const href = attr(links[0], 'href');
        assert.notEqual(href, path, 'A guide never recommends itself');
        assert.ok(PUBLIC_CANONICAL_PATHS.includes(href));
        const target = read(pathFile(href));
        assert.ok(
          walk(target, (n) => n.name === 'img' && attr(n, 'src') === attr(images[0], 'src')).length,
          'Recommendation photography belongs to the linked article',
        );
        return href;
      });
      assert.equal(new Set(destinations).size, 6, 'Recommendations are distinct');
    }
    const canonical = walk(nodes, (n) => n.name === 'link' && attr(n, 'rel') === 'canonical');
    assert.equal(canonical.length, 1);
    assert.equal(attr(canonical[0], 'href'), 'https://faunapoolen.se' + path);
    const alternates = walk(nodes, (n) => n.name === 'link' && attr(n, 'hreflang'));
    assert.deepEqual(alternates.map((n) => attr(n, 'hreflang')).sort(), [
      'da',
      'en',
      'sv',
      'x-default',
    ]);
    for (const alternate of alternates) {
      const target = new URL(attr(alternate, 'href')).pathname;
      assert.ok(PUBLIC_CANONICAL_PATHS.includes(target));
      const counterpart = read(pathFile(target));
      assert.ok(
        walk(
          counterpart,
          (n) =>
            n.name === 'link' &&
            attr(n, 'rel') === 'alternate' &&
            attr(n, 'href') === 'https://faunapoolen.se' + path,
        ).length,
      );
    }
    assert.equal(
      walk(
        nodes,
        (n) =>
          n.name === 'meta' &&
          attr(n, 'name') === 'robots' &&
          /noindex/.test(attr(n, 'content') ?? ''),
      ).length,
      0,
    );
  });
}

for (const locale of ['en', 'sv', 'da']) {
  test(`${locale}: package shells retain VAT exclusions without freezing editable prices`, () => {
    const prefix = locale === 'sv' ? '' : locale + '/';
    const nodes = read(prefix + 'nature-pools/pricing/index.html');
    const text = plain(nodes);
    // Current prices belong to the runtime catalogue, never a stale build snapshot.
    for (const value of [430_000, 1_100_000, 4_400_000]) {
      const amount = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'SEK',
        maximumFractionDigits: 0,
      })
        .format(value)
        .replace(/\s+/g, ' ');
      assert.ok(!text.includes(amount), `Package amount ${amount} is not frozen into HTML`);
    }
    assert.ok(text.includes(translations[locale]['site.editorial.priceScope']));
  });
}

test('public pages never describe a price or cost as including VAT', () => {
  for (const path of PUBLIC_CANONICAL_PATHS) {
    const text = plain(read(pathFile(path)));
    assert.doesNotMatch(
      text,
      /\b(?:incl\.?|include[sd]?|including|inclusive of)\s+VAT\b|\b(?:inkl\.?|inklusive|inkluderar|inkluderer)\s+moms\b/i,
      path,
    );
  }
});
