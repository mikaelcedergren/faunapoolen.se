import { randomUUID } from 'node:crypto';

import {
  DurableJobCapacityError,
  DurableJobRetentionCapacityError,
  type DurableJobDisposition,
  type DurableJobExecutionContext,
  type DurableJobHandler,
} from '@mikaelcedergren/cx-framework/server/jobs';

import {
  CampaignCapacityError,
  CampaignRevisionConflictError,
  GenerationAggregateCapacityError,
  GenerationRunCapacityError,
  PersistenceRevisionConflictError,
  ProviderEffectCapacityError,
  type CampaignRepository,
  type CampaignStageMutation,
  type CreateGenerationRunInput,
  type GenerationRepository,
  type GenerationRun,
  type GenerationStageOutcome,
  type StoredCampaign,
} from './campaign-repository.js';
import {
  CAMPAIGN_LANGUAGES,
  validateCampaignRecord,
  type CampaignCopy,
  type CampaignLanguage,
  type CampaignRecord,
} from './campaign-schema.js';
import {
  buildCampaignGenerationJob,
  CAMPAIGN_GENERATION_JOB_TYPE,
  CampaignGenerationJobInputError,
  campaignGenerationReceiptRecoveryIdempotencyKey,
  parseCampaignGenerationJob,
  type CampaignGenerationJobPayload,
} from './generation-jobs.js';
import {
  buildCampaignImagePrompts,
  copyGenerationSpec,
  imagePromptsGenerationSpec,
  strategyGenerationSpec,
} from './generation-content.js';
import {
  GenerationProviderPendingError,
  GenerationProviderTerminalError,
  type OpenAiResponsesProvider,
} from './openai-provider.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const WORKER_STOP_RECHECK_MS = 1_000;

type TerminalGenerationStageOutcome = Exclude<
  GenerationStageOutcome,
  { readonly state: 'succeeded' }
>;

export interface CreateCampaignGenerationHandlersOptions {
  readonly campaigns: CampaignRepository;
  readonly clock?: () => number;
  readonly createUuid?: () => string;
  readonly generations: GenerationRepository;
  readonly provider: OpenAiResponsesProvider;
}

export class CampaignGenerationExecutionError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable: boolean, options: ErrorOptions = {}) {
    assertSafeFailure(code, message);
    super(message, options);
    this.name = 'CampaignGenerationExecutionError';
    this.code = code;
    this.retryable = retryable;
  }
}

export function createCampaignGenerationHandlers({
  campaigns,
  clock = Date.now,
  createUuid = randomUUID,
  generations,
  provider,
}: CreateCampaignGenerationHandlersOptions): Readonly<Record<string, DurableJobHandler>> {
  const handler: DurableJobHandler = async (rawPayload, context) => {
    let payload: CampaignGenerationJobPayload;
    try {
      payload = parseCampaignGenerationJob(rawPayload);
    } catch (error) {
      failAssociatedRun(
        context.jobId,
        'invalid_job_payload',
        'The campaign generation job payload is invalid.',
      );
      throw new CampaignGenerationExecutionError(
        'invalid_job_payload',
        'The campaign generation job payload is invalid.',
        false,
        { cause: error },
      );
    }
    let run = generations.getRunByJobId(context.jobId);
    if (!run || !runMatchesJob(run, payload, context, generations)) {
      failAssociatedRun(
        context.jobId,
        'generation_run_conflict',
        'The durable generation run does not match its immutable job.',
      );
      throw new CampaignGenerationExecutionError(
        'generation_run_conflict',
        'The durable generation run does not match its immutable job.',
        false,
      );
    }
    if (run.state === 'succeeded') return;
    if (run.state === 'failed' || run.state === 'ambiguous') {
      throw new CampaignGenerationExecutionError(
        run.errorCode ?? 'generation_failed',
        run.errorMessage ?? 'Campaign generation did not complete.',
        false,
      );
    }
    if (run.state === 'queued') {
      run = generations.transitionRun({
        expectedRevision: run.revision,
        runId: run.runId,
        state: 'running',
      });
    }

    try {
      if (payload.stage === 'strategy') {
        await executeStrategy(payload, run, context);
      } else if (payload.stage === 'copy') {
        await executeCopy(payload, run, context);
      } else {
        await executePrompts(payload, run, context);
      }
    } catch (error) {
      if (error instanceof CampaignGenerationExecutionError) throw error;
      if (
        error instanceof DurableJobCapacityError ||
        error instanceof DurableJobRetentionCapacityError ||
        error instanceof GenerationAggregateCapacityError ||
        error instanceof GenerationRunCapacityError ||
        error instanceof ProviderEffectCapacityError
      ) {
        if (context.attempt >= context.maxAttempts) {
          const current = generations.getRun(run.runId);
          if (current?.state === 'running') {
            terminalizeRun(current, {
              errorCode: 'generation_queue_capacity',
              errorMessage:
                'Campaign generation could not hand off before its durable retry budget ended.',
              state: 'failed',
            });
          }
          throw new CampaignGenerationExecutionError(
            'generation_queue_capacity',
            'Campaign generation could not hand off before its durable retry budget ended.',
            false,
            { cause: error },
          );
        }
        throw new CampaignGenerationExecutionError(
          'generation_queue_capacity',
          'The next campaign generation stage is waiting for durable queue capacity.',
          true,
          { cause: error },
        );
      }
      if (error instanceof CampaignRevisionConflictError) {
        const current = generations.getRun(run.runId);
        if (current?.state === 'succeeded') return;
        if (current?.state === 'failed' || current?.state === 'ambiguous') {
          throw new CampaignGenerationExecutionError(
            current.errorCode ?? 'generation_failed',
            current.errorMessage ?? 'Campaign generation did not complete.',
            false,
            { cause: error },
          );
        }
        if (current?.state === 'running') {
          terminalizeRun(current, {
            errorCode: 'campaign_revision_conflict',
            errorMessage: 'The campaign changed before generation could be saved.',
            state: 'failed',
          });
        }
      }
      if (error instanceof PersistenceRevisionConflictError) {
        const current = generations.getRun(run.runId);
        if (current?.state === 'succeeded') return;
        if (current?.state === 'failed' || current?.state === 'ambiguous') {
          throw new CampaignGenerationExecutionError(
            current.errorCode ?? 'generation_failed',
            current.errorMessage ?? 'Campaign generation did not complete.',
            false,
            { cause: error },
          );
        }
        if (context.attempt < context.maxAttempts) {
          throw new CampaignGenerationExecutionError(
            'generation_revision_conflict',
            'Campaign generation changed concurrently and will be checked again.',
            true,
            { cause: error },
          );
        }
      }
      if (error instanceof CampaignCapacityError) {
        const current = generations.getRun(run.runId);
        if (current?.state === 'running') {
          terminalizeRun(current, {
            errorCode: 'campaign_capacity_reached',
            errorMessage: 'Campaign storage is full. Delete a campaign before trying again.',
            state: 'failed',
          });
        }
      }
      if (context.attempt < context.maxAttempts) {
        throw new CampaignGenerationExecutionError(
          'generation_unexpected',
          'Campaign generation stopped unexpectedly and will retry from its durable state.',
          true,
          { cause: error },
        );
      }
      const current = generations.getRun(run.runId);
      if (current?.state === 'running') {
        terminalizeRun(current, {
          errorCode: 'generation_unexpected',
          errorMessage: 'Campaign generation stopped at an unexpected durable boundary.',
          state: 'ambiguous',
        });
      }
      throw new CampaignGenerationExecutionError(
        'generation_unexpected',
        'Campaign generation stopped at an unexpected durable boundary.',
        false,
        { cause: error },
      );
    }
  };

  async function executeStrategy(
    _payload: CampaignGenerationJobPayload,
    run: GenerationRun,
    context: DurableJobExecutionContext,
  ): Promise<void> {
    const strategyIdea = run.strategyIdea;
    if (!strategyIdea) {
      throw new CampaignGenerationJobInputError('Durable strategy idea is missing.');
    }
    let strategy;
    try {
      strategy = await provider.generateStructured({
        runId: run.runId,
        signal: context.signal,
        spec: (correction) => strategyGenerationSpec(strategyIdea, correction),
      });
    } catch (error) {
      terminalizeProviderFailure(run, error, context);
    }
    const timestamp = timestampAt(checkedClock(clock));
    const campaign = validateCampaignRecord({
      copy: {},
      createdAt: timestamp,
      idea: strategyIdea,
      id: run.campaignId,
      imagePrompts: [],
      name: strategy.name,
      stage: 'strategy',
      strategy,
      updatedAt: timestamp,
    });
    const nextRun = nextRunInput(run, 'copy', 1);
    generations.finalizeStage({
      expectedRunRevision: run.revision,
      outcome: {
        campaign: { kind: 'create', record: campaign },
        nextRun,
        state: 'succeeded',
      },
      runId: run.runId,
    });
  }

  async function executeCopy(
    _payload: CampaignGenerationJobPayload,
    run: GenerationRun,
    context: DurableJobExecutionContext,
  ): Promise<void> {
    const stored = requiredCampaign(run);
    const missing = CAMPAIGN_LANGUAGES.filter(
      (language) => stored.record.copy[language] === undefined,
    );
    const settled = await Promise.allSettled(
      missing.map(async (language) =>
        Object.freeze({
          copy: await provider.generateStructured({
            runId: run.runId,
            signal: context.signal,
            spec: (correction) => copyGenerationSpec(stored.record.strategy, language, correction),
          }),
          language,
        }),
      ),
    );

    const copy: Partial<Record<CampaignLanguage, CampaignCopy>> = {
      ...stored.record.copy,
    };
    const failures: GenerationProviderTerminalError[] = [];
    for (const [index, result] of settled.entries()) {
      const language = missing[index];
      if (!language) throw new Error('Copy generation result lost its language identity.');
      if (result.status === 'fulfilled') {
        copy[language] = result.value.copy;
        continue;
      }
      failures.push(providerFailure(result.reason, context));
    }

    if (failures.length > 0) {
      const changed = Object.keys(copy).length > Object.keys(stored.record.copy).length;
      const outcome = aggregateCopyFailure(
        failures,
        changed ? partialCopy(stored, copy, checkedClock(clock)) : undefined,
      );
      terminalizeRun(run, outcome);
    }

    const hasPrompts = stored.record.imagePrompts.length > 0;
    const record = validateCampaignRecord({
      ...stored.record,
      copy,
      stage: hasPrompts ? 'complete' : 'copy',
      updatedAt: nextTimestamp(stored.record, checkedClock(clock)),
    });
    const nextRun = hasPrompts ? undefined : nextRunInput(run, 'prompts', stored.revision + 1);
    generations.finalizeStage({
      expectedRunRevision: run.revision,
      outcome: {
        campaign: { expectedRevision: stored.revision, kind: 'replace', record },
        ...(nextRun === undefined ? {} : { nextRun }),
        state: 'succeeded',
      },
      runId: run.runId,
    });
  }

  async function executePrompts(
    _payload: CampaignGenerationJobPayload,
    run: GenerationRun,
    context: DurableJobExecutionContext,
  ): Promise<void> {
    const stored = requiredCampaign(run);
    let generated;
    try {
      generated = await provider.generateStructured({
        runId: run.runId,
        signal: context.signal,
        spec: (correction) => imagePromptsGenerationSpec(stored.record.strategy, correction),
      });
    } catch (error) {
      terminalizeProviderFailure(run, error, context);
    }
    const record = validateCampaignRecord({
      ...stored.record,
      imagePrompts: buildCampaignImagePrompts(generated),
      stage: 'complete',
      updatedAt: nextTimestamp(stored.record, checkedClock(clock)),
    });
    generations.finalizeStage({
      expectedRunRevision: run.revision,
      outcome: {
        campaign: { expectedRevision: stored.revision, kind: 'replace', record },
        state: 'succeeded',
      },
      runId: run.runId,
    });
  }

  function requiredCampaign(run: GenerationRun): StoredCampaign {
    const campaign = campaigns.get(run.campaignId);
    if (!campaign) {
      terminalizeRun(run, {
        errorCode: 'campaign_not_found',
        errorMessage: 'The campaign no longer exists for this generation stage.',
        state: 'failed',
      });
    }
    if (campaign.revision !== run.expectedCampaignRevision) {
      terminalizeRun(run, {
        errorCode: 'campaign_revision_conflict',
        errorMessage: 'The campaign changed before this generation stage could run.',
        state: 'failed',
      });
    }
    return campaign;
  }

  function failAssociatedRun(jobId: string, errorCode: string, errorMessage: string): void {
    let associated = generations.getRunByJobId(jobId);
    if (!associated || ['succeeded', 'failed', 'ambiguous'].includes(associated.state)) return;
    if (associated.state === 'queued') {
      associated = generations.transitionRun({
        expectedRevision: associated.revision,
        runId: associated.runId,
        state: 'running',
      });
    }
    generations.finalizeStage({
      expectedRunRevision: associated.revision,
      outcome: { errorCode, errorMessage, state: 'failed' },
      runId: associated.runId,
    });
  }

  function terminalizeProviderFailure(
    run: GenerationRun,
    error: unknown,
    context: DurableJobExecutionContext,
  ): never {
    const terminal = providerFailure(error, context);
    terminalizeRun(run, {
      errorCode: terminal.code,
      errorMessage: terminal.message,
      state: terminal.outcome,
    });
  }

  function providerFailure(
    error: unknown,
    context: DurableJobExecutionContext,
  ): GenerationProviderTerminalError {
    if (error instanceof GenerationProviderTerminalError) return error;
    if (error instanceof ProviderEffectCapacityError) {
      if (context.attempt < context.maxAttempts) {
        throw new CampaignGenerationExecutionError(
          'generation_queue_capacity',
          'Provider receipt storage is waiting for bounded maintenance.',
          true,
          { cause: error },
        );
      }
      return new GenerationProviderTerminalError(
        'generation_queue_capacity',
        'Provider receipt storage remained full through the durable retry budget.',
        'failed',
        { cause: error },
      );
    }
    if (error instanceof GenerationProviderPendingError) {
      if (error.code === 'worker_stopping') {
        throw new CampaignGenerationExecutionError(error.code, error.message, true, {
          cause: error,
        });
      }
      if (context.attempt < context.maxAttempts) {
        throw new CampaignGenerationExecutionError(error.code, error.message, true, {
          cause: error,
        });
      }
      provider.quarantinePending(
        error.effectId,
        'provider_poll_ambiguous',
        'The provider response did not finish within the automatic polling budget. Check the existing provider response before choosing a retry.',
      );
      return new GenerationProviderTerminalError(
        'provider_poll_ambiguous',
        'The provider response did not finish within the automatic polling budget. Check the existing provider response before choosing a retry.',
        'ambiguous',
        { cause: error },
      );
    }
    if (context.attempt < context.maxAttempts) {
      throw new CampaignGenerationExecutionError(
        'generation_unexpected',
        'Campaign generation stopped unexpectedly and will retry from its durable receipts.',
        true,
        { cause: error },
      );
    }
    return new GenerationProviderTerminalError(
      'generation_unexpected',
      'Campaign generation stopped at an ambiguous provider boundary.',
      'ambiguous',
      { cause: error },
    );
  }

  function terminalizeRun(run: GenerationRun, outcome: TerminalGenerationStageOutcome): never {
    generations.finalizeStage({
      expectedRunRevision: run.revision,
      outcome,
      runId: run.runId,
    });
    throw new CampaignGenerationExecutionError(outcome.errorCode, outcome.errorMessage, false);
  }

  function nextRunInput(
    current: GenerationRun,
    stage: Exclude<CampaignGenerationJobPayload['stage'], 'strategy'>,
    expectedCampaignRevision: number,
  ): CreateGenerationRunInput {
    const runId = uuid(createUuid, 'Generation run');
    return Object.freeze({
      campaignId: current.campaignId,
      expectedCampaignRevision,
      job: buildCampaignGenerationJob({
        campaignId: current.campaignId,
        expectedCampaignRevision,
        runId,
        stage,
      }),
      ownerSessionIdHash: current.ownerSessionIdHash,
      runId,
      stage,
      strategyIdea: null,
    });
  }

  return Object.freeze({ [CAMPAIGN_GENERATION_JOB_TYPE]: handler });
}

function aggregateCopyFailure(
  failures: readonly GenerationProviderTerminalError[],
  campaign: CampaignStageMutation | undefined,
): TerminalGenerationStageOutcome {
  const ambiguous = failures.some((failure) => failure.outcome === 'ambiguous');
  return Object.freeze({
    ...(campaign === undefined ? {} : { campaign }),
    errorCode: ambiguous ? 'campaign_copy_ambiguous' : 'campaign_copy_incomplete',
    errorMessage: ambiguous
      ? 'Some campaign copy has an ambiguous provider outcome and needs a targeted retry.'
      : 'Some campaign copy could not be written and needs a targeted retry.',
    state: ambiguous ? ('ambiguous' as const) : ('failed' as const),
  });
}

function partialCopy(
  stored: StoredCampaign,
  copy: Readonly<Partial<Record<CampaignLanguage, CampaignCopy>>>,
  current: number,
): CampaignStageMutation {
  return Object.freeze({
    expectedRevision: stored.revision,
    kind: 'replace' as const,
    record: validateCampaignRecord({
      ...stored.record,
      copy,
      stage: 'copy',
      updatedAt: nextTimestamp(stored.record, current),
    }),
  });
}

function runMatchesJob(
  run: GenerationRun,
  payload: CampaignGenerationJobPayload,
  context: DurableJobExecutionContext,
  generations: GenerationRepository,
): boolean {
  const expectedStandardKey = `campaign-generation:${payload.runId}`;
  const expectedRecoveryKey = campaignGenerationReceiptRecoveryIdempotencyKey(payload.runId);
  const idempotencyMatches =
    context.idempotencyKey === expectedStandardKey ||
    (context.idempotencyKey === expectedRecoveryKey &&
      generations.isReceiptRecoveryJob({ jobId: context.jobId, runId: payload.runId }));
  return (
    run.campaignId === payload.campaignId &&
    run.expectedCampaignRevision === payload.expectedCampaignRevision &&
    run.jobId === context.jobId &&
    run.runId === payload.runId &&
    run.stage === payload.stage &&
    (run.stage === 'strategy'
      ? run.strategyIdea === payload.idea
      : run.strategyIdea === null && payload.idea === undefined) &&
    idempotencyMatches
  );
}

export function classifyCampaignGenerationFailure(
  error: unknown,
  now: number = Date.now(),
): DurableJobDisposition {
  if (
    !Number.isSafeInteger(now) ||
    now < 0 ||
    now > Number.MAX_SAFE_INTEGER - WORKER_STOP_RECHECK_MS
  ) {
    throw new Error('Generation failure clock must return safe epoch milliseconds.');
  }
  if (error instanceof CampaignGenerationExecutionError) {
    if (error.code === 'worker_stopping') {
      return Object.freeze({
        availableAt: now + WORKER_STOP_RECHECK_MS,
        code: error.code,
        message: error.message,
        type: 'delay' as const,
      });
    }
    return Object.freeze({
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    });
  }
  return Object.freeze({
    code: 'generation_job_failed',
    message: 'The campaign generation job stopped unexpectedly.',
    retryable: true,
  });
}

function nextTimestamp(record: CampaignRecord, current: number): string {
  const previous = Date.parse(record.updatedAt);
  return timestampAt(Math.max(previous, current));
}

function timestampAt(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0 || value > 8_640_000_000_000_000) {
    throw new Error('Campaign timestamp is outside the supported range.');
  }
  return new Date(value).toISOString();
}

function checkedClock(clock: () => number): number {
  const value = clock();
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('Campaign generation clock must return non-negative epoch milliseconds.');
  }
  return value;
}

function uuid(createUuid: () => string, label: string): string {
  const value = createUuid();
  if (!UUID_PATTERN.test(value)) throw new Error(`${label} factory returned an invalid UUID.`);
  return value;
}

function assertSafeFailure(code: string, message: string): void {
  if (!/^[a-z][a-z0-9_]{0,127}$/u.test(code)) {
    throw new Error('Campaign generation failure code is invalid.');
  }
  if (
    !message ||
    message !== message.trim() ||
    message.length > 2_048 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(message)
  ) {
    throw new Error('Campaign generation failure message is invalid.');
  }
}
