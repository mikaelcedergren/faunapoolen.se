import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Owner-approved 2026-09-30: the shared consultation invitation replaces this
// final paragraph. Keep the historical fixtures intact and permit only this deletion.
const removedContact = JSON.parse(
  readFileSync(new URL('./fixtures/approved-guide-contact-removal.json', import.meta.url), 'utf8'),
);

export function removedGuideContact(locale, id) {
  return id === 'build' ? removedContact[locale] : '';
}

export function expectedGuideBody(original, locale, id) {
  const removed = removedGuideContact(locale, id);
  if (!removed) return original;
  assert.ok(
    original.trimEnd().endsWith(removed),
    'Approved contact paragraph ends the original guide',
  );
  return original.trimEnd().slice(0, -removed.length).trimEnd();
}
