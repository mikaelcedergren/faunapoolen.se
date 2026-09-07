import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseLogRecord } from '@mikaelcedergren/cx-framework/server/logging';

const sourceRoot = path.dirname(fileURLToPath(import.meta.url));

test('compiled startup failures emit one safe fatal event for each role', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faunapoolen-PRIVATE-startup-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [entrypoint, role] of [
    ['index.js', 'web'],
    ['worker.js', 'jobs'],
  ]) {
    const result = spawnSync(
      process.execPath,
      [path.resolve(sourceRoot, '..', 'dist', entrypoint!)],
      {
        cwd: root,
        env: {
          PATH: process.env['PATH'],
          NODE_ENV: 'production',
          CX_EXECUTION_SCOPE: 'test',
          CX_DATA_MODE: 'isolated',
          CX_SCHEDULE_OWNER: 'false',
        },
        encoding: 'utf8',
        timeout: 5_000,
      },
    );
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    const records = result.stderr.trim().split('\n').map(parseLogRecord);
    assert.equal(records.length, 1);
    assert.equal(records[0]?.event, 'process.start_failed');
    assert.equal(records[0]?.role, role);
    assert.equal(records[0]?.level, 'fatal');
    assert.ok(records[0]?.error?.locations.length);
    assert.doesNotMatch(result.stderr, /PRIVATE|\/Users\/|\.env\.web|\.env\.worker/u);
  }
});

test('each process sanitizes and loads only its role file before importing its runtime', () => {
  for (const [entrypoint, role, runtime] of [
    ['index.ts', 'web', './runtime.js'],
    ['worker.ts', 'worker', './worker-runtime.js'],
  ] as const) {
    const source = fs.readFileSync(path.join(sourceRoot, entrypoint), 'utf8');
    const roleLoad = `loadFaunapoolenEnvironmentFiles({ role: '${role}' });`;
    const runtimeImport = `await import('${runtime}')`;
    const escapedRuntime = runtime.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.doesNotMatch(source, new RegExp(`from ['"]${escapedRuntime}['"]`));
    assert.ok(source.indexOf(roleLoad) >= 0, `${entrypoint} must load its ${role} role file`);
    assert.ok(
      source.indexOf(runtimeImport) >= 0,
      `${entrypoint} must dynamically import its runtime`,
    );
    assert.ok(
      source.indexOf(roleLoad) < source.indexOf(runtimeImport),
      `${entrypoint} must establish its private role boundary before importing runtime code`,
    );
  }
});
