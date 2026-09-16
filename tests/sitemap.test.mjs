import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
