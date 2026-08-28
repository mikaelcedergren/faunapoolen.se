import assert from 'node:assert/strict';
import test from 'node:test';

import { createCampaignGenerationWorker } from './generation-worker.js';

test('claim-disabled lifecycle performs no generation-state or scheduler operation', async () => {
  const calls: string[] = [];
  const inaccessible = new Proxy(
    {},
    {
      get(_target, property) {
        calls.push(`read:${String(property)}`);
        return () => calls.push(`call:${String(property)}`);
      },
    },
  );
  const worker = createCampaignGenerationWorker({
    campaigns: inaccessible as never,
    enabled: false,
    generations: inaccessible as never,
    maintenance: inaccessible as never,
    scheduleInterval() {
      calls.push('schedule');
      return () => calls.push('cancel');
    },
    store: inaccessible as never,
  });

  assert.equal(worker.accepting, false);
  assert.equal(worker.running, false);
  worker.start();
  worker.start();
  assert.equal(worker.running, true);
  assert.equal(await worker.runUntilIdle(), 0);
  await worker.drain(1);
  worker.stopClaiming();
  worker.abortActive(new Error('test'));
  assert.equal(worker.running, false);
  assert.throws(() => worker.start(), /cannot restart/);
  assert.deepEqual(calls, []);
});
