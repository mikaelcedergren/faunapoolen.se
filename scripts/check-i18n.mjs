import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const directory = fileURLToPath(new URL('../src/locale/', import.meta.url));
const english = JSON.parse(readFileSync(directory + 'messages.en.json', 'utf8'));
const keys = Object.keys(english.translations).sort();
const prune = process.argv.slice(2).join(' ') === '--prune';
assert.ok(process.argv.length === 2 || prune, 'Usage: check-i18n.mjs [--prune]');
const placeholders = (value) => [...value.matchAll(/\{\$([^}]+)\}/g)].map((m) => m[1]).sort();
for (const locale of ['sv', 'da']) {
  const file = directory + `messages.${locale}.json`;
  const catalogue = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(catalogue.locale, locale);
  for (const id of keys) {
    assert.ok(
      typeof catalogue.translations[id] === 'string' && catalogue.translations[id].trim(),
      `${locale}: missing ${id}`,
    );
    assert.deepEqual(
      placeholders(catalogue.translations[id]),
      placeholders(english.translations[id]),
      `${locale}: changed placeholders in ${id}`,
    );
  }
  if (prune)
    writeFileSync(
      file,
      JSON.stringify(
        {
          locale,
          translations: Object.fromEntries(keys.map((id) => [id, catalogue.translations[id]])),
        },
        null,
        2,
      ) + '\n',
    );
  else
    assert.deepEqual(
      Object.keys(catalogue.translations).sort(),
      keys,
      `${locale}: run extraction and remove obsolete translations`,
    );
}
console.log(
  `Translation catalogues: ${keys.length} English messages, complete Swedish and Danish counterparts.`,
);
