import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createFailureTracker,
  createSessionStore,
  MAX_ADMIN_SESSIONS,
  MAX_FAILURE_STATES,
  MAX_SESSION_HOURS,
  sessionMaxAgeSeconds,
} from './admin-auth.mjs';

test('admin session lifetime is capped at 24 hours', () => {
  assert.equal(MAX_SESSION_HOURS, 24);
  assert.equal(sessionMaxAgeSeconds('8'), 8 * 60 * 60);
  assert.equal(sessionMaxAgeSeconds('48'), 24 * 60 * 60);
  assert.equal(sessionMaxAgeSeconds('not-a-number'), 8 * 60 * 60);
});

test('admin sessions evict the oldest live session at the fixed count ceiling', () => {
  let currentTime = 1_000;
  const sessions = createSessionStore({ maxSessions: 2, now: () => currentTime });
  assert.equal(MAX_ADMIN_SESSIONS, 64);

  sessions.add('oldest', 60);
  currentTime += 1;
  sessions.add('newer', 60);
  currentTime += 1;
  assert.deepEqual(sessions.add('newest', 60), { evicted: true });

  assert.equal(sessions.size(), 2);
  assert.equal(sessions.get('oldest'), undefined);
  assert.ok(sessions.get('newer'));
  assert.ok(sessions.get('newest'));
});

test('scheduled sweeps expire admin sessions while the server is otherwise idle', async (t) => {
  let currentTime = 1_000;
  const sessions = createSessionStore({
    maxSessions: 2,
    sweepIntervalMs: 5,
    now: () => currentTime,
  });
  t.after(sessions.stopSweep);
  sessions.add('session-a', 1);
  currentTime += 1_001;
  sessions.startSweep();

  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(sessions.size(), 0);
});

test('failed-login state has a fixed production cardinality ceiling', () => {
  assert.equal(MAX_FAILURE_STATES, 10_000);
});

test('failed-login state expires globally and fails closed at capacity', () => {
  let currentTime = 1_000;
  const tracker = createFailureTracker({
    windowMs: 100,
    maxFailures: 2,
    maxClients: 2,
    sweepIntervalMs: 10,
    now: () => currentTime,
  });

  assert.equal(tracker.record('client-a'), true);
  assert.equal(tracker.record('client-a'), true);
  assert.equal(tracker.isRateLimited('client-a'), true);
  assert.equal(tracker.record('client-b'), true);
  assert.equal(tracker.size(), 2);

  assert.equal(tracker.isRateLimited('client-c'), true);
  assert.equal(tracker.record('client-c'), false);
  assert.equal(tracker.size(), 2);

  currentTime += 101;
  assert.equal(tracker.isRateLimited('client-c'), false);
  assert.equal(tracker.size(), 0);
  assert.equal(tracker.record('client-c'), true);
  assert.equal(tracker.size(), 1);
});

test('successful authentication can clear one client without affecting others', () => {
  const tracker = createFailureTracker({ maxClients: 2 });
  tracker.record('client-a');
  tracker.record('client-b');
  assert.equal(tracker.clear('client-a'), true);
  assert.equal(tracker.size(), 1);
});

test('scheduled sweeps remove failed-login state while the server is otherwise idle', async (t) => {
  let currentTime = 1_000;
  const tracker = createFailureTracker({
    windowMs: 10,
    maxClients: 2,
    sweepIntervalMs: 5,
    now: () => currentTime,
  });
  t.after(tracker.stopSweep);
  tracker.record('client-a');
  currentTime += 11;
  tracker.startSweep();

  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(tracker.size(), 0);
});
