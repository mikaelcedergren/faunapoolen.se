import { randomUUID } from 'node:crypto';

import {
  createDurableWorker,
  type DurableJobStore,
  type DurableWorker,
} from '@mikaelcedergren/cx-framework/server/jobs';

import type { CampaignRepository, GenerationRepository } from './campaign-repository.js';
import {
  MAX_GENERATION_RETENTION_BATCH,
  type GenerationMaintenanceRepository,
  type GenerationReconciliationResult,
  type GenerationRetentionResult,
} from './campaign-repository.js';
import {
  classifyCampaignGenerationFailure,
  createCampaignGenerationHandlers,
} from './generation-handlers.js';
import type { OpenAiResponsesProvider } from './openai-provider.js';

const DEFAULT_WORKER_POLL_INTERVAL_MS = 1_000;
// A quota window can add up to 90 terminal stage runs. A 100-row maintenance batch therefore runs
// once per quota window, as well as after productive worker batches, so capacity is reclaimed faster
// than admitted work can consume it.
const DEFAULT_MAINTENANCE_INTERVAL_MS = 10 * 60 * 1_000;

export interface CampaignGenerationWorkerLoop {
  readonly accepting: boolean;
  readonly running: boolean;
  abortActive(reason?: unknown): void;
  drain(timeoutMs: number): Promise<void>;
  runUntilIdle(): Promise<number>;
  start(): void;
  stopClaiming(): void;
}

export interface CreateCampaignGenerationWorkerOptions {
  readonly campaigns: CampaignRepository;
  readonly clock?: () => number;
  readonly createUuid?: () => string;
  readonly enabled?: boolean;
  readonly generations: GenerationRepository;
  readonly maintenance: GenerationMaintenanceRepository;
  readonly maintenanceIntervalMs?: number;
  readonly onError?: (error: unknown) => void;
  readonly onMaintenance?: (
    result: GenerationReconciliationResult & GenerationRetentionResult,
  ) => void;
  readonly onRecovery?: (result: {
    readonly ambiguousEffects: number;
    readonly ambiguousRuns: number;
    readonly failedJobs: number;
    readonly failedRuns: number;
    readonly resumedRuns: number;
    readonly retriedJobs: number;
  }) => void;
  readonly owner?: string;
  readonly pollIntervalMs?: number;
  readonly provider?: OpenAiResponsesProvider;
  readonly scheduleInterval?: (intervalMs: number, tick: () => void) => () => void;
  readonly store: DurableJobStore;
  readonly worker?: DurableWorker;
}

/**
 * Compose the listener-free background process. Enabled startup quarantines orphaned create
 * requests before recovering expired claims, then the cx-framework worker owns fencing,
 * heartbeats, and attempts. Disabled startup is a lifecycle-only, generation-state-inert process.
 */
export function createCampaignGenerationWorker(
  options: CreateCampaignGenerationWorkerOptions,
): CampaignGenerationWorkerLoop {
  if (options.enabled === false) return createClaimDisabledCampaignGenerationWorker();
  const {
    campaigns,
    clock = Date.now,
    createUuid = randomUUID,
    generations,
    maintenance,
    maintenanceIntervalMs = DEFAULT_MAINTENANCE_INTERVAL_MS,
    onError = () => {},
    onMaintenance = () => {},
    onRecovery = () => {},
    owner = `faunapoolen-worker-${randomUUID()}`,
    pollIntervalMs = DEFAULT_WORKER_POLL_INTERVAL_MS,
    provider,
    scheduleInterval = defaultScheduleInterval,
    store,
    worker: suppliedWorker,
  } = options;
  if (store.maxConcurrentJobs !== 1) {
    throw new Error(
      'Faunapoolen campaign generation requires exactly one concurrent durable claim.',
    );
  }
  assertTimer(pollIntervalMs, 'Campaign generation worker poll interval');
  assertTimer(maintenanceIntervalMs, 'Campaign generation maintenance interval');
  let worker: DurableWorker;
  if (suppliedWorker) {
    worker = suppliedWorker;
  } else {
    if (!provider) throw new Error('Enabled campaign generation requires a provider.');
    worker = createDurableWorker({
      classifyFailure: (error) => classifyCampaignGenerationFailure(error, checkedClock(clock)),
      handlers: createCampaignGenerationHandlers({
        campaigns,
        clock,
        createUuid,
        generations,
        provider,
      }),
      owner,
      store,
    });
  }
  let cancelPoll: (() => void) | undefined;
  let cancelMaintenance: (() => void) | undefined;

  async function runUntilIdle(): Promise<number> {
    try {
      const processed = await worker.runUntilIdle();
      if (processed > 0) {
        try {
          maintain();
        } catch (error) {
          // Completed work remains authoritative. Maintenance is bounded and will be retried on the
          // periodic path; diagnostics must not turn a successful worker batch into a false failure.
          onError(error);
        }
      }
      return processed;
    } catch (error) {
      onError(error);
      throw error;
    }
  }

  function poll(): void {
    void runUntilIdle().catch(() => {
      // onError owns diagnostics. A later poll can recover an expired or transient claim.
    });
  }

  function maintain(): GenerationReconciliationResult & GenerationRetentionResult {
    const now = checkedClock(clock);
    const reconciled = maintenance.reconcileTerminalJobs({
      limit: MAX_GENERATION_RETENTION_BATCH,
      now,
    });
    const retained = maintenance.maintainTerminalStorage({
      limit: MAX_GENERATION_RETENTION_BATCH,
      now,
    });
    const result = Object.freeze({ ...reconciled, ...retained });
    onMaintenance(result);
    return result;
  }

  function maintenanceTick(): void {
    try {
      maintain();
    } catch (error) {
      onError(error);
    }
  }

  function recover(): void {
    const ambiguousEffects = generations.markCreatingEffectsAmbiguous(checkedClock(clock));
    const recovered = store.recoverExpired();
    const maintained = maintain();
    onRecovery({
      ambiguousEffects,
      ambiguousRuns: maintained.ambiguous,
      failedJobs: recovered.failed,
      failedRuns: maintained.failed,
      resumedRuns: maintained.resumed,
      retriedJobs: recovered.retried,
    });
  }

  return Object.freeze({
    get accepting() {
      return worker.accepting;
    },
    get running() {
      return cancelPoll !== undefined || cancelMaintenance !== undefined || worker.running;
    },
    abortActive(reason?: unknown) {
      cancelPoll?.();
      cancelPoll = undefined;
      cancelMaintenance?.();
      cancelMaintenance = undefined;
      worker.abortActive(reason);
    },
    drain: (timeoutMs: number) => worker.drain(timeoutMs),
    runUntilIdle,
    start() {
      if (cancelPoll || cancelMaintenance) return;
      if (!worker.accepting)
        throw new Error('A stopped campaign generation worker cannot restart.');
      recover();
      const scheduledPoll = scheduleInterval(pollIntervalMs, poll);
      if (typeof scheduledPoll !== 'function') {
        throw new Error('Campaign generation worker poll interval must be cancellable.');
      }
      let scheduledMaintenance: (() => void) | undefined;
      try {
        scheduledMaintenance = scheduleInterval(maintenanceIntervalMs, maintenanceTick);
        if (typeof scheduledMaintenance !== 'function') {
          throw new Error('Campaign generation maintenance interval must be cancellable.');
        }
      } catch (error) {
        scheduledPoll();
        throw error;
      }
      cancelPoll = scheduledPoll;
      cancelMaintenance = scheduledMaintenance;
      poll();
    },
    stopClaiming() {
      cancelPoll?.();
      cancelPoll = undefined;
      cancelMaintenance?.();
      cancelMaintenance = undefined;
      worker.stopClaiming();
    },
  });
}

function createClaimDisabledCampaignGenerationWorker(): CampaignGenerationWorkerLoop {
  let state: 'new' | 'running' | 'stopped' = 'new';
  return Object.freeze({
    get accepting() {
      return false;
    },
    get running() {
      return state === 'running';
    },
    abortActive() {
      if (state === 'running') state = 'stopped';
    },
    async drain() {},
    async runUntilIdle() {
      return 0;
    },
    start() {
      if (state === 'running') return;
      if (state === 'stopped') {
        throw new Error('A stopped campaign generation worker cannot restart.');
      }
      state = 'running';
    },
    stopClaiming() {
      if (state === 'running') state = 'stopped';
    },
  });
}

function defaultScheduleInterval(intervalMs: number, tick: () => void): () => void {
  const timer = setInterval(tick, intervalMs);
  return () => clearInterval(timer);
}

function assertTimer(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > 2_147_483_647) {
    throw new Error(`${label} must be a positive timer-safe integer.`);
  }
}

function checkedClock(clock: () => number): number {
  const value = clock();
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(
      'Campaign generation worker clock must return non-negative epoch milliseconds.',
    );
  }
  return value;
}
