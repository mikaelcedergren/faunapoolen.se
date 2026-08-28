import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { parseCampaignImportArguments } from './import-campaigns.js';

test('campaign importer requires explicit source and target paths', () => {
  assert.deepEqual(
    parseCampaignImportArguments([
      '--source',
      'stopped-campaigns',
      '--database',
      'new-data/faunapoolen.db',
    ]),
    {
      databasePath: path.resolve('new-data/faunapoolen.db'),
      sourceDirectory: path.resolve('stopped-campaigns'),
    },
  );
  assert.throws(
    () => parseCampaignImportArguments(['--source', 'stopped-campaigns']),
    /explicit --source and --database/,
  );
  assert.throws(
    () => parseCampaignImportArguments(['--database', 'new-data/faunapoolen.db']),
    /explicit --source and --database/,
  );
});

test('campaign importer rejects ambiguous or malformed arguments', () => {
  assert.throws(
    () =>
      parseCampaignImportArguments([
        '--source',
        'first',
        '--source',
        'second',
        '--database',
        'target',
      ]),
    /Usage:/,
  );
  assert.throws(() => parseCampaignImportArguments(['--source', '--database', 'target']), /Usage:/);
  assert.throws(
    () => parseCampaignImportArguments(['stopped-campaigns', 'new-data/faunapoolen.db']),
    /Usage:/,
  );
});
