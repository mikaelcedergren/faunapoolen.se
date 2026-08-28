import type { JsonValue } from '@mikaelcedergren/cx-framework/server/errors';
import type { EnqueueDurableJob } from '@mikaelcedergren/cx-framework/server/jobs';

import { isCampaignId, normalizeCampaignIdea } from './campaign-schema.js';
import { MAX_IDEA_CHARACTERS, MIN_IDEA_CHARACTERS } from './generation-content.js';
import type { GenerationStage } from './campaign-repository.js';

export const CAMPAIGN_GENERATION_JOB_TYPE = 'faunapoolen.campaign_generation';
export const CAMPAIGN_GENERATION_JOB_VERSION = 1;
export const CAMPAIGN_GENERATION_MAX_ATTEMPTS = 8;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export type CampaignGenerationJobPayload = Readonly<{
  campaignId: string;
  expectedCampaignRevision: number;
  idea?: string;
  runId: string;
  stage: GenerationStage;
  version: 1;
}>;

export interface BuildCampaignGenerationJobInput {
  readonly campaignId: string;
  readonly expectedCampaignRevision: number;
  readonly idea?: string;
  readonly runId: string;
  readonly stage: GenerationStage;
}

export function campaignGenerationReceiptRecoveryIdempotencyKey(runId: string): string {
  if (!UUID_PATTERN.test(runId)) {
    throw new CampaignGenerationJobInputError(
      'Campaign generation receipt recovery run ID is invalid.',
    );
  }
  return `campaign-generation-receipt-recovery:${runId}`;
}

/**
 * Build the immutable input shared by the HTTP enqueue path and the worker parser. The untrusted
 * idea exists only on the strategy job and its immutable generation run; every later stage reloads
 * the trusted strategy from the campaign repository.
 */
export function buildCampaignGenerationJob(
  input: BuildCampaignGenerationJobInput,
): EnqueueDurableJob {
  const payload = campaignGenerationJobPayload({
    ...input,
    version: CAMPAIGN_GENERATION_JOB_VERSION,
  });
  return Object.freeze({
    idempotencyKey: `campaign-generation:${payload.runId}`,
    maxAttempts: CAMPAIGN_GENERATION_MAX_ATTEMPTS,
    payload: payload as JsonValue,
    type: CAMPAIGN_GENERATION_JOB_TYPE,
  });
}

export function parseCampaignGenerationJob(payload: JsonValue): CampaignGenerationJobPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new CampaignGenerationJobInputError('Campaign generation payload must be an object.');
  }
  return campaignGenerationJobPayload(payload as Record<string, JsonValue>);
}

export class CampaignGenerationJobInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CampaignGenerationJobInputError';
  }
}

function campaignGenerationJobPayload(
  input: Readonly<Record<string, unknown>>,
): CampaignGenerationJobPayload {
  const stage = input['stage'];
  if (stage !== 'strategy' && stage !== 'copy' && stage !== 'prompts') {
    throw new CampaignGenerationJobInputError(
      'Campaign generation stage must be strategy, copy, or prompts.',
    );
  }
  const expectedKeys = [
    'campaignId',
    'expectedCampaignRevision',
    ...(stage === 'strategy' ? ['idea'] : []),
    'runId',
    'stage',
    'version',
  ].sort();
  const actualKeys = Object.keys(input).sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new CampaignGenerationJobInputError(
      `Campaign generation payload must contain exactly: ${expectedKeys.join(', ')}.`,
    );
  }
  if (input['version'] !== CAMPAIGN_GENERATION_JOB_VERSION) {
    throw new CampaignGenerationJobInputError('Campaign generation payload version is invalid.');
  }
  const campaignId = input['campaignId'];
  if (!isCampaignId(campaignId)) {
    throw new CampaignGenerationJobInputError('Campaign generation campaign ID is invalid.');
  }
  const runId = input['runId'];
  if (typeof runId !== 'string' || !UUID_PATTERN.test(runId)) {
    throw new CampaignGenerationJobInputError('Campaign generation run ID is invalid.');
  }
  const expectedCampaignRevision = input['expectedCampaignRevision'];
  if (
    !Number.isSafeInteger(expectedCampaignRevision) ||
    (expectedCampaignRevision as number) < 0 ||
    ((expectedCampaignRevision as number) === 0) !== (stage === 'strategy')
  ) {
    throw new CampaignGenerationJobInputError(
      'Campaign generation expected revision does not match its stage.',
    );
  }

  let idea: string | undefined;
  if (stage === 'strategy') {
    const candidate = input['idea'];
    if (typeof candidate !== 'string') {
      throw new CampaignGenerationJobInputError('Strategy generation requires a durable idea.');
    }
    idea = normalizeCampaignIdea(candidate);
    if (
      idea !== candidate ||
      [...idea].length < MIN_IDEA_CHARACTERS ||
      [...idea].length > MAX_IDEA_CHARACTERS
    ) {
      throw new CampaignGenerationJobInputError('Strategy generation idea is invalid.');
    }
  }

  return Object.freeze({
    campaignId,
    expectedCampaignRevision: expectedCampaignRevision as number,
    ...(idea === undefined ? {} : { idea }),
    runId,
    stage,
    version: CAMPAIGN_GENERATION_JOB_VERSION,
  });
}
