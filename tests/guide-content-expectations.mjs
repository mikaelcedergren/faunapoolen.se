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

// Owner-approved 2026-10-03: remove only the DIY/project advice sentence.
const removedAdvice = JSON.parse(
  readFileSync(new URL('./fixtures/approved-guide-advice-removal.json', import.meta.url), 'utf8'),
);
const advicePredecessor = {
  en: 'We offer a free phone consultation where we go through your needs and concerns together.',
  sv: 'Vi erbjuder en kostnadsfri telefonkonsultation där vi tillsammans går igenom dina behov och funderingar.',
  da: 'Vi tilbyder en gratis indledende telefonsamtale om dine behov og spørgsmål.',
};

// Owner-approved 2026-10-03: replace the unrelated inline mood image with
// construction materials. Historical fixtures and all surrounding prose stay intact.
const inlineImageReplacement = JSON.parse(
  readFileSync(
    new URL('./fixtures/approved-guide-inline-image-replacement.json', import.meta.url),
    'utf8',
  ),
);

export function expectedGuideImages(images, id) {
  return id === 'build'
    ? images.map((src) =>
        src === '/assets/images/blog/blog-post-mood-image-1.jpg'
          ? '/assets/images/guides/inline/build-materials.webp'
          : src,
      )
    : images;
}

export function historicalGuideWording(body, locale, id) {
  if (id !== 'build') return body;
  const [original, qualified] = guideVatWording[locale];
  assert.ok(body.includes(qualified), 'DIY estimate explicitly excludes VAT');
  assert.ok(!body.includes(removedAdvice[locale]), 'Approved advice sentence is removed');
  assert.ok(body.includes(advicePredecessor[locale]), 'Surrounding copy remains unchanged');
  return body
    .replace(qualified, original)
    .replace(advicePredecessor[locale], `${advicePredecessor[locale]} ${removedAdvice[locale]}`);
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
  assert.ok(
    body.includes(removedAdvice[locale]),
    'Original advice sentence remains in the fixture',
  );
  const revised = body.replace(amount, qualified).replace(` ${removedAdvice[locale]}`, '');
  const image = inlineImageReplacement[locale];
  if (!image) return revised;
  assert.ok(revised.includes(image.original), 'Original inline image remains in the fixture');
  return revised.replace(image.original, image.replacement);
}

// Swedish copy review, 2026-10-03: remove only the duplicated final full stop.
// The historical fixtures, words and all SEO fields remain unchanged.
export function expectedGuideIntro(original, locale, id) {
  if (locale !== 'sv' || id !== 'build') return original;
  assert.ok(original.endsWith('misstagen..'), 'Historical introduction ends with the known typo');
  return original.slice(0, -1);
}
