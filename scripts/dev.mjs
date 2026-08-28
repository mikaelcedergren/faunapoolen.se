#!/usr/bin/env node
import { spawn } from 'node:child_process';

const developmentEnvironment = {
  ...process.env,
  APP_BASE_URL: 'http://127.0.0.1:4240',
  DATA_DIR: '.run/dev/data',
  DB_PATH: '.run/dev/data/faunapoolen.db',
  HOST: '127.0.0.1',
  NODE_ENV: 'development',
  PORT: '4241',
};

const children = [
  spawn('server/node_modules/.bin/tsx', ['watch', 'server/src/index.ts'], {
    env: developmentEnvironment,
    stdio: 'inherit',
  }),
  spawn('server/node_modules/.bin/tsx', ['watch', 'server/src/worker.ts'], {
    env: developmentEnvironment,
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
    { env: developmentEnvironment, stdio: 'inherit' },
  ),
];

let stopping = false;

function stop(signal = 'SIGTERM') {
  if (stopping) {
    return;
  }
  stopping = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

for (const child of children) {
  child.on('exit', (code, signal) => {
    if (!stopping) {
      stop();
      process.exitCode = signal ? 1 : (code ?? 1);
    }
  });
}

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
