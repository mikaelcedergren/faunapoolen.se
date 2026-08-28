import path from 'node:path';

export const E2E_BUILD_ENVIRONMENT_KEYS = Object.freeze(
  [
    'CI',
    'NG_CLI_ANALYTICS',
    'NPM_CONFIG_GLOBALCONFIG',
    'NPM_CONFIG_USERCONFIG',
    'PATH',
    'TMPDIR',
  ].sort(),
);
export const E2E_RELEASE_BUILD_ENVIRONMENT_KEYS = Object.freeze(
  [
    'CI',
    'NG_CLI_ANALYTICS',
    'NPM_CONFIG_GLOBALCONFIG',
    'NPM_CONFIG_USERCONFIG',
    'PATH',
    'SITE_RELEASE_BROWSER_DIR',
    'SITE_RELEASE_DIR',
    'TMPDIR',
  ].sort(),
);
export const E2E_SERVER_ENVIRONMENT_KEYS = Object.freeze(
  [
    'ADMIN_PASSWORD',
    'ADMIN_SESSION_TTL_SECONDS',
    'ADMIN_USERNAME',
    'APP_BASE_URL',
    'CAMPAIGN_GENERATION_ENABLED',
    'CX_TEST_ALLOWED_ORIGIN',
    'DATA_DIR',
    'DB_PATH',
    'FAUNAPOOLEN_LOAD_ENV_FILE',
    'HOST',
    'NODE_ENV',
    'OPENAI_MODEL',
    'PATH',
    'PORT',
    'SESSION_SECRET',
    'SITE_BROWSER_DIR',
    'TMPDIR',
  ].sort(),
);

export function createE2EBuildEnvironment({ pathValue, runtimeTemp }) {
  return exactEnvironment(
    'build',
    {
      CI: '1',
      NG_CLI_ANALYTICS: 'false',
      NPM_CONFIG_GLOBALCONFIG: '/dev/null',
      NPM_CONFIG_USERCONFIG: '/dev/null',
      PATH: pathValue,
      TMPDIR: runtimeTemp,
    },
    E2E_BUILD_ENVIRONMENT_KEYS,
  );
}

export function createE2EReleaseBuildEnvironment({ pathValue, releaseDirectory, runtimeTemp }) {
  return exactEnvironment(
    'release build',
    {
      CI: '1',
      NG_CLI_ANALYTICS: 'false',
      NPM_CONFIG_GLOBALCONFIG: '/dev/null',
      NPM_CONFIG_USERCONFIG: '/dev/null',
      PATH: pathValue,
      SITE_RELEASE_BROWSER_DIR: path.join(releaseDirectory, 'browser'),
      SITE_RELEASE_DIR: releaseDirectory,
      TMPDIR: runtimeTemp,
    },
    E2E_RELEASE_BUILD_ENVIRONMENT_KEYS,
  );
}

export function createE2EServerEnvironment({ pathValue, port, runtimeRoot, runtimeTemp }) {
  const baseUrl = `http://127.0.0.1:${port}`;
  return exactEnvironment(
    'server',
    {
      ADMIN_PASSWORD: 'faunapoolen-e2e-owner-password',
      ADMIN_SESSION_TTL_SECONDS: '28800',
      ADMIN_USERNAME: 'faunapoolen-e2e-owner',
      APP_BASE_URL: baseUrl,
      CAMPAIGN_GENERATION_ENABLED: '0',
      CX_TEST_ALLOWED_ORIGIN: baseUrl,
      DATA_DIR: path.join(runtimeRoot, 'data'),
      DB_PATH: path.join(runtimeRoot, 'data', 'faunapoolen.db'),
      FAUNAPOOLEN_LOAD_ENV_FILE: 'false',
      HOST: '127.0.0.1',
      NODE_ENV: 'test',
      OPENAI_MODEL: 'gpt-5.6-terra',
      PATH: pathValue,
      PORT: String(port),
      SESSION_SECRET: 'faunapoolen-e2e-session-secret-with-48-characters',
      SITE_BROWSER_DIR: path.join(runtimeRoot, 'browser-output', 'browser'),
      TMPDIR: runtimeTemp,
    },
    E2E_SERVER_ENVIRONMENT_KEYS,
  );
}

function exactEnvironment(label, values, expectedKeys, allowEmpty = false) {
  const environment = Object.freeze(values);
  assertExactEnvironment(label, environment, expectedKeys, allowEmpty);
  return environment;
}

function assertExactEnvironment(label, environment, expectedKeys, allowEmpty = false) {
  const keys = Object.keys(environment).sort();
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index]) ||
    Object.values(environment).some(
      (value) => typeof value !== 'string' || (!allowEmpty && value.length === 0),
    )
  ) {
    throw new Error(`Faunapoolen E2E ${label} environment must match its explicit synthetic set.`);
  }
}
