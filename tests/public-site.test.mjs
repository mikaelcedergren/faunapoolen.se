import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { HtmlParser } from '@angular/compiler';
import {
  PUBLIC_CANONICAL_PATHS,
  PUBLIC_PAGES,
  GUIDE_SLUGS,
  LEGACY_REDIRECTS,
} from '../server/src/public-routes.ts';

const root = resolve(import.meta.dirname, '..');
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
    const nodes = read(path.endsWith('/') ? path.slice(1) + 'index.html' : path.slice(1));
    const graph = walk(nodes, (n) => n.name === 'script' && attr(n, 'id') === 'fp-jsonld')[0];
    const page = JSON.parse(graph.children.map((node) => node.value ?? '').join(''))['@graph'].find(
      (node) => node['@id'] === `${url}#webpage`,
    );
    const entry = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].find((match) =>
      match[1].includes(`<loc>${url}</loc>`),
    )[1];
    assert.equal(entry.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1], page.dateModified, url);
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
    test(`${locale}: guide ${id} renders its authored translation and useful links`, () => {
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
      assert.equal(
        plain(walk(nodes, (n) => attr(n, 'id') === 'guide-intro')[0].children),
        translations[locale][`blog.${id}.intro`].replace(/\s+/g, ' ').trim(),
      );
      assert.equal(
        plain(walk(nodes, (n) => n.name === 'title')[0].children),
        translations[locale][`blog.${id}.seo.title`],
      );
      assert.equal(
        attr(
          walk(nodes, (n) => n.name === 'meta' && attr(n, 'name') === 'description')[0],
          'content',
        ),
        translations[locale][`blog.${id}.seo.description`],
      );
      const links = walk(body.children, (n) => n.name === 'a').map((n) => attr(n, 'href'));
      const offerLinks = [
        ...links,
        ...walk(nodes, (n) => n.name === 'fp-contact-invitation').flatMap((invitation) =>
          walk(invitation.children, (n) => n.name === 'a').map((n) => attr(n, 'href')),
        ),
      ];
      assert.ok(
        offerLinks.some((href) => {
          if (href === 'mailto:info@faunapoolen.se') return true;
          if (!href?.startsWith('/')) return false;
          const path = new URL(href, 'https://faunapoolen.se').pathname;
          const destination = LEGACY_REDIRECTS[path.replace(/\/$/, '')] ?? path;
          return ['nature-pools', 'waterscapes', 'configure'].some((section) =>
            destination.startsWith(`${prefix}/${section}/`),
          );
        }),
        'Article or its consultation invitation has a relevant offer or support destination',
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
for (const locale of ['en', 'sv', 'da']) {
  test(`${locale}: price guide leads to relevant pages before an enquiry`, () => {
    const prefix = locale === 'sv' ? '' : '/' + locale;
    const nodes = read(pathFile(prefix + '/blog/posts/naturpool-pris.html'));
    const article = walk(nodes, (node) => node.name === 'article')[0];
    const links = walk(article.children, (node) => node.name === 'a').map((node) =>
      attr(node, 'href'),
    );
    for (const path of ['/nature-pools/pricing/', '/nature-pools/', '/projects/gotland/']) {
      assert.ok(links.includes(prefix + path), `Useful next step: ${path}`);
    }
    assert.ok(links.every((href) => !href.includes('/configure') && !href.startsWith('http')));
    assert.equal(walk(nodes, (node) => node.name === 'fp-contact-invitation').length, 0);
    assert.equal(walk(nodes, (node) => node.name === 'fp-guide-prices').length, 1);
    const prices = walk(nodes, (node) => attr(node, 'id') === 'guide-prices')[0];
    assert.ok(prices, 'Starting-price section is readable and linked from contents');
    assert.ok(links.some((href) => href.endsWith('#guide-prices')));
    const invitation = walk(
      nodes,
      (node) => attr(node, 'aria-labelledby') === 'guide-explore-title',
    )[0];
    assert.equal(
      attr(walk(invitation.children, (node) => node.name === 'a')[0], 'href'),
      prefix + '/nature-pools/',
    );
    assert.ok(
      !/430[\s,]*000|1[\s,]*100[\s,]*000|4[\s,]*400[\s,]*000/.test(plain(article.children)),
      'Prerender does not freeze live catalogue prices',
    );
  });
  test(`${locale}: inline guide photographs retain their localized descriptions and loadable assets`, () => {
    const prefix = locale === 'sv' ? '' : '/' + locale;
    const images = [];
    for (const [id, slug] of Object.entries(GUIDE_SLUGS)) {
      const nodes = read(pathFile(prefix + '/blog/posts/' + slug));
      const body = walk(nodes, (node) => attr(node, 'id') === 'guide-body')[0];
      const authored = parser.parse(translations[locale][`blog.${id}.bodyHtml`], id).rootNodes;
      const describe = (image) =>
        Object.fromEntries(['src', 'alt', 'width', 'height'].map((key) => [key, attr(image, key)]));
      const renderedImages = walk(body.children, (node) => node.name === 'img').map(describe);
      assert.deepEqual(renderedImages, walk(authored, (node) => node.name === 'img').map(describe));
      for (const image of renderedImages) {
        assert.ok(image.src.startsWith('/assets/images/guides/inline/'));
        assert.ok(image.alt.length > 20, 'A useful localized description accompanies the image');
        assert.ok(Number(image.width) > 0 && Number(image.height) > 0);
        assert.ok(readFileSync(join(root, 'public', image.src)).length > 0);
        images.push(image.src);
      }
    }
    assert.equal(images.length, locale === 'da' ? 9 : 10);
    assert.equal(
      new Set(images).size,
      images.length,
      'Each section has its own relevant photograph',
    );
  });
  test(`${locale}: guide cards share their destination's current copy and unique cover`, () => {
    const prefix = locale === 'sv' ? '' : '/' + locale;
    const index = read(pathFile(prefix + '/blog/'));
    const cards = walk(index, (node) => node.name === 'fp-guide-card');
    assert.equal(cards.length, Object.keys(GUIDE_SLUGS).length);
    const covers = new Set();
    const destinations = new Set();
    for (const card of cards) {
      const link = walk(card.children, (node) => node.name === 'a')[0];
      const href = attr(link, 'href');
      const id = Object.keys(GUIDE_SLUGS).find(
        (key) => href === prefix + '/blog/posts/' + GUIDE_SLUGS[key],
      );
      assert.ok(id, `Unknown guide: ${href}`);
      destinations.add(id);
      const title = translations[locale][`blog.${id}.title`];
      const summary = translations[locale][`blog.${id}.summary`];
      assert.equal(plain(walk(card.children, (node) => node.name === 'h3')[0].children), title);
      assert.equal(plain(walk(card.children, (node) => node.name === 'p')[0].children), summary);
      const image = walk(card.children, (node) => node.name === 'img')[0];
      const cover = attr(image, 'src');
      covers.add(cover);
      assert.equal(cover, `/assets/images/guides/${id}.webp`);
      assert.ok(readFileSync(join(root, 'public', cover)).length > 0);
      const guide = read(pathFile(href));
      const hero = walk(guide, (node) => node.name === 'cx-hero')[0];
      const heroImage = walk(hero.children, (node) => node.name === 'img')[0];
      assert.equal(attr(heroImage, 'src'), cover);
      assert.equal(attr(heroImage, 'alt'), translations[locale][`blog.${id}.imageAlt`]);
      assert.equal(
        attr(
          walk(guide, (node) => node.name === 'meta' && attr(node, 'property') === 'og:image')[0],
          'content',
        ),
        'https://faunapoolen.se' + cover,
      );
    }
    assert.equal(covers.size, cards.length, 'Each guide has its own photograph');
    assert.equal(destinations.size, cards.length, 'The index lists each guide once');
  });
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
        const targetHero = walk(target, (n) => n.name === 'cx-hero')[0];
        assert.equal(
          attr(walk(targetHero.children, (n) => n.name === 'img')[0], 'src'),
          attr(images[0], 'src'),
          'Recommendation photograph is the linked article hero',
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
