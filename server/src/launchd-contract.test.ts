import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const installer = path.join(repoRoot, 'bin', 'install-server-daemon');

test('LaunchDaemon source selects immutable web and listener-free worker roles', () => {
  for (const [label, entrypoint, listener] of [
    ['com.faunapoolen.server', 'server/dist/index.js', true],
    ['com.faunapoolen.jobs', 'server/dist/worker.js', false],
  ] as const) {
    const source = readFileSync(path.join(repoRoot, 'launchd', `${label}.plist`), 'utf8');
    assert.match(
      source,
      new RegExp(
        `/\\.run/site-releases/server/current-server/artifact/${entrypoint.replaceAll('.', '\\.')}<`,
      ),
    );
    assert.match(source, /current-server\/server-release\.json</);
    assert.match(source, /<key>CAMPAIGN_GENERATION_ENABLED<\/key>\s*<string>0<\/string>/);
    assert.doesNotMatch(
      source,
      /<key>(?:ADMIN_PASSWORD|ADMIN_USERNAME|OPENAI_API_KEY|SESSION_SECRET)<\/key>/,
    );
    if (listener) {
      assert.match(source, /<key>HOST<\/key>\s*<string>127\.0\.0\.1<\/string>/);
      assert.match(source, /<key>PORT<\/key>\s*<string>3040<\/string>/);
      assert.doesNotMatch(source, /<key>OPENAI_MODEL<\/key>/);
    } else {
      assert.doesNotMatch(source, /<key>(?:HOST|PORT)<\/key>/);
      assert.match(source, /<key>OPENAI_MODEL<\/key>\s*<string>gpt-5\.6-terra<\/string>/);
    }
  }
});

test('daemon installer keeps campaign cutover gated and never activates either service', (t) => {
  const source = readFileSync(installer, 'utf8');
  assert.match(source, /MODE="check"/);
  assert.match(source, /\.env\.web/);
  assert.match(source, /\.env\.worker/);
  assert.match(source, /data\/faunapoolen\.db/);
  assert.match(source, /server\/dist\/index\.js/);
  assert.match(source, /server\/dist\/worker\.js/);
  assert.match(source, /exact \{expected_label\} allowlist/);
  assert.match(source, /os\.lstat\(path\)/);
  assert.doesNotMatch(source, /open\([^\n]*(?:\.env\.web|\.env\.worker)/);
  assert.doesNotMatch(source, /\blaunchctl\b/);
  assert.match(source, /server-ops\/bin\/install-launchdaemon-definitions\.mjs/);
  assert.match(source, /--definition "\$\{LABELS\[0\]\}=/);
  assert.match(source, /--definition "\$\{LABELS\[1\]\}=/);
  assert.doesNotMatch(source, /sudo install -o root -g wheel -m 0644/);

  if (process.platform !== 'darwin') {
    t.diagnostic('Mac-only installer execution is covered by source contract on this platform.');
    return;
  }
  const direct = execFileSync(installer, [], { cwd: repoRoot, encoding: 'utf8' });
  assert.match(direct, /VALID: Faunapoolen web and jobs-worker LaunchDaemon templates/);
  assert.match(
    direct,
    /Campaign import, backup\/restore, server selection, and activation remain gated/,
  );
  const explicit = execFileSync(installer, ['--check'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(explicit, direct);

  const copiedRoot = mkdtempSync(path.join(os.tmpdir(), 'faunapoolen-daemon-check-'));
  t.after(() => rmSync(copiedRoot, { force: true, recursive: true }));
  mkdirSync(path.join(copiedRoot, 'bin'));
  mkdirSync(path.join(copiedRoot, 'launchd'));
  const copiedInstaller = path.join(copiedRoot, 'bin', 'install-server-daemon');
  copyFileSync(installer, copiedInstaller);
  chmodSync(copiedInstaller, 0o755);
  for (const label of ['com.faunapoolen.server', 'com.faunapoolen.jobs']) {
    copyFileSync(
      path.join(repoRoot, 'launchd', `${label}.plist`),
      path.join(copiedRoot, 'launchd', `${label}.plist`),
    );
  }
  const copiedCheck = execFileSync(copiedInstaller, ['--check'], {
    cwd: copiedRoot,
    encoding: 'utf8',
  });
  assert.equal(copiedCheck, direct);
  assert.throws(
    () =>
      execFileSync(copiedInstaller, ['--apply'], {
        cwd: copiedRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    (error: unknown) =>
      error instanceof Error &&
      /--apply is allowed only from the canonical production checkout/.test(
        'stderr' in error ? String(error.stderr) : error.message,
      ),
  );
});
