import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
  createGenerationStateStore,
  MAX_GENERATION_STATES,
} from '../../server/admin-ad-builder.mjs';
import {
  CURRENT_CAMPAIGN_IDS,
  currentCampaign,
  currentCopy,
  currentImagePromptResponse,
  currentStrategy,
} from '../fixtures/current-campaigns.mjs';
import {
  authenticatedCookie,
  createCurrentFixture,
  post,
  readCampaignFile,
  repoRoot,
  startCurrentServer,
  startFakeOpenAi,
  stopCurrentServer,
  writeCampaignFile,
} from './current-server-harness.mjs';

const validIdea =
  'A calm nature pool campaign for a small Swedish garden without unsupported claims.';

test('current three-stage generation writes strategy, parallel bilingual copy, prompts, and reloads', async (t) => {
  const fixture = await createCurrentFixture(t);
  const provider = await startFakeOpenAi(fixture);
  const server = await startCurrentServer(fixture, { openAiBaseUrl: provider.baseUrl });
  const cookie = await authenticatedCookie(server);

  provider.queueSuccess(currentStrategy());
  const created = await post(server, '/admin-auth/campaigns/create', {
    cookie,
    body: { idea: `  ${validIdea}  ` },
  });
  assert.equal(created.status, 200);
  const createdBody = await created.json();
  assert.equal(createdBody.campaign.stage, 'strategy');
  assert.equal(createdBody.campaign.idea, validIdea);
  assert.equal(createdBody.campaign.name, currentStrategy().name);
  assert.deepEqual(createdBody.campaign.copy, {});
  assert.deepEqual(createdBody.campaign.imagePrompts, []);
  assert.match(createdBody.campaign.id, /^[0-9a-f-]{36}$/);

  assert.equal(provider.requests.length, 1);
  assert.equal(provider.requests[0].model, 'gpt-5.6-terra');
  assert.equal(provider.requests[0].max_output_tokens, 4_000);
  assert.equal(provider.requests[0].text.verbosity, 'medium');
  assert.equal(provider.requests[0].text.format.name, 'faunapoolen_campaign_strategy');
  assert.match(provider.requests[0].input, /BEGIN LOW-AUTHORITY ROUGH IDEA/);
  assert.match(provider.requests[0].input, new RegExp(validIdea));

  provider.queueSuccess(currentCopy('sv'));
  provider.queueSuccess(currentCopy('en'));
  const copied = await post(server, '/admin-auth/campaigns/copy', {
    cookie,
    body: { id: createdBody.campaign.id },
  });
  assert.equal(copied.status, 200);
  const copiedBody = await copied.json();
  assert.equal(copiedBody.campaign.stage, 'copy');
  assert.deepEqual(Object.keys(copiedBody.campaign.copy).sort(), ['en', 'sv']);
  assert.equal(Object.hasOwn(copiedBody, 'copyError'), false);
  for (const request of provider.requests.slice(1, 3)) {
    assert.equal(request.text.format.name, 'faunapoolen_campaign_copy');
    assert.doesNotMatch(request.input, new RegExp(validIdea));
    assert.match(request.input, /CAMPAIGN STRATEGY/);
  }

  provider.queueSuccess(currentImagePromptResponse());
  const prompted = await post(server, '/admin-auth/campaigns/prompts', {
    cookie,
    body: { id: createdBody.campaign.id },
  });
  assert.equal(prompted.status, 200);
  const promptedBody = await prompted.json();
  assert.equal(promptedBody.campaign.stage, 'complete');
  assert.deepEqual(
    promptedBody.campaign.imagePrompts.map(({ concept, label }) => ({ concept, label })),
    [
      { concept: 'photograph', label: 'Straight photograph' },
      { concept: 'composite', label: 'Photograph with a graphic element' },
      { concept: 'detail', label: 'Material detail' },
    ],
  );
  assert.match(promptedBody.campaign.imagePrompts[0].prompt, /No HDR tone mapping/);
  assert.match(promptedBody.campaign.imagePrompts[0].prompt, /No text, letters, numbers/);

  const persisted = await readCampaignFile(fixture, createdBody.campaign.id);
  assert.deepEqual(persisted, promptedBody.campaign);
  await stopCurrentServer(server);
  const restarted = await startCurrentServer(fixture, { openAiBaseUrl: provider.baseUrl });
  const restartedCookie = await authenticatedCookie(restarted);
  const reopened = await post(restarted, '/admin-auth/campaigns/open', {
    cookie: restartedCookie,
    body: { id: createdBody.campaign.id },
  });
  assert.deepEqual((await reopened.json()).campaign, promptedBody.campaign);
});

test('current copy stage saves one successful language, reports the other, and targeted retry fills both', async (t) => {
  const fixture = await createCurrentFixture(t);
  const provider = await startFakeOpenAi(fixture);
  const campaign = currentCampaign({ id: CURRENT_CAMPAIGN_IDS.strategy, stage: 'strategy' });
  await writeCampaignFile(fixture, campaign.id, campaign);
  const server = await startCurrentServer(fixture, { openAiBaseUrl: provider.baseUrl });
  const cookie = await authenticatedCookie(server);

  provider.queueSuccess(currentCopy('sv'));
  provider.queueError(401, 'invalid_api_key');
  const partial = await post(server, '/admin-auth/campaigns/copy', {
    cookie,
    body: { id: campaign.id },
  });
  assert.equal(partial.status, 200);
  const partialBody = await partial.json();
  assert.equal(partialBody.campaign.stage, 'copy');
  assert.equal(Object.keys(partialBody.campaign.copy).length, 1);
  assert.match(partialBody.copyError, /^The (Swedish|English) copy could not be written\./);
  assert.equal(Object.keys((await readCampaignFile(fixture, campaign.id)).copy).length, 1);

  provider.queueSuccess(currentCopy('sv'));
  provider.queueSuccess(currentCopy('en'));
  const retried = await post(server, '/admin-auth/campaigns/copy', {
    cookie,
    body: { id: campaign.id },
  });
  assert.equal(retried.status, 200);
  assert.deepEqual(Object.keys((await retried.json()).campaign.copy).sort(), ['en', 'sv']);
});

test('current total copy failure keeps the saved strategy intact', async (t) => {
  const fixture = await createCurrentFixture(t);
  const provider = await startFakeOpenAi(fixture);
  const campaign = currentCampaign({ id: CURRENT_CAMPAIGN_IDS.strategy, stage: 'strategy' });
  await writeCampaignFile(fixture, campaign.id, campaign);
  const before = await readCampaignFile(fixture, campaign.id);
  const server = await startCurrentServer(fixture, { openAiBaseUrl: provider.baseUrl });
  const cookie = await authenticatedCookie(server);
  provider.queueError(401, 'invalid_api_key');
  provider.queueError(401, 'invalid_api_key');

  const response = await post(server, '/admin-auth/campaigns/copy', {
    cookie,
    body: { id: campaign.id },
  });
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    error: 'The campaign copy could not be written. Try again.',
  });
  assert.deepEqual(await readCampaignFile(fixture, campaign.id), before);
});

test('current route order permits prompts before copy and copy after complete', async (t) => {
  const fixture = await createCurrentFixture(t);
  const provider = await startFakeOpenAi(fixture);
  const campaign = currentCampaign({ id: CURRENT_CAMPAIGN_IDS.strategy, stage: 'strategy' });
  await writeCampaignFile(fixture, campaign.id, campaign);
  const server = await startCurrentServer(fixture, { openAiBaseUrl: provider.baseUrl });
  const cookie = await authenticatedCookie(server);

  provider.queueSuccess(currentImagePromptResponse());
  const promptsFirst = await post(server, '/admin-auth/campaigns/prompts', {
    cookie,
    body: { id: campaign.id },
  });
  const completeWithoutCopy = (await promptsFirst.json()).campaign;
  assert.equal(completeWithoutCopy.stage, 'complete');
  assert.deepEqual(completeWithoutCopy.copy, {});
  assert.equal(completeWithoutCopy.imagePrompts.length, 3);

  provider.queueSuccess(currentCopy('sv'));
  provider.queueSuccess(currentCopy('en'));
  const copyAfterComplete = await post(server, '/admin-auth/campaigns/copy', {
    cookie,
    body: { id: campaign.id },
  });
  const rewound = (await copyAfterComplete.json()).campaign;
  assert.equal(rewound.stage, 'copy');
  assert.equal(rewound.imagePrompts.length, 3);
  // The durable target will use explicit stage transitions rather than preserving this reachability.
});

test('current structured generation makes one corrective retry and then exposes incomplete output', async (t) => {
  const fixture = await createCurrentFixture(t);
  const provider = await startFakeOpenAi(fixture);
  const server = await startCurrentServer(fixture, { openAiBaseUrl: provider.baseUrl });
  const cookie = await authenticatedCookie(server);

  provider.queueRawOutput('not an object');
  provider.queueSuccess(currentStrategy());
  const corrected = await post(server, '/admin-auth/campaigns/create', {
    cookie,
    body: { idea: validIdea },
  });
  assert.equal(corrected.status, 200);
  assert.equal(provider.requests.length, 2);
  assert.match(provider.requests[1].input, /previous response was rejected/i);

  provider.queueRawOutput('still not an object');
  provider.queueRawOutput('again not an object');
  const incomplete = await post(server, '/admin-auth/campaigns/create', {
    cookie,
    body: { idea: validIdea },
  });
  assert.equal(incomplete.status, 502);
  assert.deepEqual(await incomplete.json(), {
    error: 'OpenAI returned an incomplete strategy. Try again.',
  });
});

test('current generation in-flight guard rejects a competing request for the same session', async (t) => {
  const fixture = await createCurrentFixture(t);
  const provider = await startFakeOpenAi(fixture);
  const server = await startCurrentServer(fixture, { openAiBaseUrl: provider.baseUrl });
  const cookie = await authenticatedCookie(server);
  const held = provider.queueHold(currentStrategy());

  const firstPromise = post(server, '/admin-auth/campaigns/create', {
    cookie,
    body: { idea: validIdea },
  });
  await held.started;
  const competing = await post(server, '/admin-auth/campaigns/create', {
    cookie,
    body: { idea: `${validIdea} Competing request.` },
  });
  assert.equal(competing.status, 429);
  assert.deepEqual(await competing.json(), { error: 'Something is already being created.' });
  held.release();
  assert.equal((await firstPromise).status, 200);
});

test('current generation counts invalid work and blocks the thirty-first request in its window', async (t) => {
  const fixture = await createCurrentFixture(t);
  const provider = await startFakeOpenAi(fixture);
  const server = await startCurrentServer(fixture, { openAiBaseUrl: provider.baseUrl });
  const cookie = await authenticatedCookie(server);

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const invalid = await post(server, '/admin-auth/campaigns/create', {
      cookie,
      body: { idea: 'short' },
    });
    assert.equal(invalid.status, 400, `attempt ${String(attempt)}`);
    assert.deepEqual(await invalid.json(), {
      error: 'Add a little more detail to the rough idea.',
    });
  }
  const limited = await post(server, '/admin-auth/campaigns/create', {
    cookie,
    body: { idea: validIdea },
  });
  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), {
    error: 'Generation limit reached. Try again in a few minutes.',
  });
  assert.equal(provider.requests.length, 0);
});

test('current missing provider configuration precedes idea validation', async (t) => {
  const fixture = await createCurrentFixture(t);
  const server = await startCurrentServer(fixture, { omitOpenAiKey: true });
  const cookie = await authenticatedCookie(server);
  const response = await post(server, '/admin-auth/campaigns/create', {
    cookie,
    body: { idea: 'short' },
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: 'Connect OpenAI by adding OPENAI_API_KEY to .env, then restart the server.',
  });
});

test('current generation pins authentication, idea bounds, and missing-campaign errors before provider calls', async (t) => {
  const fixture = await createCurrentFixture(t);
  const provider = await startFakeOpenAi(fixture);
  const server = await startCurrentServer(fixture, { openAiBaseUrl: provider.baseUrl });

  const signedOut = await post(server, '/admin-auth/campaigns/create', {
    body: { idea: validIdea },
  });
  assert.equal(signedOut.status, 401);
  assert.deepEqual(await signedOut.json(), { error: 'Your admin session has expired.' });

  const cookie = await authenticatedCookie(server);
  for (const [idea, error] of [
    [null, 'Add a little more detail to the rough idea.'],
    ['short', 'Add a little more detail to the rough idea.'],
    ['x'.repeat(3_001), 'Keep the rough idea under 3,000 characters.'],
  ]) {
    const response = await post(server, '/admin-auth/campaigns/create', {
      cookie,
      body: { idea },
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error });
  }
  assert.equal(provider.requests.length, 0);

  provider.queueSuccess(currentStrategy());
  const maximum = await post(server, '/admin-auth/campaigns/create', {
    cookie,
    body: { idea: 'x'.repeat(3_000) },
  });
  assert.equal(maximum.status, 200);
  assert.equal(provider.requests.length, 1);

  for (const route of ['copy', 'prompts']) {
    const missing = await post(server, `/admin-auth/campaigns/${route}`, {
      cookie,
      body: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    });
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: 'That campaign no longer exists.' });
  }
  assert.equal(provider.requests.length, 1);
});

for (const scenario of [
  {
    name: 'rejected key',
    actions: [[401, 'invalid_api_key']],
    status: 502,
    error: 'OpenAI rejected the API key. Update OPENAI_API_KEY in .env.',
    requests: 1,
  },
  {
    name: 'insufficient quota',
    actions: [
      [429, 'insufficient_quota'],
      [429, 'insufficient_quota'],
    ],
    status: 503,
    error: 'The OpenAI account has no available API quota. Check billing, then try again.',
    requests: 2,
  },
  {
    name: 'provider rate limit',
    actions: [
      [429, 'rate_limit_exceeded'],
      [429, 'rate_limit_exceeded'],
    ],
    status: 429,
    error: 'OpenAI is busy right now. Try again shortly.',
    requests: 2,
  },
  {
    name: 'moderation block',
    actions: [[400, 'moderation_blocked']],
    status: 422,
    error:
      'That idea could not be used as written. Rephrase it around the offer and customer outcome.',
    requests: 1,
  },
  {
    name: 'generic provider failure',
    actions: [
      [500, 'server_error'],
      [500, 'server_error'],
    ],
    status: 502,
    error: 'OpenAI could not create the campaign right now. Try again.',
    requests: 2,
  },
]) {
  test(`current provider mapping: ${scenario.name}`, async (t) => {
    const fixture = await createCurrentFixture(t);
    const provider = await startFakeOpenAi(fixture);
    const server = await startCurrentServer(fixture, { openAiBaseUrl: provider.baseUrl });
    const cookie = await authenticatedCookie(server);
    for (const [status, code] of scenario.actions) provider.queueError(status, code);
    const response = await post(server, '/admin-auth/campaigns/create', {
      cookie,
      body: { idea: validIdea },
    });
    assert.equal(response.status, scenario.status);
    assert.deepEqual(await response.json(), { error: scenario.error });
    assert.equal(provider.requests.length, scenario.requests);
  });
}

test('current provider connection failure and campaign storage failure both map to generic 502', async (t) => {
  const fixture = await createCurrentFixture(t);
  const connectionServer = await startCurrentServer(fixture, {
    openAiBaseUrl: 'http://127.0.0.1:1/v1',
  });
  const connectionCookie = await authenticatedCookie(connectionServer);
  const connectionFailure = await post(connectionServer, '/admin-auth/campaigns/create', {
    cookie: connectionCookie,
    body: { idea: validIdea },
  });
  assert.equal(connectionFailure.status, 502);
  assert.deepEqual(await connectionFailure.json(), {
    error: 'OpenAI could not create the campaign right now. Try again.',
  });

  const storageFixture = await createCurrentFixture(t);
  const provider = await startFakeOpenAi(storageFixture);
  const fileAsCampaignRoot = path.join(storageFixture.root, 'campaign-root-is-file');
  await writeFile(fileAsCampaignRoot, 'synthetic', { mode: 0o600 });
  const storageServer = await startCurrentServer(storageFixture, {
    campaignDir: fileAsCampaignRoot,
    openAiBaseUrl: provider.baseUrl,
  });
  const storageCookie = await authenticatedCookie(storageServer);
  provider.queueSuccess(currentStrategy());
  const storageFailure = await post(storageServer, '/admin-auth/campaigns/create', {
    cookie: storageCookie,
    body: { idea: validIdea },
  });
  assert.equal(storageFailure.status, 502);
  assert.deepEqual(await storageFailure.json(), {
    error: 'The campaign could not be created right now. Try again.',
  });
});

test('current hard-coded provider timeout maps to 504 under test-only time acceleration', async (t) => {
  const fixture = await createCurrentFixture(t);
  const provider = await startFakeOpenAi(fixture);
  const first = provider.queueHold(currentStrategy());
  const second = provider.queueHold(currentStrategy());
  const server = await startCurrentServer(fixture, {
    additionalImports: [path.join(repoRoot, 'tests/server/current-timeout-clamp.mjs')],
    openAiBaseUrl: provider.baseUrl,
  });
  const cookie = await authenticatedCookie(server);
  const response = await post(server, '/admin-auth/campaigns/create', {
    cookie,
    body: { idea: validIdea },
  });
  assert.equal(response.status, 504);
  assert.deepEqual(await response.json(), {
    error: 'OpenAI took too long to respond. Try again.',
  });
  assert.equal(provider.requests.length, 2, 'the SDK retries one timed-out create request');
  first.release();
  second.release();
});

test('current generation state pins process-local cap, expiry, and in-flight retention', () => {
  assert.equal(MAX_GENERATION_STATES, 1_000);
  let now = 1_000;
  const store = createGenerationStateStore({
    maxEntries: 1,
    windowMs: 100,
    sweepIntervalMs: 10,
    now: () => now,
  });
  const active = store.get('session-a');
  active.inFlight = true;
  now += 101;
  store.sweep();
  assert.equal(store.get('session-b'), undefined);
  active.inFlight = false;
  store.sweep();
  assert.ok(store.get('session-b'));
});
