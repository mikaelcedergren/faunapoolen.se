#!/usr/bin/env node
import { spawn } from 'node:child_process';

const children = [
  spawn(process.execPath, ['server/admin-dev.mjs'], { stdio: 'inherit' }),
  spawn(
    'ng',
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
    { stdio: 'inherit' },
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
