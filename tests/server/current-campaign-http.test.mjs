import assert from 'node:assert/strict';
import { lstat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { COPY_BUDGETS, COPY_FIELD_IDS } from '../../server/copy-budgets.mjs';
import { MARKETING_RULES } from '../../server/marketing-rules.mjs';
import {
  CURRENT_CAMPAIGN_IDS,
  currentCampaign,
  currentCopy,
} from '../fixtures/current-campaigns.mjs';
import {
  authenticatedCookie,
  createCurrentFixture,
  localFetch,
  post,
  readCampaignFile,
  startCurrentServer,
  stopCurrentServer,
  writeCampaignFile,
} from './current-server-harness.mjs';

test('current campaign config, summaries, full records, missing ids, and deletion responses are exact', async (t) => {
  const fixture = await createCurrentFixture(t);
  const strategy = currentCampaign({
    id: CURRENT_CAMPAIGN_IDS.strategy,
    stage: 'strategy',
    createdAt: '2026-01-01T00:00:00.000Z',
    name: 'Strategy campaign',
  });
  const complete = currentCampaign({
    id: CURRENT_CAMPAIGN_IDS.complete,
    stage: 'complete',
    createdAt: '2026-03-01T00:00:00.000Z',
    name: 'Complete campaign',
  });
  await writeCampaignFile(fixture, strategy.id, strategy);
  await writeCampaignFile(fixture, complete.id, complete);
  const server = await startCurrentServer(fixture);
  const cookie = await authenticatedCookie(server);

  const config = await post(server, '/admin-auth/campaigns/config', { cookie });
  assert.equal(config.status, 200);
  assert.equal(config.headers.get('cache-control'), 'no-store');
  const configBody = await config.json();
  assert.equal(configBody.maxIdeaCharacters, 3_000);
  assert.equal(configBody.limitsVerifiedOn, '2026-08-08');
  assert.deepEqual(
    configBody.fields.map(({ id, budget }) => [id, budget]),
    COPY_FIELD_IDS.map((id) => [id, COPY_BUDGETS[id === 'hashtags' ? 'hashtag' : id]]),
  );
  assert.deepEqual(configBody.rules, MARKETING_RULES);
  assert.deepEqual(configBody.concepts, [
    { id: 'photograph', label: 'Straight photograph' },
    { id: 'composite', label: 'Photograph with a graphic element' },
    { id: 'detail', label: 'Material detail' },
  ]);

  const list = await post(server, '/admin-auth/campaigns/list', { cookie });
  assert.deepEqual(await list.json(), {
    campaigns: [
      {
        id: complete.id,
        name: complete.name,
        createdAt: complete.createdAt,
        idea: complete.idea,
        stage: complete.stage,
      },
      {
        id: strategy.id,
        name: strategy.name,
        createdAt: strategy.createdAt,
        idea: strategy.idea,
        stage: strategy.stage,
      },
    ],
  });

  const open = await post(server, '/admin-auth/campaigns/open', {
    cookie,
    body: { id: complete.id },
  });
  assert.deepEqual(await open.json(), { campaign: complete });
  for (const id of ['not-a-uuid', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']) {
    const missing = await post(server, '/admin-auth/campaigns/open', { cookie, body: { id } });
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: 'That campaign no longer exists.' });
  }

  const invalidDelete = await post(server, '/admin-auth/campaigns/delete', {
    cookie,
    body: { id: 'not-a-uuid' },
  });
  assert.equal(invalidDelete.status, 400);
  assert.deepEqual(await invalidDelete.json(), { error: 'Unknown campaign.' });
  const absentDelete = await post(server, '/admin-auth/campaigns/delete', {
    cookie,
    body: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
  });
  assert.equal(absentDelete.status, 200);
  assert.deepEqual(await absentDelete.json(), { ok: true });
  const deleted = await post(server, '/admin-auth/campaigns/delete', {
    cookie,
    body: { id: strategy.id },
  });
  assert.deepEqual(await deleted.json(), { ok: true });
  assert.equal(
    await lstat(path.join(fixture.campaignDir, `${strategy.id}.json`)).then(
      () => true,
      () => false,
    ),
    false,
  );
});

test('current copy editing trims, widens beyond guidance, bounds abuse, and persists without changing stage', async (t) => {
  const fixture = await createCurrentFixture(t);
  const campaign = currentCampaign({ id: CURRENT_CAMPAIGN_IDS.copy, stage: 'copy' });
  await writeCampaignFile(fixture, campaign.id, campaign);
  let server = await startCurrentServer(fixture);
  let cookie = await authenticatedCookie(server);

  const widenedHeadline = 'x'.repeat(COPY_BUDGETS.headline + 20);
  const saved = await post(server, '/admin-auth/campaigns/copy/save', {
    cookie,
    body: { id: campaign.id, language: 'en', field: 'headline', value: `  ${widenedHeadline}  ` },
  });
  assert.equal(saved.status, 200);
  const savedBody = await saved.json();
  assert.equal(savedBody.ok, true);
  assert.match(savedBody.updatedAt, /^\d{4}-\d{2}-\d{2}T/);

  const tags = Array.from({ length: 30 }, (_, index) => `#current${String(index)}`);
  const tagsSaved = await post(server, '/admin-auth/campaigns/copy/save', {
    cookie,
    body: { id: campaign.id, language: 'sv', field: 'hashtags', value: tags },
  });
  assert.equal(tagsSaved.status, 200);

  for (const body of [
    { id: campaign.id, language: 'xx', field: 'headline', value: 'value' },
    { id: campaign.id, language: 'en', field: 'unknown', value: 'value' },
  ]) {
    const invalid = await post(server, '/admin-auth/campaigns/copy/save', { cookie, body });
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), { error: 'Unknown campaign field.' });
  }
  for (const value of ['', 'x'.repeat(4_001), 42]) {
    const invalid = await post(server, '/admin-auth/campaigns/copy/save', {
      cookie,
      body: { id: campaign.id, language: 'en', field: 'headline', value },
    });
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), { error: 'That value could not be saved.' });
  }
  const tooManyTags = await post(server, '/admin-auth/campaigns/copy/save', {
    cookie,
    body: {
      id: campaign.id,
      language: 'en',
      field: 'hashtags',
      value: Array(31).fill('#tag'),
    },
  });
  assert.equal(tooManyTags.status, 400);

  const persisted = await readCampaignFile(fixture, campaign.id);
  assert.equal(persisted.copy.en.headline, widenedHeadline);
  assert.deepEqual(persisted.copy.sv.hashtags, tags);
  assert.equal(persisted.stage, 'copy');

  await stopCurrentServer(server);
  server = await startCurrentServer(fixture);
  cookie = await authenticatedCookie(server);
  const reopened = await post(server, '/admin-auth/campaigns/open', {
    cookie,
    body: { id: campaign.id },
  });
  assert.equal((await reopened.json()).campaign.copy.en.headline, widenedHeadline);
});

test('current copy edit distinguishes missing campaign from a reachable missing-language copy', async (t) => {
  const fixture = await createCurrentFixture(t);
  const partial = currentCampaign({
    id: CURRENT_CAMPAIGN_IDS.partial,
    stage: 'copy',
    copy: { sv: currentCopy('sv') },
  });
  await writeCampaignFile(fixture, partial.id, partial);
  const server = await startCurrentServer(fixture);
  const cookie = await authenticatedCookie(server);

  for (const id of [partial.id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']) {
    const response = await post(server, '/admin-auth/campaigns/copy/save', {
      cookie,
      body: { id, language: 'en', field: 'headline', value: 'A value' },
    });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'That campaign no longer exists.' });
  }
});

test('current storage failure is an HTML 500 while health remains green', async (t) => {
  const fixture = await createCurrentFixture(t);
  const fileAsCampaignRoot = path.join(fixture.root, 'campaign-root-is-file');
  await writeFile(fileAsCampaignRoot, 'synthetic', { mode: 0o600 });
  const server = await startCurrentServer(fixture, { campaignDir: fileAsCampaignRoot });
  const cookie = await authenticatedCookie(server);

  const list = await post(server, '/admin-auth/campaigns/list', { cookie });
  assert.equal(list.status, 500);
  assert.match(list.headers.get('content-type'), /^text\/html/);
  assert.equal(list.headers.get('cache-control'), 'no-store');

  const health = await localFetch(`${server.baseUrl}/healthz`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { app: 'faunapoolen.se', ok: true, port: server.port });
});
