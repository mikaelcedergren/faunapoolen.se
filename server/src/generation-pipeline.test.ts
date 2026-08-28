import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';

import { HttpError } from '@mikaelcedergren/cx-framework/server/errors';

import {
  createFaunapoolenPersistence,
  insertImportedCampaign,
  type FaunapoolenPersistence,
} from './campaign-repository.js';
import {
  canonicalCampaignBytes,
  sha256Hex,
  validateCampaignRecord,
  type CampaignCopy,
  type CampaignImagePrompt,
  type CampaignRecord,
  type CampaignStrategy,
} from './campaign-schema.js';
import { buildCampaignImagePrompts, type GeneratedImageScenes } from './generation-content.js';
import { createGenerationService } from './generation-service.js';
import { createCampaignGenerationWorker } from './generation-worker.js';
import {
  GenerationProviderTerminalError,
  type GenerateStructuredInput,
  type OpenAiResponsesProvider,
} from './openai-provider.js';

const NOW = Date.UTC(2026, 7, 25, 14, 0, 0);
const OWNER_HASH = 'a'.repeat(64);

test('durable worker completes strategy, bilingual copy, and prompts through atomic handoffs', async (t) => {
  const persistence = fixture(t);
  const ids = uuidFactory(100);
  const provider = new SyntheticProvider();
  const service = createGenerationService({
    campaigns: persistence.campaigns,
    clock: () => NOW,
    createUuid: ids,
    generationAdmission: persistence.generationAdmission,
    generations: persistence.generations,
    providerConfigured: true,
  });
  const accepted = await service.createCampaign({
    idea: 'Create a calm nature pool campaign',
    ownerSessionIdHash: OWNER_HASH,
  });
  assert.equal(accepted.campaignRevision, 0);

  const worker = createCampaignGenerationWorker({
    campaigns: persistence.campaigns,
    clock: () => NOW,
    createUuid: ids,
    generations: persistence.generations,
    maintenance: persistence.generationMaintenance,
    owner: 'faunapoolen-worker-pipeline-0001',
    provider,
    store: persistence.jobs,
  });
  assert.equal(await worker.runUntilIdle(), 3);

  const campaign = persistence.campaigns.get(accepted.campaignId);
  assert.ok(campaign);
  assert.equal(campaign.record.stage, 'complete');
  assert.deepEqual(Object.keys(campaign.record.copy).sort(), ['en', 'sv']);
  assert.equal(campaign.record.imagePrompts.length, 3);
  assert.equal(campaign.revision, 3);
  assert.deepEqual(provider.operations, [
    'campaign.strategy',
    'campaign.copy.sv',
    'campaign.copy.en',
    'campaign.image_prompts',
  ]);
  assert.doesNotMatch(provider.inputs.get('campaign.copy.sv') ?? '', /nature pool campaign/u);

  const status = await service.getStatus(accepted.campaignId);
  assert.equal(status?.stage, 'prompts');
  assert.equal(status?.state, 'succeeded');
  assert.equal(status?.campaignRevision, 3);
  assert.equal(persistence.jobs.get(accepted.jobId)?.status, 'succeeded');
});

test('one-language copy is preserved, then targeted retry generates only the missing language', async (t) => {
  const persistence = fixture(t);
  const ids = uuidFactory(200);
  const provider = new SyntheticProvider();
  provider.failures.set(
    'campaign.copy.en',
    new GenerationProviderTerminalError(
      'provider_generation_failed',
      'Synthetic English copy failure.',
      'failed',
    ),
  );
  const service = createGenerationService({
    campaigns: persistence.campaigns,
    clock: () => NOW,
    createUuid: ids,
    generationAdmission: persistence.generationAdmission,
    generations: persistence.generations,
    providerConfigured: true,
  });
  const accepted = await service.createCampaign({
    idea: 'Write a bilingual water garden campaign',
    ownerSessionIdHash: OWNER_HASH,
  });
  const worker = createCampaignGenerationWorker({
    campaigns: persistence.campaigns,
    clock: () => NOW,
    createUuid: ids,
    generations: persistence.generations,
    maintenance: persistence.generationMaintenance,
    owner: 'faunapoolen-worker-partial-0001',
    provider,
    store: persistence.jobs,
  });
  assert.equal(await worker.runUntilIdle(), 2);

  const partial = persistence.campaigns.get(accepted.campaignId);
  assert.ok(partial);
  assert.equal(partial.record.stage, 'copy');
  assert.ok(partial.record.copy.sv);
  assert.equal(partial.record.copy.en, undefined);
  assert.equal(partial.revision, 2);
  assert.equal(persistence.generations.getLatestRun(accepted.campaignId)?.state, 'failed');
  assert.deepEqual(
    (await service.listRecoverableStatuses()).map(
      ({ campaignId, campaignRevision, stage, state }) => ({
        campaignId,
        campaignRevision,
        stage,
        state,
      }),
    ),
    [{ campaignId: accepted.campaignId, campaignRevision: 2, stage: 'copy', state: 'failed' }],
  );

  provider.failures.delete('campaign.copy.en');
  provider.operations.length = 0;
  const retried = await service.retryCampaign({
    campaignId: accepted.campaignId,
    expectedRevision: partial.revision,
    ownerSessionIdHash: OWNER_HASH,
    stage: 'copy',
  });
  assert.equal('state' in retried ? retried.state : undefined, 'queued');
  assert.equal(await worker.runUntilIdle(), 2);

  const completed = persistence.campaigns.get(accepted.campaignId);
  assert.ok(completed);
  assert.equal(completed.record.stage, 'complete');
  assert.deepEqual(Object.keys(completed.record.copy).sort(), ['en', 'sv']);
  assert.deepEqual(provider.operations, ['campaign.copy.en', 'campaign.image_prompts']);
  assert.deepEqual(await service.listRecoverableStatuses(), []);
});

test('an ambiguous revision-zero strategy run can only be retried explicitly as strategy', async (t) => {
  const persistence = fixture(t);
  const ids = uuidFactory(250);
  const provider = new SyntheticProvider();
  provider.failures.set(
    'campaign.strategy',
    new GenerationProviderTerminalError(
      'provider_create_ambiguous',
      'The synthetic create outcome is ambiguous.',
      'ambiguous',
    ),
  );
  const service = createGenerationService({
    campaigns: persistence.campaigns,
    clock: () => NOW,
    createUuid: ids,
    generationAdmission: persistence.generationAdmission,
    generations: persistence.generations,
    providerConfigured: true,
  });
  const accepted = await service.createCampaign({
    idea: 'Create a campaign that crosses a synthetic ambiguous boundary',
    ownerSessionIdHash: OWNER_HASH,
  });
  const worker = createCampaignGenerationWorker({
    campaigns: persistence.campaigns,
    clock: () => NOW,
    createUuid: ids,
    generations: persistence.generations,
    maintenance: persistence.generationMaintenance,
    owner: 'faunapoolen-worker-ambiguous-0001',
    provider,
    store: persistence.jobs,
  });
  assert.equal(await worker.runUntilIdle(), 1);
  assert.equal(persistence.campaigns.get(accepted.campaignId), null);
  assert.deepEqual(await service.getStatus(accepted.campaignId), {
    campaignId: accepted.campaignId,
    campaignRevision: 0,
    error: {
      code: 'provider_create_ambiguous',
      message: 'The synthetic create outcome is ambiguous.',
    },
    jobId: accepted.jobId,
    stage: 'strategy',
    state: 'ambiguous',
    updatedAt: new Date(NOW).toISOString(),
  });
  assert.equal(persistence.jobs.pruneTerminal(NOW + 1, 100), 1);
  const reloadedService = createGenerationService({
    campaigns: persistence.campaigns,
    clock: () => NOW,
    createUuid: ids,
    generationAdmission: persistence.generationAdmission,
    generations: persistence.generations,
    providerConfigured: true,
  });
  assert.deepEqual(await reloadedService.listRecoverableStatuses(), [
    await service.getStatus(accepted.campaignId),
  ]);
  await assert.rejects(
    reloadedService.retryCampaign({
      campaignId: accepted.campaignId,
      expectedRevision: 0,
      ownerSessionIdHash: OWNER_HASH,
      stage: 'copy',
    }),
    (error: unknown) =>
      error instanceof HttpError &&
      error.code === 'generation_retry_unavailable' &&
      error.status === 409,
  );

  provider.failures.delete('campaign.strategy');
  const retried = await reloadedService.retryCampaign({
    campaignId: accepted.campaignId,
    expectedRevision: 0,
    ownerSessionIdHash: OWNER_HASH,
    stage: 'strategy',
  });
  assert.equal('state' in retried ? retried.state : undefined, 'queued');
  assert.notEqual('jobId' in retried ? retried.jobId : undefined, accepted.jobId);
  assert.equal(await worker.runUntilIdle(), 3);
  assert.equal(persistence.campaigns.get(accepted.campaignId)?.record.stage, 'complete');
  assert.deepEqual(await reloadedService.listRecoverableStatuses(), []);
});

test('an imported complete campaign fills missing copy without regenerating valid prompts', async (t) => {
  const persistence = fixture(t);
  const campaignId = uuid(300);
  const imported = campaignRecord(campaignId, {
    copy: { sv: copy('sv') },
    imagePrompts: prompts(),
    stage: 'complete',
  });
  importCampaign(persistence, imported, 1);

  const ids = uuidFactory(301);
  const provider = new SyntheticProvider();
  const service = createGenerationService({
    campaigns: persistence.campaigns,
    clock: () => NOW,
    createUuid: ids,
    generationAdmission: persistence.generationAdmission,
    generations: persistence.generations,
    providerConfigured: true,
  });
  const accepted = await service.retryCampaign({
    campaignId,
    expectedRevision: 1,
    ownerSessionIdHash: OWNER_HASH,
    stage: 'copy',
  });
  assert.equal('state' in accepted ? accepted.state : undefined, 'queued');
  const worker = createCampaignGenerationWorker({
    campaigns: persistence.campaigns,
    clock: () => NOW,
    createUuid: ids,
    generations: persistence.generations,
    maintenance: persistence.generationMaintenance,
    owner: 'faunapoolen-worker-import-0001',
    provider,
    store: persistence.jobs,
  });
  assert.equal(await worker.runUntilIdle(), 1);

  const completed = persistence.campaigns.get(campaignId);
  assert.ok(completed);
  assert.equal(completed.record.stage, 'complete');
  assert.ok(completed.record.copy.en);
  assert.deepEqual(completed.record.imagePrompts, imported.imagePrompts);
  assert.deepEqual(provider.operations, ['campaign.copy.en']);
  assert.equal(persistence.generations.getLatestRun(campaignId)?.state, 'succeeded');
});

test('missing provider configuration fails before quota consumption or durable enqueue', async (t) => {
  const persistence = fixture(t);
  const service = createGenerationService({
    campaigns: persistence.campaigns,
    clock: () => NOW,
    createUuid: uuidFactory(400),
    generationAdmission: persistence.generationAdmission,
    generations: persistence.generations,
    providerConfigured: false,
  });

  await assert.rejects(
    service.createCampaign({
      idea: 'A valid idea that cannot yet run',
      ownerSessionIdHash: OWNER_HASH,
    }),
    (error: unknown) =>
      error instanceof HttpError &&
      error.code === 'generation_provider_unavailable' &&
      error.status === 503,
  );
  assert.equal(
    persistence.database.sqlite.get('SELECT COUNT(*) AS count FROM generation_windows')?.['count'],
    0,
  );
  assert.equal(
    persistence.database.sqlite.get('SELECT COUNT(*) AS count FROM generation_runs')?.['count'],
    0,
  );
  assert.equal(
    persistence.database.sqlite.get('SELECT COUNT(*) AS count FROM cx_jobs')?.['count'],
    0,
  );
});

test('generation admission returns a bounded retry time without creating a thirty-first run', async (t) => {
  const persistence = fixture(t);
  const service = createGenerationService({
    campaigns: persistence.campaigns,
    clock: () => NOW,
    createUuid: uuidFactory(500),
    generationAdmission: persistence.generationAdmission,
    generations: persistence.generations,
    providerConfigured: true,
  });
  for (let index = 0; index < 30; index += 1) {
    await service.createCampaign({
      idea: `A valid queued campaign idea number ${String(index).padStart(2, '0')}`,
      ownerSessionIdHash: OWNER_HASH,
    });
  }
  await assert.rejects(
    service.createCampaign({
      idea: 'A valid campaign idea that exceeds the persisted generation window',
      ownerSessionIdHash: OWNER_HASH,
    }),
    (error: unknown) =>
      error instanceof HttpError &&
      error.code === 'generation_limit_reached' &&
      error.status === 429 &&
      error.details?.['retryAt'] === NOW + 10 * 60 * 1_000,
  );
  assert.equal(
    persistence.database.sqlite.get('SELECT COUNT(*) AS count FROM generation_runs')?.['count'],
    30,
  );
  assert.equal(
    persistence.database.sqlite.get('SELECT COUNT(*) AS count FROM cx_jobs')?.['count'],
    30,
  );
});

test('generation normalizes whitespace and completes an idea beyond 3,000 UTF-16 units', async (t) => {
  const persistence = fixture(t);
  const ids = uuidFactory(550);
  const service = createGenerationService({
    campaigns: persistence.campaigns,
    clock: () => NOW,
    createUuid: ids,
    generationAdmission: persistence.generationAdmission,
    generations: persistence.generations,
    providerConfigured: true,
  });
  const emoji = '🫧'.repeat(1_501);
  const rawIdea = ` \t${emoji}\t  calm   pool\r\n\r\n\r\n  in Sweden  `;
  const normalizedIdea = `${emoji} calm pool\n\nin Sweden`;
  assert.ok(rawIdea.length > 3_000);
  assert.ok([...normalizedIdea].length < 3_000);

  const accepted = await service.createCampaign({ idea: rawIdea, ownerSessionIdHash: OWNER_HASH });
  assert.equal(
    persistence.generations.getLatestRun(accepted.campaignId)?.strategyIdea,
    normalizedIdea,
  );

  const worker = createCampaignGenerationWorker({
    campaigns: persistence.campaigns,
    clock: () => NOW,
    createUuid: ids,
    generations: persistence.generations,
    maintenance: persistence.generationMaintenance,
    owner: 'faunapoolen-worker-unicode-0001',
    provider: new SyntheticProvider(),
    store: persistence.jobs,
  });
  assert.equal(await worker.runUntilIdle(), 3);
  assert.equal(persistence.campaigns.get(accepted.campaignId)?.record.idea, normalizedIdea);
});

test('worker startup quarantines creating effects before expired claims are recovered', () => {
  const order: string[] = [];
  const worker = createCampaignGenerationWorker({
    campaigns: {} as FaunapoolenPersistence['campaigns'],
    clock: () => NOW,
    generations: {
      markCreatingEffectsAmbiguous() {
        order.push('effects');
        return 2;
      },
    } as unknown as FaunapoolenPersistence['generations'],
    maintenance: {
      maintainTerminalStorage() {
        order.push('maintain');
        return { effects: 4, jobs: 5, responseBytes: 6, runs: 7 };
      },
      reconcileTerminalJobs() {
        order.push('reconcile');
        return { ambiguous: 8, failed: 9, resumed: 10 };
      },
    },
    onRecovery(result) {
      order.push(`reported:${String(result.ambiguousEffects)}`);
    },
    pollIntervalMs: 10,
    provider: new SyntheticProvider(),
    scheduleInterval(interval, _tick) {
      order.push(`scheduled:${String(interval)}`);
      return () => {};
    },
    store: {
      maxConcurrentJobs: 1,
      recoverExpired() {
        order.push('jobs');
        return { failed: 1, retried: 3 };
      },
    } as FaunapoolenPersistence['jobs'],
    worker: {
      accepting: true,
      abortActive() {},
      async drain() {},
      async runUntilIdle() {
        order.push('polled');
        return 0;
      },
      running: false,
      stopClaiming() {},
    },
  });
  worker.start();
  assert.deepEqual(order, [
    'effects',
    'jobs',
    'reconcile',
    'maintain',
    'reported:2',
    'scheduled:10',
    'scheduled:600000',
    'polled',
  ]);
  worker.stopClaiming();
});

test('productive worker batches run bounded maintenance without hiding maintenance failure', async () => {
  const maintenanceError = new Error('synthetic maintenance failure');
  const errors: unknown[] = [];
  let reconciliations = 0;
  const worker = createCampaignGenerationWorker({
    campaigns: {} as FaunapoolenPersistence['campaigns'],
    generations: {} as FaunapoolenPersistence['generations'],
    maintenance: {
      maintainTerminalStorage() {
        throw new Error('storage maintenance must not follow failed reconciliation');
      },
      reconcileTerminalJobs() {
        reconciliations += 1;
        throw maintenanceError;
      },
    },
    onError(error) {
      errors.push(error);
    },
    provider: new SyntheticProvider(),
    store: { maxConcurrentJobs: 1 } as FaunapoolenPersistence['jobs'],
    worker: {
      accepting: true,
      abortActive() {},
      async drain() {},
      async runUntilIdle() {
        return 2;
      },
      running: false,
      stopClaiming() {},
    },
  });

  assert.equal(await worker.runUntilIdle(), 2);
  assert.equal(reconciliations, 1);
  assert.deepEqual(errors, [maintenanceError]);
});

class SyntheticProvider implements OpenAiResponsesProvider {
  readonly failures = new Map<string, Error>();
  readonly inputs = new Map<string, string>();
  readonly operations: string[] = [];

  async generateStructured<Result>({ spec }: GenerateStructuredInput<Result>): Promise<Result> {
    const generation = spec();
    this.operations.push(generation.operation);
    this.inputs.set(generation.operation, generation.input);
    const failure = this.failures.get(generation.operation);
    if (failure) throw failure;
    const value = resultForOperation(generation.operation);
    const validated = generation.validate(value);
    if (!validated.ok) throw new Error(validated.error);
    return validated.value;
  }

  quarantinePending(): void {}
}

function resultForOperation(operation: string): unknown {
  if (operation === 'campaign.strategy') return STRATEGY;
  if (operation === 'campaign.copy.sv') return copy('sv');
  if (operation === 'campaign.copy.en') return copy('en');
  if (operation === 'campaign.image_prompts') return IMAGE_SCENES;
  throw new Error(`Unexpected synthetic generation operation: ${operation}`);
}

const STRATEGY: CampaignStrategy = Object.freeze({
  assumptions: Object.freeze([]),
  audience: 'Swedish homeowners who want a calmer garden',
  desiredOutcome: 'A natural water garden that feels easy to begin',
  externalProblem: 'They do not know which first step makes the project manageable',
  internalProblem: 'The number of choices makes the project feel risky',
  name: 'Calm water garden',
  plan: Object.freeze([
    'Describe the garden',
    'Choose the water form',
    'Plan the first step',
  ] as const),
  rationale: Object.freeze([
    Object.freeze({
      ruleIds: Object.freeze(['hero-is-customer']),
      topic: 'audience' as const,
      why: 'Keep the homeowner at the centre of the campaign.',
    }),
    Object.freeze({
      ruleIds: Object.freeze(['outcome-first']),
      topic: 'desiredOutcome' as const,
      why: 'Lead with the calmer garden they want.',
    }),
    Object.freeze({
      ruleIds: Object.freeze(['three-step-plan']),
      topic: 'plan' as const,
      why: 'Three clear steps make the project feel manageable.',
    }),
  ]),
  singleMessage: 'A considered water garden can begin with one calm, practical step.',
});

const IMAGE_SCENES: GeneratedImageScenes = Object.freeze({
  prompts: Object.freeze([
    scene('photograph', 'none'),
    scene('composite', 'A small cyan square in the lower right corner'),
    scene('detail', 'none'),
  ]),
});

function scene(concept: 'composite' | 'detail' | 'photograph', graphic: string) {
  return Object.freeze({
    altText: `A calm Swedish water garden shown as a ${concept}.`,
    composition: 'Natural eye-level framing with the water as the clear focal point.',
    concept,
    environment: 'A Swedish garden with granite, birch, native planting and clear water.',
    graphic,
    light: 'Soft overcast Nordic afternoon light from the left.',
    ruleIds: Object.freeze(['photo-not-poster']),
    subject: 'A natural photograph of a homeowner enjoying a calm water garden.',
    why: 'The scene makes the desired garden outcome concrete and credible.',
  });
}

function copy(language: 'en' | 'sv'): CampaignCopy {
  const primaryText =
    language === 'sv' ? 'Börja med en lugn vattenidé.' : 'Begin with one calm water idea.';
  return Object.freeze({
    callToAction: language === 'sv' ? 'Planera första steget' : 'Plan the first step',
    description: language === 'sv' ? 'En lugn början' : 'A calm beginning',
    fullCaption: `${primaryText} A considered plan makes the next choice easier.`,
    hashtags: Object.freeze(
      language === 'sv'
        ? ['#naturpool', '#vattenträdgård', '#svenskträdgård']
        : ['#naturepool', '#watergarden', '#swedishgarden'],
    ),
    headline: language === 'sv' ? 'En lugnare trädgård' : 'A calmer garden',
    primaryText,
    rationale: Object.freeze(
      ['headline', 'description', 'primaryText', 'fullCaption', 'callToAction', 'hashtags'].map(
        (field) =>
          Object.freeze({
            field: field as CampaignCopy['rationale'][number]['field'],
            guidance: 'Keep the outcome clear and the next step specific.',
            ruleIds: Object.freeze(['outcome-first']),
          }),
      ),
    ),
    variations: Object.freeze({
      headline: Object.freeze([
        'Calm water at home',
        'Start with one step',
        'Shape a calmer garden',
      ] as const),
      primaryText: Object.freeze([
        'Picture a calmer garden.',
        'Start your water garden simply.',
        'Choose one practical first step.',
      ] as const),
    }),
  });
}

function campaignRecord(
  id: string,
  state: {
    readonly copy: CampaignRecord['copy'];
    readonly imagePrompts: CampaignRecord['imagePrompts'];
    readonly stage: CampaignRecord['stage'];
  },
): CampaignRecord {
  return validateCampaignRecord({
    copy: state.copy,
    createdAt: new Date(NOW).toISOString(),
    idea: 'An imported campaign idea',
    id,
    imagePrompts: state.imagePrompts,
    name: STRATEGY.name,
    stage: state.stage,
    strategy: STRATEGY,
    updatedAt: new Date(NOW).toISOString(),
  });
}

function prompts(): readonly CampaignImagePrompt[] {
  return buildCampaignImagePrompts(IMAGE_SCENES);
}

function importCampaign(
  persistence: FaunapoolenPersistence,
  record: CampaignRecord,
  sequence: number,
): void {
  const bytes = canonicalCampaignBytes(record);
  insertImportedCampaign(persistence.database.sqlite, record, sequence, {
    bytes,
    fileName: `${record.id}.json`,
    sha256: sha256Hex(bytes),
  });
}

function fixture(t: TestContext): FaunapoolenPersistence {
  const directory = fs.mkdtempSync(
    path.join(fs.realpathSync(os.tmpdir()), 'faunapoolen-generation-test-'),
  );
  const jobs = uuidFactory(10_000);
  const leases = uuidFactory(20_000);
  const persistence = createFaunapoolenPersistence({
    clock: () => NOW,
    createJobId: jobs,
    createLeaseToken: leases,
    databasePath: path.join(directory, 'faunapoolen.db'),
    operationalRoot: directory,
  });
  t.after(() => {
    persistence.close();
    fs.rmSync(directory, { force: true, recursive: true });
  });
  return persistence;
}

function uuidFactory(start: number): () => string {
  let value = start;
  return () => uuid(value++);
}

function uuid(value: number): string {
  return `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
}
