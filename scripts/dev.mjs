#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function createDevelopmentEnvironments(ambient = process.env, { owner = false } = {}) {
  const server = {
    ...ambient,
    APP_BASE_URL: 'http://127.0.0.1:4240',
    DATA_DIR: owner ? 'data/owner-development' : 'data',
    CX_EXECUTION_SCOPE: 'development',
    CX_DATA_MODE: owner ? 'isolated' : 'shared',
    CX_SCHEDULE_OWNER: 'false',
    CAMPAIGN_GENERATION_ENABLED: owner ? '0' : (ambient.CAMPAIGN_GENERATION_ENABLED ?? '0'),
    DB_PATH: owner ? 'data/owner-development/faunapoolen.db' : 'data/faunapoolen.db',
    ...(owner ? { FAUNAPOOLEN_LOAD_ENV_FILE: 'false' } : {}),
    HOST: '127.0.0.1',
    NODE_ENV: 'development',
    PORT: '4241',
  };
  if (owner) {
    for (const key of ['ADMIN_PASSWORD', 'ADMIN_USERNAME', 'OPENAI_API_KEY', 'SESSION_SECRET']) {
      delete server[key];
    }
  }
  const browser = { ...server };
  delete browser.PORT;
  return Object.freeze({
    browser: Object.freeze(browser),
    server: Object.freeze(server),
  });
}

export function prepareDevelopmentDataDirectory(root = process.cwd(), { owner = false } = {}) {
  const canonicalRoot = realpathSync(root);
  if (canonicalRoot !== resolve(root)) {
    throw new Error('Faunapoolen development must run from its canonical repository path.');
  }
  const sharedDirectory = resolve(canonicalRoot, 'data');
  const directory = owner ? resolve(sharedDirectory, 'owner-development') : sharedDirectory;
  const database = resolve(directory, 'faunapoolen.db');
  for (const [candidate, kind] of [
    ...(owner ? [[sharedDirectory, 'directory']] : []),
    [directory, 'directory'],
    [database, 'file'],
  ]) {
    if (owner && !existsSync(candidate)) {
      if (kind === 'file') continue;
      mkdirSync(candidate, { mode: 0o700 });
    }
    const metadata = lstatSync(candidate);
    if (
      (kind === 'directory' ? !metadata.isDirectory() : !metadata.isFile()) ||
      metadata.isSymbolicLink() ||
      metadata.uid !== process.getuid?.() ||
      realpathSync(candidate) !== candidate
    ) {
      throw new Error(
        `Unsafe Faunapoolen ${owner ? 'owner' : 'shared'} development store: ${candidate}`,
      );
    }
  }
  return directory;
}

export function startDevelopment({ owner = false } = {}) {
  prepareDevelopmentDataDirectory(process.cwd(), { owner });
  const environments = createDevelopmentEnvironments(process.env, { owner });
  const children = [
    spawn('server/node_modules/.bin/tsx', ['watch', 'server/src/index.ts'], {
      env: environments.server,
      stdio: 'inherit',
    }),
    spawn('server/node_modules/.bin/tsx', ['watch', 'server/src/worker.ts'], {
      env: environments.server,
      stdio: 'inherit',
    }),
    spawn(
      'node_modules/.bin/ng',
      [
        'serve',
        '--configuration',
        'local',
        '--host',
        '127.0.0.1',
        '--port',
        '4240',
        '--proxy-config',
        'proxy.conf.json',
      ],
      { env: environments.browser, stdio: 'inherit' },
    ),
  ];
  let stopping = false;
  let remaining = children.length;
  let forceTimer;

  function stop(signal = 'SIGTERM') {
    if (stopping) {
      return;
    }
    stopping = true;
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill(signal);
      }
    }
    forceTimer = setTimeout(() => {
      for (const child of children) {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill('SIGKILL');
        }
      }
    }, 10_000);
  }

  const onInterrupt = () => stop('SIGINT');
  const onTerminate = () => stop('SIGTERM');
  process.on('SIGINT', onInterrupt);
  process.on('SIGTERM', onTerminate);

  for (const child of children) {
    child.on('close', (code, signal) => {
      if (!stopping) {
        stop();
        process.exitCode = signal || code === 0 ? 1 : (code ?? 1);
      }
      remaining -= 1;
      if (remaining === 0) {
        if (forceTimer !== undefined) {
          clearTimeout(forceTimer);
        }
        process.off('SIGINT', onInterrupt);
        process.off('SIGTERM', onTerminate);
      }
    });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--owner');
  if (unknownArguments.length > 0)
    throw new Error(`Unknown development option: ${unknownArguments[0]}`);
  startDevelopment({ owner: process.argv.includes('--owner') });
}
