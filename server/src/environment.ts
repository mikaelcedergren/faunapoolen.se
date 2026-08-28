import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  integerEnvironmentValue,
  localBindHost,
  nodeEnvironmentValue,
  portEnvironmentValue,
  releaseValidationEnvironmentValue,
  type Environment,
} from '@mikaelcedergren/cx-framework/server/configuration';
import { normalizeHttpOrigin } from '@mikaelcedergren/cx-framework/server/origin';
import { randomBase64UrlIdentifier } from '@mikaelcedergren/cx-framework/server/signing';

import {
  ADMIN_SESSION_DEFAULT_TTL_SECONDS,
  ADMIN_SESSION_MAXIMUM_TTL_SECONDS,
  DEFAULT_OPENAI_MODEL,
  FAUNAPOOLEN_PUBLIC_ORIGIN,
  FAUNAPOOLEN_WWW_ORIGIN,
} from './constants.js';

export const FAUNAPOOLEN_MANIFEST_FILE = fileURLToPath(
  new URL('../../cx-product.json', import.meta.url),
);
export const FAUNAPOOLEN_ARTIFACT_ROOT = path.dirname(FAUNAPOOLEN_MANIFEST_FILE);

interface FaunapoolenBaseEnvironment {
  readonly appOrigin: string;
  readonly dataDirectory: string;
  readonly databasePath: string;
  readonly generationEnabled: boolean;
  readonly isProduction: boolean;
  readonly nodeEnvironment: 'development' | 'production' | 'test';
  readonly operationalRoot: string;
  readonly releaseValidation: boolean;
}

export interface FaunapoolenEnvironment extends FaunapoolenBaseEnvironment {
  readonly adminPassword: string;
  readonly adminUsername: string;
  readonly browserDirectory: string;
  readonly browserDirectoryOverride: string | undefined;
  readonly cookieSecure: boolean;
  readonly host: string;
  readonly mutationOrigins: readonly string[];
  readonly port: number;
  readonly sessionSecret: string;
  readonly sessionTtlSeconds: number;
}

export interface FaunapoolenWorkerEnvironment extends FaunapoolenBaseEnvironment {
  readonly providerApiKey: string | undefined;
  readonly providerBaseUrl: string | undefined;
  readonly providerModel: typeof DEFAULT_OPENAI_MODEL;
}

export type FaunapoolenEnvironmentRole = 'web' | 'worker';

export function resolveFaunapoolenOperationalRoot(environment: Environment): string {
  const nodeEnvironment = nodeEnvironmentValue(environment);
  const validation = releaseValidationEnvironmentValue(environment);
  const override = environment['CX_RUNTIME_ROOT'];
  if (override !== undefined && !validation) {
    throw new Error('CX_RUNTIME_ROOT is reserved for CX_RELEASE_VALIDATION=1.');
  }
  if (validation && override === undefined) {
    throw new Error('CX_RELEASE_VALIDATION=1 requires an absolute CX_RUNTIME_ROOT.');
  }
  if (override !== undefined && (!override || !path.isAbsolute(override))) {
    throw new Error('CX_RUNTIME_ROOT must be absolute during release validation.');
  }
  return realpathSync.native(path.resolve(override ?? process.cwd()));
}

export function loadFaunapoolenEnvironment(
  environment?: Environment,
  role?: 'web',
): FaunapoolenEnvironment;
export function loadFaunapoolenEnvironment(
  environment: Environment | undefined,
  role: 'worker',
): FaunapoolenWorkerEnvironment;
export function loadFaunapoolenEnvironment(
  environment: Environment = process.env,
  role: FaunapoolenEnvironmentRole = 'web',
): FaunapoolenEnvironment | FaunapoolenWorkerEnvironment {
  const nodeEnvironment = nodeEnvironmentValue(environment);
  const releaseValidation = releaseValidationEnvironmentValue(environment);
  const isProduction = nodeEnvironment === 'production';

  const operationalRoot = resolveFaunapoolenOperationalRoot(environment);
  const port = role === 'web' ? portEnvironmentValue(environment, 'PORT', 3040) : undefined;
  const expectedProductionOrigin = releaseValidation
    ? 'http://127.0.0.1'
    : FAUNAPOOLEN_PUBLIC_ORIGIN;
  const configuredOrigin = environment['APP_BASE_URL'];
  if (isProduction && configuredOrigin !== expectedProductionOrigin) {
    throw new Error(`APP_BASE_URL must be exactly ${expectedProductionOrigin} in production.`);
  }
  const appOrigin = normalizeHttpOrigin(
    configuredOrigin ?? `http://127.0.0.1:${String(port ?? 3040)}`,
  );
  const defaultDataDirectory = isProduction || releaseValidation ? 'data' : '.run/dev/data';
  const dataDirectory = resolveContainedPath(
    operationalRoot,
    environment['DATA_DIR'] ?? defaultDataDirectory,
    'DATA_DIR',
  );
  const databasePath = resolveContainedPath(
    operationalRoot,
    environment['DB_PATH'] ?? path.join(dataDirectory, 'faunapoolen.db'),
    'DB_PATH',
  );
  if (isProduction) {
    const expectedDataDirectory = path.join(operationalRoot, 'data');
    const expectedDatabasePath = path.join(expectedDataDirectory, 'faunapoolen.db');
    if (dataDirectory !== expectedDataDirectory) {
      throw new Error('DATA_DIR must resolve to the operational data directory in production.');
    }
    if (databasePath !== expectedDatabasePath) {
      throw new Error('DB_PATH must resolve to data/faunapoolen.db in production.');
    }
  }
  const generationEnabled = binaryEnvironmentSwitch(
    environment,
    'CAMPAIGN_GENERATION_ENABLED',
    isProduction ? undefined : environment['OPENAI_API_KEY'] !== undefined,
  );

  const base = {
    appOrigin,
    dataDirectory,
    databasePath,
    generationEnabled,
    isProduction,
    nodeEnvironment,
    operationalRoot,
    releaseValidation,
  } satisfies FaunapoolenBaseEnvironment;

  if (role === 'worker') {
    const providerBaseUrl = parseTestProviderBaseUrl(
      nodeEnvironment,
      optionalExactValue(environment, 'OPENAI_BASE_URL'),
    );
    const providerApiKey = optionalExactValue(environment, 'OPENAI_API_KEY');
    const providerModel = optionalExactValue(environment, 'OPENAI_MODEL') ?? DEFAULT_OPENAI_MODEL;
    if (providerModel !== DEFAULT_OPENAI_MODEL) {
      throw new Error(`OPENAI_MODEL must be exactly ${DEFAULT_OPENAI_MODEL}.`);
    }
    return Object.freeze({
      ...base,
      providerApiKey,
      providerBaseUrl,
      providerModel,
    });
  }

  // Validation owns no operator credential: fresh unreachable values keep the real auth stack
  // composable without turning development defaults into a release-validation bypass.
  const adminUsername = releaseValidation
    ? randomBase64UrlIdentifier(32)
    : exactSecret(
        environment,
        'ADMIN_USERNAME',
        isProduction ? undefined : 'faunapoolen-local-owner',
      );
  if (adminUsername.length > 256) {
    throw new Error('ADMIN_USERNAME must contain at most 256 characters.');
  }
  const adminPassword = releaseValidation
    ? randomBase64UrlIdentifier(32)
    : exactSecret(
        environment,
        'ADMIN_PASSWORD',
        isProduction ? undefined : 'faunapoolen-local-development-password',
      );
  if (adminPassword.length < 16 || adminPassword.length > 256) {
    throw new Error('ADMIN_PASSWORD must contain between 16 and 256 characters.');
  }
  const sessionSecret = releaseValidation
    ? randomBase64UrlIdentifier(32)
    : exactSecret(
        environment,
        'SESSION_SECRET',
        isProduction ? undefined : 'faunapoolen-local-development-session-secret',
      );
  if (sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 characters.');
  }
  const sessionTtlSeconds = integerEnvironmentValue(environment, 'ADMIN_SESSION_TTL_SECONDS', {
    fallback: ADMIN_SESSION_DEFAULT_TTL_SECONDS,
    minimum: 1,
    maximum: ADMIN_SESSION_MAXIMUM_TTL_SECONDS,
  });
  const browserDirectory = path.join(operationalRoot, 'dist', 'browser');
  const browserDirectoryOverride = optionalExactValue(environment, 'SITE_BROWSER_DIR');
  if (browserDirectoryOverride !== undefined) {
    if (!path.isAbsolute(browserDirectoryOverride)) {
      throw new Error('SITE_BROWSER_DIR must be absolute when it is set.');
    }
    if (isProduction && !releaseValidation) {
      throw new Error(
        'SITE_BROWSER_DIR is available only to development, test, and release validation.',
      );
    }
    assertStrictlyContainedPath(operationalRoot, browserDirectoryOverride, 'SITE_BROWSER_DIR');
  }
  return Object.freeze({
    ...base,
    adminPassword,
    adminUsername,
    browserDirectory,
    browserDirectoryOverride,
    cookieSecure: isProduction && !releaseValidation,
    host: localBindHost(environment),
    mutationOrigins: Object.freeze(
      isProduction && !releaseValidation
        ? [FAUNAPOOLEN_PUBLIC_ORIGIN, FAUNAPOOLEN_WWW_ORIGIN]
        : [appOrigin],
    ),
    port: port!,
    sessionSecret,
    sessionTtlSeconds,
  });
}

function exactSecret(environment: Environment, name: string, fallback: string | undefined): string {
  const value = environment[name] ?? fallback;
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment value: ${name}.`);
  }
  if (value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`${name} must not contain surrounding whitespace or control characters.`);
  }
  return value;
}

function optionalExactValue(environment: Environment, name: string): string | undefined {
  const value = environment[name];
  if (value === undefined) return undefined;
  if (!value || value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`${name} must be a non-empty exact value without control characters.`);
  }
  return value;
}

function binaryEnvironmentSwitch(
  environment: Environment,
  name: string,
  fallback: boolean | undefined,
): boolean {
  const value = environment[name];
  if (value === undefined) {
    if (fallback === undefined) throw new Error(`Missing required environment value: ${name}.`);
    return fallback;
  }
  if (value !== '0' && value !== '1') {
    throw new Error(`${name} must be exactly 0 or 1.`);
  }
  return value === '1';
}

function resolveContainedPath(root: string, configured: string, name: string): string {
  if (!configured || configured !== configured.trim() || /[\u0000-\u001f\u007f]/.test(configured)) {
    throw new Error(`${name} must be a non-empty safe path.`);
  }
  const resolved = path.isAbsolute(configured)
    ? path.normalize(configured)
    : path.resolve(root, configured);
  assertStrictlyContainedPath(root, resolved, name);
  return resolved;
}

function assertStrictlyContainedPath(root: string, candidate: string, name: string): void {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  if (
    !relative ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`${name} must remain strictly inside the operational root.`);
  }
}

function parseTestProviderBaseUrl(
  nodeEnvironment: FaunapoolenBaseEnvironment['nodeEnvironment'],
  value: string | undefined,
): string | undefined {
  if (value === undefined) return undefined;
  if (nodeEnvironment !== 'test') {
    throw new Error('OPENAI_BASE_URL is available only when NODE_ENV=test.');
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch (error) {
    throw new Error('OPENAI_BASE_URL must be a valid loopback URL.', { cause: error });
  }
  if (
    parsed.protocol !== 'http:' ||
    !['127.0.0.1', '[::1]'].includes(parsed.hostname) ||
    !parsed.port ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== '/v1' ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error('OPENAI_BASE_URL must be an exact http://127.0.0.1:<port>/v1 loopback URL.');
  }
  return parsed.toString().replace(/\/$/, '');
}
