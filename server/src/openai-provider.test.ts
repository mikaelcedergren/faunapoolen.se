import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import test, { type TestContext } from 'node:test';

import type { JsonValue } from '@mikaelcedergren/cx-framework/server/errors';

import type {
  GenerationRepository,
  ProviderEffect,
  ProviderEffectState,
} from './campaign-repository.js';
import { ProviderResponseCapacityError } from './campaign-repository.js';
import type { StructuredGenerationSpec, ValidationResult } from './generation-content.js';
import {
  createOpenAiResponsesProvider,
  GenerationProviderPendingError,
  GenerationProviderTerminalError,
} from './openai-provider.js';

const RUN_ID = '22222222-2222-4222-8222-222222222222';
const NOW = 1_800_000_000_000;

test('one background create is fenced before completed output is interpreted', async () => {
  const repository = new EffectRepository();
  const requests: RequestRecord[] = [];
  const provider = providerFixture(repository, requests, async (_url, init) => {
    return jsonResponse(completed('resp_success_0001', { value: 'ok' }));
  });

  const value = await provider.generateStructured({
    runId: RUN_ID,
    signal: new AbortController().signal,
    spec,
  });

  assert.deepEqual(value, { value: 'ok' });
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.method, 'POST');
  assert.equal(requests[0]?.url, 'http://127.0.0.1:4545/v1/responses');
  assert.equal(requests[0]?.redirect, 'error');
  assert.deepEqual(requests[0]?.body, {
    background: true,
    input: 'Initial input',
    instructions: 'Instructions',
    max_output_tokens: 128,
    model: 'gpt-5.6-terra',
    store: true,
    text: {
      format: {
        name: 'test_output',
        schema: { additionalProperties: false, type: 'object' },
        strict: true,
        type: 'json_schema',
      },
      verbosity: 'medium',
    },
  });
  assert.deepEqual(repository.transitions, ['prepared', 'creating', 'submitted', 'succeeded']);
  assert.equal(repository.only().providerResponseId, 'resp_success_0001');
});

test('queued create resumes by response id and never sends a second create', async () => {
  const repository = new EffectRepository();
  const requests: RequestRecord[] = [];
  const responses = [
    jsonResponse({ id: 'resp_polling_0001', status: 'queued' }),
    jsonResponse(completed('resp_polling_0001', { value: 'done' })),
  ];
  const provider = providerFixture(repository, requests, async () => {
    const response = responses.shift();
    if (!response) throw new Error('Unexpected provider call.');
    return response;
  });

  assert.deepEqual(
    await provider.generateStructured({
      runId: RUN_ID,
      signal: new AbortController().signal,
      spec,
    }),
    { value: 'done' },
  );
  assert.deepEqual(
    requests.map(({ method, url }) => ({ method, url })),
    [
      { method: 'POST', url: 'http://127.0.0.1:4545/v1/responses' },
      {
        method: 'GET',
        url: 'http://127.0.0.1:4545/v1/responses/resp_polling_0001',
      },
    ],
  );
  assert.deepEqual(
    requests.map(({ redirect }) => redirect),
    ['error', 'error'],
  );
  assert.deepEqual(repository.transitions, [
    'prepared',
    'creating',
    'submitted',
    'polling',
    'succeeded',
  ]);
});

test('a create transport failure is ambiguous and cannot replay', async () => {
  const repository = new EffectRepository();
  const requests: RequestRecord[] = [];
  const provider = providerFixture(repository, requests, async () => {
    throw new Error('synthetic connection reset');
  });

  await assert.rejects(
    provider.generateStructured({
      runId: RUN_ID,
      signal: new AbortController().signal,
      spec,
    }),
    (error: unknown) =>
      error instanceof GenerationProviderTerminalError && error.outcome === 'ambiguous',
  );
  await assert.rejects(
    provider.generateStructured({
      runId: RUN_ID,
      signal: new AbortController().signal,
      spec,
    }),
    (error: unknown) =>
      error instanceof GenerationProviderTerminalError && error.outcome === 'ambiguous',
  );
  assert.equal(requests.filter((request) => request.method === 'POST').length, 1);
  assert.equal(repository.only().state, 'ambiguous');
});

test('408 and 5xx create responses are ambiguous and never replayed for the same effect', async (t) => {
  for (const status of [408, 500, 503]) {
    await t.test(String(status), async () => {
      const repository = new EffectRepository();
      const requests: RequestRecord[] = [];
      const provider = providerFixture(repository, requests, async () =>
        jsonResponse({ error: 'synthetic' }, status),
      );
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await assert.rejects(
          provider.generateStructured({
            runId: RUN_ID,
            signal: new AbortController().signal,
            spec,
          }),
          (error: unknown) =>
            error instanceof GenerationProviderTerminalError && error.outcome === 'ambiguous',
        );
      }
      assert.equal(requests.length, 1);
      assert.equal(repository.only().state, 'ambiguous');
    });
  }
});

test('unknown create status and malformed success receipts are ambiguous without replay', async (t) => {
  for (const scenario of [
    {
      name: 'unknown HTTP status',
      response: () => jsonResponse({ error: 'synthetic unknown status' }, 418),
    },
    {
      name: 'success without response id',
      response: () => jsonResponse({ status: 'queued' }),
    },
    {
      name: 'malformed success body',
      response: () =>
        new Response('{', { headers: { 'Content-Type': 'application/json' }, status: 200 }),
    },
  ]) {
    await t.test(scenario.name, async () => {
      const repository = new EffectRepository();
      const requests: RequestRecord[] = [];
      const provider = providerFixture(repository, requests, async () => scenario.response());
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await assert.rejects(
          provider.generateStructured({
            runId: RUN_ID,
            signal: new AbortController().signal,
            spec,
          }),
          (error: unknown) =>
            error instanceof GenerationProviderTerminalError && error.outcome === 'ambiguous',
        );
      }
      assert.equal(requests.length, 1);
      assert.equal(repository.only().state, 'ambiguous');
    });
  }
});

test('a stalled create response body is bounded and remains a one-shot ambiguous effect', async () => {
  const repository = new EffectRepository();
  let creates = 0;
  const provider = createOpenAiResponsesProvider({
    apiKey: 'synthetic-stalled-create-key',
    baseUrl: 'http://127.0.0.1:4545/v1',
    fetch: async () => {
      creates += 1;
      return new Response(new ReadableStream<Uint8Array>());
    },
    repository,
    requestTimeoutMs: 10,
  });
  const startedAt = Date.now();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await assert.rejects(
      provider.generateStructured({
        runId: RUN_ID,
        signal: new AbortController().signal,
        spec,
      }),
      (error: unknown) =>
        error instanceof GenerationProviderTerminalError && error.outcome === 'ambiguous',
    );
  }
  assert.ok(Date.now() - startedAt < 500);
  assert.equal(creates, 1);
  assert.equal(repository.only().state, 'ambiguous');
});

test('explicit no-create rejection statuses are terminal failed receipts', async () => {
  const repository = new EffectRepository();
  const requests: RequestRecord[] = [];
  const provider = providerFixture(repository, requests, async () =>
    jsonResponse({ error: 'synthetic validation rejection' }, 422),
  );
  await assert.rejects(
    provider.generateStructured({
      runId: RUN_ID,
      signal: new AbortController().signal,
      spec,
    }),
    (error: unknown) =>
      error instanceof GenerationProviderTerminalError && error.outcome === 'failed',
  );
  assert.equal(repository.only().state, 'rejected');
  assert.equal(requests.length, 1);
});

test('native fetch rejects a create redirect without replaying or forwarding authorization', async (t) => {
  const counts = { create: 0, redirected: 0 };
  const server = createServer((request, response) => {
    if (request.url === '/v1/responses') {
      counts.create += 1;
      response.writeHead(307, { Location: '/redirected' });
      response.end();
      return;
    }
    if (request.url === '/redirected') counts.redirected += 1;
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(completed('resp_redirected_0001', { value: 'forbidden' })));
  });
  const baseUrl = await listen(t, server);
  const repository = new EffectRepository();
  const provider = createOpenAiResponsesProvider({
    apiKey: 'synthetic-redirect-api-key',
    baseUrl: `${baseUrl}/v1`,
    delay: async () => {},
    repository,
    requestTimeoutMs: 1_000,
  });

  await assert.rejects(
    provider.generateStructured({
      runId: RUN_ID,
      signal: new AbortController().signal,
      spec,
    }),
    (error: unknown) =>
      error instanceof GenerationProviderTerminalError && error.outcome === 'ambiguous',
  );
  assert.deepEqual(counts, { create: 1, redirected: 0 });
  assert.equal(repository.only().state, 'ambiguous');
});

test('a recovered creating receipt without an id is quarantined without a fetch', async () => {
  const repository = new EffectRepository();
  const firstRequests: RequestRecord[] = [];
  const first = providerFixture(repository, firstRequests, async () => {
    throw new Error('synthetic crash boundary');
  });
  await assert.rejects(
    first.generateStructured({ runId: RUN_ID, signal: new AbortController().signal, spec }),
  );
  repository.forceState('creating');

  const resumedRequests: RequestRecord[] = [];
  const resumed = providerFixture(repository, resumedRequests, async () => {
    throw new Error('Fetch must not run.');
  });
  await assert.rejects(
    resumed.generateStructured({ runId: RUN_ID, signal: new AbortController().signal, spec }),
    (error: unknown) =>
      error instanceof GenerationProviderTerminalError && error.outcome === 'ambiguous',
  );
  assert.equal(resumedRequests.length, 0);
  assert.equal(repository.only().state, 'ambiguous');
});

test('a submitted receipt resumes GET after restart and a succeeded receipt is read-only', async () => {
  const repository = new EffectRepository();
  const firstRequests: RequestRecord[] = [];
  const first = providerFixture(repository, firstRequests, async () => {
    throw new Error('synthetic connection reset');
  });
  await assert.rejects(
    first.generateStructured({ runId: RUN_ID, signal: new AbortController().signal, spec }),
  );
  repository.forceState('submitted', 'resp_restart_0001');

  const resumedRequests: RequestRecord[] = [];
  const resumed = providerFixture(repository, resumedRequests, async () =>
    jsonResponse(completed('resp_restart_0001', { value: 'resumed' })),
  );
  assert.deepEqual(
    await resumed.generateStructured({
      runId: RUN_ID,
      signal: new AbortController().signal,
      spec,
    }),
    { value: 'resumed' },
  );
  assert.deepEqual(
    resumedRequests.map((request) => request.method),
    ['GET'],
  );

  const replayRequests: RequestRecord[] = [];
  const replay = providerFixture(repository, replayRequests, async () => {
    throw new Error('Fetch must not run for a succeeded receipt.');
  });
  assert.deepEqual(
    await replay.generateStructured({
      runId: RUN_ID,
      signal: new AbortController().signal,
      spec,
    }),
    { value: 'resumed' },
  );
  assert.equal(replayRequests.length, 0);
});

test('retrieval ignores missing and mismatched response ids, including completed bodies', async () => {
  const repository = new EffectRepository();
  const requests: RequestRecord[] = [];
  const responses = [
    jsonResponse({ id: 'resp_expected_0001', status: 'queued' }),
    jsonResponse(completed('resp_different_0001', { value: 'wrong receipt' })),
    jsonResponse({ output: [], status: 'completed' }),
    jsonResponse(completed('resp_expected_0001', { value: 'right receipt' })),
  ];
  const provider = providerFixture(repository, requests, async () => {
    const response = responses.shift();
    if (!response) throw new Error('Unexpected provider call.');
    return response;
  });

  assert.deepEqual(
    await provider.generateStructured({
      runId: RUN_ID,
      signal: new AbortController().signal,
      spec,
    }),
    { value: 'right receipt' },
  );
  assert.equal(requests.filter((request) => request.method === 'POST').length, 1);
  assert.equal(requests.filter((request) => request.method === 'GET').length, 3);
  assert.equal(repository.only().providerResponseId, 'resp_expected_0001');
});

test('missing and unknown statuses remain safely retrievable by their durable response id', async () => {
  const repository = new EffectRepository();
  const requests: RequestRecord[] = [];
  const responses = [
    jsonResponse({ id: 'resp_status_0001' }),
    jsonResponse({ id: 'resp_status_0001', status: 'future_provider_status' }),
    jsonResponse(completed('resp_status_0001', { value: 'eventually completed' })),
  ];
  const provider = providerFixture(repository, requests, async () => {
    const response = responses.shift();
    if (!response) throw new Error('Unexpected provider call.');
    return response;
  });

  assert.deepEqual(
    await provider.generateStructured({
      runId: RUN_ID,
      signal: new AbortController().signal,
      spec,
    }),
    { value: 'eventually completed' },
  );
  assert.deepEqual(
    requests.map(({ method }) => method),
    ['POST', 'GET', 'GET'],
  );
  assert.equal(repository.only().state, 'succeeded');
});

test('retrieval non-success responses remain bounded and resume only by durable response id', async () => {
  const repository = new EffectRepository();
  const requests: RequestRecord[] = [];
  const responses = [
    jsonResponse({ id: 'resp_retrieve_0001', status: 'queued' }),
    jsonResponse({ error: 'synthetic retrieval outage' }, 503),
    jsonResponse(completed('resp_retrieve_0001', { value: 'retrieved safely' })),
  ];
  const provider = providerFixture(repository, requests, async () => {
    const response = responses.shift();
    if (!response) throw new Error('Unexpected provider call.');
    return response;
  });

  assert.deepEqual(
    await provider.generateStructured({
      runId: RUN_ID,
      signal: new AbortController().signal,
      spec,
    }),
    { value: 'retrieved safely' },
  );
  assert.deepEqual(
    requests.map(({ method, redirect }) => ({ method, redirect })),
    [
      { method: 'POST', redirect: 'error' },
      { method: 'GET', redirect: 'error' },
      { method: 'GET', redirect: 'error' },
    ],
  );
  assert.equal(repository.only().providerResponseId, 'resp_retrieve_0001');
  assert.equal(repository.only().state, 'succeeded');
});

test('a stalled retrieval body is cut off by the polling deadline without another create', async () => {
  const repository = new EffectRepository();
  const requests: RequestRecord[] = [];
  const provider = createOpenAiResponsesProvider({
    apiKey: 'synthetic-stalled-body-key',
    baseUrl: 'http://127.0.0.1:4545/v1',
    delay: async () => {},
    fetch: async (input, init = {}) => {
      requests.push({
        body:
          typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, JsonValue>) : {},
        method: init.method ?? 'GET',
        redirect: init.redirect,
        url: String(input),
      });
      if (init.method === 'POST') {
        return jsonResponse({ id: 'resp_stalled_0001', status: 'queued' });
      }
      return new Response(new ReadableStream<Uint8Array>());
    },
    pollIntervalMs: 1,
    repository,
    requestTimeoutMs: 1_000,
  });
  const startedAt = Date.now();

  await assert.rejects(
    provider.generateStructured({
      runId: RUN_ID,
      signal: new AbortController().signal,
      spec: (correction) => ({ ...spec(correction), pollDeadlineMs: 20 }),
    }),
    (error: unknown) => error instanceof GenerationProviderPendingError,
  );
  assert.ok(Date.now() - startedAt < 500);
  // Timer precision may leave enough polling budget for another idempotent retrieval. The safety
  // boundary is one paid create followed only by response-id retrievals, not an exact GET count.
  assert.equal(requests[0]?.method, 'POST');
  assert.ok(requests.length >= 2);
  assert.ok(requests.slice(1).every(({ method }) => method === 'GET'));
  assert.equal(repository.only().state, 'polling');
  assert.equal(repository.only().providerResponseId, 'resp_stalled_0001');
});

test('completed output waits for receipt capacity and resumes by id without another create', async () => {
  const repository = new CapacityEffectRepository();
  const requests: RequestRecord[] = [];
  const provider = providerFixture(repository, requests, async () =>
    jsonResponse(completed('resp_capacity_0001', { value: 'durable after maintenance' })),
  );

  let pending: GenerationProviderPendingError | undefined;
  await assert.rejects(
    provider.generateStructured({
      runId: RUN_ID,
      signal: new AbortController().signal,
      spec,
    }),
    (error: unknown) => {
      if (error instanceof GenerationProviderPendingError) pending = error;
      return (
        error instanceof GenerationProviderPendingError &&
        error.code === 'provider_response_storage_pending'
      );
    },
  );
  assert.ok(pending);
  assert.equal(repository.only().state, 'submitted');
  assert.equal(repository.only().providerResponseId, 'resp_capacity_0001');
  assert.equal(requests.filter(({ method }) => method === 'POST').length, 1);

  repository.responseCapacityAvailable = true;
  assert.deepEqual(
    await provider.generateStructured({
      runId: RUN_ID,
      signal: new AbortController().signal,
      spec,
    }),
    { value: 'durable after maintenance' },
  );
  assert.deepEqual(
    requests.map(({ method }) => method),
    ['POST', 'GET'],
  );
  assert.equal(repository.only().state, 'succeeded');
});

test('a succeeded receipt is never interpreted when its saved response id differs', async () => {
  const repository = new EffectRepository();
  const requests: RequestRecord[] = [];
  const provider = providerFixture(repository, requests, async () =>
    jsonResponse(completed('resp_saved_0001', { value: 'saved' })),
  );
  assert.deepEqual(
    await provider.generateStructured({
      runId: RUN_ID,
      signal: new AbortController().signal,
      spec,
    }),
    { value: 'saved' },
  );
  repository.forceResponse(completed('resp_other_0001', { value: 'wrong' }));

  await assert.rejects(
    provider.generateStructured({
      runId: RUN_ID,
      signal: new AbortController().signal,
      spec,
    }),
    (error: unknown) =>
      error instanceof GenerationProviderTerminalError &&
      error.code === 'provider_receipt_corrupt' &&
      error.outcome === 'ambiguous',
  );
  assert.equal(requests.length, 1);
});

test('invalid structured output creates exactly one separately receipted correction', async () => {
  const repository = new EffectRepository();
  const requests: RequestRecord[] = [];
  const responses = [
    jsonResponse(completed('resp_correct_0001', { wrong: true })),
    jsonResponse(completed('resp_correct_0002', { value: 'corrected' })),
  ];
  const provider = providerFixture(repository, requests, async () => {
    const response = responses.shift();
    if (!response) throw new Error('A third provider request is forbidden.');
    return response;
  });

  assert.deepEqual(
    await provider.generateStructured({
      runId: RUN_ID,
      signal: new AbortController().signal,
      spec,
    }),
    { value: 'corrected' },
  );
  const posts = requests.filter((request) => request.method === 'POST');
  assert.equal(posts.length, 2);
  assert.match(String(posts[1]?.body['input']), /previous response was rejected/u);
  assert.equal(repository.effects.size, 2);
  assert.equal(new Set([...repository.effects.values()].map((effect) => effect.effectKey)).size, 2);
});

test('two invalid responses stop without a hidden third attempt', async () => {
  const repository = new EffectRepository();
  const requests: RequestRecord[] = [];
  const provider = providerFixture(repository, requests, async (_url, _init, index) =>
    jsonResponse(completed(`resp_invalid_000${String(index + 1)}`, { wrong: true })),
  );

  await assert.rejects(
    provider.generateStructured({
      runId: RUN_ID,
      signal: new AbortController().signal,
      spec,
    }),
    (error: unknown) =>
      error instanceof GenerationProviderTerminalError &&
      error.code === 'structured_output_invalid' &&
      error.outcome === 'failed',
  );
  assert.equal(requests.length, 2);
});

test('bounded polling leaves a resumable receipt and can be explicitly terminalized', async () => {
  const repository = new EffectRepository();
  const requests: RequestRecord[] = [];
  const times = [NOW, NOW, NOW + 50];
  let lateCompletionReady = false;
  const provider = providerFixture(
    repository,
    requests,
    async (_url, _init, index) =>
      jsonResponse(
        lateCompletionReady
          ? completed('resp_pending_0001', { value: 'late completion' })
          : { id: 'resp_pending_0001', status: index === 0 ? 'queued' : 'in_progress' },
      ),
    () => times.shift() ?? NOW + 50,
    50,
  );

  let pending: GenerationProviderPendingError | undefined;
  await assert.rejects(
    provider.generateStructured({
      runId: RUN_ID,
      signal: new AbortController().signal,
      spec: (correction) => ({ ...spec(correction), pollDeadlineMs: 50 }),
    }),
    (error: unknown) => {
      if (error instanceof GenerationProviderPendingError) pending = error;
      return error instanceof GenerationProviderPendingError;
    },
  );
  assert.ok(pending);
  assert.equal(repository.only().state, 'polling');
  const requestCount = requests.length;
  provider.quarantinePending(
    pending.effectId,
    'provider_poll_ambiguous',
    'The provider response may still complete and must be checked before retrying.',
  );
  assert.equal(repository.only().state, 'ambiguous');
  lateCompletionReady = true;
  provider.quarantinePending(
    pending.effectId,
    'provider_poll_ambiguous',
    'The provider response may still complete and must be checked before retrying.',
  );
  await assert.rejects(
    provider.generateStructured({
      runId: RUN_ID,
      signal: new AbortController().signal,
      spec,
    }),
    (error: unknown) =>
      error instanceof GenerationProviderTerminalError &&
      error.code === 'provider_poll_ambiguous' &&
      error.outcome === 'ambiguous',
  );
  assert.equal(requests.length, requestCount);
});

interface RequestRecord {
  readonly body: Record<string, JsonValue>;
  readonly method: string;
  readonly redirect: RequestInit['redirect'];
  readonly url: string;
}

function providerFixture(
  repository: EffectRepository,
  requests: RequestRecord[],
  respond: (url: string, init: RequestInit, index: number) => Promise<Response>,
  clock: () => number = () => NOW,
  pollIntervalMs = 1,
) {
  return createOpenAiResponsesProvider({
    apiKey: 'synthetic-test-api-key',
    baseUrl: 'http://127.0.0.1:4545/v1',
    clock,
    delay: async () => {},
    fetch: async (input, init = {}) => {
      const body =
        typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, JsonValue>) : {};
      const request = {
        body,
        method: init.method ?? 'GET',
        redirect: init.redirect,
        url: String(input),
      };
      requests.push(request);
      return respond(request.url, init, requests.length - 1);
    },
    pollIntervalMs,
    repository,
    requestTimeoutMs: 1_000,
  });
}

function spec(correction?: string): StructuredGenerationSpec<{ readonly value: string }> {
  return Object.freeze({
    format: Object.freeze({
      name: 'test_output',
      schema: Object.freeze({ additionalProperties: false, type: 'object' }),
      strict: true,
      type: 'json_schema',
    }),
    input:
      correction === undefined
        ? 'Initial input'
        : `Initial input\n\nThe previous response was rejected: ${correction}.`,
    instructions: 'Instructions',
    maxOutputTokens: 128,
    operation: 'test.operation',
    pollDeadlineMs: 1_000,
    validate(value: unknown): ValidationResult<{ readonly value: string }> {
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        typeof (value as Record<string, unknown>)['value'] === 'string'
      ) {
        return Object.freeze({
          ok: true,
          value: Object.freeze({ value: (value as Record<string, string>)['value'] as string }),
        });
      }
      return Object.freeze({ error: 'the value field is missing', ok: false });
    },
  });
}

function completed(id: string, output: JsonValue): JsonValue {
  return {
    id,
    output: [
      {
        content: [{ text: JSON.stringify(output), type: 'output_text' }],
        type: 'message',
      },
    ],
    status: 'completed',
  };
}

function jsonResponse(value: JsonValue, status = 200): Response {
  return new Response(JSON.stringify(value), {
    headers: { 'Content-Type': 'application/json' },
    status,
  });
}

class EffectRepository {
  readonly effects = new Map<string, ProviderEffect>();
  readonly transitions: ProviderEffectState[] = [];

  getEffect(effectId: string): ProviderEffect | null {
    return this.effects.get(effectId) ?? null;
  }

  prepareEffect(input: Parameters<GenerationRepository['prepareEffect']>[0]): ProviderEffect {
    const existing = this.effects.get(input.effectId);
    if (existing) return existing;
    const effect: ProviderEffect = Object.freeze({
      createdAt: NOW,
      effectId: input.effectId,
      effectKey: input.effectKey,
      errorCode: null,
      errorMessage: null,
      finishedAt: null,
      operation: input.operation,
      providerResponseId: null,
      requestSha256: input.requestSha256,
      response: null,
      responseSha256: null,
      revision: 1,
      runId: input.runId,
      state: 'prepared',
      updatedAt: NOW,
    });
    this.effects.set(effect.effectId, effect);
    this.transitions.push('prepared');
    return effect;
  }

  transitionEffect(input: Parameters<GenerationRepository['transitionEffect']>[0]): ProviderEffect {
    const current = this.effects.get(input.effectId);
    if (!current || current.revision !== input.expectedRevision) {
      throw new Error('Synthetic effect revision conflict.');
    }
    const terminal = ['ambiguous', 'rejected', 'succeeded'].includes(input.state);
    const response = input.response ?? null;
    const effect: ProviderEffect = Object.freeze({
      ...current,
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
      finishedAt: terminal ? NOW : null,
      providerResponseId: input.providerResponseId ?? current.providerResponseId,
      response,
      responseSha256: response === null ? null : sha256(JSON.stringify(response)),
      revision: current.revision + 1,
      state: input.state,
      updatedAt: NOW,
    });
    this.effects.set(effect.effectId, effect);
    this.transitions.push(effect.state);
    return effect;
  }

  forceState(state: ProviderEffectState, providerResponseId: string | null = null): void {
    const current = this.only();
    this.effects.set(
      current.effectId,
      Object.freeze({
        ...current,
        errorCode: state === 'ambiguous' ? current.errorCode : null,
        errorMessage: state === 'ambiguous' ? current.errorMessage : null,
        finishedAt: ['ambiguous', 'rejected', 'succeeded'].includes(state) ? NOW : null,
        providerResponseId,
        response: null,
        responseSha256: null,
        revision: current.revision + 1,
        state,
      }),
    );
  }

  forceResponse(response: JsonValue): void {
    const current = this.only();
    this.effects.set(
      current.effectId,
      Object.freeze({
        ...current,
        response,
        responseSha256: sha256(JSON.stringify(response)),
      }),
    );
  }

  only(): ProviderEffect {
    assert.equal(this.effects.size, 1);
    const effect = this.effects.values().next().value as ProviderEffect | undefined;
    assert.ok(effect);
    return effect;
  }
}

class CapacityEffectRepository extends EffectRepository {
  responseCapacityAvailable = false;

  override transitionEffect(
    input: Parameters<GenerationRepository['transitionEffect']>[0],
  ): ProviderEffect {
    if (input.state === 'succeeded' && !this.responseCapacityAvailable) {
      throw new ProviderResponseCapacityError();
    }
    return super.transitionEffect(input);
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function listen(t: TestContext, server: ReturnType<typeof createServer>): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
    server.listen(0, '127.0.0.1');
  });
  t.after(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${String(address.port)}`;
}
