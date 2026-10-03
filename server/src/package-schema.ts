import type { SqliteMigration } from '@mikaelcedergren/cx-framework/server/sqlite';

// Frozen launch values. Once installed, the catalogue is edited only through the admin.
const initial = JSON.stringify([
  {
    id: 'glade',
    titles: { en: 'Daily dips', sv: 'Dagliga dopp', da: 'Daglige dukkerter' },
    price: 430000,
  },
  {
    id: 'summer',
    titles: { en: 'Swim together', sv: 'Bada tillsammans', da: 'Bad sammen' },
    price: 1100000,
  },
  { id: 'horizon', titles: { en: 'More room', sv: 'Mer plats', da: 'Mere plads' }, price: 4400000 },
]);
export const PACKAGE_MIGRATION: SqliteMigration = {
  version: 16,
  name: 'scoped_public_package_catalogue',
  statements: [
    `CREATE TABLE package_catalogues (
      execution_scope TEXT PRIMARY KEY CHECK(execution_scope IN ('development','production','test')),
      revision INTEGER NOT NULL CHECK(revision>=1),
      packages_json TEXT NOT NULL CHECK(json_valid(packages_json) AND length(packages_json)<=5000),
      updated_at TEXT NOT NULL
    ) STRICT`,
    ...['development', 'production', 'test'].map(
      (scope) =>
        `INSERT INTO package_catalogues VALUES ('${scope}',1,'${initial.replaceAll("'", "''")}','2026-10-03T00:00:00.000Z')`,
    ),
  ],
};
