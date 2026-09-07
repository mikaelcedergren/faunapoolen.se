import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parseLogRecord, type LogRecord } from '@mikaelcedergren/cx-framework/server/logging';
import { openFaunapoolenDatabase } from './database.js';
import { configureFaunapoolenLogging } from './logging.js';

test('storage diagnostics record a failure and recovery once without repeated health noise', (t) => {
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'faunapoolen-PRIVATE-health-')),
  );
  const records: LogRecord[] = [];
  const logger = configureFaunapoolenLogging('web', { NODE_ENV: 'test' }, 'fixture', {
    write(line) {
      records.push(parseLogRecord(line));
      return true;
    },
    status() {
      return { accepted: records.length, dropped: 0, failed: 0, pendingBytes: 0, available: true };
    },
  });
  const file = path.join(root, 'database.sqlite');
  const database = openFaunapoolenDatabase({ databasePath: file, operationalRoot: root });
  t.after(() => {
    database.close();
    configureFaunapoolenLogging('operator', { NODE_ENV: 'test' });
    fs.rmSync(root, { recursive: true, force: true });
  });
  assert.equal(database.isReady(), true);
  fs.renameSync(file, `${file}.held`);
  try {
    assert.equal(database.isReady(), false);
    assert.equal(database.isReady(), false);
  } finally {
    fs.renameSync(`${file}.held`, file);
  }
  assert.equal(database.isReady(), true);
  assert.equal(database.isReady(), true);
  assert.deepEqual(
    records.map((record) => record.event),
    ['storage.unavailable', 'storage.ready'],
  );
  assert.ok(records[0]?.error?.fingerprint);
  assert.equal(logger.status().invalid, 0);
  assert.doesNotMatch(JSON.stringify(records), /PRIVATE|database\.sqlite|\/Users\//u);
});
