import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';

import type { ServerReleaseIdentity } from '@mikaelcedergren/cx-framework/server/server-identity';

import {
  createOwnerAuthService,
  type AuthenticationCapacityResult,
  type LoginThrottleState,
  type PersistedOwnerSession,
  type PersistentOwnerAuthRepository,
} from './auth-service.js';
import { createFaunapoolenApplication } from './app.js';
import { createFaunapoolenBrowserServing } from './browser-serving.js';
import type { FaunapoolenEnvironment } from './environment.js';
import type {
  CampaignCopyUpdate,
  CampaignMutationResult,
  CampaignRecord,
  CampaignService,
  CampaignSummary,
  DatabaseReadiness,
  GenerationAcceptance,
  GenerationService,
  GenerationStage,
  GenerationStatus,
} from './http-contracts.js';

const ORIGIN = 'http://127.0.0.1:4360';
const USERNAME = 'owner';
const PASSWORD = 'correct-horse-battery-staple';
const SESSION_SECRET = 'app-test-session-secret-'.repeat(3);
const CAMPAIGN_ID = '11111111-1111-4111-8111-111111111111';
const CREATED_CAMPAIGN_ID = '22222222-2222-4222-8222-222222222222';

class MemoryAuthRepository implements PersistentOwnerAuthRepository {
  readonly sessions = new Map<string, PersistedOwnerSession>();

  async createSessionAndClearLoginFailures(input: {
    readonly clientKeyHash: string;
    readonly session: PersistedOwnerSession;
  }): Promise<AuthenticationCapacityResult> {
    this.sessions.set(input.session.sessionIdHash, input.session);
    return 'created';
  }

  async deleteSession(sessionIdHash: string): Promise<boolean> {
    return this.sessions.delete(sessionIdHash);
  }

  async findSession(sessionIdHash: string): Promise<PersistedOwnerSession | null> {
    return this.sessions.get(sessionIdHash) ?? null;
  }

  async readLoginThrottle(): Promise<LoginThrottleState> {
    return { status: 'allowed' };
  }

  async recordLoginFailure(): Promise<LoginThrottleState> {
    return { status: 'allowed' };
  }

  async touchSession(input: {
    readonly expectedRevision: number;
    readonly lastSeenAt: number;
    readonly sessionIdHash: string;
  }): Promise<PersistedOwnerSession | null> {
    const session = this.sessions.get(input.sessionIdHash);
    if (!session || session.revision !== input.expectedRevision) return null;
    const updated = {
      ...session,
      lastSeenAt: Math.max(session.lastSeenAt, input.lastSeenAt),
      revision: session.revision + 1,
    };
    this.sessions.set(input.sessionIdHash, updated);
    return updated;
  }
}

class FakeCampaignService implements CampaignService {
  configurationFailure = false;
  deleted = false;
  revision = 7;
  readonly copyUpdates: CampaignCopyUpdate[] = [];
  readonly deletes: Array<{ readonly expectedRevision: number; readonly id: string }> = [];

  async configuration() {
    if (this.configurationFailure) throw new Error('synthetic configuration failure');
    return { limitsVerifiedOn: '2026-08-25', maxIdeaCharacters: 3_000 };
  }

  async deleteCampaign(input: {
    readonly expectedRevision: number;
    readonly id: string;
  }): Promise<CampaignMutationResult<{ readonly status: 'deleted' }>> {
    this.deletes.push(input);
    if (input.id !== CAMPAIGN_ID || this.deleted) return { status: 'not_found' };
    if (input.expectedRevision !== this.revision) {
      return { currentRevision: this.revision, status: 'revision_conflict' };
    }
    this.deleted = true;
    return { status: 'deleted' };
  }

  async getCampaign(id: string): Promise<CampaignRecord | null> {
    if (id !== CAMPAIGN_ID || this.deleted) return null;
    return this.record();
  }

  async listCampaigns(): Promise<readonly CampaignSummary[]> {
    const campaign = this.record();
    return [
      {
        createdAt: campaign.createdAt,
        id: campaign.id,
        name: campaign.name,
        revision: campaign.revision,
        stage: campaign.stage,
        updatedAt: campaign.updatedAt,
      },
    ];
  }

  async updateCopy(input: CampaignCopyUpdate): Promise<
    CampaignMutationResult<{
      readonly revision: number;
      readonly status: 'updated';
      readonly updatedAt: string;
    }>
  > {
    this.copyUpdates.push(input);
    if (input.campaignId !== CAMPAIGN_ID || this.deleted) return { status: 'not_found' };
    if (input.expectedRevision !== this.revision) {
      return { currentRevision: this.revision, status: 'revision_conflict' };
    }
    this.revision += 1;
    return {
      revision: this.revision,
      status: 'updated',
      updatedAt: '2026-08-25T12:30:00.000Z',
    };
  }

  private record(): CampaignRecord {
    return {
      createdAt: '2026-08-25T12:00:00.000Z',
      id: CAMPAIGN_ID,
      name: 'Synthetic campaign',
      revision: this.revision,
      stage: 'copy',
      updatedAt: '2026-08-25T12:15:00.000Z',
    };
  }
}

class FakeGenerationService implements GenerationService {
  readonly refinements: Parameters<GenerationService['refineCopy']>[0][] = [];
  async refineCopy(
    input: Parameters<GenerationService['refineCopy']>[0],
  ): Promise<CampaignMutationResult<GenerationAcceptance>> {
    this.refinements.push(input);
    return {
      campaignId: input.campaignId,
      campaignRevision: input.expectedRevision,
      jobId: 'job-refine-1',
      state: 'queued',
    };
  }
  readonly creates: Array<{ readonly idea: string; readonly ownerSessionIdHash: string }> = [];
  readonly retries: Array<{
    readonly campaignId: string;
    readonly expectedRevision: number;
    readonly ownerSessionIdHash: string;
    readonly stage: GenerationStage;
  }> = [];

  constructor(private readonly campaigns: FakeCampaignService) {}

  async createCampaign(input: {
    readonly idea: string;
    readonly ownerSessionIdHash: string;
  }): Promise<GenerationAcceptance> {
    this.creates.push(input);
    return {
      campaignId: CREATED_CAMPAIGN_ID,
      campaignRevision: 0,
      jobId: 'job-create-1',
      state: 'queued',
    };
  }

  async getStatus(campaignId: string): Promise<GenerationStatus | null> {
    if (campaignId === CREATED_CAMPAIGN_ID) {
      return {
        campaignId,
        campaignRevision: 0,
        jobId: 'job-create-1',
        stage: 'strategy',
        state: 'running',
        updatedAt: '2026-08-25T12:19:00.000Z',
      };
    }
    if (campaignId !== CAMPAIGN_ID || this.campaigns.deleted) return null;
    return {
      campaignId,
      campaignRevision: this.campaigns.revision,
      jobId: 'job-copy-1',
      stage: 'copy',
      state: 'running',
      updatedAt: '2026-08-25T12:20:00.000Z',
    };
  }

  async listRecoverableStatuses(): Promise<readonly GenerationStatus[]> {
    return [(await this.getStatus(CREATED_CAMPAIGN_ID))!, (await this.getStatus(CAMPAIGN_ID))!];
  }

  async retryCampaign(input: {
    readonly campaignId: string;
    readonly expectedRevision: number;
    readonly ownerSessionIdHash: string;
    readonly stage: GenerationStage;
  }): Promise<CampaignMutationResult<GenerationAcceptance>> {
    this.retries.push(input);
    if (input.campaignId !== CAMPAIGN_ID || this.campaigns.deleted) {
      return { status: 'not_found' };
    }
    if (input.expectedRevision !== this.campaigns.revision) {
      return { currentRevision: this.campaigns.revision, status: 'revision_conflict' };
    }
    this.campaigns.revision += 1;
    return {
      campaignId: CAMPAIGN_ID,
      campaignRevision: this.campaigns.revision,
      jobId: 'job-retry-1',
      state: 'queued',
    };
  }
}

interface Fixture {
  readonly baseUrl: string;
  readonly campaigns: FakeCampaignService;
  readonly generations: FakeGenerationService;
  readonly readiness: { ready: boolean } & DatabaseReadiness;
}

async function createFixture(
  t: TestContext,
  options: {
    readonly identity?: ServerReleaseIdentity;
    readonly onInternalError?: (error: unknown, request: unknown) => void;
  } = {},
): Promise<Fixture> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faunapoolen-target-app-'));
  const browserDirectory = path.join(root, 'browser');
  writeBrowserFixture(browserDirectory);
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));

  const environment = createEnvironment(root, browserDirectory);
  const campaigns = new FakeCampaignService();
  const generations = new FakeGenerationService(campaigns);
  const readiness = {
    ready: true,
    isReady() {
      return this.ready;
    },
  };
  const repository = new MemoryAuthRepository();
  const authService = createOwnerAuthService({
    cookieSecure: false,
    expectedPassword: PASSWORD,
    expectedUsername: USERNAME,
    repository,
    sessionSecret: SESSION_SECRET,
    sessionTtlSeconds: 3_600,
  });
  const app = createFaunapoolenApplication({
    authService,
    browserServing: createFaunapoolenBrowserServing(environment),
    campaignService: campaigns,
    databaseReadiness: readiness,
    environment,
    generationService: generations,
    ...(options.identity === undefined ? {} : { identity: options.identity }),
    ...(options.onInternalError === undefined ? {} : { onInternalError: options.onInternalError }),
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  t.after(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${String(address.port)}`,
    campaigns,
    generations,
    readiness,
  };
}

function createEnvironment(root: string, browserDirectory: string): FaunapoolenEnvironment {
  return {
    adminPassword: PASSWORD,
    adminUsername: USERNAME,
    appOrigin: ORIGIN,
    browserDirectory: path.join(root, 'dist', 'browser'),
    browserDirectoryOverride: browserDirectory,
    cookieSecure: false,
    dataDirectory: path.join(root, 'data'),
    databasePath: path.join(root, 'data', 'faunapoolen.db'),
    generationEnabled: false,
    host: '127.0.0.1',
    isProduction: false,
    mutationOrigins: [ORIGIN],
    nodeEnvironment: 'test',
    operationalRoot: root,
    port: 4360,
    releaseValidation: false,
    sessionSecret: SESSION_SECRET,
    sessionTtlSeconds: 3_600,
  };
}

function writeBrowserFixture(browserDirectory: string): void {
  fs.mkdirSync(path.join(browserDirectory, 'admin'), { recursive: true });
  fs.mkdirSync(path.join(browserDirectory, 'about'), { recursive: true });
  fs.mkdirSync(path.join(browserDirectory, 'api', 'admin', 'config'), { recursive: true });
  fs.writeFileSync(path.join(browserDirectory, 'index.html'), '<p>target-root</p>');
  fs.writeFileSync(path.join(browserDirectory, 'admin', 'index.html'), '<p>target-admin</p>');
  fs.writeFileSync(path.join(browserDirectory, 'about', 'index.html'), '<p>target-about</p>');
  fs.writeFileSync(
    path.join(browserDirectory, 'api', 'admin', 'config', 'index.html'),
    '<p>must-never-shadow-api</p>',
  );
  fs.writeFileSync(path.join(browserDirectory, 'koi-pond-series.html'), '<p>target-literal</p>');
  fs.writeFileSync(path.join(browserDirectory, '404.html'), '<p>target-404</p>');
  fs.writeFileSync(path.join(browserDirectory, 'main-abcdef12.js'), 'synthetic-app-bundle');
}

async function login(fixture: Fixture): Promise<string> {
  const response = await fetch(`${fixture.baseUrl}/api/admin/login`, {
    body: JSON.stringify({ password: PASSWORD, username: USERNAME }),
    headers: { 'content-type': 'application/json', origin: ORIGIN },
    method: 'POST',
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  assert.ok(cookie);
  return cookie;
}

function authenticatedHeaders(cookie: string, mutation = false): Record<string, string> {
  return {
    cookie,
    ...(mutation ? { origin: ORIGIN } : {}),
  };
}

const IDENTITY: ServerReleaseIdentity = {
  schemaVersion: 1,
  releaseId: 'synthetic-release',
  serverBuildId: `server-${'a'.repeat(64)}`,
  revision: 'b'.repeat(40),
  sourceFingerprint: 'c'.repeat(64),
  sourceDirty: false,
  artifactDigest: 'a'.repeat(64),
  createdAt: '2026-08-25T12:00:00.000Z',
  entrypoint: 'dist/index.js',
  workers: [],
  nodeMajor: 26,
  artifactFiles: 10,
  artifactBytes: 1_024,
};

test('route order preserves health, identity, static output, noindex, security, and API privacy', async (t) => {
  const fixture = await createFixture(t, { identity: IDENTITY });

  const health = await fetch(`${fixture.baseUrl}/healthz`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { app: 'faunapoolen', ok: true, port: 4360 });
  assert.equal(health.headers.get('cache-control'), 'no-store');
  assert.match(health.headers.get('x-request-id') ?? '', /^[a-f0-9-]{36}$/);
  assert.equal(health.headers.get('x-powered-by'), null);
  assert.equal(health.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(health.headers.get('cross-origin-opener-policy'), 'same-origin');

  fixture.readiness.ready = false;
  const unavailable = await fetch(`${fixture.baseUrl}/healthz`);
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await unavailable.json(), { ok: false });
  fixture.readiness.ready = true;

  const identity = await fetch(`${fixture.baseUrl}/cx-server.json`);
  assert.equal(identity.status, 200);
  assert.equal(identity.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await identity.json(), IDENTITY);

  for (const pathname of ['/admin', '/ADMIN/child', '/en/admin', '/EN/ADMIN/child']) {
    const response = await fetch(`${fixture.baseUrl}${pathname}`);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow', pathname);
  }
  const publicBoundary = await fetch(`${fixture.baseUrl}/administration`);
  assert.equal(publicBoundary.headers.get('x-robots-tag'), null);

  const session = await fetch(`${fixture.baseUrl}/api/admin/session`);
  assert.equal(session.status, 200);
  assert.equal(session.headers.get('cache-control'), 'private, no-store');
  assert.equal(session.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.deepEqual(await session.json(), { authenticated: false });

  const shadowedConfig = await fetch(`${fixture.baseUrl}/api/admin/config`);
  assert.equal(shadowedConfig.status, 401);
  assert.doesNotMatch(await shadowedConfig.text(), /must-never-shadow-api/);

  const staticPage = await fetch(`${fixture.baseUrl}/about/`);
  assert.equal(staticPage.status, 200);
  assert.match(await staticPage.text(), /target-about/);
  const literal = await fetch(`${fixture.baseUrl}/koi-pond-series.html`);
  assert.equal(literal.status, 200);
  assert.match(await literal.text(), /target-literal/);
});

test('authentication, origin, parser, request IDs, aliases, and error envelopes fail closed', async (t) => {
  const fixture = await createFixture(t);

  const missingOrigin = await fetch(`${fixture.baseUrl}/api/admin/login`, {
    body: JSON.stringify({ password: PASSWORD, username: USERNAME }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  assert.equal(missingOrigin.status, 403);
  const missingOriginBody = (await missingOrigin.json()) as {
    error: { code: string; requestId: string };
  };
  assert.equal(missingOriginBody.error.code, 'origin_required');
  assert.equal(missingOriginBody.error.requestId, missingOrigin.headers.get('x-request-id'));

  const wrongOrigin = await fetch(`${fixture.baseUrl}/api/admin/login`, {
    body: JSON.stringify({ password: PASSWORD, username: USERNAME }),
    headers: { 'content-type': 'application/json', origin: 'https://attacker.invalid' },
    method: 'POST',
  });
  assert.equal(wrongOrigin.status, 403);
  assert.equal(
    ((await wrongOrigin.json()) as { error: { code: string } }).error.code,
    'origin_not_allowed',
  );

  const malformedLogin = await fetch(`${fixture.baseUrl}/api/admin/login`, {
    body: '{',
    headers: { 'content-type': 'application/json', origin: ORIGIN },
    method: 'POST',
  });
  assert.equal(malformedLogin.status, 400);
  assert.equal(
    ((await malformedLogin.json()) as { error: { code: string } }).error.code,
    'invalid_json',
  );

  const cookie = await login(fixture);
  const session = await fetch(`${fixture.baseUrl}/api/admin/session`, {
    headers: { cookie },
  });
  assert.deepEqual(await session.json(), { authenticated: true });
  const duplicate = await fetch(`${fixture.baseUrl}/api/admin/session`, {
    headers: { cookie: `${cookie}; ${cookie}` },
  });
  assert.deepEqual(await duplicate.json(), { authenticated: false });
  const oldRaw = await fetch(`${fixture.baseUrl}/api/admin/session`, {
    headers: { cookie: `fp_admin_session=${'a'.repeat(43)}` },
  });
  assert.deepEqual(await oldRaw.json(), { authenticated: false });

  const signedOutMalformedMutation = await fetch(`${fixture.baseUrl}/api/admin/campaigns`, {
    body: '{',
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
  assert.equal(signedOutMalformedMutation.status, 401);
  assert.equal(
    ((await signedOutMalformedMutation.json()) as { error: { code: string } }).error.code,
    'authentication_required',
  );

  const signedInMissingOrigin = await fetch(`${fixture.baseUrl}/api/admin/campaigns`, {
    body: JSON.stringify({ idea: 'A sufficiently detailed campaign idea' }),
    headers: { 'content-type': 'application/json', cookie },
    method: 'POST',
  });
  assert.equal(signedInMissingOrigin.status, 403);

  const unknownApi = await fetch(`${fixture.baseUrl}/api/unknown`);
  assert.equal(unknownApi.status, 404);
  assert.equal(
    ((await unknownApi.json()) as { error: { code: string } }).error.code,
    'route_not_found',
  );

  const wrongMethod = await fetch(`${fixture.baseUrl}/api/admin/config`, {
    headers: authenticatedHeaders(cookie, true),
    method: 'POST',
  });
  assert.equal(wrongMethod.status, 404);

  const logout = await fetch(`${fixture.baseUrl}/api/admin/logout`, {
    headers: authenticatedHeaders(cookie, true),
    method: 'POST',
  });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie') ?? '', /^fp_admin_session=;/);
  const afterLogout = await fetch(`${fixture.baseUrl}/api/admin/session`, {
    headers: { cookie },
  });
  assert.deepEqual(await afterLogout.json(), { authenticated: false });
});

test('campaign and generation routes use exact HTTP methods and optimistic revisions', async (t) => {
  const fixture = await createFixture(t);
  const cookie = await login(fixture);
  const readHeaders = authenticatedHeaders(cookie);
  const mutationHeaders = {
    ...authenticatedHeaders(cookie, true),
    'content-type': 'application/json',
  };

  const config = await fetch(`${fixture.baseUrl}/api/admin/config`, { headers: readHeaders });
  assert.equal(config.status, 200);
  assert.deepEqual(await config.json(), {
    limitsVerifiedOn: '2026-08-25',
    maxIdeaCharacters: 3_000,
  });

  const list = await fetch(`${fixture.baseUrl}/api/admin/campaigns`, { headers: readHeaders });
  assert.equal(list.status, 200);
  assert.equal(((await list.json()) as { campaigns: CampaignSummary[] }).campaigns[0]?.revision, 7);

  const recoverable = await fetch(`${fixture.baseUrl}/api/admin/generations`, {
    headers: readHeaders,
  });
  assert.equal(recoverable.status, 200);
  assert.deepEqual(
    ((await recoverable.json()) as { generations: GenerationStatus[] }).generations.map(
      ({ campaignId, campaignRevision, stage, state }) => ({
        campaignId,
        campaignRevision,
        stage,
        state,
      }),
    ),
    [
      {
        campaignId: CREATED_CAMPAIGN_ID,
        campaignRevision: 0,
        stage: 'strategy',
        state: 'running',
      },
      {
        campaignId: CAMPAIGN_ID,
        campaignRevision: 7,
        stage: 'copy',
        state: 'running',
      },
    ],
  );

  const campaign = await fetch(`${fixture.baseUrl}/api/admin/campaigns/${CAMPAIGN_ID}`, {
    headers: readHeaders,
  });
  assert.equal(campaign.status, 200);
  assert.equal(campaign.headers.get('etag'), '"7"');

  const status = await fetch(`${fixture.baseUrl}/api/admin/campaigns/${CAMPAIGN_ID}/status`, {
    headers: readHeaders,
  });
  assert.equal(status.status, 200);
  assert.equal(status.headers.get('etag'), '"7"');
  assert.equal(((await status.json()) as { status: GenerationStatus }).status.state, 'running');

  const create = await fetch(`${fixture.baseUrl}/api/admin/campaigns`, {
    body: JSON.stringify({ idea: '  A sufficiently detailed campaign idea  ' }),
    headers: mutationHeaders,
    method: 'POST',
  });
  assert.equal(create.status, 202);
  assert.equal(create.headers.get('etag'), null);
  const createdGeneration = ((await create.json()) as { generation: GenerationAcceptance })
    .generation;
  assert.equal(createdGeneration.campaignId, CREATED_CAMPAIGN_ID);
  assert.equal(createdGeneration.campaignRevision, 0);
  assert.equal(fixture.generations.creates[0]?.idea, '  A sufficiently detailed campaign idea  ');

  const preCampaignStatus = await fetch(
    `${fixture.baseUrl}/api/admin/campaigns/${CREATED_CAMPAIGN_ID}/status`,
    { headers: readHeaders },
  );
  assert.equal(preCampaignStatus.status, 200);
  assert.equal(preCampaignStatus.headers.get('etag'), null);
  assert.equal(
    ((await preCampaignStatus.json()) as { status: GenerationStatus }).status.campaignRevision,
    0,
  );

  const extraCreateField = await fetch(`${fixture.baseUrl}/api/admin/campaigns`, {
    body: JSON.stringify({ extra: true, idea: 'A sufficiently detailed campaign idea' }),
    headers: mutationHeaders,
    method: 'POST',
  });
  assert.equal(extraCreateField.status, 400);

  const staleCopy = await fetch(`${fixture.baseUrl}/api/admin/campaigns/${CAMPAIGN_ID}/copy`, {
    body: JSON.stringify({
      expectedRevision: 6,
      field: 'headline',
      language: 'sv',
      value: 'Changed headline',
    }),
    headers: mutationHeaders,
    method: 'PATCH',
  });
  assert.equal(staleCopy.status, 409);
  assert.deepEqual(
    ((await staleCopy.json()) as { error: { code: string; details: unknown } }).error,
    {
      code: 'revision_conflict',
      details: { currentRevision: 7 },
      message: 'The campaign changed after it was opened. Reload it and try again.',
      requestId: staleCopy.headers.get('x-request-id'),
    },
  );

  const copy = await fetch(`${fixture.baseUrl}/api/admin/campaigns/${CAMPAIGN_ID}/copy`, {
    body: JSON.stringify({
      expectedRevision: 7,
      field: 'hashtags',
      language: 'en',
      value: [' #pond ', '#water'],
    }),
    headers: mutationHeaders,
    method: 'PATCH',
  });
  assert.equal(copy.status, 200);
  assert.equal(copy.headers.get('etag'), '"8"');
  assert.deepEqual(await copy.json(), {
    ok: true,
    revision: 8,
    updatedAt: '2026-08-25T12:30:00.000Z',
  });
  assert.deepEqual(fixture.campaigns.copyUpdates[1]?.value, ['#pond', '#water']);

  const staleRetry = await fetch(`${fixture.baseUrl}/api/admin/campaigns/${CAMPAIGN_ID}/retry`, {
    body: JSON.stringify({ expectedRevision: 7, stage: 'copy' }),
    headers: mutationHeaders,
    method: 'POST',
  });
  assert.equal(staleRetry.status, 409);

  const preCampaignRetry = await fetch(
    `${fixture.baseUrl}/api/admin/campaigns/${CAMPAIGN_ID}/retry`,
    {
      body: JSON.stringify({ expectedRevision: 0, stage: 'strategy' }),
      headers: mutationHeaders,
      method: 'POST',
    },
  );
  assert.equal(
    preCampaignRetry.status,
    409,
    'revision zero reaches the durable generation service',
  );

  const retry = await fetch(`${fixture.baseUrl}/api/admin/campaigns/${CAMPAIGN_ID}/retry`, {
    body: JSON.stringify({ expectedRevision: 8, stage: 'copy' }),
    headers: mutationHeaders,
    method: 'POST',
  });
  assert.equal(retry.status, 202);
  assert.equal(retry.headers.get('etag'), '"9"');

  const missingIfMatch = await fetch(`${fixture.baseUrl}/api/admin/campaigns/${CAMPAIGN_ID}`, {
    headers: authenticatedHeaders(cookie, true),
    method: 'DELETE',
  });
  assert.equal(missingIfMatch.status, 428);
  assert.equal(
    ((await missingIfMatch.json()) as { error: { code: string } }).error.code,
    'revision_required',
  );
  for (const invalid of ['*', 'W/"9"', '"9", "10"', '9']) {
    const response = await fetch(`${fixture.baseUrl}/api/admin/campaigns/${CAMPAIGN_ID}`, {
      headers: { ...authenticatedHeaders(cookie, true), 'if-match': invalid },
      method: 'DELETE',
    });
    assert.equal(response.status, 400, invalid);
  }

  const staleDelete = await fetch(`${fixture.baseUrl}/api/admin/campaigns/${CAMPAIGN_ID}`, {
    headers: { ...authenticatedHeaders(cookie, true), 'if-match': '"8"' },
    method: 'DELETE',
  });
  assert.equal(staleDelete.status, 409);

  const deleted = await fetch(`${fixture.baseUrl}/api/admin/campaigns/${CAMPAIGN_ID}`, {
    headers: { ...authenticatedHeaders(cookie, true), 'if-match': '"9"' },
    method: 'DELETE',
  });
  assert.equal(deleted.status, 200);
  assert.deepEqual(await deleted.json(), { ok: true });
  assert.deepEqual(fixture.campaigns.deletes.at(-1), {
    expectedRevision: 9,
    id: CAMPAIGN_ID,
  });
});

test('unknown implementation failures are hidden, logged once, and keep their request ID', async (t) => {
  const internalErrors: Array<{ error: unknown; request: unknown }> = [];
  const fixture = await createFixture(t, {
    onInternalError(error, request) {
      internalErrors.push({ error, request });
    },
  });
  fixture.campaigns.configurationFailure = true;
  const cookie = await login(fixture);
  const response = await fetch(`${fixture.baseUrl}/api/admin/config`, {
    headers: authenticatedHeaders(cookie),
  });
  assert.equal(response.status, 500);
  const body = (await response.json()) as {
    error: { code: string; message: string; requestId: string };
  };
  assert.deepEqual(body.error, {
    code: 'internal_error',
    message: 'The request could not be completed.',
    requestId: response.headers.get('x-request-id'),
  });
  assert.equal(internalErrors.length, 1);
  assert.match(String(internalErrors[0]?.error), /synthetic configuration failure/);
});

test('refinement uses authenticated origin-protected admission with an exact bounded draft', async (t) => {
  const fixture = await createFixture(t);
  const url = `${fixture.baseUrl}/api/admin/campaigns/${CAMPAIGN_ID}/refine`;
  const body = {
    expectedRevision: 3,
    language: 'en',
    draft: {
      headline: 'An intentionally overlong headline that the tool should improve',
      description: 'Natural pools',
      primaryText: 'A quieter garden',
      fullCaption: 'A quieter garden to share',
      callToAction: 'Explore your garden',
      hashtags: ['#pool', '#garden', '#water'],
    },
  };
  const signedOut = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', origin: ORIGIN },
  });
  assert.equal(signedOut.status, 401);
  const cookie = await login(fixture);
  const wrongOrigin = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { cookie, 'content-type': 'application/json', origin: 'https://untrusted.example' },
  });
  assert.equal(wrongOrigin.status, 403);
  const headers = { ...authenticatedHeaders(cookie, true), 'content-type': 'application/json' };
  const invalid = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...body, draft: { ...body.draft, arbitrary: true } }),
  });
  assert.equal(invalid.status, 400);
  assert.equal(fixture.generations.refinements.length, 0);
  const accepted = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  assert.equal(accepted.status, 202);
  assert.deepEqual(fixture.generations.refinements[0]?.refinement.draft, body.draft);
});
