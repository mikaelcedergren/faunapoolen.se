import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCampaignGenerationJob,
  CAMPAIGN_GENERATION_JOB_TYPE,
  CampaignGenerationJobInputError,
  parseCampaignGenerationJob,
} from './generation-jobs.js';

const CAMPAIGN_ID = '11111111-1111-4111-8111-111111111111';
const RUN_ID = '22222222-2222-4222-8222-222222222222';

test('strategy job owns the normalized durable idea and a run-derived identity', () => {
  const job = buildCampaignGenerationJob({
    campaignId: CAMPAIGN_ID,
    expectedCampaignRevision: 0,
    idea: 'A calm nature pool',
    runId: RUN_ID,
    stage: 'strategy',
  });

  assert.equal(job.type, CAMPAIGN_GENERATION_JOB_TYPE);
  assert.equal(job.idempotencyKey, `campaign-generation:${RUN_ID}`);
  assert.equal(job.maxAttempts, 8);
  assert.deepEqual(parseCampaignGenerationJob(job.payload), {
    campaignId: CAMPAIGN_ID,
    expectedCampaignRevision: 0,
    idea: 'A calm nature pool',
    runId: RUN_ID,
    stage: 'strategy',
    version: 1,
  });
});

test('later jobs never carry the original low-authority idea', () => {
  for (const stage of ['copy', 'prompts'] as const) {
    const job = buildCampaignGenerationJob({
      campaignId: CAMPAIGN_ID,
      expectedCampaignRevision: 4,
      runId: RUN_ID,
      stage,
    });
    assert.deepEqual(parseCampaignGenerationJob(job.payload), {
      campaignId: CAMPAIGN_ID,
      expectedCampaignRevision: 4,
      runId: RUN_ID,
      stage,
      version: 1,
    });
  }
});

test('job parser rejects unknown fields, stage/revision mismatch, and non-canonical ideas', () => {
  const valid = {
    campaignId: CAMPAIGN_ID,
    expectedCampaignRevision: 0,
    idea: 'A calm nature pool',
    runId: RUN_ID,
    stage: 'strategy',
    version: 1,
  } as const;
  for (const payload of [
    { ...valid, unexpected: true },
    { ...valid, expectedCampaignRevision: 1 },
    { ...valid, idea: '  A calm nature pool  ' },
    { ...valid, runId: 'not-a-uuid' },
  ]) {
    assert.throws(() => parseCampaignGenerationJob(payload), CampaignGenerationJobInputError);
  }
  assert.throws(
    () =>
      buildCampaignGenerationJob({
        campaignId: CAMPAIGN_ID,
        expectedCampaignRevision: 1,
        idea: 'A calm nature pool',
        runId: RUN_ID,
        stage: 'copy',
      }),
    CampaignGenerationJobInputError,
  );
});
