import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { pathToFileURL } from 'node:url';

import type { ServerReleaseIdentity } from '@mikaelcedergren/cx-framework/server/server-identity';
import type {
  ServerWorkerReadiness,
  ServerWorkerReadinessLease,
} from '@mikaelcedergren/cx-framework/server/worker-readiness';

import { FAUNAPOOLEN_ARTIFACT_ROOT } from './environment.js';
import { startFaunapoolenServer } from './runtime.js';
import {
  acquireFaunapoolenWorkerReadinessLease,
  closeWorkerRuntime,
  startFaunapoolenWorker,
} from './worker-runtime.js';

const TEST_API_KEY = 'synthetic-provider-key-never-sent';
const TEST_SESSION_SECRET = 'runtime-test-session-secret-'.repeat(3);

test('compiled web composition listens locally, reports SQLite readiness, and closes every owner', async (t) => {
  const operationalRoot = temporaryOperationalRoot(t, 'faunapoolen-web-runtime-');
  const browserDirectory = path.join(operationalRoot, 'browser');
  fs.mkdirSync(browserDirectory);
  fs.writeFileSync(path.join(browserDirectory, 'index.html'), '<p>runtime-browser</p>');
  fs.writeFileSync(path.join(browserDirectory, 'main-abcdef12.js'), '');
  fs.writeFileSync(path.join(browserDirectory, 'cx-build.json'), '{}');
  const port = await availablePort();
  const listenersBefore = shutdownListenerCounts();
  const runtime = await withinWorkingDirectory(operationalRoot, () =>
    startFaunapoolenServer({
      entrypointUrl: import.meta.url,
      environment: runtimeEnvironment(port, browserDirectory),
    }),
  );
  t.after(async () => {
    if (!runtime.shutdown.closing) await runtime.shutdown.close('test_cleanup');
  });

  assert.equal(runtime.server.address() === null, false);
  assert.equal(runtime.persistence.isReady(), true);
  assert.deepEqual(shutdownListenerCounts(), {
    sigint: listenersBefore.sigint + 1,
    sigterm: listenersBefore.sigterm + 1,
  });

  const health = await fetch(`http://127.0.0.1:${String(port)}/healthz`);
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await health.json(), {
    app: 'faunapoolen',
    ok: true,
    port,
  });
  const page = await fetch(`http://127.0.0.1:${String(port)}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /runtime-browser/);

  const baseUrl = `http://127.0.0.1:${String(port)}`;
  const login = await fetch(`${baseUrl}/api/admin/login`, {
    body: JSON.stringify({
      password: 'correct-horse-battery-staple',
      username: 'owner',
    }),
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    method: 'POST',
  });
  assert.equal(login.status, 200);
  const sessionCookieHeader = login.headers.get('set-cookie');
  assert.ok(sessionCookieHeader);
  const sessionCookie = sessionCookieHeader.split(';', 1)[0];
  assert.ok(sessionCookie);
  const accepted = await fetch(`${baseUrl}/api/admin/campaigns`, {
    body: JSON.stringify({ idea: 'A durable campaign idea admitted without a web-process key.' }),
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie,
      Origin: baseUrl,
    },
    method: 'POST',
  });
  assert.equal(accepted.status, 202);

  await runtime.shutdown.close('test');
  assert.equal(runtime.persistence.isReady(), false);
  assert.deepEqual(shutdownListenerCounts(), listenersBefore);
  await assert.rejects(
    fetch(`http://127.0.0.1:${String(port)}/healthz`, {
      signal: AbortSignal.timeout(1_000),
    }),
  );
});

test('campaign worker owns no listener, starts without an external call, and drains durably', async (t) => {
  const operationalRoot = temporaryOperationalRoot(t, 'faunapoolen-worker-runtime-');
  const port = await availablePort();
  const listenersBefore = shutdownListenerCounts();
  const signals = new EventEmitter();
  const runtime = await withinWorkingDirectory(operationalRoot, () =>
    startFaunapoolenWorker({
      entrypointUrl: import.meta.url,
      environment: {
        ...runtimeEnvironment(port),
        OPENAI_API_KEY: TEST_API_KEY,
        OPENAI_BASE_URL: `http://127.0.0.1:${String(port)}/v1`,
      },
      signals,
    }),
  );
  assert.equal(runtime.kind, 'worker');
  if (runtime.kind !== 'worker') throw new Error('Expected an ordinary worker runtime.');
  t.after(async () => {
    if (!runtime.shutdown.closing) await runtime.shutdown.close('test_cleanup');
  });

  assert.equal(runtime.claimsEnabled, true);
  assert.equal(runtime.worker.running, true);
  assert.equal(runtime.persistence.isReady(), true);
  assert.deepEqual(shutdownListenerCounts(), listenersBefore);
  assert.equal(signals.listenerCount('SIGINT'), 1);
  assert.equal(signals.listenerCount('SIGTERM'), 1);
  await assert.rejects(
    fetch(`http://127.0.0.1:${String(port)}/healthz`, {
      signal: AbortSignal.timeout(1_000),
    }),
  );

  await runtime.shutdown.close('test');
  assert.equal(runtime.worker.running, false);
  assert.equal(runtime.persistence.isReady(), false);
  assert.deepEqual(shutdownListenerCounts(), listenersBefore);
  assert.equal(signals.listenerCount('SIGINT'), 0);
  assert.equal(signals.listenerCount('SIGTERM'), 0);
});

test('claim-disabled worker initializes and remains readiness-capable without a provider', async (t) => {
  const operationalRoot = temporaryOperationalRoot(t, 'faunapoolen-worker-disabled-');
  const port = await availablePort();
  const signals = new EventEmitter();
  const runtime = await withinWorkingDirectory(operationalRoot, () =>
    startFaunapoolenWorker({
      entrypointUrl: import.meta.url,
      environment: {
        ...runtimeEnvironment(port),
        CAMPAIGN_GENERATION_ENABLED: '0',
      },
      signals,
    }),
  );
  assert.equal(runtime.kind, 'worker');
  if (runtime.kind !== 'worker') throw new Error('Expected an ordinary worker runtime.');
  t.after(async () => {
    if (!runtime.shutdown.closing) await runtime.shutdown.close('test_cleanup');
  });

  assert.equal(runtime.claimsEnabled, false);
  assert.equal(runtime.worker.accepting, false);
  assert.equal(runtime.worker.running, true);
  assert.equal(runtime.readinessLease, undefined);
  assert.equal(signals.listenerCount('SIGINT'), 1);
  assert.equal(signals.listenerCount('SIGTERM'), 1);

  await runtime.shutdown.close('test');
  assert.equal(runtime.worker.running, false);
  assert.equal(runtime.persistence.isReady(), false);
  assert.equal(signals.listenerCount('SIGINT'), 0);
  assert.equal(signals.listenerCount('SIGTERM'), 0);
});

test('ordinary worker acquires readiness before effects and closes it before every owner', async () => {
  const events: string[] = [];
  const lease = readinessLease(events);
  const acquired = acquireFaunapoolenWorkerReadinessLease({
    acquireReadinessLease() {
      events.push('lease:acquire');
      return lease;
    },
    environment: { NODE_ENV: 'production' },
    identity: undefined,
    production: true,
  });
  assert.equal(acquired, lease);
  events.push('worker:start');

  await closeWorkerRuntime({
    closePersistence: () => events.push('persistence:close'),
    closeReadinessLease: () => lease.close(),
    disposeSignals: () => events.push('signals:dispose'),
    reason: 'test',
    worker: {
      abortActive: () => events.push('worker:abort'),
      drain: async () => events.push('worker:drain'),
      stopClaiming: () => events.push('worker:stop'),
    } as never,
  });
  assert.deepEqual(events, [
    'lease:acquire',
    'worker:start',
    'lease:close',
    'worker:stop',
    'worker:abort',
    'worker:drain',
    'signals:dispose',
    'persistence:close',
  ]);
});

test('readiness acquisition failure occurs before worker effects and nonproduction never attempts it', () => {
  const events: string[] = [];
  assert.throws(
    () =>
      acquireFaunapoolenWorkerReadinessLease({
        acquireReadinessLease() {
          events.push('lease:acquire');
          throw new Error('synthetic lease failure');
        },
        environment: { NODE_ENV: 'production' },
        identity: undefined,
        production: true,
      }),
    /synthetic lease failure/,
  );
  assert.deepEqual(events, ['lease:acquire']);

  const development = acquireFaunapoolenWorkerReadinessLease({
    acquireReadinessLease() {
      throw new Error('development must not acquire a readiness lease');
    },
    environment: { NODE_ENV: 'development' },
    identity: undefined,
    production: false,
  });
  assert.equal(development, undefined);
  assert.deepEqual(events, ['lease:acquire']);
});

test('release-validation worker holds readiness until SIGTERM then exits through clean shutdown', async (t) => {
  const operationalRoot = temporaryOperationalRoot(t, 'faunapoolen-worker-validation-');
  const entrypoint = 'server/index.mjs';
  const identity = releaseValidationIdentity(entrypoint);
  const identityFile = path.join(operationalRoot, 'server-release.json');
  fs.writeFileSync(identityFile, `${JSON.stringify(identity)}\n`, { mode: 0o600 });
  const signals = new EventEmitter();
  const readiness: ServerWorkerReadiness[] = [];
  let releasedReferences = 0;
  const runtime = await withinWorkingDirectory(operationalRoot, () =>
    startFaunapoolenWorker({
      acquireReadinessLease() {
        throw new Error('release validation must remain IPC-only');
      },
      entrypointUrl: pathToFileURL(path.join(FAUNAPOOLEN_ARTIFACT_ROOT, entrypoint)),
      environment: releaseValidationEnvironment(operationalRoot, identityFile),
      releaseValidationReference() {
        releasedReferences += 1;
      },
      async signalReadiness(message) {
        readiness.push(message);
        return true;
      },
      signals,
    }),
  );
  assert.equal(runtime.kind, 'release-validation');
  if (runtime.kind !== 'release-validation') {
    throw new Error('Expected a release-validation worker runtime.');
  }
  t.after(async () => {
    if (!runtime.shutdown.closing) await runtime.shutdown.close('test_cleanup');
  });

  assert.equal(runtime.persistence.isReady(), true);
  assert.equal(signals.listenerCount('SIGINT'), 1);
  assert.equal(signals.listenerCount('SIGTERM'), 1);
  assert.deepEqual(readiness, [
    {
      entrypoint,
      productId: 'faunapoolen',
      releaseId: identity.releaseId,
      schemaVersion: 1,
      serverBuildId: identity.serverBuildId,
      type: 'cx-server-worker-ready',
      workerKey: 'jobs',
    },
  ]);

  assert.equal(signals.emit('SIGTERM'), true);
  assert.equal(runtime.shutdown.closing, true);
  await runtime.shutdown.close('test_wait');
  assert.equal(runtime.persistence.isReady(), false);
  assert.equal(signals.listenerCount('SIGINT'), 0);
  assert.equal(signals.listenerCount('SIGTERM'), 0);
  assert.equal(releasedReferences, 1);
});

function readinessLease(events: string[]): ServerWorkerReadinessLease {
  let closed = false;
  return {
    get closed() {
      return closed;
    },
    close() {
      if (closed) return;
      closed = true;
      events.push('lease:close');
    },
    entrypoint: 'server/dist/worker.js',
    identityFile: '/synthetic/server-release.json',
    releaseId: 'synthetic-release',
    serverBuildId: `server-${'a'.repeat(64)}`,
    workerKey: 'jobs',
  };
}

test('campaign worker alone fail-closes when its provider secret is absent', async (t) => {
  const operationalRoot = temporaryOperationalRoot(t, 'faunapoolen-worker-secret-');
  const port = await availablePort();
  await assert.rejects(
    withinWorkingDirectory(operationalRoot, () =>
      startFaunapoolenWorker({
        entrypointUrl: import.meta.url,
        environment: runtimeEnvironment(port),
      }),
    ),
    /requires OPENAI_API_KEY when claims are enabled/,
  );
});

function runtimeEnvironment(port: number, browserDirectory?: string): NodeJS.ProcessEnv {
  return {
    ADMIN_PASSWORD: 'correct-horse-battery-staple',
    ADMIN_USERNAME: 'owner',
    APP_BASE_URL: `http://127.0.0.1:${String(port)}`,
    CAMPAIGN_GENERATION_ENABLED: '1',
    DATA_DIR: 'data',
    DB_PATH: 'data/faunapoolen.db',
    HOST: '127.0.0.1',
    NODE_ENV: 'test',
    PORT: String(port),
    SESSION_SECRET: TEST_SESSION_SECRET,
    ...(browserDirectory === undefined ? {} : { SITE_BROWSER_DIR: browserDirectory }),
  };
}

function releaseValidationEnvironment(
  operationalRoot: string,
  identityFile: string,
): NodeJS.ProcessEnv {
  return {
    ADMIN_PASSWORD: 'release-validation-password',
    ADMIN_USERNAME: 'release-owner',
    APP_BASE_URL: 'http://127.0.0.1',
    CAMPAIGN_GENERATION_ENABLED: '0',
    CX_RELEASE_VALIDATION: '1',
    CX_RUNTIME_ROOT: operationalRoot,
    CX_SERVER_RELEASE_IDENTITY_FILE: identityFile,
    DATA_DIR: 'data',
    DB_PATH: 'data/faunapoolen.db',
    HOST: '127.0.0.1',
    NODE_ENV: 'production',
    PORT: '4359',
    SESSION_SECRET: 'release-validation-session-secret-'.repeat(2),
  };
}

function releaseValidationIdentity(workerEntrypoint: string): ServerReleaseIdentity {
  const artifactDigest = 'a'.repeat(64);
  return Object.freeze({
    artifactBytes: 1_024,
    artifactDigest,
    artifactFiles: 10,
    createdAt: '2026-08-25T12:00:00.000Z',
    entrypoint: 'scripts/dev.mjs',
    nodeMajor: 26,
    releaseId: 'faunapoolen-runtime-test',
    revision: 'b'.repeat(40),
    schemaVersion: 1,
    serverBuildId: `server-${artifactDigest}`,
    sourceDirty: true,
    sourceFingerprint: 'c'.repeat(64),
    workers: [{ entrypoint: workerEntrypoint, key: 'jobs' }],
  });
}

function temporaryOperationalRoot(t: TestContext, prefix: string): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));
  return root;
}

async function withinWorkingDirectory<T>(root: string, operation: () => Promise<T>): Promise<T> {
  const previous = process.cwd();
  process.chdir(root);
  try {
    return await operation();
  } finally {
    process.chdir(previous);
  }
}

function shutdownListenerCounts(): { readonly sigint: number; readonly sigterm: number } {
  return {
    sigint: process.listenerCount('SIGINT'),
    sigterm: process.listenerCount('SIGTERM'),
  };
}

async function availablePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Could not reserve a loopback test port.');
  }
  const port = address.port;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}
