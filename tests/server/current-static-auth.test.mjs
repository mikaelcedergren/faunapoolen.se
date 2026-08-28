import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createFailureTracker,
  createSessionStore,
  MAX_ADMIN_SESSIONS,
  MAX_FAILURE_STATES,
  sessionMaxAgeSeconds,
} from '../../server/admin-auth.mjs';
import {
  CURRENT_LITERAL_HTML_ROUTES,
  CURRENT_ROUTE_COUNT_PER_LOCALE,
  CURRENT_SECTION_ROUTES,
} from '../fixtures/current-public-routes.mjs';
import {
  authenticatedCookie,
  cookiePair,
  createCurrentFixture,
  CURRENT_ADMIN_PASSWORD,
  CURRENT_ADMIN_USERNAME,
  localFetch,
  login,
  post,
  startCurrentServer,
  stopCurrentServer,
} from './current-server-harness.mjs';

test('current public static routes preserve section, literal-html, language, and protected URLs', async (t) => {
  const fixture = await createCurrentFixture(t);
  const server = await startCurrentServer(fixture);

  for (const [pathname, marker] of [
    ['/', 'current-root'],
    ['/about', 'current-about'],
    ['/about/', 'current-about'],
    ['/en/about', 'current-about-en'],
    ['/en/about/', 'current-about-en'],
    ['/koi-pond-series.html', 'current-literal-html'],
    ['/en/koi-pond-series.html', 'current-literal-html-en'],
    ['/blog/posts/difference-between-normal-pool-and-natural-pool.html', 'current-protected-one'],
    ['/blog/posts/build-your-own-nature-pool.html', 'current-protected-two'],
    [
      '/en/blog/posts/difference-between-normal-pool-and-natural-pool.html',
      'current-protected-one-en',
    ],
    ['/en/blog/posts/build-your-own-nature-pool.html', 'current-protected-two-en'],
  ]) {
    const response = await localFetch(`${server.baseUrl}${pathname}`);
    assert.equal(response.status, 200, pathname);
    assert.equal(response.headers.get('cache-control'), 'no-cache', pathname);
    assert.match(await response.text(), new RegExp(marker), pathname);
  }

  const publicCampaign = await localFetch(`${server.baseUrl}/campaigns/pond-packages/`);
  assert.equal(publicCampaign.status, 200);
  assert.equal(publicCampaign.headers.get('x-robots-tag'), null);
  assert.match(await publicCampaign.text(), /name="robots" content="noindex, follow"/);

  const literalWithSlash = await localFetch(`${server.baseUrl}/koi-pond-series.html/`);
  assert.equal(literalWithSlash.status, 404);
  assert.match(await literalWithSlash.text(), /current-404/);
});

test('current complete 28-route Swedish and English output matrix remains reachable', async (t) => {
  assert.equal(CURRENT_ROUTE_COUNT_PER_LOCALE, 28);
  const fixture = await createCurrentFixture(t);
  const server = await startCurrentServer(fixture);
  let requests = 0;
  for (const localePrefix of ['', '/en']) {
    for (const route of CURRENT_SECTION_ROUTES) {
      const pathname = `${localePrefix}/${route}${route ? '/' : ''}` || '/';
      const response = await localFetch(`${server.baseUrl}${pathname}`);
      assert.equal(response.status, 200, pathname);
      const privateAdmin = route === 'admin';
      assert.equal(
        response.headers.get('x-robots-tag'),
        privateAdmin ? 'noindex, nofollow' : null,
        pathname,
      );
      requests += 1;
    }
    for (const route of CURRENT_LITERAL_HTML_ROUTES) {
      const pathname = `${localePrefix}/${route}`;
      const response = await localFetch(`${server.baseUrl}${pathname}`);
      assert.equal(response.status, 200, pathname);
      assert.equal(response.headers.get('x-robots-tag'), null, pathname);
      requests += 1;
    }
  }
  assert.equal(requests, 56);
});

test('current static cache, asset, API, fallback, health, and hardening responses are exact', async (t) => {
  const fixture = await createCurrentFixture(t);
  const server = await startCurrentServer(fixture);

  const health = await localFetch(`${server.baseUrl}/healthz`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { app: 'faunapoolen.se', ok: true, port: server.port });
  assert.equal(health.headers.get('x-powered-by'), null);
  assert.equal(health.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(health.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(
    health.headers.get('permissions-policy'),
    'camera=(), microphone=(), geolocation=()',
  );
  assert.equal(health.headers.get('cross-origin-opener-policy'), 'same-origin');
  assert.equal(health.headers.get('cross-origin-resource-policy'), 'same-origin');

  const hashed = await localFetch(`${server.baseUrl}/main-ABCDEF12.js`);
  assert.equal(hashed.status, 200);
  assert.equal(hashed.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  const ordinary = await localFetch(`${server.baseUrl}/styles.css`);
  assert.equal(ordinary.headers.get('cache-control'), 'public, max-age=3600');
  const build = await localFetch(`${server.baseUrl}/cx-build.json`);
  assert.equal(build.headers.get('cache-control'), 'no-store, no-cache, must-revalidate');

  const missingAsset = await localFetch(`${server.baseUrl}/assets/missing.js`);
  assert.equal(missingAsset.status, 404);
  assert.equal(missingAsset.headers.get('cache-control'), 'no-store');
  assert.equal(await missingAsset.text(), 'Asset not found');

  const missingPage = await localFetch(`${server.baseUrl}/not-a-current-route`);
  assert.equal(missingPage.status, 404);
  assert.equal(missingPage.headers.get('cache-control'), 'no-cache');
  assert.match(await missingPage.text(), /current-404/);

  const api = await localFetch(`${server.baseUrl}/api/not-a-route`);
  assert.equal(api.status, 404);
  assert.deepEqual(await api.json(), { error: 'API route not found' });
});

test('current private/noindex prefixes are case-insensitive and segment-bounded on every response', async (t) => {
  const fixture = await createCurrentFixture(t);
  const server = await startCurrentServer(fixture);

  for (const pathname of [
    '/admin',
    '/ADMIN/',
    '/admin/child',
    '/en/admin',
    '/EN/ADMIN/child',
    '/admin-auth/session',
    '/ADMIN-AUTH/anything',
  ]) {
    const response = pathname.toLowerCase().includes('admin-auth/session')
      ? await localFetch(`${server.baseUrl}${pathname}`, { method: 'POST' })
      : await localFetch(`${server.baseUrl}${pathname}`, { redirect: 'manual' });
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow', pathname);
  }

  for (const pathname of [
    '/administration',
    '/administer',
    '/en/administrator',
    '/admin-authentication',
    '/campaigns/pond-packages/',
  ]) {
    const response = await localFetch(`${server.baseUrl}${pathname}`);
    assert.equal(response.headers.get('x-robots-tag'), null, pathname);
  }

  const unknownPrivatePost = await localFetch(`${server.baseUrl}/ADMIN-AUTH/not-a-route`, {
    method: 'POST',
  });
  assert.equal(unknownPrivatePost.status, 404);
  assert.equal(unknownPrivatePost.headers.get('x-robots-tag'), 'noindex, nofollow');
});

test('current authentication cookie, session, duplicate, logout, and origin behaviour stays explicit', async (t) => {
  const fixture = await createCurrentFixture(t);
  const server = await startCurrentServer(fixture, { cookieSecure: true, sessionHours: '0.5' });

  const crossOriginLogin = await login(server, {
    headers: { origin: 'https://cross-origin.invalid' },
  });
  assert.equal(crossOriginLogin.status, 200);
  assert.deepEqual(await crossOriginLogin.json(), { ok: true });
  assert.match(
    crossOriginLogin.headers.get('set-cookie'),
    /^fp_admin_session=[^;]+; Path=\/; HttpOnly; SameSite=Strict; Max-Age=1800; Secure$/,
  );
  const firstCookie = cookiePair(crossOriginLogin);
  const secondCookie = cookiePair(await login(server));
  assert.notEqual(secondCookie, firstCookie);

  for (const cookie of [firstCookie, secondCookie]) {
    const session = await post(server, '/admin-auth/session', { cookie });
    assert.deepEqual(await session.json(), { authenticated: true });
  }

  const firstInvalid = await post(server, '/admin-auth/session', {
    cookie: `fp_admin_session=invalid; ${secondCookie}`,
  });
  assert.deepEqual(await firstInvalid.json(), { authenticated: false });
  const firstValid = await post(server, '/admin-auth/session', {
    cookie: `${secondCookie}; fp_admin_session=invalid`,
  });
  assert.deepEqual(await firstValid.json(), { authenticated: true });

  await post(server, '/admin-auth/logout', {
    cookie: `fp_admin_session=invalid; ${secondCookie}`,
  });
  assert.deepEqual(
    await (await post(server, '/admin-auth/session', { cookie: secondCookie })).json(),
    { authenticated: true },
    'logout also acts on only the first duplicate cookie',
  );

  const logout = await post(server, '/admin-auth/logout', { cookie: firstCookie });
  assert.equal(logout.status, 200);
  assert.deepEqual(await logout.json(), { ok: true });
  assert.equal(
    logout.headers.get('set-cookie'),
    'fp_admin_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Secure',
  );
  assert.deepEqual(
    await (await post(server, '/admin-auth/session', { cookie: firstCookie })).json(),
    { authenticated: false },
  );
  assert.deepEqual(
    await (await post(server, '/admin-auth/session', { cookie: secondCookie })).json(),
    { authenticated: true },
  );

  const config = await post(server, '/admin-auth/campaigns/config', {
    cookie: secondCookie,
    headers: { origin: 'https://cross-origin.invalid' },
  });
  assert.equal(config.status, 200, 'current server has no Origin guard');
});

test('current sessions expire, clear on restart, and leave campaign files available', async (t) => {
  const fixture = await createCurrentFixture(t);
  let server = await startCurrentServer(fixture, { sessionHours: '0.0002777778' });
  const expiringCookie = await authenticatedCookie(server);
  await new Promise((resolve) => setTimeout(resolve, 1_100));
  assert.deepEqual(
    await (await post(server, '/admin-auth/session', { cookie: expiringCookie })).json(),
    { authenticated: false },
  );

  const restartCookie = await authenticatedCookie(server);
  await stopCurrentServer(server);
  server = await startCurrentServer(fixture);
  const afterRestart = await post(server, '/admin-auth/session', { cookie: restartCookie });
  assert.deepEqual(await afterRestart.json(), { authenticated: false });
});

test('current login parser, configuration, authentication, and campaign parser ordering is pinned', async (t) => {
  const fixture = await createCurrentFixture(t);
  const server = await startCurrentServer(fixture, {
    omitAdminCredentials: true,
  });

  const malformed = await localFetch(`${server.baseUrl}/admin-auth/login`, {
    body: '{',
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  assert.equal(malformed.status, 400);
  assert.match(malformed.headers.get('content-type'), /^text\/html/);
  assert.equal(malformed.headers.get('cache-control'), 'no-store');

  const primitive = await localFetch(`${server.baseUrl}/admin-auth/login`, {
    body: 'true',
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  assert.equal(primitive.status, 400);

  const unconfigured = await login(server);
  assert.equal(unconfigured.status, 503);
  assert.deepEqual(await unconfigured.json(), { error: 'Admin login is not configured.' });

  const fixtureConfigured = await createCurrentFixture(t);
  const configured = await startCurrentServer(fixtureConfigured);
  const signedOutMalformedCampaign = await localFetch(
    `${configured.baseUrl}/admin-auth/campaigns/open`,
    {
      body: '{',
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    },
  );
  assert.equal(signedOutMalformedCampaign.status, 401);
  assert.deepEqual(await signedOutMalformedCampaign.json(), {
    error: 'Your admin session has expired.',
  });

  const cookie = await authenticatedCookie(configured);
  const signedInMalformedCampaign = await localFetch(
    `${configured.baseUrl}/admin-auth/campaigns/open`,
    {
      body: '{',
      headers: { 'content-type': 'application/json', cookie },
      method: 'POST',
    },
  );
  assert.equal(signedInMalformedCampaign.status, 400);
  assert.match(signedInMalformedCampaign.headers.get('content-type'), /^text\/html/);

  const oversized = await localFetch(`${configured.baseUrl}/admin-auth/login`, {
    body: JSON.stringify({ username: 'x'.repeat(3_000), password: CURRENT_ADMIN_PASSWORD }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  assert.equal(oversized.status, 413);
  assert.match(oversized.headers.get('content-type'), /^text\/html/);

  const getLogin = await localFetch(`${configured.baseUrl}/admin-auth/login`);
  assert.equal(getLogin.status, 404, 'all current admin routes are POST-only');
  assert.equal(getLogin.headers.get('x-robots-tag'), 'noindex, nofollow');
});

test('current login throttling counts eight failures, blocks correct credentials, and isolates clients', async (t) => {
  const fixture = await createCurrentFixture(t);
  const server = await startCurrentServer(fixture);
  const failedClient = '198.51.100.11';

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const response = await login(server, {
      password: 'wrong-current-password',
      headers: { 'x-forwarded-for': failedClient },
    });
    assert.equal(response.status, 401, `failure ${String(attempt)}`);
    assert.deepEqual(await response.json(), { error: 'Invalid credentials.' });
  }
  const blockedCorrect = await login(server, { headers: { 'x-forwarded-for': failedClient } });
  assert.equal(blockedCorrect.status, 429);
  assert.deepEqual(await blockedCorrect.json(), { error: 'Too many sign-in attempts.' });

  const otherClient = await login(server, { headers: { 'x-forwarded-for': '198.51.100.12' } });
  assert.equal(otherClient.status, 200);
});

test('current login accepts JSON last-key wins, ignores extras, and bounds supplied credential strings', async (t) => {
  const fixture = await createCurrentFixture(t);
  const server = await startCurrentServer(fixture);
  const duplicateLastCorrect = await localFetch(`${server.baseUrl}/admin-auth/login`, {
    body: `{"username":"wrong","username":"${CURRENT_ADMIN_USERNAME}","password":"wrong","password":"${CURRENT_ADMIN_PASSWORD}","extra":true}`,
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  assert.equal(duplicateLastCorrect.status, 200);

  const duplicateLastWrong = await localFetch(`${server.baseUrl}/admin-auth/login`, {
    body: `{"username":"${CURRENT_ADMIN_USERNAME}","username":"wrong","password":"${CURRENT_ADMIN_PASSWORD}"}`,
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  assert.equal(duplicateLastWrong.status, 401);
  for (const body of [
    { username: 'x'.repeat(257), password: CURRENT_ADMIN_PASSWORD },
    { username: CURRENT_ADMIN_USERNAME, password: 'x'.repeat(257) },
    { username: 42, password: true },
  ]) {
    const response = await post(server, '/admin-auth/login', { body });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'Invalid credentials.' });
  }

  const skippedParser = await localFetch(`${server.baseUrl}/admin-auth/login`, {
    body: JSON.stringify({
      username: CURRENT_ADMIN_USERNAME,
      password: CURRENT_ADMIN_PASSWORD,
    }),
    method: 'POST',
  });
  assert.equal(skippedParser.status, 401);
});

test('current in-memory auth stores pin caps, oldest eviction, expiry, and fail-closed capacity', () => {
  assert.equal(MAX_ADMIN_SESSIONS, 64);
  assert.equal(MAX_FAILURE_STATES, 10_000);
  assert.equal(sessionMaxAgeSeconds('48'), 24 * 60 * 60);
  assert.equal(sessionMaxAgeSeconds('0.00001'), 1);
  assert.equal(sessionMaxAgeSeconds('-1'), 8 * 60 * 60);

  let now = 1_000;
  const sessions = createSessionStore({ maxSessions: 2, now: () => now });
  sessions.add('oldest', 10);
  now += 1;
  sessions.add('newer', 10);
  assert.deepEqual(sessions.add('newest', 10), { evicted: true });
  assert.equal(sessions.get('oldest'), undefined);
  assert.ok(sessions.get('newer'));
  assert.ok(sessions.get('newest'));

  const failures = createFailureTracker({
    maxClients: 1,
    maxFailures: 2,
    windowMs: 100,
    now: () => now,
  });
  failures.record('client-a');
  failures.record('client-a');
  assert.equal(failures.isRateLimited('client-a'), true);
  assert.equal(failures.isRateLimited('client-b'), true);
  now += 101;
  assert.equal(
    failures.isRateLimited('client-b'),
    true,
    'expired failure state stays fail-closed until the independent sweep deadline',
  );
  now += 60_000;
  assert.equal(failures.isRateLimited('client-b'), false);
});
