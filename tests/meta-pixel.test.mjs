import assert from 'node:assert/strict';
import test from 'node:test';
import { MetaPixel, META_PIXEL_ID } from '../src/app/site/meta-pixel.ts';

function fixture(origin = 'https://faunapoolen.se') {
  const scripts = [];
  const cookies = [];
  const document = {
    defaultView: { location: { origin } },
    createElement: () => ({}),
    head: { appendChild: (script) => scripts.push(script) },
    set cookie(value) {
      cookies.push(value);
    },
  };
  return { document, scripts, cookies, pixel: new MetaPixel(document) };
}

test('Meta stays absent until used, loads once, and emits only explicit events for the intended pixel', () => {
  const { pixel, scripts, document } = fixture();
  assert.deepEqual(scripts, []);
  assert.equal(document.defaultView.fbq, undefined);
  pixel.send('PageView');
  pixel.send('Lead');
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, 'https://connect.facebook.net/en_US/fbevents.js');
  const fbq = document.defaultView.fbq;
  assert.equal(fbq.disablePushState, true);
  assert.deepEqual(fbq.queue, [
    ['consent', 'revoke'],
    ['set', 'autoConfig', false, META_PIXEL_ID],
    ['init', META_PIXEL_ID],
    ['consent', 'grant'],
    ['trackSingle', META_PIXEL_ID, 'PageView'],
    ['consent', 'grant'],
    ['trackSingle', META_PIXEL_ID, 'Lead'],
  ]);
});

test('withdrawal during download removes pending events and revokes consent before the SDK can send them', () => {
  const { pixel, document, cookies } = fixture();
  pixel.send('PageView');
  pixel.send('Lead');
  pixel.revoke();
  assert.equal(
    document.defaultView.fbq.queue.some((args) => args[0] === 'trackSingle'),
    false,
  );
  assert.deepEqual(document.defaultView.fbq.queue.at(-1), ['consent', 'revoke']);
  assert.equal(cookies.length, 6);
  assert(cookies.every((cookie) => cookie.includes('max-age=0; path=/')));
  pixel.send('PageView');
  assert.deepEqual(document.defaultView.fbq.queue.slice(-2), [
    ['consent', 'grant'],
    ['trackSingle', META_PIXEL_ID, 'PageView'],
  ]);
});

test('loaded SDK receives withdrawal and reacceptance commands', () => {
  const { pixel, document, scripts } = fixture();
  pixel.send('PageView');
  const calls = [];
  document.defaultView.fbq.callMethod = (...args) => calls.push(args);
  pixel.revoke();
  pixel.send('PageView');
  assert.deepEqual(calls, [
    ['consent', 'revoke'],
    ['consent', 'grant'],
    ['trackSingle', META_PIXEL_ID, 'PageView'],
  ]);
  assert.equal(scripts.length, 1);
});

for (const origin of [
  'http://127.0.0.1:4240',
  'http://localhost:4240',
  'https://preview.example',
  'http://faunapoolen.se',
]) {
  test(`Meta never loads on ${origin}`, () => {
    const { pixel, scripts, document } = fixture(origin);
    pixel.send('PageView');
    pixel.send('Lead');
    assert.deepEqual(scripts, []);
    assert.equal(document.defaultView.fbq, undefined);
  });
}
