import type { SqliteMigration } from '@mikaelcedergren/cx-framework/server/sqlite';

/** The small pool is for dips: avoid the Italian word that also suggests diving. */
export const PACKAGE_ITALIAN_TITLE_MIGRATION: SqliteMigration = {
  version: 18,
  name: 'italian_daily_dips_wording',
  statements: [
    `UPDATE package_catalogues SET packages_json = json_set(packages_json,
      '$[0].titles.it', 'Bagni quotidiani'
    ), revision = revision + 1 WHERE json_extract(packages_json, '$[0].titles.it') = 'Tuffi quotidiani'`,
  ],
};
