import assert from 'node:assert/strict';
import test from 'node:test';

import { HttpError } from '@mikaelcedergren/cx-framework/server/errors';

import {
  createOwnerAuthService,
  type AuthenticationCapacityResult,
  type LoginThrottleState,
  type PersistedOwnerSession,
  type PersistentOwnerAuthRepository,
} from './auth-service.js';
import { ADMIN_SESSION_COOKIE } from './constants.js';

const USERNAME = 'owner';
const PASSWORD = 'correct-horse-battery-staple';
const SESSION_SECRET = 'session-secret-'.repeat(4);
const START_TIME = Date.UTC(2026, 7, 25, 12, 0, 0);

class MemoryAuthRepository implements PersistentOwnerAuthRepository {
  readonly failures = new Map<string, number>();
  readonly sessions = new Map<string, PersistedOwnerSession>();
  lastClientKeyHash: string | undefined;
  createResult: AuthenticationCapacityResult = 'created';
  readState: LoginThrottleState = { status: 'allowed' };
  recordState: LoginThrottleState = { status: 'allowed' };
  touchRaces = 0;

  async createSessionAndClearLoginFailures(input: {
    readonly clientKeyHash: string;
    readonly session: PersistedOwnerSession;
  }): Promise<AuthenticationCapacityResult> {
    this.lastClientKeyHash = input.clientKeyHash;
    if (this.createResult === 'created') {
      this.sessions.set(input.session.sessionIdHash, input.session);
      this.failures.delete(input.clientKeyHash);
    }
    return this.createResult;
  }

  async deleteSession(sessionIdHash: string): Promise<boolean> {
    return this.sessions.delete(sessionIdHash);
  }

  async findSession(sessionIdHash: string): Promise<PersistedOwnerSession | null> {
    return this.sessions.get(sessionIdHash) ?? null;
  }

  async readLoginThrottle(clientKeyHash: string): Promise<LoginThrottleState> {
    this.lastClientKeyHash = clientKeyHash;
    return this.readState;
  }

  async recordLoginFailure(clientKeyHash: string): Promise<LoginThrottleState> {
    this.lastClientKeyHash = clientKeyHash;
    this.failures.set(clientKeyHash, (this.failures.get(clientKeyHash) ?? 0) + 1);
    return this.recordState;
  }

  async touchSession(input: {
    readonly expectedRevision: number;
    readonly lastSeenAt: number;
    readonly sessionIdHash: string;
  }): Promise<PersistedOwnerSession | null> {
    const session = this.sessions.get(input.sessionIdHash);
    if (!session) return null;
    if (this.touchRaces > 0) {
      this.touchRaces -= 1;
      this.sessions.set(input.sessionIdHash, {
        ...session,
        lastSeenAt: Math.max(session.lastSeenAt, input.lastSeenAt - this.touchRaces),
        revision: session.revision + 1,
      });
      return null;
    }
    if (session.revision !== input.expectedRevision) return null;
    const updated = {
      ...session,
      lastSeenAt: Math.max(session.lastSeenAt, input.lastSeenAt),
      revision: session.revision + 1,
    };
    this.sessions.set(input.sessionIdHash, updated);
    return updated;
  }
}

function createService(repository: MemoryAuthRepository, now: () => number = () => START_TIME) {
  return createOwnerAuthService({
    cookieSecure: true,
    expectedPassword: PASSWORD,
    expectedUsername: USERNAME,
    now,
    repository,
    sessionSecret: SESSION_SECRET,
    sessionTtlSeconds: 3_600,
  });
}

async function loginCookie(
  service: ReturnType<typeof createService>,
  overrides: Partial<{ clientKey: string; password: string; username: string }> = {},
): Promise<string> {
  const result = await service.login({
    clientKey: overrides.clientKey ?? '127.0.0.1',
    password: overrides.password ?? PASSWORD,
    username: overrides.username ?? USERNAME,
  });
  const pair = result.setCookie.split(';', 1)[0];
  assert.ok(pair);
  return pair;
}

test('signed owner sessions survive service reconstruction through the persistent repository seam', async () => {
  const repository = new MemoryAuthRepository();
  const firstService = createService(repository);
  const cookie = await loginCookie(firstService);
  assert.match(cookie, /^fp_admin_session=[A-Za-z0-9._-]+$/);
  assert.equal(repository.sessions.size, 1);
  assert.match(repository.lastClientKeyHash ?? '', /^[a-f0-9]{64}$/);
  assert.notEqual(repository.lastClientKeyHash, '127.0.0.1');

  const secondService = createService(repository);
  const session = await secondService.resolve(cookie);
  assert.ok(session);
  assert.equal(session.expiresAt, Math.floor(START_TIME / 1_000) + 3_600);
  assert.equal(session.ownerSessionIdHash.length, 64);
});

test('parallel resolves preserve monotonic activity without false authentication failures', async () => {
  let now = START_TIME;
  const repository = new MemoryAuthRepository();
  const service = createService(repository, () => now);
  const cookie = await loginCookie(service);
  now += 1_000;

  const sessions = await Promise.all([
    service.resolve(cookie),
    service.resolve(cookie),
    service.resolve(cookie),
  ]);
  assert.equal(sessions.every(Boolean), true);
  const stored = [...repository.sessions.values()][0];
  assert.ok(stored);
  assert.equal(stored.lastSeenAt, Math.floor(now / 1_000));
  assert.equal(stored.revision, 2);
});

test('a second stale touch performs one final validation read instead of signing out', async () => {
  let now = START_TIME;
  const repository = new MemoryAuthRepository();
  const service = createService(repository, () => now);
  const cookie = await loginCookie(service);
  now += 2_000;
  repository.touchRaces = 2;

  assert.ok(await service.resolve(cookie));
  const stored = [...repository.sessions.values()][0];
  assert.ok(stored);
  assert.equal(stored.lastSeenAt, Math.floor(now / 1_000));
  assert.equal(stored.revision, 3);
});

test('session cookies are strict, secure, bounded, and revoked durably', async () => {
  const repository = new MemoryAuthRepository();
  const service = createService(repository);
  const login = await service.login({
    clientKey: '127.0.0.1',
    password: PASSWORD,
    username: USERNAME,
  });
  assert.match(
    login.setCookie,
    /^fp_admin_session=[^;]+; Path=\/; Max-Age=3600; HttpOnly; Secure; SameSite=Strict$/,
  );
  const cookie = login.setCookie.split(';', 1)[0];
  assert.ok(cookie);

  const logout = await service.logout(cookie);
  assert.equal(repository.sessions.size, 0);
  assert.equal(
    logout.setCookie,
    'fp_admin_session=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Strict',
  );
  assert.equal(await service.resolve(cookie), null);
});

test('old raw cookies, tampering, duplicate cookie names, and mismatched records fail closed', async () => {
  const repository = new MemoryAuthRepository();
  const service = createService(repository);
  const cookie = await loginCookie(service);
  const token = cookie.slice(`${ADMIN_SESSION_COOKIE}=`.length);
  const replacement = token.endsWith('x') ? 'y' : 'x';

  assert.equal(await service.resolve(`${ADMIN_SESSION_COOKIE}=${'a'.repeat(43)}`), null);
  assert.equal(
    await service.resolve(`${ADMIN_SESSION_COOKIE}=${token.slice(0, -1)}${replacement}`),
    null,
  );
  assert.equal(await service.resolve(`${cookie}; ${cookie}`), null);
  assert.equal(await service.resolve(`${cookie}; ${ADMIN_SESSION_COOKIE}=different`), null);

  const [sessionIdHash, stored] = [...repository.sessions.entries()][0] ?? [];
  assert.ok(sessionIdHash);
  assert.ok(stored);
  repository.sessions.set(sessionIdHash, { ...stored, expiresAt: stored.expiresAt + 1 });
  assert.equal(await service.resolve(cookie), null);
});

test('expired signed and stored sessions cannot authenticate', async () => {
  let now = START_TIME;
  const repository = new MemoryAuthRepository();
  const service = createService(repository, () => now);
  const cookie = await loginCookie(service);
  now += 3_600_000;
  assert.equal(await service.resolve(cookie), null);
});

test('login throttling and both capacity ceilings return explicit errors without eviction', async () => {
  const throttledRepository = new MemoryAuthRepository();
  throttledRepository.readState = { retryAfterSeconds: 90, status: 'rate_limited' };
  await assert.rejects(
    () => loginCookie(createService(throttledRepository)),
    (error: unknown) =>
      error instanceof HttpError &&
      error.status === 429 &&
      error.code === 'authentication_rate_limited' &&
      error.details?.['retryAfterSeconds'] === 90,
  );
  assert.equal(throttledRepository.sessions.size, 0);

  const concurrentLimit = new MemoryAuthRepository();
  concurrentLimit.recordState = { retryAfterSeconds: 60, status: 'rate_limited' };
  await assert.rejects(
    () =>
      loginCookie(createService(concurrentLimit), {
        password: 'definitely-the-wrong-password',
      }),
    (error: unknown) =>
      error instanceof HttpError &&
      error.status === 429 &&
      error.code === 'authentication_rate_limited',
  );

  const failureCapacity = new MemoryAuthRepository();
  failureCapacity.recordState = { status: 'capacity_reached' };
  await assert.rejects(
    () =>
      loginCookie(createService(failureCapacity), {
        password: 'definitely-the-wrong-password',
      }),
    (error: unknown) =>
      error instanceof HttpError &&
      error.status === 503 &&
      error.code === 'authentication_capacity_reached',
  );

  const sessionCapacity = new MemoryAuthRepository();
  sessionCapacity.createResult = 'capacity_reached';
  await assert.rejects(
    () => loginCookie(createService(sessionCapacity)),
    (error: unknown) =>
      error instanceof HttpError &&
      error.status === 503 &&
      error.code === 'session_capacity_reached',
  );
  assert.equal(sessionCapacity.sessions.size, 0);
});

test('invalid credentials are bounded, counted, and never create a session', async () => {
  const repository = new MemoryAuthRepository();
  const service = createService(repository);
  for (const input of [
    { username: 'wrong', password: PASSWORD },
    { username: USERNAME, password: 'wrong-password-value' },
    { username: 'x'.repeat(257), password: PASSWORD },
  ]) {
    await assert.rejects(
      () => loginCookie(service, input),
      (error: unknown) =>
        error instanceof HttpError && error.status === 401 && error.code === 'invalid_credentials',
    );
  }
  assert.equal([...repository.failures.values()][0], 3);
  assert.equal(repository.sessions.size, 0);
});
