import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';

import {
  parseCampaignImportVerificationArguments,
  readCampaignImportReceiptEvidence,
} from './verify-campaign-import.js';

const VALID_RECEIPT = Object.freeze({
  campaignCount: 2,
  formatVersion: 1,
  orderedCampaignsSha256: 'b'.repeat(64),
  sourceBytes: 1_024,
  sourceSha256: 'a'.repeat(64),
});

test('campaign import verifier requires explicit receipt and database paths', () => {
  assert.deepEqual(
    parseCampaignImportVerificationArguments([
      '--database',
      'restore/faunapoolen.db',
      '--receipt',
      'evidence/import-receipt.json',
    ]),
    {
      databasePath: path.resolve('restore/faunapoolen.db'),
      receiptPath: path.resolve('evidence/import-receipt.json'),
    },
  );
  assert.throws(
    () => parseCampaignImportVerificationArguments(['--database', 'restore/faunapoolen.db']),
    /explicit --database and --receipt/,
  );
  assert.throws(
    () =>
      parseCampaignImportVerificationArguments([
        '--database',
        'first.db',
        '--database',
        'second.db',
        '--receipt',
        'receipt.json',
      ]),
    /Usage:/,
  );
});

test('campaign import verifier reads only the exact bounded receipt shape', (t) => {
  const directory = privateTempDirectory(t);
  const receiptPath = path.join(directory, 'receipt.json');
  fs.writeFileSync(receiptPath, `${JSON.stringify(VALID_RECEIPT)}\n`, { mode: 0o600 });
  assert.deepEqual(readCampaignImportReceiptEvidence(receiptPath), VALID_RECEIPT);

  fs.writeFileSync(receiptPath, `${JSON.stringify({ ...VALID_RECEIPT, unexpected: true })}\n`, {
    mode: 0o600,
  });
  assert.throws(() => readCampaignImportReceiptEvidence(receiptPath), /unexpected shape/);

  fs.writeFileSync(
    receiptPath,
    `${JSON.stringify({ ...VALID_RECEIPT, sourceSha256: 'not-a-hash' })}\n`,
    { mode: 0o600 },
  );
  assert.throws(() => readCampaignImportReceiptEvidence(receiptPath), /invalid aggregate hash/);
});

test('campaign import verifier refuses linked receipt evidence', (t) => {
  const directory = privateTempDirectory(t);
  const receiptPath = path.join(directory, 'receipt.json');
  const linkedPath = path.join(directory, 'linked-receipt.json');
  fs.writeFileSync(receiptPath, `${JSON.stringify(VALID_RECEIPT)}\n`, { mode: 0o600 });
  fs.symlinkSync(receiptPath, linkedPath);
  assert.throws(() => readCampaignImportReceiptEvidence(linkedPath), /canonical absolute path/);
});

function privateTempDirectory(t: TestContext): string {
  const directory = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), 'faunapoolen-import-verifier-')),
  );
  fs.chmodSync(directory, 0o700);
  t.after(() => fs.rmSync(directory, { force: true, recursive: true }));
  return directory;
}
