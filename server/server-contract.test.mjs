import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CONTRACT_PORT = 4342;
const STORAGE_FAILURE_PORT = 4343;
const ADMIN_USERNAME = 'contract-admin';
const ADMIN_PASSWORD = 'contract-password-with-no-live-access';
const CAMPAIGN_ID = '11111111-1111-4111-8111-111111111111';

function localUrl(port, path) {
  const url = new URL(path, `http://127.0.0.1:${port}`);
  if (url.hostname !== '127.0.0.1' || Number(url.port) !== port) {
    throw new Error(`Faunapoolen contract tests may only call reserved loopback port ${port}.`);
  }
  return url;
}

function localFetch(port, path, init) {
  return fetch(localUrl(port, path), init);
}

async function createBrowserFixture(directory) {
  const files = new Map([
    ['index.html', '<!doctype html><title>Faunapoolen contract root</title><p>fp-root</p>'],
    ['main.contract.js', 'globalThis.faunapoolenContractFixture = true;'],
    ['404.html', '<!doctype html><title>Not found</title><p>fp-404</p>'],
    ['about/index.html', '<!doctype html><title>About</title><p>fp-about</p>'],
    ['en/about/index.html', '<!doctype html><title>About</title><p>fp-about-en</p>'],
    ['admin/index.html', '<!doctype html><title>Admin</title><p>fp-admin-login</p>'],
    [
      'blog/posts/difference-between-normal-pool-and-natural-pool.html',
      '<!doctype html><title>Protected post one</title><p>fp-protected-one</p>',
    ],
    [
      'blog/posts/build-your-own-nature-pool.html',
      '<!doctype html><title>Protected post two</title><p>fp-protected-two</p>',
    ],
  ]);
  for (const [relativePath, body] of files) {
    const target = join(directory, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, body, 'utf8');
  }
}

function startServer({ port, browserDir, campaignDataDir }) {
  const child = spawn(
    process.execPath,
    ['--import', './server/test/block-external-fetch.mjs', 'server/index.mjs'],
    {
      cwd: ROOT,
      env: {
        CX_TEST_ALLOWED_ORIGIN: `http://127.0.0.1:${String(port)}`,
        PATH: process.env.PATH,
        TMPDIR: process.env.TMPDIR,
        HOST: '127.0.0.1',
        PORT: String(port),
        SITE_BROWSER_DIR: browserDir,
        CAMPAIGN_DATA_DIR: campaignDataDir,
        ADMIN_USERNAME,
        ADMIN_PASSWORD,
        ADMIN_COOKIE_SECURE: 'false',
        ADMIN_SESSION_HOURS: '1',
        FAUNAPOOLEN_LOAD_ENV_FILE: 'false',
        NODE_ENV: 'production',
        OPENAI_API_KEY: '',
        OPENAI_BASE_URL: 'http://127.0.0.1:1',
        NO_COLOR: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const handle = { child, output: '' };
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    handle.output += chunk;
  });
  child.stderr.on('data', (chunk) => {
    handle.output += chunk;
  });
  return handle;
}

async function waitForOutput(handle, pattern, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (pattern.test(handle.output)) return;
    if (handle.child.exitCode !== null || handle.child.signalCode !== null) {
      throw new Error(`Faunapoolen server exited during startup:\n${handle.output}`);
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 20));
  }
  throw new Error(`Timed out waiting for Faunapoolen server output ${pattern}:\n${handle.output}`);
}

async function waitForHealth(handle, port) {
  await waitForOutput(handle, /\[faunapoolen\.se\] serving /);
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      const response = await localFetch(port, '/healthz');
      if (response.status === 200) return response;
    } catch {
      // The process has logged its listener before the socket is necessarily observable here.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 20));
  }
  throw new Error(`Faunapoolen health check did not become ready:\n${handle.output}`);
}

function waitForExit(handle, timeoutMs = 5_000) {
  return new Promise((resolveExit, rejectExit) => {
    let timer;
    const onExit = (code, signal) => {
      clearTimeout(timer);
      resolveExit({ code, signal });
    };
    handle.child.once('exit', onExit);
    if (handle.child.exitCode !== null || handle.child.signalCode !== null) {
      handle.child.off('exit', onExit);
      resolveExit({ code: handle.child.exitCode, signal: handle.child.signalCode });
      return;
    }
    timer = setTimeout(() => {
      handle.child.off('exit', onExit);
      rejectExit(new Error(`Faunapoolen server did not exit:\n${handle.output}`));
    }, timeoutMs);
  });
}

async function stopServer(handle) {
  if (handle.child.exitCode === null && handle.child.signalCode === null) {
    handle.child.kill('SIGTERM');
  }
  return waitForExit(handle);
}

async function login(port) {
  const response = await localFetch(port, '/admin-auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  const setCookie = response.headers.get('set-cookie');
  assert.match(
    setCookie,
    /^fp_admin_session=[^;]+; Path=\/; HttpOnly; SameSite=Strict; Max-Age=3600$/,
  );
  return setCookie.split(';', 1)[0];
}

function withCookie(cookie, init = {}) {
  return { ...init, headers: { ...init.headers, cookie } };
}

test('public, admin, storage, startup, shutdown, and restart contracts stay stable', async (t) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'faunapoolen-server-contract-'));
  const browserDir = join(temporaryRoot, 'browser');
  const campaignDataDir = join(temporaryRoot, 'campaigns');
  await createBrowserFixture(browserDir);
  await mkdir(campaignDataDir, { recursive: true });
  await writeFile(
    join(campaignDataDir, `${CAMPAIGN_ID}.json`),
    JSON.stringify({
      id: CAMPAIGN_ID,
      createdAt: '2026-08-23T00:00:00.000Z',
      updatedAt: '2026-08-23T00:00:00.000Z',
      idea: 'A synthetic campaign fixture',
      name: 'Synthetic campaign',
      stage: 'strategy',
      strategy: {},
      copy: {},
      imagePrompts: [],
    }),
    'utf8',
  );

  let server = startServer({ port: CONTRACT_PORT, browserDir, campaignDataDir });
  t.after(async () => {
    if (server.child.exitCode === null && server.child.signalCode === null)
      await stopServer(server);
    await rm(temporaryRoot, { recursive: true, force: true });
  });

  const health = await waitForHealth(server, CONTRACT_PORT);
  assert.deepEqual(await health.json(), {
    app: 'faunapoolen.se',
    ok: true,
    port: CONTRACT_PORT,
  });
  assert.equal(health.headers.get('x-powered-by'), null);
  assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(health.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.equal(health.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(
    health.headers.get('permissions-policy'),
    'camera=(), microphone=(), geolocation=()',
  );

  for (const [path, marker] of [
    ['/', 'fp-root'],
    ['/about/', 'fp-about'],
    ['/en/about/', 'fp-about-en'],
    ['/blog/posts/difference-between-normal-pool-and-natural-pool.html', 'fp-protected-one'],
    ['/blog/posts/build-your-own-nature-pool.html', 'fp-protected-two'],
  ]) {
    const response = await localFetch(CONTRACT_PORT, path);
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), new RegExp(marker), path);
  }

  const adminPage = await localFetch(CONTRACT_PORT, '/admin');
  assert.equal(adminPage.status, 200);
  assert.equal(adminPage.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.match(await adminPage.text(), /fp-admin-login/);

  const api404 = await localFetch(CONTRACT_PORT, '/api/not-a-route');
  assert.equal(api404.status, 404);
  assert.deepEqual(await api404.json(), { error: 'API route not found' });

  const static404 = await localFetch(CONTRACT_PORT, '/not-a-route');
  assert.equal(static404.status, 404);
  assert.equal(static404.headers.get('cache-control'), 'no-cache');
  assert.match(await static404.text(), /fp-404/);

  const missingAsset = await localFetch(CONTRACT_PORT, '/assets/missing.js');
  assert.equal(missingAsset.status, 404);
  assert.equal(missingAsset.headers.get('cache-control'), 'no-store');
  assert.equal(await missingAsset.text(), 'Asset not found');

  const malformed = await localFetch(CONTRACT_PORT, '/admin-auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"username":',
  });
  assert.equal(malformed.status, 400);
  assert.match(malformed.headers.get('content-type'), /^text\/html/);
  assert.equal(malformed.headers.get('x-robots-tag'), 'noindex, nofollow');

  const oversized = await localFetch(CONTRACT_PORT, '/admin-auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'x'.repeat(3_000), password: ADMIN_PASSWORD }),
  });
  assert.equal(oversized.status, 413);
  assert.match(oversized.headers.get('content-type'), /^text\/html/);

  const signedOut = await localFetch(CONTRACT_PORT, '/admin-auth/session', { method: 'POST' });
  assert.equal(signedOut.status, 200);
  assert.deepEqual(await signedOut.json(), { authenticated: false });

  const protectedList = await localFetch(CONTRACT_PORT, '/admin-auth/campaigns/list', {
    method: 'POST',
  });
  assert.equal(protectedList.status, 401);
  assert.deepEqual(await protectedList.json(), { error: 'Your admin session has expired.' });

  const cookie = await login(CONTRACT_PORT);
  const signedIn = await localFetch(
    CONTRACT_PORT,
    '/admin-auth/session',
    withCookie(cookie, { method: 'POST' }),
  );
  assert.deepEqual(await signedIn.json(), { authenticated: true });

  const list = await localFetch(
    CONTRACT_PORT,
    '/admin-auth/campaigns/list',
    withCookie(cookie, { method: 'POST' }),
  );
  assert.equal(list.status, 200);
  assert.deepEqual(await list.json(), {
    campaigns: [
      {
        id: CAMPAIGN_ID,
        name: 'Synthetic campaign',
        createdAt: '2026-08-23T00:00:00.000Z',
        idea: 'A synthetic campaign fixture',
        stage: 'strategy',
      },
    ],
  });

  const open = await localFetch(
    CONTRACT_PORT,
    '/admin-auth/campaigns/open',
    withCookie(cookie, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: CAMPAIGN_ID }),
    }),
  );
  assert.equal(open.status, 200);
  assert.equal((await open.json()).campaign.name, 'Synthetic campaign');

  const generationWithoutProvider = await localFetch(
    CONTRACT_PORT,
    '/admin-auth/campaigns/create',
    withCookie(cookie, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idea: 'A long enough synthetic idea' }),
    }),
  );
  assert.equal(generationWithoutProvider.status, 503);
  assert.deepEqual(await generationWithoutProvider.json(), {
    error: 'Connect OpenAI by adding OPENAI_API_KEY to .env, then restart the server.',
  });

  const competingServer = startServer({ port: CONTRACT_PORT, browserDir, campaignDataDir });
  const competingExit = await waitForExit(competingServer);
  assert.equal(competingExit.signal, null);
  assert.notEqual(competingExit.code, 0);
  assert.match(
    competingServer.output,
    /failed to listen .*EADDRINUSE|EADDRINUSE.*address already in use/s,
  );

  const firstExit = await stopServer(server);
  assert.deepEqual(firstExit, { code: null, signal: 'SIGTERM' });

  server = startServer({ port: CONTRACT_PORT, browserDir, campaignDataDir });
  await waitForHealth(server, CONTRACT_PORT);

  const oldSession = await localFetch(
    CONTRACT_PORT,
    '/admin-auth/session',
    withCookie(cookie, { method: 'POST' }),
  );
  assert.deepEqual(await oldSession.json(), { authenticated: false });

  const restartedCookie = await login(CONTRACT_PORT);
  const restartedList = await localFetch(
    CONTRACT_PORT,
    '/admin-auth/campaigns/list',
    withCookie(restartedCookie, { method: 'POST' }),
  );
  assert.equal(restartedList.status, 200);
  assert.equal((await restartedList.json()).campaigns[0].id, CAMPAIGN_ID);

  const restartExit = await stopServer(server);
  assert.deepEqual(restartExit, { code: null, signal: 'SIGTERM' });
});

test('campaign storage failure returns the current server error without taking health down', async (t) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'faunapoolen-storage-contract-'));
  const browserDir = join(temporaryRoot, 'browser');
  const campaignDataFile = join(temporaryRoot, 'campaign-data-is-a-file');
  await createBrowserFixture(browserDir);
  await writeFile(campaignDataFile, 'not a directory', 'utf8');

  const server = startServer({
    port: STORAGE_FAILURE_PORT,
    browserDir,
    campaignDataDir: campaignDataFile,
  });
  t.after(async () => {
    if (server.child.exitCode === null && server.child.signalCode === null)
      await stopServer(server);
    await rm(temporaryRoot, { recursive: true, force: true });
  });
  await waitForHealth(server, STORAGE_FAILURE_PORT);
  const cookie = await login(STORAGE_FAILURE_PORT);

  const list = await localFetch(
    STORAGE_FAILURE_PORT,
    '/admin-auth/campaigns/list',
    withCookie(cookie, { method: 'POST' }),
  );
  assert.equal(list.status, 500);
  assert.match(list.headers.get('content-type'), /^text\/html/);

  const health = await localFetch(STORAGE_FAILURE_PORT, '/healthz');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {
    app: 'faunapoolen.se',
    ok: true,
    port: STORAGE_FAILURE_PORT,
  });

  const exit = await stopServer(server);
  assert.deepEqual(exit, { code: null, signal: 'SIGTERM' });
});
