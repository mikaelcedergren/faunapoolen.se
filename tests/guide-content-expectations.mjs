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

// Owner-approved 2026-10-03: explicitly qualify the existing DIY estimate as net.
// Keep both historical fixtures unchanged and allow only this exact insertion.
const guideVatWording = {
  en: ['50,000–100,000 kronor', '50,000–100,000 kronor excluding VAT'],
  sv: ['50 000–100 000 kronor', '50 000–100 000 kronor exklusive moms'],
  da: ['50.000–100.000 svenske kroner', '50.000–100.000 svenske kroner eksklusive moms'],
};

export function historicalGuideVatWording(body, locale, id) {
  if (id !== 'build') return body;
  const [original, qualified] = guideVatWording[locale];
  assert.ok(body.includes(qualified), 'DIY estimate explicitly excludes VAT');
  return body.replace(qualified, original);
}

export function expectedGuideBody(original, locale, id) {
  const removed = removedGuideContact(locale, id);
  if (!removed) return original;
  assert.ok(
    original.trimEnd().endsWith(removed),
    'Approved contact paragraph ends the original guide',
  );
  const body = original.trimEnd().slice(0, -removed.length).trimEnd();
  const [amount, qualified] = guideVatWording[locale];
  assert.ok(body.includes(amount), 'Original DIY estimate remains present');
  return body.replace(amount, qualified);
}
