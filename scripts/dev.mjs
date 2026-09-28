#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { lstatSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function createDevelopmentEnvironments(ambient = process.env) {
  const server = {
    ...ambient,
    APP_BASE_URL: 'http://127.0.0.1:4240',
    DATA_DIR: 'data',
    CX_EXECUTION_SCOPE: 'development',
    CX_DATA_MODE: 'shared',
    CX_SCHEDULE_OWNER: 'false',
    CAMPAIGN_GENERATION_ENABLED: ambient.CAMPAIGN_GENERATION_ENABLED ?? '0',
    DB_PATH: 'data/faunapoolen.db',
    HOST: '127.0.0.1',
    NODE_ENV: 'development',
    PORT: '4241',
  };
  const browser = { ...server };
  delete browser.PORT;
  return Object.freeze({
    browser: Object.freeze(browser),
    server: Object.freeze(server),
  });
}

export function prepareDevelopmentDataDirectory(root = process.cwd()) {
  const canonicalRoot = realpathSync(root);
  if (canonicalRoot !== resolve(root)) {
    throw new Error('Faunapoolen development must run from its canonical repository path.');
  }
  const directory = resolve(canonicalRoot, 'data');
  const database = resolve(directory, 'faunapoolen.db');
  for (const [candidate, kind] of [
    [directory, 'directory'],
    [database, 'file'],
  ]) {
    const metadata = lstatSync(candidate);
    if (
      (kind === 'directory' ? !metadata.isDirectory() : !metadata.isFile()) ||
      metadata.isSymbolicLink() ||
      metadata.uid !== process.getuid?.() ||
      realpathSync(candidate) !== candidate
    ) {
      throw new Error(`Unsafe Faunapoolen shared development store: ${candidate}`);
    }
  }
  return directory;
}

export function startDevelopment() {
  prepareDevelopmentDataDirectory();
  const environments = createDevelopmentEnvironments();
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
  startDevelopment();
}
