import { randomUUID } from 'node:crypto';

import { HttpError } from '@mikaelcedergren/cx-framework/server/errors';
import {
  DurableJobCapacityError,
  DurableJobRetentionCapacityError,
} from '@mikaelcedergren/cx-framework/server/jobs';

import {
  CampaignRevisionConflictError,
  classifyCampaignContinuation,
  GenerationAggregateCapacityError,
  GenerationCompletedReceiptRetryError,
  GenerationRunCapacityError,
  GenerationWindowCapacityError,
  MAX_RECOVERABLE_GENERATION_RUNS,
  PersistenceRevisionConflictError,
  type CampaignRepository,
  type CreateGenerationRunInput,
  type GenerationAdmissionInput,
  type GenerationAdmissionRepository,
  type GenerationRepository,
  type GenerationRun,
  type GenerationStage,
  type StoredCampaign,
} from './campaign-repository.js';
import { isCampaignId, normalizeCampaignIdea } from './campaign-schema.js';
import {
  buildCampaignGenerationJob,
  type BuildCampaignGenerationJobInput,
} from './generation-jobs.js';
import { MAX_IDEA_CHARACTERS, MIN_IDEA_CHARACTERS } from './generation-content.js';
import type {
  CampaignMutationResult,
  GenerationAcceptance,
  GenerationService,
  GenerationStatus,
} from './http-contracts.js';

export const GENERATION_WINDOW_MS = 10 * 60 * 1_000;
export const MAX_GENERATIONS_PER_WINDOW = 30;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export interface CreateGenerationServiceOptions {
  readonly campaigns: CampaignRepository;
  readonly clock?: () => number;
  readonly createUuid?: () => string;
  readonly generationAdmission: GenerationAdmissionRepository;
  readonly generations: GenerationRepository;
  readonly providerConfigured: boolean;
}

export function createGenerationService({
  campaigns,
  clock = Date.now,
  createUuid = randomUUID,
  generationAdmission,
  generations,
  providerConfigured,
}: CreateGenerationServiceOptions): GenerationService {
  const service: GenerationService = {
    async createCampaign({ idea: rawIdea, ownerSessionIdHash }) {
      const idea = normalizedIdea(rawIdea);
      requireProvider(providerConfigured);

      const campaignId = uuid(createUuid, 'Campaign');
      const runId = uuid(createUuid, 'Generation run');
      try {
        const result = generationAdmission.admit({
          kind: 'initial',
          now: checkedClock(clock),
          policy: generationWindowPolicy(),
          run: {
            campaignId,
            expectedCampaignRevision: 0,
            job: buildCampaignGenerationJob({
              campaignId,
              expectedCampaignRevision: 0,
              idea,
              runId,
              stage: 'strategy',
            }),
            ownerSessionIdHash,
            runId,
            stage: 'strategy',
            strategyIdea: idea,
          },
        });
        requireAllowance(result);
        return acceptance(result.run, 0);
      } catch (error) {
        throw generationAdmissionError(error);
      }
    },

    async getStatus(campaignId) {
      if (!isCampaignId(campaignId)) return null;
      const run = generations.getLatestRun(campaignId);
      if (!run) return null;
      const campaignRevision = campaigns.get(campaignId)?.revision ?? 0;
      return generationStatus(run, campaignRevision);
    },

    async listRecoverableStatuses() {
      return Object.freeze(
        generations
          .listLatestRecoverableRuns({ limit: MAX_RECOVERABLE_GENERATION_RUNS })
          .map((run) => generationStatus(run, campaigns.get(run.campaignId)?.revision ?? 0)),
      );
    },

    async retryCampaign({ campaignId, expectedRevision, ownerSessionIdHash, stage }) {
      requireProvider(providerConfigured);
      const campaign = campaigns.get(campaignId);
      if (campaign) {
        if (expectedRevision !== campaign.revision) return revisionConflict(campaign.revision);
      } else if (expectedRevision !== 0) {
        return Object.freeze({ status: 'not_found' as const });
      }

      const latest = generations.getLatestRun(campaignId);
      const admission = retryAdmission(campaign, latest, stage);
      if (admission.kind === 'not_found') {
        return Object.freeze({ status: 'not_found' as const });
      }
      if (admission.kind === 'unavailable') {
        throw retryUnavailable(admission.message);
      }

      const runId = uuid(createUuid, 'Generation run');
      const strategyIdea = stage === 'strategy' ? latest?.strategyIdea : null;
      if (stage === 'strategy' && !strategyIdea) {
        throw new Error('Failed strategy generation is missing its durable normalized idea.');
      }
      const jobInput: BuildCampaignGenerationJobInput = {
        campaignId,
        expectedCampaignRevision: expectedRevision,
        ...(strategyIdea === null || strategyIdea === undefined ? {} : { idea: strategyIdea }),
        runId,
        stage,
      };
      const run: CreateGenerationRunInput = {
        attempt: admission.attempt,
        campaignId,
        expectedCampaignRevision: expectedRevision,
        job: buildCampaignGenerationJob(jobInput),
        ownerSessionIdHash,
        runId,
        stage,
        strategyIdea: strategyIdea ?? null,
      };

      try {
        const input: GenerationAdmissionInput =
          admission.kind === 'continuation'
            ? {
                kind: 'continuation',
                now: checkedClock(clock),
                policy: generationWindowPolicy(),
                run,
              }
            : {
                kind: 'retry',
                now: checkedClock(clock),
                policy: generationWindowPolicy(),
                requiredCampaignRevision: expectedRevision,
                run,
              };
        const result = generationAdmission.admit(input);
        requireAllowance(result);
        return acceptance(result.run, expectedRevision);
      } catch (error) {
        if (
          error instanceof CampaignRevisionConflictError ||
          error instanceof PersistenceRevisionConflictError
        ) {
          return currentRevisionResult(campaigns, campaignId);
        }
        throw generationAdmissionError(error);
      }
    },
  };
  return Object.freeze(service);
}

type RetryAdmission =
  | { readonly attempt: number; readonly kind: 'continuation' | 'retry' }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'unavailable'; readonly message: string };

function retryAdmission(
  campaign: StoredCampaign | null,
  latest: GenerationRun | null,
  requestedStage: GenerationStage,
): RetryAdmission {
  if (latest) {
    if (
      latest.stage !== requestedStage ||
      (latest.state !== 'failed' && latest.state !== 'ambiguous')
    ) {
      return Object.freeze({
        kind: 'unavailable' as const,
        message: 'Only the latest failed or ambiguous generation stage can be retried.',
      });
    }
    if (!campaign && requestedStage !== 'strategy') {
      return Object.freeze({ kind: 'not_found' as const });
    }
    if (campaign && requestedStage === 'strategy') {
      return Object.freeze({
        kind: 'unavailable' as const,
        message: 'Strategy cannot be regenerated after the campaign has been created.',
      });
    }
    return Object.freeze({ attempt: latest.attempt + 1, kind: 'retry' as const });
  }

  if (!campaign) return Object.freeze({ kind: 'not_found' as const });
  const stage = classifyCampaignContinuation(campaign.record);
  if (stage === null) {
    return Object.freeze({
      kind: 'unavailable' as const,
      message: 'This campaign already contains every generation stage.',
    });
  }
  if (requestedStage !== stage) {
    return Object.freeze({
      kind: 'unavailable' as const,
      message: `The campaign must continue with its ${stage} stage.`,
    });
  }
  return Object.freeze({ attempt: 1, kind: 'continuation' as const });
}

function normalizedIdea(value: string): string {
  const normalized = normalizeCampaignIdea(value);
  const length = [...normalized].length;
  if (length < MIN_IDEA_CHARACTERS || length > MAX_IDEA_CHARACTERS) {
    throw new HttpError({
      code: 'campaign_idea_invalid',
      message: `The rough idea must contain between ${String(MIN_IDEA_CHARACTERS)} and ${String(MAX_IDEA_CHARACTERS)} characters.`,
      status: 400,
    });
  }
  return normalized;
}

function requireProvider(configured: boolean): void {
  if (!configured) {
    throw new HttpError({
      code: 'generation_provider_unavailable',
      message: 'Campaign generation is not configured on this server.',
      status: 503,
    });
  }
}

function generationWindowPolicy() {
  return Object.freeze({
    maximumGenerations: MAX_GENERATIONS_PER_WINDOW,
    windowMs: GENERATION_WINDOW_MS,
  });
}

function requireAllowance<T extends { readonly allowance: { readonly retryAt: number } }>(
  result: T & ({ readonly status: 'accepted' } | { readonly status: 'rate_limited' }),
): asserts result is T & { readonly status: 'accepted' } {
  if (result.status === 'rate_limited') {
    throw new HttpError({
      code: 'generation_limit_reached',
      details: { retryAt: result.allowance.retryAt },
      message: 'The campaign generation limit has been reached. Try again in a few minutes.',
      status: 429,
    });
  }
}

function generationAdmissionError(error: unknown): unknown {
  if (error instanceof GenerationCompletedReceiptRetryError) {
    return retryUnavailable(
      'Completed provider work cannot be submitted again; its sealed receipt requires operator review.',
    );
  }
  if (error instanceof GenerationWindowCapacityError) {
    return new HttpError({
      code: 'generation_capacity_reached',
      message: 'Too many campaign generation sessions are active. Try again shortly.',
      status: 429,
    });
  }
  if (
    error instanceof DurableJobCapacityError ||
    error instanceof DurableJobRetentionCapacityError ||
    error instanceof GenerationAggregateCapacityError ||
    error instanceof GenerationRunCapacityError
  ) {
    return new HttpError({
      code: 'generation_queue_unavailable',
      message: 'The campaign generation queue is full. Try again after current work finishes.',
      status: 503,
    });
  }
  return error;
}

function acceptance(run: GenerationRun, campaignRevision: number): GenerationAcceptance {
  return Object.freeze({
    campaignId: run.campaignId,
    campaignRevision,
    jobId: run.jobId,
    state: 'queued' as const,
  });
}

function generationStatus(run: GenerationRun, campaignRevision: number): GenerationStatus {
  return Object.freeze({
    campaignId: run.campaignId,
    campaignRevision,
    ...(run.errorCode && run.errorMessage
      ? { error: Object.freeze({ code: run.errorCode, message: run.errorMessage }) }
      : {}),
    jobId: run.jobId,
    stage: run.stage,
    state: run.state,
    updatedAt: new Date(run.updatedAt).toISOString(),
  });
}

function currentRevisionResult(
  campaigns: CampaignRepository,
  campaignId: string,
): CampaignMutationResult<never> {
  const campaign = campaigns.get(campaignId);
  return campaign
    ? revisionConflict(campaign.revision)
    : Object.freeze({ status: 'not_found' as const });
}

function revisionConflict(currentRevision: number) {
  return Object.freeze({ currentRevision, status: 'revision_conflict' as const });
}

function retryUnavailable(message: string): HttpError {
  return new HttpError({ code: 'generation_retry_unavailable', message, status: 409 });
}

function uuid(createUuid: () => string, label: string): string {
  const value = createUuid();
  if (!UUID_PATTERN.test(value)) throw new Error(`${label} factory returned an invalid UUID.`);
  return value;
}

function checkedClock(clock: () => number): number {
  const value = clock();
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('Generation clock must return non-negative epoch milliseconds.');
  }
  return value;
}
