import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { openFaunapoolenDatabase } from './database.js';
import { createPackageService } from './package-service.js';

test('package edits persist, keep stable identities and cannot cross the publication boundary', (t) => {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'fauna-packages-')));
  const options = { operationalRoot: root, databasePath: path.join(root, 'synthetic.db') };
  let db = openFaunapoolenDatabase(options);
  t.after(() => {
    db.close();
    rmSync(root, { recursive: true, force: true });
  });
  const development = createPackageService(db.sqlite, 'development');
  const original = development.read();
  assert.deepEqual(
    original.packages.map((p) => [p.titles.en, p.price]),
    [
      ['Daily dips', 430000],
      ['Swim together', 1100000],
      ['More room', 4400000],
    ],
  );
  const draft = structuredClone(original);
  draft.packages[0]!.titles = { en: 'Morning swims', sv: 'Morgondopp', da: 'Morgensvømning' };
  draft.packages[0]!.price = 450000;
  assert.equal(development.update(draft).revision, 2);
  assert.deepEqual(createPackageService(db.sqlite, 'production').read(), original);
  assert.throws(() => development.update(original), /changed since/);
  const current = development.read();
  for (const price of [0, -1, 1.5, 100000001, '450000']) {
    const invalid = structuredClone(current);
    invalid.packages[1]!.price = price as number;
    assert.throws(() => development.update(invalid), /whole SEK/);
  }
  const blank = structuredClone(current);
  blank.packages[2]!.titles.da = ' ';
  assert.throws(() => development.update(blank), /Each title/);
  assert.throws(
    () => development.update({ ...current, packages: [...current.packages].reverse() }),
    /identities/,
  );
  assert.deepEqual(development.read(), current, 'failed updates are atomic');
  db.close();
  db = openFaunapoolenDatabase(options);
  assert.deepEqual(createPackageService(db.sqlite, 'development').read(), current);
});
