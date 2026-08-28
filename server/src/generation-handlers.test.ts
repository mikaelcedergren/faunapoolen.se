import assert from 'node:assert/strict';
import test from 'node:test';

import { DurableJobCapacityError } from '@mikaelcedergren/cx-framework/server/jobs';

import type {
  FinalizeGenerationStageInput,
  FinalizeGenerationStageResult,
  GenerationRepository,
  GenerationRun,
} from './campaign-repository.js';
import { ProviderEffectCapacityError } from './campaign-repository.js';
import {
  CAMPAIGN_GENERATION_JOB_TYPE,
  buildCampaignGenerationJob,
  campaignGenerationReceiptRecoveryIdempotencyKey,
} from './generation-jobs.js';
import {
  CampaignGenerationExecutionError,
  createCampaignGenerationHandlers,
} from './generation-handlers.js';
import type { GenerateStructuredInput, OpenAiResponsesProvider } from './openai-provider.js';
import { GenerationProviderPendingError } from './openai-provider.js';

const NOW = 1_800_000_000_000;
const CAMPAIGN_ID = '11111111-1111-4111-8111-111111111111';
const RUN_ID = '22222222-2222-4222-8222-222222222222';
const JOB_ID = 'job-generation-capacity-0001';
const IDEA = 'Build a calm synthetic nature-pool campaign for this durable boundary.';

test('final handoff capacity exhausts the run explicitly instead of leaving it active forever', async () => {
  const repository = new CapacityGenerationRepository();
  const job = buildCampaignGenerationJob({
    campaignId: CAMPAIGN_ID,
    expectedCampaignRevision: 0,
    idea: IDEA,
    runId: RUN_ID,
    stage: 'strategy',
  });
  const handlers = createCampaignGenerationHandlers({
    campaigns: {} as never,
    clock: () => NOW,
    createUuid: () => '33333333-3333-4333-8333-333333333333',
    generations: repository as unknown as GenerationRepository,
    provider: new StrategyProvider(),
  });
  const handler = handlers[CAMPAIGN_GENERATION_JOB_TYPE];
  assert.ok(handler);

  await assert.rejects(
    handler(job.payload, {
      attempt: 8,
      heartbeat: () => NOW,
      idempotencyKey: `campaign-generation:${RUN_ID}`,
      jobId: JOB_ID,
      maxAttempts: 8,
      signal: new AbortController().signal,
    }),
    (error: unknown) =>
      error instanceof CampaignGenerationExecutionError &&
      error.code === 'generation_queue_capacity' &&
      error.retryable === false,
  );
  assert.equal(repository.run.state, 'failed');
  assert.equal(repository.run.errorCode, 'generation_queue_capacity');
  assert.equal(repository.run.finishedAt, NOW);
});

test('effect-capacity exhaustion fails definitively before any provider create can cross', async () => {
  const repository = new CapacityGenerationRepository(false);
  const job = buildCampaignGenerationJob({
    campaignId: CAMPAIGN_ID,
    expectedCampaignRevision: 0,
    idea: IDEA,
    runId: RUN_ID,
    stage: 'strategy',
  });
  const handler = createCampaignGenerationHandlers({
    campaigns: {} as never,
    clock: () => NOW,
    generations: repository as unknown as GenerationRepository,
    provider: new EffectCapacityProvider(),
  })[CAMPAIGN_GENERATION_JOB_TYPE];
  assert.ok(handler);

  await assert.rejects(
    handler(job.payload, {
      attempt: 8,
      heartbeat: () => NOW,
      idempotencyKey: `campaign-generation:${RUN_ID}`,
      jobId: JOB_ID,
      maxAttempts: 8,
      signal: new AbortController().signal,
    }),
    (error: unknown) =>
      error instanceof CampaignGenerationExecutionError &&
      error.code === 'generation_queue_capacity' &&
      error.retryable === false,
  );
  assert.equal(repository.run.state, 'failed');
  assert.equal(repository.run.errorCode, 'generation_queue_capacity');
});

test('invalid or altered job input fails only the run associated with the trusted claim job id', async (t) => {
  for (const scenario of [
    { code: 'invalid_job_payload', name: 'invalid shape', payload: {} },
    {
      code: 'generation_run_conflict',
      name: 'altered valid idea',
      payload: buildCampaignGenerationJob({
        campaignId: CAMPAIGN_ID,
        expectedCampaignRevision: 0,
        idea: 'A different but valid synthetic idea that must never replace the durable lineage.',
        runId: RUN_ID,
        stage: 'strategy',
      }).payload,
    },
  ] as const) {
    await t.test(scenario.name, async () => {
      const repository = new CapacityGenerationRepository(false);
      const provider = new StrategyProvider();
      const handlers = createCampaignGenerationHandlers({
        campaigns: {} as never,
        clock: () => NOW,
        generations: repository as unknown as GenerationRepository,
        provider,
      });
      const handler = handlers[CAMPAIGN_GENERATION_JOB_TYPE];
      assert.ok(handler);

      await assert.rejects(
        handler(scenario.payload, {
          attempt: 1,
          heartbeat: () => NOW,
          idempotencyKey: `campaign-generation:${RUN_ID}`,
          jobId: JOB_ID,
          maxAttempts: 8,
          signal: new AbortController().signal,
        }),
        (error: unknown) =>
          error instanceof CampaignGenerationExecutionError &&
          error.code === scenario.code &&
          error.retryable === false,
      );
      assert.equal(repository.run.state, 'failed');
      assert.equal(repository.run.errorCode, scenario.code);
      assert.equal(provider.calls, 0);
      assert.equal(
        repository.lookedUpJobIds.every((jobId) => jobId === JOB_ID),
        true,
      );
    });
  }
});

test('a recovery-shaped key is rejected unless the exact job identity is persisted', async () => {
  const repository = new CapacityGenerationRepository(false);
  const provider = new StrategyProvider();
  const job = buildCampaignGenerationJob({
    campaignId: CAMPAIGN_ID,
    expectedCampaignRevision: 0,
    idea: IDEA,
    runId: RUN_ID,
    stage: 'strategy',
  });
  const handler = createCampaignGenerationHandlers({
    campaigns: {} as never,
    clock: () => NOW,
    generations: repository as unknown as GenerationRepository,
    provider,
  })[CAMPAIGN_GENERATION_JOB_TYPE];
  assert.ok(handler);

  await assert.rejects(
    handler(job.payload, {
      attempt: 1,
      heartbeat: () => NOW,
      idempotencyKey: campaignGenerationReceiptRecoveryIdempotencyKey(RUN_ID),
      jobId: JOB_ID,
      maxAttempts: 8,
      signal: new AbortController().signal,
    }),
    (error: unknown) =>
      error instanceof CampaignGenerationExecutionError &&
      error.code === 'generation_run_conflict' &&
      error.retryable === false,
  );
  assert.deepEqual(repository.recoveryChecks, [{ jobId: JOB_ID, runId: RUN_ID }]);
  assert.equal(repository.run.state, 'failed');
  assert.equal(provider.calls, 0);
});

test('exhausted polling quarantines the durable receipt and run as ambiguous without replay', async () => {
  const repository = new CapacityGenerationRepository(false);
  const provider = new PendingProvider();
  const job = buildCampaignGenerationJob({
    campaignId: CAMPAIGN_ID,
    expectedCampaignRevision: 0,
    idea: IDEA,
    runId: RUN_ID,
    stage: 'strategy',
  });
  const handler = createCampaignGenerationHandlers({
    campaigns: {} as never,
    clock: () => NOW,
    generations: repository as unknown as GenerationRepository,
    provider,
  })[CAMPAIGN_GENERATION_JOB_TYPE];
  assert.ok(handler);
  const context = {
    attempt: 8,
    heartbeat: () => NOW,
    idempotencyKey: `campaign-generation:${RUN_ID}`,
    jobId: JOB_ID,
    maxAttempts: 8,
    signal: new AbortController().signal,
  };

  await assert.rejects(
    handler(job.payload, context),
    (error: unknown) =>
      error instanceof CampaignGenerationExecutionError &&
      error.code === 'provider_poll_ambiguous' &&
      error.retryable === false,
  );
  assert.equal(repository.run.state, 'ambiguous');
  assert.equal(repository.run.errorCode, 'provider_poll_ambiguous');
  assert.deepEqual(provider.quarantined, ['effect-pending-0001']);

  provider.lateCompletionReady = true;
  await assert.rejects(handler(job.payload, context), /automatic polling budget/iu);
  assert.equal(provider.calls, 1);
});

class CapacityGenerationRepository {
  readonly failSuccessfulFinalization: boolean;
  readonly lookedUpJobIds: string[] = [];
  readonly recoveryChecks: Array<{ readonly jobId: string; readonly runId: string }> = [];
  run: GenerationRun = Object.freeze({
    attempt: 1,
    campaignId: CAMPAIGN_ID,
    createdAt: NOW,
    errorCode: null,
    errorMessage: null,
    expectedCampaignRevision: 0,
    finishedAt: null,
    jobId: JOB_ID,
    ownerSessionIdHash: 'a'.repeat(64),
    revision: 1,
    runId: RUN_ID,
    runSequence: 1,
    stage: 'strategy',
    state: 'queued',
    strategyIdea: IDEA,
    updatedAt: NOW,
  });

  constructor(failSuccessfulFinalization = true) {
    this.failSuccessfulFinalization = failSuccessfulFinalization;
  }

  finalizeStage(input: FinalizeGenerationStageInput): FinalizeGenerationStageResult {
    assert.equal(input.runId, RUN_ID);
    assert.equal(input.expectedRunRevision, this.run.revision);
    if (input.outcome.state === 'succeeded' && this.failSuccessfulFinalization) {
      throw new DurableJobCapacityError(1);
    }
    if (input.outcome.state === 'succeeded') {
      throw new Error('Synthetic corruption cleanup unexpectedly attempted a successful outcome.');
    }
    this.run = Object.freeze({
      ...this.run,
      errorCode: input.outcome.errorCode,
      errorMessage: input.outcome.errorMessage,
      finishedAt: NOW,
      revision: this.run.revision + 1,
      state: input.outcome.state,
    });
    return Object.freeze({ campaign: null, finalizedRun: this.run, nextRun: null });
  }

  getRun(runId: string): GenerationRun | null {
    return runId === RUN_ID ? this.run : null;
  }

  getRunByJobId(jobId: string): GenerationRun | null {
    this.lookedUpJobIds.push(jobId);
    return jobId === JOB_ID ? this.run : null;
  }

  isReceiptRecoveryJob(input: { readonly jobId: string; readonly runId: string }): boolean {
    this.recoveryChecks.push(input);
    return false;
  }

  transitionRun(input: Parameters<GenerationRepository['transitionRun']>[0]): GenerationRun {
    assert.equal(input.runId, RUN_ID);
    assert.equal(input.expectedRevision, this.run.revision);
    this.run = Object.freeze({
      ...this.run,
      revision: this.run.revision + 1,
      state: input.state,
    });
    return this.run;
  }
}

class StrategyProvider implements OpenAiResponsesProvider {
  calls = 0;

  async generateStructured<Result>(input: GenerateStructuredInput<Result>): Promise<Result> {
    this.calls += 1;
    const generation = input.spec();
    assert.equal(generation.operation, 'campaign.strategy');
    const validated = generation.validate({
      assumptions: [],
      audience: 'Swedish homeowners who want a calmer water garden',
      desiredOutcome: 'A calm garden with one credible first step',
      externalProblem: 'They do not know where to begin',
      internalProblem: 'The project feels risky and complicated',
      name: 'A calmer water garden',
      plan: ['Describe the garden', 'Choose the water form', 'Plan the first step'],
      rationale: [
        {
          ruleIds: ['hero-is-customer'],
          topic: 'audience',
          why: 'Keep the homeowner at the centre.',
        },
        {
          ruleIds: ['outcome-first'],
          topic: 'desiredOutcome',
          why: 'Lead with the calmer garden.',
        },
        {
          ruleIds: ['three-step-plan'],
          topic: 'plan',
          why: 'Make the first path manageable.',
        },
      ],
      singleMessage: 'A calm water garden begins with one practical first step.',
    });
    if (!validated.ok) throw new Error(validated.error);
    return validated.value as Result;
  }

  quarantinePending(): void {}
}

class PendingProvider implements OpenAiResponsesProvider {
  calls = 0;
  lateCompletionReady = false;
  readonly quarantined: string[] = [];

  async generateStructured<Result>(): Promise<Result> {
    this.calls += 1;
    if (this.lateCompletionReady) {
      throw new Error('A quarantined late completion must never be fetched automatically.');
    }
    throw new GenerationProviderPendingError(
      'effect-pending-0001',
      'provider_poll_pending',
      'The synthetic provider response remains in progress.',
    );
  }

  quarantinePending(effectId: string): void {
    this.quarantined.push(effectId);
  }
}

class EffectCapacityProvider implements OpenAiResponsesProvider {
  async generateStructured<Result>(): Promise<Result> {
    throw new ProviderEffectCapacityError();
  }

  quarantinePending(): void {}
}
