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
  draft.packages[0]!.titles = {
    ...draft.packages[0]!.titles,
    en: 'Morning swims',
    sv: 'Morgondopp',
    da: 'Morgensvømning',
  };
  draft.packages[0]!.price = 450000;
  assert.equal(development.update(draft).revision, original.revision + 1);
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

test('adding package languages preserves edited prices, existing titles and scope isolation', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const { createHash } = await import('node:crypto');
  const { applySqliteMigrations, createPreparedSyncSqliteAdapter } =
    await import('@mikaelcedergren/cx-framework/server/sqlite');
  const { FAUNAPOOLEN_MIGRATIONS, migrateFaunapoolenDatabase } = await import('./database.js');
  const { PUBLIC_LANGUAGES } = await import('./public-routes.js');
  const native = new DatabaseSync(':memory:');
  try {
    const database = createPreparedSyncSqliteAdapter(native);
    applySqliteMigrations(
      database,
      FAUNAPOOLEN_MIGRATIONS.filter((migration) => migration.version <= 16),
      {
        fingerprint: (source) => createHash('sha256').update(source).digest('hex'),
        now: () => '2026-10-24T00:00:00.000Z',
      },
    );
    database.run(
      `UPDATE package_catalogues SET packages_json = json_set(packages_json, '$[0].price', 450000, '$[0].titles.en', 'Owner title'), revision = 4 WHERE execution_scope = 'development'`,
    );
    migrateFaunapoolenDatabase(database);
    const development = createPackageService(database, 'development').read();
    assert.equal(development.revision, 6);
    assert.equal(development.packages[0]!.titles.it, 'Bagni quotidiani');
    assert.equal(development.packages[0]!.price, 450000);
    assert.equal(development.packages[0]!.titles.en, 'Owner title');
    for (const item of development.packages) {
      assert.deepEqual(Object.keys(item.titles).sort(), [...PUBLIC_LANGUAGES].sort());
      assert.ok(Object.values(item.titles).every((title) => title.length > 0));
    }
    assert.equal(createPackageService(database, 'production').read().packages[0]!.price, 430000);
    migrateFaunapoolenDatabase(database);
    assert.deepEqual(createPackageService(database, 'development').read(), development);
  } finally {
    native.close();
  }
});
