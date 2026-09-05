import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';

import { loadFaunapoolenEnvironmentFiles } from './environment-files.js';

test('product role policy delegates private file I/O to the framework primitive', () => {
  const source = fs.readFileSync(new URL('./environment-files.ts', import.meta.url), 'utf8');
  assert.match(source, /@mikaelcedergren\/cx-framework\/server\/private-environment/);
  assert.doesNotMatch(source, /\b(?:fstatSync|openSync|readSync)\b/);
});

test('web and worker load only their own private role file', (t) => {
  const root = temporaryRoot(t);
  fs.writeFileSync(
    path.join(root, '.env.web'),
    [
      'ADMIN_PASSWORD=synthetic-password',
      'ADMIN_USERNAME=synthetic-owner',
      'CAMPAIGN_GENERATION_ENABLED=1',
      'SESSION_SECRET=synthetic-session-secret',
      '',
    ].join('\n'),
    { mode: 0o600 },
  );
  fs.writeFileSync(
    path.join(root, '.env.worker'),
    'CAMPAIGN_GENERATION_ENABLED=1\nOPENAI_API_KEY=synthetic-provider-key\n',
    {
      mode: 0o600,
    },
  );
  fs.writeFileSync(
    path.join(root, '.env'),
    'ADMIN_PASSWORD=legacy-password\nOPENAI_API_KEY=legacy-provider-key\n',
    { mode: 0o600 },
  );

  const webEnvironment: NodeJS.ProcessEnv = {
    OPENAI_API_KEY: 'ambient-provider-must-not-cross',
  };
  loadFaunapoolenEnvironmentFiles({
    environment: webEnvironment,
    role: 'web',
  });
  assert.deepEqual(webEnvironment, {
    ADMIN_PASSWORD: 'synthetic-password',
    ADMIN_USERNAME: 'synthetic-owner',
    CAMPAIGN_GENERATION_ENABLED: '1',
    SESSION_SECRET: 'synthetic-session-secret',
  });

  const workerEnvironment: NodeJS.ProcessEnv = {
    ADMIN_PASSWORD: 'ambient-password-must-not-cross',
    ADMIN_USERNAME: 'ambient-owner-must-not-cross',
    SESSION_SECRET: 'ambient-session-must-not-cross',
  };
  loadFaunapoolenEnvironmentFiles({
    environment: workerEnvironment,
    role: 'worker',
  });
  assert.deepEqual(workerEnvironment, {
    CAMPAIGN_GENERATION_ENABLED: '1',
    OPENAI_API_KEY: 'synthetic-provider-key',
  });
});

test('production requires each role file and makes its allowlist authoritative', (t) => {
  const root = temporaryRoot(t);
  const environment: NodeJS.ProcessEnv = {
    ADMIN_PASSWORD: 'ambient-must-be-cleared',
    ADMIN_USERNAME: 'ambient-must-be-replaced',
    CAMPAIGN_GENERATION_ENABLED: '0',
    NODE_ENV: 'production',
    SESSION_SECRET: 'ambient-must-be-cleared',
    UNRELATED: 'preserved',
  };

  assert.throws(
    () => loadFaunapoolenEnvironmentFiles({ environment, role: 'web' }),
    /Required private environment file \.env\.web is absent/,
  );
  assert.equal(environment['ADMIN_USERNAME'], 'ambient-must-be-replaced');

  fs.writeFileSync(
    path.join(root, '.env.web'),
    'ADMIN_USERNAME=file-owner\nCAMPAIGN_GENERATION_ENABLED=1\n',
    {
      mode: 0o600,
    },
  );
  loadFaunapoolenEnvironmentFiles({ environment, role: 'web' });
  assert.deepEqual(environment, {
    ADMIN_USERNAME: 'file-owner',
    CAMPAIGN_GENERATION_ENABLED: '1',
    NODE_ENV: 'production',
    UNRELATED: 'preserved',
  });

  assert.throws(
    () =>
      loadFaunapoolenEnvironmentFiles({
        environment: {
          FAUNAPOOLEN_LOAD_ENV_FILE: 'false',
          NODE_ENV: 'production',
        },
        role: 'web',
      }),
    /cannot disable the required production private environment file/,
  );
});

test('environment files fail closed on public mode, links, and test bypasses all reads', (t) => {
  const root = temporaryRoot(t);
  const webFile = path.join(root, '.env.web');
  fs.writeFileSync(webFile, 'ADMIN_USERNAME=owner\n', { mode: 0o600 });
  fs.chmodSync(webFile, 0o644);
  assert.throws(
    () => loadFaunapoolenEnvironmentFiles({ environment: {}, role: 'web' }),
    /mode-0600 regular file/,
  );

  fs.rmSync(webFile);
  const target = path.join(root, 'target.env');
  fs.writeFileSync(target, 'ADMIN_USERNAME=owner\n', { mode: 0o600 });
  fs.symlinkSync(target, webFile);
  assert.throws(
    () => loadFaunapoolenEnvironmentFiles({ environment: {}, role: 'web' }),
    /mode-0600 regular file/,
  );

  fs.rmSync(webFile);
  fs.rmSync(target);
  fs.symlinkSync(target, webFile);
  assert.throws(
    () => loadFaunapoolenEnvironmentFiles({ environment: {}, role: 'web' }),
    /mode-0600 regular file/,
  );

  let loaded = false;
  const testEnvironment: NodeJS.ProcessEnv = {
    ADMIN_PASSWORD: 'wrong-role',
    ADMIN_USERNAME: 'wrong-role',
    NODE_ENV: 'test',
    SESSION_SECRET: 'wrong-role',
  };
  loadFaunapoolenEnvironmentFiles({
    environment: testEnvironment,
    role: 'worker',
  });
  loaded = Object.hasOwn(testEnvironment, 'SYNTHETIC_VALUE');
  assert.equal(loaded, false);
  assert.deepEqual(testEnvironment, { NODE_ENV: 'test' });
  assert.throws(
    () =>
      loadFaunapoolenEnvironmentFiles({
        environment: { FAUNAPOOLEN_LOAD_ENV_FILE: 'false', NODE_ENV: 'Production' },
        role: 'web',
      }),
    /NODE_ENV must be exactly development, test, or production/,
  );
  assert.throws(
    () =>
      loadFaunapoolenEnvironmentFiles({
        environment: { FAUNAPOOLEN_LOAD_ENV_FILE: 'False' },
        role: 'web',
      }),
    /FAUNAPOOLEN_LOAD_ENV_FILE must be exactly false/,
  );

  const validationEnvironment: NodeJS.ProcessEnv = {
    ADMIN_PASSWORD: 'ambient-foreign-must-be-removed',
    CAMPAIGN_GENERATION_ENABLED: '1',
    CX_RELEASE_VALIDATION: '1',
    CX_RUNTIME_ROOT: root,
    NODE_ENV: 'production',
    OPENAI_API_KEY: 'ambient-owned-must-be-removed',
  };
  loadFaunapoolenEnvironmentFiles({
    environment: validationEnvironment,
    role: 'worker',
  });
  assert.equal(validationEnvironment['ADMIN_PASSWORD'], undefined);
  assert.equal(validationEnvironment['CAMPAIGN_GENERATION_ENABLED'], '1');
  assert.equal(validationEnvironment['OPENAI_API_KEY'], undefined);
});

test('private role-file reads stay bounded when the file is oversized or grows after open', (t) => {
  const root = temporaryRoot(t);
  const workerFile = path.join(root, '.env.worker');
  fs.writeFileSync(workerFile, Buffer.alloc(64 * 1024 + 1, 0x41), { mode: 0o600 });
  assert.throws(
    () => loadFaunapoolenEnvironmentFiles({ environment: {}, role: 'worker' }),
    /exceeds 64 KiB/,
  );

  fs.writeFileSync(workerFile, Buffer.from([0xc3, 0x28]), { mode: 0o600 });
  assert.throws(
    () => loadFaunapoolenEnvironmentFiles({ environment: {}, role: 'worker' }),
    /must be valid UTF-8/,
  );

  fs.writeFileSync(workerFile, 'OPENAI_API_KEY=synthetic\n', { mode: 0o600 });
  const originalReadSync = fs.readSync;
  let grew = false;
  const growingRead = ((
    descriptor: number,
    buffer: NodeJS.ArrayBufferView,
    offset: number,
    length: number,
    position: number | null,
  ): number => {
    if (!grew) {
      grew = true;
      fs.appendFileSync(workerFile, Buffer.alloc(70 * 1024, 0x42));
    }
    return originalReadSync(descriptor, buffer, offset, length, position);
  }) as typeof fs.readSync;
  t.mock.method(fs, 'readSync', growingRead);
  assert.throws(
    () => loadFaunapoolenEnvironmentFiles({ environment: {}, role: 'worker' }),
    /exceeds 64 KiB/,
  );
});

test('private values cannot cross the fixed web and worker file boundaries', (t) => {
  const root = temporaryRoot(t);
  fs.writeFileSync(path.join(root, '.env.web'), 'OPENAI_API_KEY=synthetic\n', { mode: 0o600 });
  assert.throws(
    () => loadFaunapoolenEnvironmentFiles({ environment: {}, role: 'web' }),
    /outside its role allowlist: OPENAI_API_KEY/,
  );

  fs.writeFileSync(
    path.join(root, '.env.worker'),
    'OPENAI_API_KEY=synthetic\nADMIN_PASSWORD=wrong-layer\n',
    { mode: 0o600 },
  );
  assert.throws(
    () => loadFaunapoolenEnvironmentFiles({ environment: {}, role: 'worker' }),
    /outside its role allowlist: ADMIN_PASSWORD/,
  );
});

function temporaryRoot(t: TestContext): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'faunapoolen-env-files-')));
  fs.chmodSync(root, 0o700);
  const previous = process.cwd();
  process.chdir(root);
  t.after(() => {
    process.chdir(previous);
    fs.rmSync(root, { force: true, recursive: true });
  });
  return root;
}
