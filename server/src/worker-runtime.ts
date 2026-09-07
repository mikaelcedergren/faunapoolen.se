import { loadProductManifestFile } from '@mikaelcedergren/cx-framework/server/product-manifest';
import { configureFaunapoolenLogging, log } from './logging.js';
import { assertServerProcessRole } from '@mikaelcedergren/cx-framework/server/process-role';
import {
  loadServerReleaseIdentity,
  type ServerReleaseIdentity,
} from '@mikaelcedergren/cx-framework/server/server-identity';
import {
  bindShutdownSignals,
  type GracefulShutdown,
} from '@mikaelcedergren/cx-framework/server/shutdown';
import {
  acquireServerWorkerReadinessLease,
  createServerWorkerReadiness,
  createWorkerLifetimeReference,
  signalServerWorkerReadiness,
  type ServerWorkerReadinessLease,
  type WorkerLifetimeReference,
} from '@mikaelcedergren/cx-framework/server/worker-readiness';

import {
  createFaunapoolenPersistence,
  type FaunapoolenPersistence,
} from './campaign-repository.js';
import { FAUNAPOOLEN_PRODUCT_ID } from './constants.js';
import {
  FAUNAPOOLEN_ARTIFACT_ROOT,
  FAUNAPOOLEN_MANIFEST_FILE,
  loadFaunapoolenEnvironment,
  type FaunapoolenWorkerEnvironment,
} from './environment.js';
import {
  createCampaignGenerationWorker,
  type CampaignGenerationWorkerLoop,
} from './generation-worker.js';
import { verifyFaunapoolenDatabase } from './database.js';
import { createOpenAiResponsesProvider } from './openai-provider.js';
import { assertFaunapoolenProductManifest } from './product-contract.js';

export const FAUNAPOOLEN_WORKER_KEY = 'jobs';

const WORKER_DRAIN_TIMEOUT_MS = 10_000;

export interface FaunapoolenWorkerRuntime {
  readonly claimsEnabled: boolean;
  readonly environment: FaunapoolenWorkerEnvironment;
  readonly identity: ServerReleaseIdentity | undefined;
  readonly kind: 'worker';
  readonly persistence: FaunapoolenPersistence;
  readonly readinessLease: ServerWorkerReadinessLease | undefined;
  readonly shutdown: GracefulShutdown;
  readonly worker: CampaignGenerationWorkerLoop;
}

export interface FaunapoolenWorkerValidation {
  readonly environment: FaunapoolenWorkerEnvironment;
  readonly identity: ServerReleaseIdentity;
  readonly kind: 'release-validation';
  readonly persistence: FaunapoolenPersistence;
  readonly shutdown: GracefulShutdown;
}

export async function startFaunapoolenWorker({
  acquireReadinessLease = acquireServerWorkerReadinessLease,
  entrypointUrl,
  environment: sourceEnvironment = process.env,
  releaseValidationReference = releaseProcessValidationReference,
  signalReadiness = signalServerWorkerReadiness,
  signals = process,
}: {
  readonly acquireReadinessLease?: typeof acquireServerWorkerReadinessLease;
  readonly entrypointUrl: string | URL;
  readonly environment?: NodeJS.ProcessEnv;
  readonly releaseValidationReference?: () => void;
  readonly signalReadiness?: typeof signalServerWorkerReadiness;
  readonly signals?: Parameters<typeof bindShutdownSignals>[0]['signals'];
}): Promise<FaunapoolenWorkerRuntime | FaunapoolenWorkerValidation> {
  const environment = loadFaunapoolenEnvironment(sourceEnvironment, 'worker');
  const { manifest } = loadProductManifestFile(FAUNAPOOLEN_MANIFEST_FILE);
  assertFaunapoolenProductManifest(manifest);
  if (manifest.id !== FAUNAPOOLEN_PRODUCT_ID) {
    throw new Error('Faunapoolen worker manifest identity is invalid.');
  }

  const identity = loadServerReleaseIdentity({
    environment: sourceEnvironment,
    required: environment.isProduction || environment.releaseValidation,
  });
  configureFaunapoolenLogging('jobs', sourceEnvironment, identity?.releaseId);
  if (identity) {
    assertServerProcessRole({
      artifactRoot: FAUNAPOOLEN_ARTIFACT_ROOT,
      entrypointUrl,
      identity,
      role: { key: FAUNAPOOLEN_WORKER_KEY, kind: 'worker' },
    });
  }

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
  try {
    if (environment.releaseValidation) {
      if (!identity) {
        throw new Error('Faunapoolen worker validation requires a sealed server identity.');
      }
      let closing: Promise<void> | undefined;
      let disposeSignals = (): void => undefined;
      const shutdown: GracefulShutdown = {
        get closing() {
          return closing !== undefined;
        },
        close(reason = 'shutdown') {
          if (closing) return closing;
          closing = closeWorkerValidation({
            closePersistence: () => {
              if (!persistenceOpen) return;
              persistenceOpen = false;
              persistence.close();
            },
            disposeSignals: () => disposeSignals(),
            releaseValidationReference,
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
            try {
              releaseValidationReference();
            } catch (releaseError) {
              log.emit({
                event: 'process.reference_release_failed',
                level: 'error',
                category: 'diagnostic',
                outcome: 'failure',
                error: releaseError,
              });
            }
          },
          shutdown,
          signals,
        });
        await signalReadiness(
          createServerWorkerReadiness({
            identity,
            productId: manifest.id,
            workerKey: FAUNAPOOLEN_WORKER_KEY,
          }),
          { environment: sourceEnvironment },
        );
      } catch (startupError) {
        try {
          await shutdown.close('startup_failure');
        } catch (shutdownError) {
          throw new AggregateError(
            [startupError, shutdownError],
            'Faunapoolen worker validation failed and cleanup was incomplete.',
          );
        }
        throw startupError;
      }
      log.emit({
        event: 'process.ready',
        level: 'info',
        category: 'operation',
        outcome: 'success',
        code: 'VALIDATION',
      });
      return Object.freeze({
        environment,
        identity,
        kind: 'release-validation' as const,
        persistence,
        shutdown,
      });
    }

    let provider: ReturnType<typeof createOpenAiResponsesProvider> | undefined;
    if (environment.generationEnabled) {
      if (!environment.providerApiKey) {
        throw new Error('Faunapoolen worker requires OPENAI_API_KEY when claims are enabled.');
      }
      provider = createOpenAiResponsesProvider({
        apiKey: environment.providerApiKey,
        model: environment.providerModel,
        repository: persistence.generations,
        ...(environment.providerBaseUrl === undefined
          ? {}
          : { baseUrl: environment.providerBaseUrl }),
      });
    }
    const worker = createCampaignGenerationWorker({
      campaigns: persistence.campaigns,
      enabled: environment.generationEnabled,
      generations: persistence.generations,
      maintenance: persistence.generationMaintenance,
      onError(error) {
        log.emit({
          event: 'worker.failed',
          level: 'error',
          category: 'diagnostic',
          outcome: 'failure',
          error,
        });
      },
      onMaintenance(result) {
        if (
          result.ambiguous > 0 ||
          result.effects > 0 ||
          result.failed > 0 ||
          result.jobs > 0 ||
          result.responseBytes > 0 ||
          result.runs > 0
        ) {
          for (const [operation, count] of Object.entries({
            ambiguous: result.ambiguous,
            effects: result.effects,
            failed: result.failed,
            jobs: result.jobs,
            runs: result.runs,
          })) {
            if (count > 0)
              log.emit({
                event: 'generation.maintenance',
                level: 'info',
                category: 'operation',
                outcome: 'success',
                operation,
                count,
              });
          }
          if (result.responseBytes > 0)
            log.emit({
              event: 'generation.response_bytes_expired',
              level: 'info',
              category: 'operation',
              outcome: 'success',
              bytes: result.responseBytes,
            });
        }
      },
      onRecovery(result) {
        if (
          result.ambiguousEffects > 0 ||
          result.ambiguousRuns > 0 ||
          result.failedJobs > 0 ||
          result.failedRuns > 0 ||
          result.resumedRuns > 0 ||
          result.retriedJobs > 0
        ) {
          for (const [operation, count] of Object.entries({
            ambiguousEffects: result.ambiguousEffects,
            ambiguousRuns: result.ambiguousRuns,
            failedJobs: result.failedJobs,
            failedRuns: result.failedRuns,
            resumedRuns: result.resumedRuns,
            retriedJobs: result.retriedJobs,
          })) {
            if (count > 0)
              log.emit({
                event: 'generation.recovery',
                level: 'info',
                category: 'operation',
                outcome: 'success',
                operation,
                count,
              });
          }
        }
      },
      ...(provider === undefined ? {} : { provider }),
      store: persistence.jobs,
    });

    let closing: Promise<void> | undefined;
    let disposeSignals = (): void => undefined;
    let readinessLease: ServerWorkerReadinessLease | undefined;
    let lifetimeReference: WorkerLifetimeReference | undefined;
    let workerStarted = false;
    const shutdown: GracefulShutdown = {
      get closing() {
        return closing !== undefined;
      },
      close(reason = 'shutdown') {
        if (closing) return closing;
        closing = closeWorkerRuntime({
          closeReadinessLease: () => {
            readinessLease?.close();
            lifetimeReference?.close();
          },
          closePersistence: () => {
            if (!persistenceOpen) return;
            persistenceOpen = false;
            persistence.close();
          },
          disposeSignals: () => disposeSignals(),
          reason,
          worker: workerStarted ? worker : undefined,
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
        signals,
      });
      readinessLease = acquireFaunapoolenWorkerReadinessLease({
        acquireReadinessLease,
        environment: sourceEnvironment,
        identity,
        production: environment.isProduction,
      });
      if (!environment.isProduction) {
        lifetimeReference = createWorkerLifetimeReference();
      }
      workerStarted = true;
      worker.start();
    } catch (startupError) {
      try {
        await shutdown.close('startup_failure');
      } catch (shutdownError) {
        throw new AggregateError(
          [startupError, shutdownError],
          'Faunapoolen worker startup failed and cleanup was incomplete.',
        );
      }
      throw startupError;
    }

    log.emit({
      event: 'process.ready',
      level: 'info',
      category: 'operation',
      outcome: 'success',
      code: environment.generationEnabled ? 'CLAIMS_ENABLED' : 'CLAIMS_DISABLED',
    });
    if (sourceEnvironment['CX_DEV_GENERATION']) {
      console.info(
        JSON.stringify({
          developmentRuntime: {
            generation: sourceEnvironment['CX_DEV_GENERATION'],
            pid: process.pid,
            role: FAUNAPOOLEN_WORKER_KEY,
            ...environment.execution,
          },
        }),
      );
    }
    return Object.freeze({
      claimsEnabled: environment.generationEnabled,
      environment,
      identity,
      kind: 'worker' as const,
      persistence,
      readinessLease,
      shutdown,
      worker,
    });
  } catch (error) {
    if (!persistenceOpen) throw error;
    persistenceOpen = false;
    try {
      persistence.close();
    } catch (closeError) {
      throw new AggregateError(
        [error, closeError],
        'Faunapoolen worker startup and persistence cleanup both failed.',
      );
    }
    throw error;
  }
}

export function acquireFaunapoolenWorkerReadinessLease({
  acquireReadinessLease,
  environment,
  identity,
  production,
}: {
  readonly acquireReadinessLease: typeof acquireServerWorkerReadinessLease;
  readonly environment: NodeJS.ProcessEnv;
  readonly identity: ServerReleaseIdentity | undefined;
  readonly production: boolean;
}): ServerWorkerReadinessLease | undefined {
  if (!production) return undefined;
  const readinessLease = acquireReadinessLease({
    environment,
    identity,
    workerKey: FAUNAPOOLEN_WORKER_KEY,
  });
  if (!readinessLease) {
    throw new Error('Faunapoolen production worker did not acquire its server readiness lease.');
  }
  return readinessLease;
}

export async function closeWorkerRuntime({
  closeReadinessLease,
  closePersistence,
  disposeSignals,
  reason,
  worker,
}: {
  readonly closeReadinessLease: () => void;
  readonly closePersistence: () => void;
  readonly disposeSignals: () => void;
  readonly reason: string;
  readonly worker: CampaignGenerationWorkerLoop | undefined;
}): Promise<void> {
  const failures: unknown[] = [];
  try {
    closeReadinessLease();
  } catch (error) {
    failures.push(error);
  }
  try {
    worker?.stopClaiming();
  } catch (error) {
    failures.push(error);
  }
  try {
    worker?.abortActive(new Error(`Faunapoolen worker stopped (${reason}).`));
  } catch (error) {
    failures.push(error);
  }
  try {
    await worker?.drain(WORKER_DRAIN_TIMEOUT_MS);
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
    throw new AggregateError(failures, 'Faunapoolen worker shutdown cleanup failed.');
  }
}

async function closeWorkerValidation({
  closePersistence,
  disposeSignals,
  releaseValidationReference,
}: {
  readonly closePersistence: () => void;
  readonly disposeSignals: () => void;
  readonly releaseValidationReference: () => void;
}): Promise<void> {
  const failures: unknown[] = [];
  for (const operation of [disposeSignals, closePersistence, releaseValidationReference]) {
    try {
      operation();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) {
    throw new AggregateError(failures, 'Faunapoolen worker validation cleanup failed.');
  }
}

function releaseProcessValidationReference(): void {
  process.channel?.unref();
}
