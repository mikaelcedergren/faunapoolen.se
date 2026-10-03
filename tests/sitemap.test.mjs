import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { PUBLIC_CANONICAL_PATHS } from '../server/src/public-routes.ts';
import { writeSitemap } from '../scripts/sitemap.mjs';
const origin = 'https://faunapoolen.se';
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'fauna-sitemap-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const path of PUBLIC_CANONICAL_PATHS) {
    const base = path.replace(/^\/(en|da)(?=\/)/, '');
    const file = join(directory, path.slice(1), ...(path.endsWith('/') ? ['index.html'] : []));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(
      file,
      `<html><head><link href="${origin}${path}" rel="canonical">${['sv', 'en', 'da', 'x-default'].map((lang) => `<link href="${origin}${lang === 'sv' || lang === 'x-default' ? '' : '/' + lang}${base}" hreflang="${lang}" rel="alternate">`).join('')}</head><body>Public fixture</body></html>`,
    );
  }
  return directory;
}
test('sitemap proves the exact route set independent of HTML attribute order', (t) => {
  const directory = fixture(t);
  writeSitemap(directory);
  const actual = [
    ...readFileSync(join(directory, 'sitemap.xml'), 'utf8').matchAll(/<loc>(.*?)<\/loc>/g),
  ].map((match) => match[1]);
  assert.deepEqual(actual.sort(), PUBLIC_CANONICAL_PATHS.map((path) => origin + path).sort());
});
test('sitemap rejects an unintended duplicate canonical before deduplication', (t) => {
  const directory = fixture(t);
  writeFileSync(join(directory, 'duplicate.html'), readFileSync(join(directory, 'index.html')));
  assert.throws(
    () => writeSitemap(directory),
    /Duplicate canonical output|Canonical does not identify/,
  );
});
test('sitemap rejects a missing canonical even when another output exists', (t) => {
  const directory = fixture(t);
  rmSync(join(directory, 'nature-pools/pricing/index.html'));
  assert.throws(() => writeSitemap(directory), /Missing canonical pages/);
});
test('sitemap rejects false language counterparts', (t) => {
  const directory = fixture(t);
  const file = join(directory, 'nature-pools/pricing/index.html');
  writeFileSync(
    file,
    readFileSync(file, 'utf8').replace(
      'https://faunapoolen.se/da/nature-pools/pricing/',
      'https://faunapoolen.se/da/',
    ),
  );
  assert.throws(() => writeSitemap(directory), /Non-reciprocal language counterparts/);
});

function addGraph(directory, graph) {
  const file = join(directory, 'index.html');
  writeFileSync(
    file,
    readFileSync(file, 'utf8').replace(
      '</head>',
      `<script type="application/ld+json">${JSON.stringify({ '@graph': graph })}</script></head>`,
    ),
  );
  return file;
}
const datedPage = (dateModified) => ({
  '@type': 'WebPage',
  '@id': origin + '/#webpage',
  url: origin + '/',
  dateModified,
});

test('sitemap retains authored dates across rebuilds and file timestamp changes', (t) => {
  const directory = fixture(t);
  const file = addGraph(directory, [datedPage('2024-02-29')]);
  writeSitemap(directory);
  const before = readFileSync(join(directory, 'sitemap.xml'), 'utf8');
  assert.match(
    before,
    /<loc>https:\/\/faunapoolen.se\/<\/loc>\n    <lastmod>2024-02-29<\/lastmod>/,
  );
  assert.equal([...before.matchAll(/<lastmod>/g)].length, 1, 'Undated pages stay undated');
  utimesSync(file, new Date('2030-01-01'), new Date('2030-01-01'));
  writeSitemap(directory);
  assert.equal(readFileSync(join(directory, 'sitemap.xml'), 'utf8'), before);
});

test('sitemap ignores organization dates and dates belonging to another page', (t) => {
  const directory = fixture(t);
  addGraph(directory, [
    { '@type': 'Organization', dateModified: '2024-01-01' },
    { ...datedPage('2024-01-01'), '@id': origin + '/en/#webpage', url: origin + '/en/' },
  ]);
  writeSitemap(directory);
  assert.doesNotMatch(readFileSync(join(directory, 'sitemap.xml'), 'utf8'), /<lastmod>/);
});

for (const date of ['2023-02-29', '2024-13-01', 'yesterday', '9999-01-01']) {
  test(`sitemap rejects invalid or future editorial date ${date}`, (t) => {
    const directory = fixture(t);
    addGraph(directory, [datedPage(date)]);
    assert.throws(() => writeSitemap(directory), /Invalid content modification date/);
  });
}

test('sitemap rejects contradictory modification dates for the same page', (t) => {
  const directory = fixture(t);
  addGraph(directory, [datedPage('2024-01-01'), datedPage('2024-02-01')]);
  assert.throws(() => writeSitemap(directory), /Conflicting content modification dates/);
});
