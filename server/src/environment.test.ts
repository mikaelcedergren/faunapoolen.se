import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { FAUNAPOOLEN_PUBLIC_ORIGIN, FAUNAPOOLEN_WWW_ORIGIN } from './constants.js';
import { loadFaunapoolenEnvironment } from './environment.js';

const PRODUCTION_ENVIRONMENT = Object.freeze({
  ADMIN_PASSWORD: 'correct-horse-battery-staple',
  ADMIN_USERNAME: 'owner',
  APP_BASE_URL: FAUNAPOOLEN_PUBLIC_ORIGIN,
  CAMPAIGN_GENERATION_ENABLED: '1',
  HOST: '127.0.0.1',
  NODE_ENV: 'production',
  OPENAI_API_KEY: 'synthetic-production-shape-only',
  PORT: '3040',
  SESSION_SECRET: 's'.repeat(48),
});

test('production web configuration accepts only the official origins and web-role secrets', () => {
  const environment = loadFaunapoolenEnvironment(PRODUCTION_ENVIRONMENT);
  assert.equal(environment.appOrigin, FAUNAPOOLEN_PUBLIC_ORIGIN);
  assert.deepEqual(environment.mutationOrigins, [
    FAUNAPOOLEN_PUBLIC_ORIGIN,
    FAUNAPOOLEN_WWW_ORIGIN,
  ]);
  assert.equal(environment.cookieSecure, true);
  assert.equal(environment.generationEnabled, true);
  assert.equal(environment.host, '127.0.0.1');
  assert.equal(environment.port, 3040);
  assert.equal(environment.sessionTtlSeconds, 28_800);

  const webWithoutProviderSecret = loadFaunapoolenEnvironment({
    ...PRODUCTION_ENVIRONMENT,
    OPENAI_API_KEY: undefined,
  });
  assert.equal(webWithoutProviderSecret.generationEnabled, true);

  for (const [name, value] of [
    ['APP_BASE_URL', FAUNAPOOLEN_WWW_ORIGIN],
    ['APP_BASE_URL', 'http://faunapoolen.se'],
    ['ADMIN_USERNAME', ''],
    ['ADMIN_PASSWORD', 'too-short'],
    ['SESSION_SECRET', 'too-short'],
  ] as const) {
    assert.throws(
      () => loadFaunapoolenEnvironment({ ...PRODUCTION_ENVIRONMENT, [name]: value }),
      Error,
      name,
    );
  }
});

test('production worker configuration requires no web-role secret', () => {
  const environment = loadFaunapoolenEnvironment(
    {
      APP_BASE_URL: FAUNAPOOLEN_PUBLIC_ORIGIN,
      CAMPAIGN_GENERATION_ENABLED: '1',
      NODE_ENV: 'production',
      OPENAI_API_KEY: 'synthetic-production-shape-only',
    },
    'worker',
  );
  assert.equal(environment.providerApiKey, 'synthetic-production-shape-only');
  assert.equal(environment.providerBaseUrl, undefined);
  assert.equal(environment.providerModel, 'gpt-5.6-terra');
  assert.equal(environment.generationEnabled, true);
});

test('release validation is production-isolated inside one absolute runtime root', (t) => {
  const runtimeRoot = fs.realpathSync(
    fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'faunapoolen-release-validation-')),
  );
  t.after(() => fs.rmSync(runtimeRoot, { force: true, recursive: true }));
  const browserDirectory = path.join(runtimeRoot, 'browser');
  const suppliedPassword = 'release-validation-password-must-be-ignored';
  const suppliedSessionSecret = 'release-validation-session-secret-must-be-ignored';
  const suppliedUsername = 'release-owner-must-be-ignored';
  const environment = loadFaunapoolenEnvironment({
    ADMIN_PASSWORD: suppliedPassword,
    ADMIN_USERNAME: suppliedUsername,
    APP_BASE_URL: 'http://127.0.0.1',
    CAMPAIGN_GENERATION_ENABLED: '0',
    CX_RELEASE_VALIDATION: '1',
    CX_RUNTIME_ROOT: runtimeRoot,
    NODE_ENV: 'production',
    PORT: '4357',
    SESSION_SECRET: suppliedSessionSecret,
    SITE_BROWSER_DIR: browserDirectory,
  });
  const secondEnvironment = loadFaunapoolenEnvironment({
    APP_BASE_URL: 'http://127.0.0.1',
    CAMPAIGN_GENERATION_ENABLED: '0',
    CX_RELEASE_VALIDATION: '1',
    CX_RUNTIME_ROOT: runtimeRoot,
    NODE_ENV: 'production',
    PORT: '4357',
    SITE_BROWSER_DIR: browserDirectory,
  });

  assert.equal(environment.releaseValidation, true);
  assert.equal(environment.cookieSecure, false);
  assert.equal(environment.generationEnabled, false);
  assert.equal(environment.operationalRoot, runtimeRoot);
  assert.equal(environment.browserDirectoryOverride, browserDirectory);
  assert.equal(environment.databasePath, path.join(runtimeRoot, 'data', 'faunapoolen.db'));
  assert.deepEqual(environment.mutationOrigins, ['http://127.0.0.1']);
  assert.equal(Object.hasOwn(environment, 'providerApiKey'), false);
  assert.match(environment.adminUsername, /^[A-Za-z0-9_-]{43}$/);
  assert.match(environment.adminPassword, /^[A-Za-z0-9_-]{43}$/);
  assert.match(environment.sessionSecret, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(environment.adminUsername, suppliedUsername);
  assert.notEqual(environment.adminPassword, suppliedPassword);
  assert.notEqual(environment.sessionSecret, suppliedSessionSecret);
  assert.notEqual(environment.adminUsername, 'faunapoolen-local-owner');
  assert.notEqual(environment.adminPassword, 'faunapoolen-local-development-password');
  assert.notEqual(environment.sessionSecret, 'faunapoolen-local-development-session-secret');
  assert.notEqual(environment.adminUsername, secondEnvironment.adminUsername);
  assert.notEqual(environment.adminPassword, secondEnvironment.adminPassword);
  assert.notEqual(environment.sessionSecret, secondEnvironment.sessionSecret);

  assert.throws(
    () =>
      loadFaunapoolenEnvironment({
        ...PRODUCTION_ENVIRONMENT,
        APP_BASE_URL: 'http://127.0.0.1',
        CX_RELEASE_VALIDATION: '1',
      }),
    /CX_RUNTIME_ROOT/,
  );
  assert.throws(
    () =>
      loadFaunapoolenEnvironment({
        ...PRODUCTION_ENVIRONMENT,
        APP_BASE_URL: 'http://127.0.0.1',
        CX_RELEASE_VALIDATION: '1',
        CX_RUNTIME_ROOT: runtimeRoot,
        SITE_BROWSER_DIR: path.join(runtimeRoot, '..', 'outside-browser'),
      }),
    /strictly inside/,
  );
});

test('mutable data and browser paths cannot escape the operational root', (t) => {
  const runtimeRoot = fs.realpathSync(
    fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'faunapoolen-contained-')),
  );
  t.after(() => fs.rmSync(runtimeRoot, { force: true, recursive: true }));
  const base = {
    ...PRODUCTION_ENVIRONMENT,
    APP_BASE_URL: 'http://127.0.0.1',
    CX_RELEASE_VALIDATION: '1',
    CX_RUNTIME_ROOT: runtimeRoot,
    OPENAI_API_KEY: undefined,
  };
  for (const [name, value] of [
    ['DATA_DIR', '..'],
    ['DB_PATH', path.join(runtimeRoot, '..', 'outside.sqlite')],
    ['SITE_BROWSER_DIR', runtimeRoot],
  ] as const) {
    assert.throws(
      () => loadFaunapoolenEnvironment({ ...base, [name]: value }),
      /strictly inside/,
      name,
    );
  }
  assert.throws(
    () => loadFaunapoolenEnvironment({ ...base, SITE_BROWSER_DIR: 'relative/browser' }),
    /absolute/,
  );
  assert.throws(
    () => loadFaunapoolenEnvironment({ ...base, DATA_DIR: 'other-data' }),
    /operational data directory/,
  );
  assert.throws(
    () => loadFaunapoolenEnvironment({ ...base, DB_PATH: 'data/other.db' }),
    /data\/faunapoolen\.db/,
  );
});

test('provider overrides are test-only exact numeric-loopback URLs', () => {
  const accepted = loadFaunapoolenEnvironment(
    {
      NODE_ENV: 'test',
      OPENAI_BASE_URL: 'http://127.0.0.1:4545/v1',
      PORT: '4358',
    },
    'worker',
  );
  assert.equal(accepted.providerBaseUrl, 'http://127.0.0.1:4545/v1');
  assert.equal(
    accepted.databasePath,
    path.join(process.cwd(), '.run', 'dev', 'data', 'faunapoolen.db'),
  );

  for (const value of [
    'https://127.0.0.1:4545/v1',
    'http://localhost:4545/v1',
    'http://127.0.0.1/v1',
    'http://127.0.0.1:4545/',
    'http://127.0.0.1:4545/v1?unsafe=1',
  ]) {
    assert.throws(
      () => loadFaunapoolenEnvironment({ NODE_ENV: 'test', OPENAI_BASE_URL: value }, 'worker'),
      /loopback URL/,
      value,
    );
  }
  assert.throws(
    () =>
      loadFaunapoolenEnvironment(
        {
          ...PRODUCTION_ENVIRONMENT,
          OPENAI_BASE_URL: 'http://127.0.0.1:4545/v1',
        },
        'worker',
      ),
    /only when NODE_ENV=test/,
  );
  assert.throws(
    () => loadFaunapoolenEnvironment({ NODE_ENV: 'test', OPENAI_MODEL: 'gpt-5.6-sol' }, 'worker'),
    /must be exactly gpt-5\.6-terra/,
  );
});

test('host, node environment, release flag, ports, and session TTL fail closed', () => {
  for (const [name, value] of [
    ['HOST', '0.0.0.0'],
    ['NODE_ENV', 'staging'],
    ['CX_RELEASE_VALIDATION', 'true'],
    ['PORT', '3040.5'],
    ['ADMIN_SESSION_TTL_SECONDS', '86401'],
    ['CAMPAIGN_GENERATION_ENABLED', 'true'],
  ] as const) {
    assert.throws(
      () => loadFaunapoolenEnvironment({ ...PRODUCTION_ENVIRONMENT, [name]: value }),
      Error,
      name,
    );
  }
  assert.throws(
    () =>
      loadFaunapoolenEnvironment({
        ...PRODUCTION_ENVIRONMENT,
        CAMPAIGN_GENERATION_ENABLED: undefined,
      }),
    /Missing required environment value: CAMPAIGN_GENERATION_ENABLED/,
  );
  for (const NODE_ENV of ['', 'Production', ' production', 'production ']) {
    assert.throws(
      () => loadFaunapoolenEnvironment({ ...PRODUCTION_ENVIRONMENT, NODE_ENV }),
      /NODE_ENV must be exactly development, test, or production/,
      NODE_ENV,
    );
  }
});
