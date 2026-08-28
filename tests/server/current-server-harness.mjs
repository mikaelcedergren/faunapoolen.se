import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { openAiSuccess } from '../fixtures/current-campaigns.mjs';
import {
  CURRENT_LITERAL_HTML_ROUTES,
  CURRENT_SECTION_ROUTES,
} from '../fixtures/current-public-routes.mjs';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CURRENT_ADMIN_USERNAME = 'current-admin';
export const CURRENT_ADMIN_PASSWORD = 'current-password-with-no-live-access';
const forbiddenPorts = new Set([3040, 4341, 4342, 4343]);

const nativeFetch = globalThis.fetch.bind(globalThis);

export function localFetch(input, init) {
  const url = new URL(String(input));
  assert.ok(['127.0.0.1', '::1', 'localhost'].includes(url.hostname));
  assert.equal(forbiddenPorts.has(Number(url.port)), false);
  return nativeFetch(input, init);
}

export async function createCurrentFixture(t, { browserFiles = {} } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'faunapoolen-current-'));
  const browserDir = path.join(root, 'browser');
  const campaignDir = path.join(root, 'campaigns');
  await mkdir(browserDir, { recursive: true });
  await mkdir(campaignDir, { recursive: true });
  const routeFiles = {};
  for (const localePrefix of ['', 'en']) {
    for (const route of CURRENT_SECTION_ROUTES) {
      const relative = [localePrefix, route, 'index.html'].filter(Boolean).join('/');
      routeFiles[relative || 'index.html'] =
        `<!doctype html><title>Current route</title><p>current-route:${localePrefix || 'sv'}:${route || 'root'}</p>`;
    }
    for (const route of CURRENT_LITERAL_HTML_ROUTES) {
      const relative = [localePrefix, route].filter(Boolean).join('/');
      routeFiles[relative] =
        `<!doctype html><title>Current literal route</title><p>current-route:${localePrefix || 'sv'}:${route}</p>`;
    }
  }
  const defaults = {
    ...routeFiles,
    'index.html': '<!doctype html><title>Root</title><p>current-root</p>',
    '404.html': '<!doctype html><title>Missing</title><p>current-404</p>',
    'about/index.html': '<!doctype html><title>About</title><p>current-about</p>',
    'en/about/index.html': '<!doctype html><title>About EN</title><p>current-about-en</p>',
    'koi-pond-series.html': '<!doctype html><title>Koi</title><p>current-literal-html</p>',
    'en/koi-pond-series.html': '<!doctype html><title>Koi EN</title><p>current-literal-html-en</p>',
    'admin/index.html':
      '<!doctype html><meta name="robots" content="noindex, nofollow"><p>current-admin</p>',
    'en/admin/index.html':
      '<!doctype html><meta name="robots" content="noindex, nofollow"><p>current-admin-en</p>',
    'campaigns/pond-packages/index.html':
      '<!doctype html><meta name="robots" content="noindex, follow"><p>current-public-campaign</p>',
    'blog/posts/difference-between-normal-pool-and-natural-pool.html':
      '<!doctype html><title>Protected one</title><p>current-protected-one</p>',
    'blog/posts/build-your-own-nature-pool.html':
      '<!doctype html><title>Protected two</title><p>current-protected-two</p>',
    'en/blog/posts/difference-between-normal-pool-and-natural-pool.html':
      '<!doctype html><title>Protected one EN</title><p>current-protected-one-en</p>',
    'en/blog/posts/build-your-own-nature-pool.html':
      '<!doctype html><title>Protected two EN</title><p>current-protected-two-en</p>',
    'main-ABCDEF12.js': 'globalThis.faunapoolenCurrent = true;\n',
    'styles.css': 'body { color: black; }\n',
    'cx-build.json': '{"buildId":"current-characterization"}\n',
    ...browserFiles,
  };
  for (const [relative, contents] of Object.entries(defaults)) {
    const target = path.join(browserDir, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents, { flag: 'wx', mode: 0o600 });
  }

  const servers = [];
  const fakeProviders = [];
  const fixture = { browserDir, campaignDir, fakeProviders, root, servers };
  t.after(async () => {
    for (const server of [...servers].reverse()) {
      if (server.child.exitCode === null && server.child.signalCode === null) {
        await stopCurrentServer(server).catch(() => server.child.kill('SIGKILL'));
      }
    }
    for (const provider of [...fakeProviders].reverse()) await provider.close();
    await rm(root, { recursive: true, force: true });
  });
  return fixture;
}

export async function writeCampaignFile(fixture, filenameId, campaign) {
  const file = path.join(fixture.campaignDir, `${filenameId}.json`);
  await writeFile(file, `${JSON.stringify(campaign, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  return file;
}

export async function readCampaignFile(fixture, id) {
  return JSON.parse(await readFile(path.join(fixture.campaignDir, `${id}.json`), 'utf8'));
}

export async function startFakeOpenAi(fixture) {
  const actions = [];
  const requests = [];
  const sockets = new Set();
  const server = createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/v1/responses') {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: { message: 'Unknown fake route.' } }));
      return;
    }
    let body = '';
    for await (const chunk of request) body += String(chunk);
    requests.push(JSON.parse(body));
    const action = actions.shift();
    if (!action) {
      response.writeHead(500, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: { message: 'No queued fake response.' } }));
      return;
    }
    if (action.kind === 'success') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(openAiSuccess(action.output)));
      return;
    }
    if (action.kind === 'raw') {
      const payload = openAiSuccess({});
      payload.output[0].content[0].text = action.outputText;
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(payload));
      return;
    }
    if (action.kind === 'error') {
      response.writeHead(action.status, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          error: {
            message: action.message ?? 'Synthetic provider error.',
            type: action.type ?? 'invalid_request_error',
            code: action.code ?? null,
            param: null,
          },
        }),
      );
      return;
    }
    if (action.kind === 'hold') {
      action.started();
      await action.releasePromise;
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(openAiSuccess(action.output)));
    }
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  const port = await listenOnReservedPort(server);
  const provider = {
    baseUrl: `http://127.0.0.1:${String(port)}/v1`,
    port,
    requests,
    queueSuccess(output) {
      actions.push({ kind: 'success', output });
    },
    queueRawOutput(outputText) {
      actions.push({ kind: 'raw', outputText });
    },
    queueError(status, code, message) {
      actions.push({ kind: 'error', status, code, message });
    },
    queueHold(output) {
      let startedResolve;
      let releaseResolve;
      const started = new Promise((resolve) => (startedResolve = resolve));
      const releasePromise = new Promise((resolve) => (releaseResolve = resolve));
      actions.push({
        kind: 'hold',
        output,
        started: startedResolve,
        releasePromise,
      });
      return { started, release: releaseResolve };
    },
    async close() {
      for (const socket of sockets) socket.destroy();
      if (!server.listening) return;
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
  fixture.fakeProviders.push(provider);
  return provider;
}

export async function startCurrentServer(
  fixture,
  {
    adminUsername = CURRENT_ADMIN_USERNAME,
    adminPassword = CURRENT_ADMIN_PASSWORD,
    cookieSecure = false,
    sessionHours = '1',
    omitAdminCredentials = false,
    omitOpenAiKey = false,
    openAiApiKey = 'synthetic-current-key',
    openAiBaseUrl,
    campaignDir = fixture.campaignDir,
    browserDir = fixture.browserDir,
    additionalImports = [],
  } = {},
) {
  const port = await reserveLoopbackPort();
  const environment = {
    ADMIN_COOKIE_SECURE: cookieSecure ? 'true' : 'false',
    ADMIN_SESSION_HOURS: sessionHours,
    CAMPAIGN_DATA_DIR: campaignDir,
    FAUNAPOOLEN_LOAD_ENV_FILE: 'false',
    HOST: '127.0.0.1',
    LANG: 'C',
    NODE_ENV: 'test',
    OPENAI_BASE_URL: openAiBaseUrl ?? 'http://127.0.0.1:1/v1',
    PATH: process.env.PATH ?? '/usr/bin:/bin',
    PORT: String(port),
    SITE_BROWSER_DIR: browserDir,
    TMPDIR: fixture.root,
  };
  if (!omitAdminCredentials && adminUsername !== undefined) {
    environment.ADMIN_USERNAME = adminUsername;
  }
  if (!omitAdminCredentials && adminPassword !== undefined) {
    environment.ADMIN_PASSWORD = adminPassword;
  }
  if (!omitOpenAiKey && openAiApiKey !== undefined) {
    environment.OPENAI_API_KEY = openAiApiKey;
  }

  let output = '';
  const child = spawn(
    process.execPath,
    [
      ...additionalImports.flatMap((modulePath) => ['--import', modulePath]),
      '--import',
      path.join(repoRoot, 'tests/server/current-block-external-fetch.mjs'),
      'server/index.mjs',
    ],
    { cwd: repoRoot, env: environment, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => (output = bounded(output, chunk)));
  child.stderr.on('data', (chunk) => (output = bounded(output, chunk)));
  const handle = {
    baseUrl: `http://127.0.0.1:${String(port)}`,
    child,
    output: () => output,
    port,
  };
  fixture.servers.push(handle);
  await waitForHealth(handle);
  return handle;
}

export async function stopCurrentServer(server) {
  if (server.child.exitCode === null && server.child.signalCode === null) {
    server.child.kill('SIGTERM');
  }
  const exit = await waitForExit(server);
  assert.deepEqual(exit, { code: null, signal: 'SIGTERM' });
  assert.equal(await portIsClosed(server.port), true);
  return exit;
}

export async function login(
  server,
  { username = CURRENT_ADMIN_USERNAME, password = CURRENT_ADMIN_PASSWORD, headers = {} } = {},
) {
  return localFetch(`${server.baseUrl}/admin-auth/login`, {
    body: JSON.stringify({ username, password }),
    headers: { 'content-type': 'application/json', ...headers },
    method: 'POST',
  });
}

export function cookiePair(response) {
  const setCookie = response.headers.get('set-cookie');
  assert.ok(setCookie);
  return setCookie.split(';', 1)[0];
}

export async function authenticatedCookie(server) {
  const response = await login(server);
  assert.equal(response.status, 200, await response.text());
  return cookiePair(response);
}

export function post(server, pathname, { cookie, body, headers = {} } = {}) {
  const requestHeaders = { ...headers };
  if (cookie) requestHeaders.cookie = cookie;
  if (body !== undefined && requestHeaders['content-type'] === undefined) {
    requestHeaders['content-type'] = 'application/json';
  }
  return localFetch(`${server.baseUrl}${pathname}`, {
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: requestHeaders,
    method: 'POST',
  });
}

async function waitForHealth(server) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (server.child.exitCode !== null || server.child.signalCode !== null) {
      throw new Error(`Faunapoolen exited before health:\n${server.output()}`);
    }
    try {
      const response = await localFetch(`${server.baseUrl}/healthz`);
      if (response.status === 200) return;
    } catch {
      // Listener not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Faunapoolen did not become healthy:\n${server.output()}`);
}

function waitForExit(server, timeoutMs = 8_000) {
  if (server.child.exitCode !== null || server.child.signalCode !== null) {
    return Promise.resolve({ code: server.child.exitCode, signal: server.child.signalCode });
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Server did not exit:\n${server.output()}`)),
      timeoutMs,
    );
    server.child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal });
    });
  });
}

async function reserveLoopbackPort() {
  const server = net.createServer();
  const port = await listenOnReservedPort(server);
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

function listenOnReservedPort(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      assert.ok(address && typeof address === 'object');
      if (forbiddenPorts.has(address.port)) {
        server.close(() => resolve(listenOnReservedPort(server)));
      } else {
        resolve(address.port);
      }
    });
  });
}

function portIsClosed(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const finish = (closed) => {
      socket.destroy();
      resolve(closed);
    };
    socket.once('connect', () => finish(false));
    socket.once('error', () => finish(true));
    socket.setTimeout(500, () => finish(true));
  });
}

function bounded(existing, chunk) {
  const combined = `${existing}${String(chunk)}`;
  return combined.length > 1024 * 1024 ? combined.slice(-1024 * 1024) : combined;
}
