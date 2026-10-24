import type { SqliteMigration } from '@mikaelcedergren/cx-framework/server/sqlite';

/** Add the five owner-requested public languages without changing existing titles or prices. */
export const PACKAGE_TRANSLATIONS_MIGRATION: SqliteMigration = {
  version: 17,
  name: 'five_additional_package_languages',
  statements: [
    `UPDATE package_catalogues SET packages_json = json_set(packages_json,
      '$[0].titles.it', 'Tuffi quotidiani', '$[1].titles.it', 'Nuotare insieme', '$[2].titles.it', 'Più spazio',
      '$[0].titles.es', 'Chapuzones diarios', '$[1].titles.es', 'Nadar juntos', '$[2].titles.es', 'Más espacio',
      '$[0].titles.pt', 'Mergulhos diários', '$[1].titles.pt', 'Nadar em conjunto', '$[2].titles.pt', 'Mais espaço',
      '$[0].titles.de', 'Täglich eintauchen', '$[1].titles.de', 'Gemeinsam schwimmen', '$[2].titles.de', 'Mehr Platz',
      '$[0].titles.pl', 'Codzienne kąpiele', '$[1].titles.pl', 'Wspólne pływanie', '$[2].titles.pl', 'Więcej miejsca'
    ), revision = revision + 1`,
  ],
};
