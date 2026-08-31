import assert from 'node:assert/strict';
import test from 'node:test';

import { HttpError } from '@mikaelcedergren/cx-framework/server/errors';

import {
  CampaignActiveGenerationError,
  CampaignRevisionConflictError,
  type CampaignRepository,
  type StoredCampaign,
} from './campaign-repository.js';
import { validateCampaignRecord, type CampaignCopy } from './campaign-schema.js';
import { createCampaignService } from './campaign-service.js';
import { COPY_FIELDS, LIMITS_VERIFIED_ON } from './copy-budgets.js';
import { MAX_IDEA_CHARACTERS } from './generation-content.js';
import { IMAGE_CONCEPTS } from './image-style.js';
import { MARKETING_RULES } from './marketing-rules.js';

const CAMPAIGN_ID = '11111111-1111-4111-8111-111111111111';
const CREATED_AT = '2026-08-25T12:00:00.000Z';
const UPDATED_AT = '2026-08-25T12:01:00.000Z';

test('configuration is an immutable projection of the typed product registries', async () => {
  const service = createCampaignService({ campaigns: new MemoryCampaignRepository(null) });
  const configuration = await service.configuration();

  assert.deepEqual(configuration, {
    concepts: IMAGE_CONCEPTS.map(({ id, label }) => ({ id, label })),
    fields: COPY_FIELDS.map(({ budget, guidance, id, label, multiline, reason }) => ({
      budget,
      guidance,
      id,
      label,
      multiline,
      reason,
    })),
    limitsVerifiedOn: LIMITS_VERIFIED_ON,
    maxIdeaCharacters: MAX_IDEA_CHARACTERS,
    rules: MARKETING_RULES.map(({ id, name, teaches }) => ({ id, name, teaches })),
  });
  assert.strictEqual(await service.configuration(), configuration);
  assert.equal(Object.isFrozen(configuration), true);
});

test('campaign reads preserve repository ordering and expose the exact optimistic revision', async () => {
  const repository = new MemoryCampaignRepository(storedCampaign(7, true));
  const service = createCampaignService({ campaigns: repository });

  assert.deepEqual(await service.listCampaigns(), repository.list());
  assert.deepEqual(await service.getCampaign(CAMPAIGN_ID), {
    ...repository.stored?.record,
    revision: 7,
  });
  assert.equal(await service.getCampaign('22222222-2222-4222-8222-222222222222'), null);
});

test('copy updates and deletion return explicit missing, conflict, unavailable, and active states', async () => {
  const repository = new MemoryCampaignRepository(storedCampaign(3, false));
  const service = createCampaignService({ campaigns: repository });

  await assert.rejects(
    service.updateCopy({
      campaignId: CAMPAIGN_ID,
      expectedRevision: 3,
      field: 'not-a-copy-field',
      language: 'en',
      value: 'Anything',
    }),
    (error: unknown) =>
      error instanceof HttpError &&
      error.code === 'campaign_copy_field_invalid' &&
      error.status === 400,
  );
  await assert.rejects(
    service.updateCopy({
      campaignId: CAMPAIGN_ID,
      expectedRevision: 3,
      field: 'headline',
      language: 'en',
      value: 'x'.repeat(28),
    }),
    (error: unknown) =>
      error instanceof HttpError &&
      error.code === 'campaign_copy_value_invalid' &&
      error.status === 400 &&
      error.details?.['maximumCharacters'] === 27,
  );
  await assert.rejects(
    service.updateCopy({
      campaignId: CAMPAIGN_ID,
      expectedRevision: 3,
      field: 'hashtags',
      language: 'en',
      value: ['#one', '#two'],
    }),
    (error: unknown) =>
      error instanceof HttpError &&
      error.code === 'campaign_copy_value_invalid' &&
      error.status === 400 &&
      error.details?.['minimumItems'] === 3,
  );
  await assert.rejects(
    service.updateCopy({
      campaignId: CAMPAIGN_ID,
      expectedRevision: 3,
      field: 'headline',
      language: 'en',
      value: 'A clearer headline',
    }),
    (error: unknown) =>
      error instanceof HttpError &&
      error.code === 'campaign_copy_unavailable' &&
      error.status === 409,
  );

  repository.stored = storedCampaign(4, true);
  assert.deepEqual(
    await service.updateCopy({
      campaignId: CAMPAIGN_ID,
      expectedRevision: 3,
      field: 'headline',
      language: 'en',
      value: 'A clearer headline',
    }),
    { currentRevision: 4, status: 'revision_conflict' },
  );
  assert.deepEqual(
    await service.updateCopy({
      campaignId: CAMPAIGN_ID,
      expectedRevision: 4,
      field: 'headline',
      language: 'en',
      value: 'A clearer headline',
    }),
    { revision: 5, status: 'updated', updatedAt: UPDATED_AT },
  );

  repository.deleteOutcome = 'conflict';
  assert.deepEqual(await service.deleteCampaign({ expectedRevision: 5, id: CAMPAIGN_ID }), {
    currentRevision: 6,
    status: 'revision_conflict',
  });
  repository.deleteOutcome = 'active';
  await assert.rejects(
    service.deleteCampaign({ expectedRevision: 6, id: CAMPAIGN_ID }),
    (error: unknown) =>
      error instanceof HttpError &&
      error.code === 'campaign_generation_active' &&
      error.status === 409,
  );
  repository.stored = null;
  repository.deleteOutcome = 'missing';
  assert.deepEqual(await service.deleteCampaign({ expectedRevision: 6, id: CAMPAIGN_ID }), {
    status: 'not_found',
  });
});

class MemoryCampaignRepository implements CampaignRepository {
  deleteOutcome: 'active' | 'conflict' | 'missing' | 'success' = 'success';
  stored: StoredCampaign | null;

  constructor(stored: StoredCampaign | null) {
    this.stored = stored;
  }

  create(record: StoredCampaign['record']): StoredCampaign {
    this.stored = Object.freeze({ record, revision: 1, sequence: 1 });
    return this.stored;
  }

  delete(id: string, expectedRevision: number): boolean {
    if (this.deleteOutcome === 'active') throw new CampaignActiveGenerationError(id);
    if (this.deleteOutcome === 'conflict') {
      assert.ok(this.stored);
      this.stored = Object.freeze({ ...this.stored, revision: expectedRevision + 1 });
      throw new CampaignRevisionConflictError(id);
    }
    if (this.deleteOutcome === 'missing' || !this.stored) return false;
    this.stored = null;
    return true;
  }

  get(id: string): StoredCampaign | null {
    return id === CAMPAIGN_ID ? this.stored : null;
  }

  list() {
    if (!this.stored) return Object.freeze([]);
    return Object.freeze([
      Object.freeze({
        createdAt: this.stored.record.createdAt,
        id: this.stored.record.id,
        name: this.stored.record.name,
        revision: this.stored.revision,
        stage: this.stored.record.stage,
        updatedAt: this.stored.record.updatedAt,
      }),
    ]);
  }

  replace(record: StoredCampaign['record'], expectedRevision: number): StoredCampaign {
    this.stored = Object.freeze({
      record,
      revision: expectedRevision + 1,
      sequence: this.stored?.sequence ?? 1,
    });
    return this.stored;
  }

  updateCopy(): StoredCampaign | null {
    if (!this.stored) return null;
    this.stored = Object.freeze({
      ...this.stored,
      record: Object.freeze({ ...this.stored.record, updatedAt: UPDATED_AT }),
      revision: this.stored.revision + 1,
    });
    return this.stored;
  }
}

function storedCampaign(revision: number, includeEnglishCopy: boolean): StoredCampaign {
  return Object.freeze({
    record: validateCampaignRecord({
      copy: includeEnglishCopy ? { en: englishCopy() } : {},
      createdAt: CREATED_AT,
      idea: 'Help homeowners begin a calmer water garden project.',
      id: CAMPAIGN_ID,
      imagePrompts: [],
      name: 'A calmer water garden',
      stage: includeEnglishCopy ? 'copy' : 'strategy',
      strategy: {
        assumptions: [],
        audience: 'Swedish homeowners planning a natural water garden',
        desiredOutcome: 'A calm garden with a credible first step',
        externalProblem: 'The project appears too difficult to begin',
        internalProblem: 'Too many choices make the project feel risky',
        name: 'A calmer water garden',
        plan: ['Describe the garden', 'Choose the water form', 'Plan the first step'],
        rationale: [
          {
            ruleIds: ['hero-is-customer'],
            topic: 'audience',
            why: 'The homeowner remains the campaign hero.',
          },
          {
            ruleIds: ['outcome-first'],
            topic: 'desiredOutcome',
            why: 'The calmer garden is the concrete outcome.',
          },
          {
            ruleIds: ['three-step-plan'],
            topic: 'plan',
            why: 'Three steps make the path manageable.',
          },
        ],
        singleMessage: 'A calm water garden begins with one practical first step.',
      },
      updatedAt: CREATED_AT,
    }),
    revision,
    sequence: 1,
  });
}

function englishCopy(): CampaignCopy {
  return Object.freeze({
    callToAction: 'Plan the first step',
    description: 'A calm beginning',
    fullCaption: 'Begin with one calm idea. A clear plan makes the next choice easier.',
    hashtags: Object.freeze(['#naturepool', '#watergarden', '#swedishgarden']),
    headline: 'A calmer garden',
    primaryText: 'Begin with one calm idea.',
    rationale: [
      ...([
        'headline',
        'description',
        'primaryText',
        'fullCaption',
        'callToAction',
        'hashtags',
      ] as const),
    ].map((field) => ({
      field,
      guidance: 'Keep the outcome clear and the next move specific.',
      ruleIds: ['outcome-first'],
    })),
    variations: {
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
    },
  });
}
