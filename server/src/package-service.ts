import { HttpError } from '@mikaelcedergren/cx-framework/server/errors';
import {
  withImmediateTransaction,
  type SyncSqliteDatabase,
} from '@mikaelcedergren/cx-framework/server/sqlite';
import {
  PACKAGE_IDS,
  type PackageCatalogue,
  type PackageService,
  type PackageValues,
} from './package-contracts.js';

function invalid(message: string): never {
  throw new HttpError({ status: 400, code: 'invalid_packages', message });
}
function exact(value: unknown, keys: string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !== keys.sort().join(',')
  )
    invalid('The package details are incomplete or unsupported.');
  return value as Record<string, unknown>;
}
export function createPackageService(database: SyncSqliteDatabase, scope: string): PackageService {
  if (!['development', 'production', 'test'].includes(scope))
    throw new Error('Invalid package execution scope.');
  const read = (): PackageCatalogue => {
    const row = database.get(
      'SELECT revision,packages_json FROM package_catalogues WHERE execution_scope=?',
      [scope],
    );
    if (!row) throw new Error('Package catalogue is missing.');
    return {
      revision: Number(row['revision']),
      packages: JSON.parse(String(row['packages_json'])) as PackageValues[],
    };
  };
  return {
    read,
    update(value) {
      const input = exact(value, ['revision', 'packages']);
      if (!Number.isSafeInteger(input['revision']) || Number(input['revision']) < 1)
        invalid('Reload packages before saving.');
      if (!Array.isArray(input['packages']) || input['packages'].length !== 3)
        invalid('All three packages are required.');
      const packages = input['packages'].map((entry, index): PackageValues => {
        const item = exact(entry, ['id', 'titles', 'price']);
        if (item['id'] !== PACKAGE_IDS[index])
          invalid('Package identities and order cannot change.');
        const titles = exact(item['titles'], ['en', 'sv', 'da']);
        const title = (locale: 'en' | 'sv' | 'da') => {
          const text = titles[locale];
          if (
            typeof text !== 'string' ||
            !text.trim() ||
            text.trim().length > 80 ||
            /[\u0000-\u001f\u007f]/u.test(text)
          )
            invalid('Each title must contain 1–80 characters on one line.');
          return text.trim();
        };
        const price = item['price'];
        if (
          typeof price !== 'number' ||
          !Number.isSafeInteger(price) ||
          price < 1 ||
          price > 100000000
        )
          invalid('Enter a whole SEK amount between 1 and 100,000,000.');
        return {
          id: PACKAGE_IDS[index]!,
          titles: { en: title('en'), sv: title('sv'), da: title('da') },
          price,
        };
      });
      return withImmediateTransaction(database, () => {
        if (read().revision !== input['revision'])
          throw new HttpError({
            status: 409,
            code: 'packages_changed',
            message: 'Packages changed since you opened them. Reload before saving.',
          });
        database.run(
          'UPDATE package_catalogues SET packages_json=?,revision=revision+1,updated_at=? WHERE execution_scope=?',
          [JSON.stringify(packages), new Date().toISOString(), scope],
        );
        return read();
      });
    },
  };
}
