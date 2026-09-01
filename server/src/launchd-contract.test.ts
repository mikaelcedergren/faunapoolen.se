import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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

test('daemon installer is a thin delegate and never activates either service', () => {
  const source = readFileSync(installer, 'utf8');
  assert.match(source, /install-site-service-definitions\.mjs/);
  assert.match(source, /--site faunapoolen/);
  assert.match(source, /--repo "\$repo" "\$@"/);
  assert.doesNotMatch(source, /\blaunchctl\b/);
  assert.doesNotMatch(source, /\bsudo\b/);
  assert.doesNotMatch(source, /\.env\.|faunapoolen\.db|server\/dist/);

  const direct = execFileSync(installer, [], { cwd: repoRoot, encoding: 'utf8' });
  assert.match(direct, /VALID: faunapoolen 2 registered LaunchDaemon definitions/);
  assert.match(direct, /No service definition was installed/);
  const explicit = execFileSync(installer, ['--check'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(explicit, direct);
});
