import type { Server } from 'node:http';
import { configureFaunapoolenLogging, log } from './logging.js';

import { listenHttpApplication } from '@mikaelcedergren/cx-framework/server/listen';
import { loadProductManifestFile } from '@mikaelcedergren/cx-framework/server/product-manifest';
import { assertServerProcessRole } from '@mikaelcedergren/cx-framework/server/process-role';
import {
  loadServerReleaseIdentity,
  type ServerReleaseIdentity,
} from '@mikaelcedergren/cx-framework/server/server-identity';
import {
  bindShutdownSignals,
  createGracefulShutdown,
  type GracefulShutdown,
} from '@mikaelcedergren/cx-framework/server/shutdown';
import { assertBrowserServingForStartup } from '@mikaelcedergren/cx-framework/server/static-files';

import { createFaunapoolenApplication } from './app.js';
import { createOwnerAuthService } from './auth-service.js';
import {
  createFaunapoolenPersistence,
  type FaunapoolenPersistence,
} from './campaign-repository.js';
import { createCampaignService } from './campaign-service.js';
import { createFaunapoolenBrowserServing } from './browser-serving.js';
import {
  FAUNAPOOLEN_ARTIFACT_ROOT,
  FAUNAPOOLEN_MANIFEST_FILE,
  loadFaunapoolenEnvironment,
  type FaunapoolenEnvironment,
} from './environment.js';
import { createGenerationService } from './generation-service.js';
import { createEnquiryService } from './enquiry-service.js';
import { verifyFaunapoolenDatabase } from './database.js';
import { assertFaunapoolenProductManifest } from './product-contract.js';

const HTTP_SHUTDOWN_TIMEOUT_MS = 10_000;

export interface FaunapoolenRuntime {
  readonly environment: FaunapoolenEnvironment;
  readonly identity: ServerReleaseIdentity | undefined;
  readonly persistence: FaunapoolenPersistence;
  readonly server: Server;
  readonly shutdown: GracefulShutdown;
}

export async function startFaunapoolenServer({
  entrypointUrl,
  environment: sourceEnvironment = process.env,
}: {
  readonly entrypointUrl: string | URL;
  readonly environment?: NodeJS.ProcessEnv;
}): Promise<FaunapoolenRuntime> {
  const environment = loadFaunapoolenEnvironment(sourceEnvironment);
  const { manifest } = loadProductManifestFile(FAUNAPOOLEN_MANIFEST_FILE);
  assertFaunapoolenProductManifest(manifest);

  const identity = loadServerReleaseIdentity({
    environment: sourceEnvironment,
    required: environment.isProduction || environment.releaseValidation,
  });
  configureFaunapoolenLogging('web', sourceEnvironment, identity?.releaseId);
  if (identity) {
    assertServerProcessRole({
      artifactRoot: FAUNAPOOLEN_ARTIFACT_ROOT,
      entrypointUrl,
      identity,
      role: { kind: 'web' },
    });
  }

  const configuredBrowserServing = createFaunapoolenBrowserServing(environment);
  assertBrowserServingForStartup({
    browserServing: configuredBrowserServing,
    environment: sourceEnvironment,
  });

  const persistence = createFaunapoolenPersistence({
    executionScope: environment.execution.executionScope,
    databasePath: environment.databasePath,
    operationalRoot: environment.operationalRoot,
    ...(environment.execution.dataMode === 'shared'
      ? {
          requireExisting: true as const,
          verifyBeforeWrite: verifyFaunapoolenDatabase,
        }
      : {}),
  });
  let persistenceOpen = true;
  let server: Server | undefined;
  try {
    const authService = createOwnerAuthService({
      cookieSecure: environment.cookieSecure,
      expectedPassword: environment.adminPassword,
      expectedUsername: environment.adminUsername,
      repository: persistence.ownerAuth,
      sessionSecret: environment.sessionSecret,
      sessionTtlSeconds: environment.sessionTtlSeconds,
    });
    const campaignService = createCampaignService({ campaigns: persistence.campaigns });
    const generationService = createGenerationService({
      campaigns: persistence.campaigns,
      generationAdmission: persistence.generationAdmission,
      generations: persistence.generations,
      providerConfigured: environment.generationEnabled,
    });
    const app = createFaunapoolenApplication({
      enquiryService: createEnquiryService({
        database: persistence.database.sqlite,
        secret: environment.sessionSecret,
      }),
      authService,
      browserServing: configuredBrowserServing,
      campaignService,
      databaseReadiness: persistence,
      environment,
      generationService,
      ...(identity === undefined ? {} : { identity }),
    });
    server = await listenHttpApplication(app, {
      host: environment.host,
      port: environment.port,
    });
    const httpShutdown = createGracefulShutdown({
      server,
      timeoutMs: HTTP_SHUTDOWN_TIMEOUT_MS,
    });
    let closing: Promise<void> | undefined;
    let disposeSignals = (): void => undefined;
    const shutdown: GracefulShutdown = {
      get closing() {
        return closing !== undefined;
      },
      close(reason = 'shutdown') {
        if (closing) return closing;
        closing = closeWebRuntime({
          closeHttp: () => httpShutdown.close(reason),
          closePersistence: () => {
            if (!persistenceOpen) return;
            persistenceOpen = false;
            persistence.close();
          },
          disposeSignals: () => disposeSignals(),
        }).then(() => {
          log.emit({
            event: 'process.stopped',
            level: 'info',
            category: 'operation',
            outcome: 'success',
          });
        });
        return closing;
      },
    };

    try {
      disposeSignals = bindShutdownSignals({
        onError(error) {
          log.emit({
            event: 'process.stop_failed',
            level: 'error',
            category: 'diagnostic',
            outcome: 'failure',
            error,
          });
          process.exitCode = 1;
        },
        shutdown,
        signals: process,
      });
    } catch (signalError) {
      try {
        await shutdown.close('signal_setup_failed');
      } catch (shutdownError) {
        throw new AggregateError(
          [signalError, shutdownError],
          'Faunapoolen signal setup failed and web cleanup was incomplete.',
        );
      }
      throw signalError;
    }

    log.emit({ event: 'process.ready', level: 'info', category: 'operation', outcome: 'success' });
    return Object.freeze({ environment, identity, persistence, server, shutdown });
  } catch (error) {
    const failures: unknown[] = [error];
    if (server?.listening) {
      try {
        await closeServer(server);
      } catch (closeError) {
        failures.push(closeError);
      }
    }
    if (persistenceOpen) {
      persistenceOpen = false;
      try {
        persistence.close();
      } catch (closeError) {
        failures.push(closeError);
      }
    }
    if (failures.length === 1) throw error;
    throw new AggregateError(failures, 'Faunapoolen web startup and cleanup both failed.');
  }
}

async function closeWebRuntime({
  closeHttp,
  closePersistence,
  disposeSignals,
}: {
  readonly closeHttp: () => Promise<void>;
  readonly closePersistence: () => void;
  readonly disposeSignals: () => void;
}): Promise<void> {
  const failures: unknown[] = [];
  try {
    await closeHttp();
  } catch (error) {
    failures.push(error);
  }
  try {
    disposeSignals();
  } catch (error) {
    failures.push(error);
  }
  try {
    closePersistence();
  } catch (error) {
    failures.push(error);
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) {
    throw new AggregateError(failures, 'Faunapoolen web shutdown cleanup failed.');
  }
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
