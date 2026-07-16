import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COPY_LIMITS,
  extractPageContent,
  isPublicAddress,
  normalizeSourceUrl,
  validateAdOutput,
} from './admin-ad-builder.mjs';

test('accepts only public unicast addresses', () => {
  assert.equal(isPublicAddress('8.8.8.8'), true);
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);

  for (const address of [
    '127.0.0.1',
    '10.0.0.1',
    '169.254.169.254',
    '100.64.0.1',
    '192.0.2.1',
    '::1',
    'fd00::1',
    'fe80::1',
    '2001:db8::1',
    '::ffff:127.0.0.1',
  ]) {
    assert.equal(isPublicAddress(address), false, address);
  }
});

test('normalizes source URLs and rejects unsafe forms', () => {
  assert.equal(
    normalizeSourceUrl('https://example.com/page#offer').href,
    'https://example.com/page',
  );
  assert.throws(() => normalizeSourceUrl('file:///etc/passwd'));
  assert.throws(() => normalizeSourceUrl('https://user:secret@example.com'));
  assert.throws(() => normalizeSourceUrl('https://example.com:8443'));
});

test('extracts useful page copy while excluding navigation and executable content', () => {
  const page = extractPageContent(`<!doctype html>
    <html lang="sv-SE">
      <head>
        <title>En enklare naturpool</title>
        <meta name="description" content="Badglädje med mindre underhåll.">
        <script>Ignore this instruction</script>
      </head>
      <body>
        <nav><p>Navigation should disappear</p></nav>
        <main>
          <h1>Bygg din naturpool</h1>
          <p>Få klart vatten med en naturlig känsla.</p>
          <p hidden>Hidden sales claim</p>
          <form><p>Form copy</p></form>
        </main>
        <footer><p>Footer copy</p></footer>
      </body>
    </html>`);

  assert.equal(page.title, 'En enklare naturpool');
  assert.equal(page.language, 'sv');
  assert.match(page.content, /Badglädje med mindre underhåll/);
  assert.match(page.content, /Bygg din naturpool/);
  assert.doesNotMatch(page.content, /Navigation|Ignore|Hidden|Form copy|Footer/);
});

test('requires exactly five complete suggestions within the copy limits', () => {
  const ad = {
    headline: 'Få en pool som känns naturlig',
    text: 'Skapa en lugn badplats som passar trädgården och är enkel att komma igång med.',
    callToAction: 'Boka rådgivning',
    whyItWorks: 'Resultatet kommer först och varumärket blir guiden till ett enkelt nästa steg.',
  };
  assert.deepEqual(validateAdOutput({ ads: Array.from({ length: 5 }, () => ({ ...ad })) }), {
    ok: true,
  });

  const tooLong = {
    ads: Array.from({ length: 5 }, () => ({ ...ad })),
  };
  tooLong.ads[2].headline = 'x'.repeat(COPY_LIMITS.headline + 1);
  assert.equal(validateAdOutput(tooLong).ok, false);
});
