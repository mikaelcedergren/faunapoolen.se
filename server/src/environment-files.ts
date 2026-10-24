import path from 'node:path';

import { releaseValidationEnvironmentValue } from '@mikaelcedergren/cx-framework/server/configuration';
import {
  loadPrivateEnvironmentFile,
  privateEnvironmentFileStartupMode,
  UnsupportedPrivateEnvironmentKeyError,
} from '@mikaelcedergren/cx-framework/server/private-environment';

import { resolveFaunapoolenOperationalRoot } from './environment.js';

export type FaunapoolenProcessRole = 'web' | 'worker';

const ROLE_FILES = Object.freeze({
  web: Object.freeze({
    allowedKeys: new Set([
      'ADMIN_PASSWORD',
      'ADMIN_USERNAME',
      'CAMPAIGN_GENERATION_ENABLED',
      'SESSION_SECRET',
    ]),
    foreignPrivateKeys: [
      'OPENAI_API_KEY',
      'BREVO_API_KEY',
      'COMPANY_EMAIL',
      'ENQUIRY_EMAIL_ENABLED',
    ] as const,
    name: '.env.web' as const,
    privateKeys: ['ADMIN_PASSWORD', 'ADMIN_USERNAME', 'SESSION_SECRET'] as const,
  }),
  worker: Object.freeze({
    allowedKeys: new Set([
      'CAMPAIGN_GENERATION_ENABLED',
      'OPENAI_API_KEY',
      'BREVO_API_KEY',
      'COMPANY_EMAIL',
      'ENQUIRY_EMAIL_ENABLED',
    ]),
    foreignPrivateKeys: ['ADMIN_PASSWORD', 'ADMIN_USERNAME', 'SESSION_SECRET'] as const,
    name: '.env.worker' as const,
    privateKeys: [
      'OPENAI_API_KEY',
      'BREVO_API_KEY',
      'COMPANY_EMAIL',
      'ENQUIRY_EMAIL_ENABLED',
    ] as const,
  }),
});

export function loadFaunapoolenEnvironmentFiles({
  environment = process.env,
  role,
}: {
  readonly environment?: NodeJS.ProcessEnv;
  readonly role: FaunapoolenProcessRole;
}): void {
  const releaseValidation = releaseValidationEnvironmentValue(environment);
  const roleFile = ROLE_FILES[role];
  for (const name of roleFile.foreignPrivateKeys) delete environment[name];
  if (releaseValidation) {
    for (const name of roleFile.privateKeys) delete environment[name];
    resolveFaunapoolenOperationalRoot(environment);
    return;
  }
  const mode = privateEnvironmentFileStartupMode({
    bypassKey: 'FAUNAPOOLEN_LOAD_ENV_FILE',
    environment,
  });
  // Owner preview can explicitly opt into enquiry mail through its worker-owned file.
  // It still has no access to web credentials or a paid campaign provider.
  if (
    role === 'worker' &&
    mode === 'skip' &&
    environment['NODE_ENV'] === 'development' &&
    environment['CX_DATA_MODE'] === 'isolated' &&
    environment['CX_EXECUTION_SCOPE'] === 'development' &&
    environment['CAMPAIGN_GENERATION_ENABLED'] === '0'
  ) {
    const mailEnvironment: NodeJS.ProcessEnv = {};
    loadPrivateEnvironmentFile({
      allowedKeys: roleFile.allowedKeys,
      environment: mailEnvironment,
      file: path.join(resolveFaunapoolenOperationalRoot(environment), roleFile.name),
      mode: 'optional-ambient',
    });
    for (const name of ['BREVO_API_KEY', 'COMPANY_EMAIL', 'ENQUIRY_EMAIL_ENABLED']) {
      delete environment[name];
      if (mailEnvironment[name] !== undefined) environment[name] = mailEnvironment[name];
    }
    delete environment['OPENAI_API_KEY'];
    return;
  }
  if (mode === 'skip') return;
  const operationalRoot = resolveFaunapoolenOperationalRoot(environment);
  try {
    loadPrivateEnvironmentFile({
      allowedKeys: roleFile.allowedKeys,
      environment,
      file: path.join(operationalRoot, roleFile.name),
      mode,
    });
  } catch (error) {
    if (error instanceof UnsupportedPrivateEnvironmentKeyError) {
      throw new Error(
        `Faunapoolen ${roleFile.name} contains values outside its role allowlist: ${error.key}.`,
        { cause: error },
      );
    }
    throw error;
  }
}
