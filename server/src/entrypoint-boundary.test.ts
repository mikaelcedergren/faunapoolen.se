import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const sourceRoot = path.dirname(fileURLToPath(import.meta.url));

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
