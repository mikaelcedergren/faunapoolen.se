import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';

import type { CampaignImportReceipt } from './campaign-repository.js';
import { insertCampaignImportReceipt } from './campaign-repository.js';
import { openFaunapoolenDatabase } from './database.js';
import { verifyLegacyCampaignImportPreActivation } from './legacy-cutover.js';
import {
  parseCampaignDatabaseQuiesceArguments,
  quiesceCampaignDatabase,
  requireCompletedTruncateCheckpoint,
} from './quiesce-campaign-database.js';

const EMPTY_SHA256 = createHash('sha256').digest('hex');
const EMPTY_IMPORT_RECEIPT: CampaignImportReceipt = Object.freeze({
  campaignCount: 0,
  formatVersion: 1,
  orderedCampaignsSha256: EMPTY_SHA256,
  sourceBytes: 0,
  sourceSha256: EMPTY_SHA256,
});

test('campaign database quiescer requires explicit database and receipt paths', () => {
  assert.deepEqual(
    parseCampaignDatabaseQuiesceArguments([
      '--database',
      'data/faunapoolen.db',
      '--receipt',
      'evidence/import-receipt.json',
    ]),
    {
      databasePath: path.resolve('data/faunapoolen.db'),
      receiptPath: path.resolve('evidence/import-receipt.json'),
    },
  );
  assert.throws(
    () => parseCampaignDatabaseQuiesceArguments(['--database', 'data/faunapoolen.db']),
    /explicit --database and --receipt/,
  );
  assert.throws(
    () =>
      parseCampaignDatabaseQuiesceArguments([
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

test('campaign database quiescer accepts only an exact idle truncated checkpoint', () => {
  assert.deepEqual(requireCompletedTruncateCheckpoint([{ busy: 0, checkpointed: 0, log: 0 }]), {
    busy: 0,
    checkpointed: 0,
    log: 0,
  });
  for (const rows of [
    [],
    [{ busy: 1, checkpointed: 0, log: 1 }],
    [{ busy: 0, checkpointed: 1, log: 1 }],
    [{ busy: 0, checkpointed: 0, log: 0, unexpected: 0 }],
    [
      { busy: 0, checkpointed: 0, log: 0 },
      { busy: 0, checkpointed: 0, log: 0 },
    ],
  ]) {
    assert.throws(
      () => requireCompletedTruncateCheckpoint(rows),
      /did not reach one exact idle truncated result/,
    );
  }
});

test('campaign database quiescer recovers a crash-left WAL through SQLite and leaves one immutable main file', (t) => {
  const root = privateTempDirectory(t);
  const databasePath = path.join(root, 'data', 'faunapoolen.db');
  const seeded = openFaunapoolenDatabase({ databasePath, operationalRoot: root });
  insertCampaignImportReceipt(seeded.sqlite, EMPTY_IMPORT_RECEIPT);
  seeded.close();
  const allocationBefore = fs.lstatSync(databasePath, { bigint: true });

  leaveCommittedWalAfterCrash(databasePath);
  assert.equal(fs.existsSync(`${databasePath}-wal`), true);
  assert.equal(fs.existsSync(`${databasePath}-shm`), true);

  const result = quiesceCampaignDatabase(databasePath, EMPTY_IMPORT_RECEIPT);
  assert.deepEqual(result.checkpoint, { busy: 0, checkpointed: 0, log: 0 });
  assert.deepEqual(result.campaignImport, EMPTY_IMPORT_RECEIPT);
  assert.deepEqual(result.sidecarsBefore, ['shm', 'wal']);
  assert.deepEqual(result.sidecarsAfter, []);
  assert.equal(result.database.bytes, fs.statSync(databasePath).size);
  assert.match(result.database.sha256, /^[a-f0-9]{64}$/u);
  for (const suffix of ['-journal', '-shm', '-wal']) {
    assert.equal(fs.existsSync(`${databasePath}${suffix}`), false);
  }
  const allocationAfter = fs.lstatSync(databasePath, { bigint: true });
  assert.equal(allocationAfter.dev, allocationBefore.dev);
  assert.equal(allocationAfter.ino, allocationBefore.ino);
  assert.equal(allocationAfter.uid, allocationBefore.uid);
  assert.equal(allocationAfter.gid, allocationBefore.gid);
  assert.equal(allocationAfter.mode, allocationBefore.mode);
  assert.equal(allocationAfter.nlink, allocationBefore.nlink);
  assert.deepEqual(
    verifyLegacyCampaignImportPreActivation(databasePath, EMPTY_IMPORT_RECEIPT),
    EMPTY_IMPORT_RECEIPT,
  );
});

test('campaign database quiescer closes the observed empty WAL and 32-KiB SHM incident through SQLite', (t) => {
  const root = privateTempDirectory(t);
  const databasePath = path.join(root, 'data', 'faunapoolen.db');
  const seeded = openFaunapoolenDatabase({ databasePath, operationalRoot: root });
  insertCampaignImportReceipt(seeded.sqlite, EMPTY_IMPORT_RECEIPT);
  seeded.close();
  fs.writeFileSync(`${databasePath}-wal`, Buffer.alloc(0), { flag: 'wx', mode: 0o600 });
  fs.writeFileSync(`${databasePath}-shm`, Buffer.alloc(32 * 1_024), {
    flag: 'wx',
    mode: 0o600,
  });

  const result = quiesceCampaignDatabase(databasePath, EMPTY_IMPORT_RECEIPT);

  assert.deepEqual(result.checkpoint, { busy: 0, checkpointed: 0, log: 0 });
  assert.deepEqual(result.sidecarsBefore, ['shm', 'wal']);
  assert.deepEqual(result.sidecarsAfter, []);
  for (const suffix of ['-journal', '-shm', '-wal']) {
    assert.equal(fs.existsSync(`${databasePath}${suffix}`), false);
  }
  assert.deepEqual(
    verifyLegacyCampaignImportPreActivation(databasePath, EMPTY_IMPORT_RECEIPT),
    EMPTY_IMPORT_RECEIPT,
  );
});

test('campaign database quiescer rejects compiled migration ledger drift before write authority', async (t) => {
  const cases = [
    {
      label: 'fingerprint',
      parameters: ['f'.repeat(64), 4] as const,
      statement: 'UPDATE cx_schema_migrations SET fingerprint = ? WHERE version = ?',
    },
    {
      label: 'applied_at',
      parameters: ['2026-08-01T00:00:00Z', 4] as const,
      statement: 'UPDATE cx_schema_migrations SET applied_at = ? WHERE version = ?',
    },
  ] as const;

  for (const drift of cases) {
    await t.test(drift.label, (context) => {
      const root = privateTempDirectory(context);
      const databasePath = path.join(root, 'data', 'faunapoolen.db');
      const seeded = openFaunapoolenDatabase({ databasePath, operationalRoot: root });
      insertCampaignImportReceipt(seeded.sqlite, EMPTY_IMPORT_RECEIPT);
      seeded.sqlite.run(drift.statement, drift.parameters);
      seeded.close();
      const bytesBefore = fs.readFileSync(databasePath);

      assert.throws(
        () => quiesceCampaignDatabase(databasePath, EMPTY_IMPORT_RECEIPT),
        /current migration ledger row 4 does not match its compiled definition/,
      );
      assert.deepEqual(fs.readFileSync(databasePath), bytesBefore);
      assert.throws(
        () => verifyLegacyCampaignImportPreActivation(databasePath, EMPTY_IMPORT_RECEIPT),
        /current migration ledger row 4 does not match its compiled definition/,
      );
    });
  }
});

test('campaign database quiescer rejects non-foundation trigger drift before write authority', (t) => {
  const root = privateTempDirectory(t);
  const databasePath = path.join(root, 'data', 'faunapoolen.db');
  const seeded = openFaunapoolenDatabase({ databasePath, operationalRoot: root });
  insertCampaignImportReceipt(seeded.sqlite, EMPTY_IMPORT_RECEIPT);
  seeded.sqlite.execute('DROP TRIGGER campaigns_capacity_guard');
  seeded.close();
  const bytesBefore = fs.readFileSync(databasePath);

  assert.throws(
    () => quiesceCampaignDatabase(databasePath, EMPTY_IMPORT_RECEIPT),
    /current sqlite_schema/,
  );
  assert.deepEqual(fs.readFileSync(databasePath), bytesBefore);
  for (const suffix of ['-journal', '-shm', '-wal']) {
    assert.equal(fs.existsSync(`${databasePath}${suffix}`), false);
  }
});

test('campaign database quiescer rejects an inode replacement at immutable opening', (t) => {
  const root = privateTempDirectory(t);
  const databasePath = path.join(root, 'data', 'faunapoolen.db');
  const displacedPath = `${databasePath}.displaced`;
  const seeded = openFaunapoolenDatabase({ databasePath, operationalRoot: root });
  insertCampaignImportReceipt(seeded.sqlite, EMPTY_IMPORT_RECEIPT);
  seeded.close();
  let raced = false;

  assert.throws(
    () =>
      quiesceCampaignDatabase(databasePath, EMPTY_IMPORT_RECEIPT, (checkpoint) => {
        assert.equal(checkpoint, 'immutable_opening');
        assert.equal(raced, false);
        raced = true;
        fs.renameSync(databasePath, displacedPath);
        fs.writeFileSync(databasePath, fs.readFileSync(displacedPath), {
          flag: 'wx',
          mode: 0o600,
        });
      }),
    /allocation changed during offline quiescence/,
  );
  assert.equal(raced, true);
});

test('immutable campaign import verification rejects every non-foundation schema drift class', async (t) => {
  const cases = [
    {
      label: 'trigger removed',
      statement: 'DROP TRIGGER campaigns_capacity_guard',
    },
    {
      label: 'index removed',
      statement: 'DROP INDEX cx_jobs_claim_order',
    },
    {
      label: 'extra schema object',
      statement: 'CREATE TABLE unregistered_campaign_state (id INTEGER PRIMARY KEY) STRICT',
    },
  ] as const;

  for (const drift of cases) {
    await t.test(drift.label, (context) => {
      const root = privateTempDirectory(context);
      const databasePath = path.join(root, 'data', 'faunapoolen.db');
      const seeded = openFaunapoolenDatabase({ databasePath, operationalRoot: root });
      insertCampaignImportReceipt(seeded.sqlite, EMPTY_IMPORT_RECEIPT);
      seeded.sqlite.execute(drift.statement);
      seeded.close();

      assert.throws(
        () => verifyLegacyCampaignImportPreActivation(databasePath, EMPTY_IMPORT_RECEIPT),
        /current sqlite_schema/,
      );
    });
  }
});

test('campaign database quiescer refuses a receipt mismatch before checkpoint authority', (t) => {
  const root = privateTempDirectory(t);
  const databasePath = path.join(root, 'data', 'faunapoolen.db');
  const seeded = openFaunapoolenDatabase({ databasePath, operationalRoot: root });
  insertCampaignImportReceipt(seeded.sqlite, EMPTY_IMPORT_RECEIPT);
  seeded.close();
  leaveCommittedWalAfterCrash(databasePath);

  assert.throws(
    () =>
      quiesceCampaignDatabase(databasePath, {
        ...EMPTY_IMPORT_RECEIPT,
        sourceSha256: 'a'.repeat(64),
      }),
    /receipt does not match cutover evidence/,
  );
});

function leaveCommittedWalAfterCrash(databasePath: string): void {
  const source = String.raw`
    import fs from 'node:fs';
    import { DatabaseSync } from 'node:sqlite';
    process.umask(0o077);
    const databasePath = process.argv[1];
    const database = new DatabaseSync(databasePath);
    database.exec("PRAGMA journal_mode = WAL");
    database.exec("INSERT INTO login_failure_windows (client_key_hash, window_started_at, failure_count, blocked_until, updated_at) VALUES ('cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', 1, 1, NULL, 1)");
    for (const suffix of ['-shm', '-wal']) fs.chmodSync(databasePath + suffix, 0o600);
    process.kill(process.pid, 'SIGKILL');
  `;
  const crashed = spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', source, databasePath],
    {
      encoding: 'utf8',
    },
  );
  assert.equal(crashed.status, null);
  assert.equal(crashed.signal, 'SIGKILL');
  assert.equal(crashed.stdout, '');
  assert.equal(crashed.stderr, '');
}

function privateTempDirectory(t: TestContext): string {
  const directory = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), 'faunapoolen-quiesce-test-')),
  );
  fs.chmodSync(directory, 0o700);
  t.after(() => fs.rmSync(directory, { force: true, recursive: true }));
  return directory;
}
