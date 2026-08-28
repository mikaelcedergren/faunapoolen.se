import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  openOwnedSqliteDatabase,
  type OwnedSqliteDatabase,
  type SqliteRow,
} from '@mikaelcedergren/cx-framework/server/sqlite';

import type { CampaignImportReceipt } from './campaign-repository.js';
import {
  verifyLegacyCampaignImportLogicalState,
  verifyLegacyCampaignImportPreActivationProof,
} from './legacy-cutover.js';
import { readCampaignImportReceiptEvidence } from './verify-campaign-import.js';

const CHECKPOINT_KEYS = Object.freeze(['busy', 'checkpointed', 'log']);
const DATABASE_BUSY_TIMEOUT_MS = 5_000;
const HASH_BUFFER_BYTES = 64 * 1024;
const PRIVATE_DATABASE_MODE = 0o600;
const SIDECAR_SUFFIXES = Object.freeze(['-journal', '-shm', '-wal'] as const);
const NO_FOLLOW = requiredConstant(fs.constants.O_NOFOLLOW, 'O_NOFOLLOW');

interface QuiesceArguments {
  readonly databasePath: string;
  readonly receiptPath: string;
}

interface CheckpointRow extends SqliteRow {
  readonly busy: number;
  readonly checkpointed: number;
  readonly log: number;
}

interface DatabaseSnapshot {
  readonly bytes: number;
  readonly sha256: string;
  readonly stats: fs.BigIntStats;
}

export interface CampaignDatabaseQuiesceReceipt {
  readonly schemaVersion: 1;
  readonly kind: 'faunapoolen-campaign-database-quiesce-result';
  readonly checkpoint: Readonly<{
    readonly busy: 0;
    readonly checkpointed: 0;
    readonly log: 0;
  }>;
  readonly database: Readonly<{
    readonly bytes: number;
    readonly sha256: string;
  }>;
  readonly campaignImport: CampaignImportReceipt;
  readonly sidecarsBefore: readonly string[];
  readonly sidecarsAfter: readonly string[];
}

export type CampaignDatabaseQuiescenceCheckpoint = 'immutable_opening';

export function parseCampaignDatabaseQuiesceArguments(
  arguments_: readonly string[],
): QuiesceArguments {
  let databasePath: string | undefined;
  let receiptPath: string | undefined;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    const value = arguments_[index + 1];
    if (argument === '--database' && value && !value.startsWith('--') && !databasePath) {
      databasePath = path.resolve(value);
      index += 1;
      continue;
    }
    if (argument === '--receipt' && value && !value.startsWith('--') && !receiptPath) {
      receiptPath = path.resolve(value);
      index += 1;
      continue;
    }
    throw new Error(
      'Usage: node server/dist/quiesce-campaign-database.js --database <stopped-database> --receipt <captured-import-receipt>',
    );
  }
  if (!databasePath || !receiptPath) {
    throw new Error(
      'Campaign database quiescence requires explicit --database and --receipt paths.',
    );
  }
  return Object.freeze({ databasePath, receiptPath });
}

/**
 * Checkpoint one stopped, identity-pinned campaign authority through SQLite itself. The registered
 * inactive-candidate runner proves the process/service boundary around this product-owned command;
 * this function additionally refuses a busy checkpoint and any sidecar that survives final close.
 */
export function quiesceCampaignDatabase(
  databasePath: string,
  expected: CampaignImportReceipt,
  onCheckpoint?: (checkpoint: CampaignDatabaseQuiescenceCheckpoint) => unknown,
): CampaignDatabaseQuiesceReceipt {
  const initial = capturePrivateDatabaseSnapshot(databasePath);
  const sidecarsBefore = inspectSidecarInventory(databasePath);
  let owned: OwnedSqliteDatabase | undefined;
  let checkpoint: CampaignDatabaseQuiesceReceipt['checkpoint'] | undefined;
  let primaryError: unknown;
  try {
    owned = openOwnedSqliteDatabase({
      configuration: {
        busyTimeoutMs: DATABASE_BUSY_TIMEOUT_MS,
        journalMode: 'wal',
      },
      databasePath,
      operationalRoot: path.dirname(databasePath),
      requireExisting: true,
      beforeWrite(database) {
        assertSameCampaignImportReceipt(
          expected,
          verifyLegacyCampaignImportLogicalState(database, expected),
        );
      },
    });
    assertSameCampaignImportReceipt(
      expected,
      verifyLegacyCampaignImportLogicalState(owned.database, expected),
    );
    checkpoint = requireCompletedTruncateCheckpoint(
      owned.database.all<CheckpointRow>('PRAGMA wal_checkpoint(TRUNCATE)'),
    );
    assertSameCampaignImportReceipt(
      expected,
      verifyLegacyCampaignImportLogicalState(owned.database, expected),
    );
    owned.verifyStorage();
  } catch (error) {
    primaryError = error;
  }

  let closeError: unknown;
  if (owned) {
    try {
      owned.close();
    } catch (error) {
      closeError = error;
    }
  }
  if (primaryError && closeError) {
    throw new AggregateError(
      [primaryError, closeError],
      'Campaign database quiescence and owned SQLite close both failed.',
    );
  }
  if (primaryError) throw primaryError;
  if (closeError) throw closeError;
  if (!checkpoint) throw new Error('Campaign database quiescence produced no checkpoint receipt.');

  assertSidecarsAbsent(databasePath);
  const checkpointed = capturePrivateDatabaseSnapshot(databasePath);
  assertSameDatabaseAllocation(initial.stats, checkpointed.stats);
  emitQuiescenceCheckpoint(onCheckpoint, 'immutable_opening');
  const finalProof = verifyLegacyCampaignImportPreActivationProof(databasePath, expected);
  assertSameDatabaseAllocation(initial.stats, finalProof.allocation);
  const finalReceipt = finalProof.campaignImport;
  assertSameCampaignImportReceipt(expected, finalReceipt);
  const stable = capturePrivateDatabaseSnapshot(databasePath);
  assertSameDatabaseSnapshot(checkpointed, stable);

  return Object.freeze({
    schemaVersion: 1,
    kind: 'faunapoolen-campaign-database-quiesce-result',
    checkpoint,
    database: Object.freeze({
      bytes: stable.bytes,
      sha256: stable.sha256,
    }),
    campaignImport: finalReceipt,
    sidecarsBefore,
    sidecarsAfter: Object.freeze([]),
  });
}

export function requireCompletedTruncateCheckpoint(
  rows: readonly CheckpointRow[],
): CampaignDatabaseQuiesceReceipt['checkpoint'] {
  const row = rows[0];
  if (
    rows.length !== 1 ||
    !row ||
    Object.keys(row).toSorted().join(',') !== CHECKPOINT_KEYS.join(',') ||
    row.busy !== 0 ||
    row.checkpointed !== 0 ||
    row.log !== 0
  ) {
    throw new Error(
      'Campaign database WAL checkpoint did not reach one exact idle truncated result.',
    );
  }
  return Object.freeze({ busy: 0, checkpointed: 0, log: 0 });
}

export function runCampaignDatabaseQuiesce(arguments_: readonly string[]): void {
  const options = parseCampaignDatabaseQuiesceArguments(arguments_);
  const expected = readCampaignImportReceiptEvidence(options.receiptPath);
  const result = quiesceCampaignDatabase(options.databasePath, expected);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  runCampaignDatabaseQuiesce(process.argv.slice(2));
}

function inspectSidecarInventory(databasePath: string): readonly string[] {
  const present: string[] = [];
  for (const suffix of SIDECAR_SUFFIXES) {
    const sidecarPath = `${databasePath}${suffix}`;
    try {
      fs.lstatSync(sidecarPath);
      present.push(suffix.slice(1));
    } catch (error) {
      if (!isMissingPath(error)) throw error;
    }
  }
  return Object.freeze(present);
}

function assertSidecarsAbsent(databasePath: string): void {
  const present = inspectSidecarInventory(databasePath);
  if (present.length > 0) {
    throw new Error(
      `Campaign database remained mutable after SQLite close: ${present.join(', ')} sidecar present.`,
    );
  }
}

function capturePrivateDatabaseSnapshot(databasePath: string): DatabaseSnapshot {
  if (
    !path.isAbsolute(databasePath) ||
    path.normalize(databasePath) !== databasePath ||
    fs.realpathSync.native(databasePath) !== databasePath
  ) {
    throw new Error('Campaign database quiescence requires one canonical absolute database path.');
  }
  const atPathBefore = fs.lstatSync(databasePath, { bigint: true });
  const descriptor = fs.openSync(databasePath, fs.constants.O_RDONLY | NO_FOLLOW);
  try {
    const opened = fs.fstatSync(descriptor, { bigint: true });
    assertPrivateDatabaseFile(opened);
    if (!sameStableFile(atPathBefore, opened)) {
      throw new Error('Campaign database changed while its quiescence snapshot was opened.');
    }
    if (opened.size < 0n || opened.size > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error('Campaign database exceeds the quiescence hashing range.');
    }
    const bytes = Number(opened.size);
    const hash = createHash('sha256');
    const buffer = Buffer.allocUnsafe(HASH_BUFFER_BYTES);
    let offset = 0;
    while (offset < bytes) {
      const read = fs.readSync(
        descriptor,
        buffer,
        0,
        Math.min(buffer.length, bytes - offset),
        offset,
      );
      if (read === 0) throw new Error('Campaign database ended before its pinned size.');
      hash.update(buffer.subarray(0, read));
      offset += read;
    }
    const openedAfter = fs.fstatSync(descriptor, { bigint: true });
    const atPathAfter = fs.lstatSync(databasePath, { bigint: true });
    if (!sameStableFile(opened, openedAfter) || !sameStableFile(opened, atPathAfter)) {
      throw new Error('Campaign database changed while its quiescence snapshot was hashed.');
    }
    return Object.freeze({
      bytes,
      sha256: hash.digest('hex'),
      stats: openedAfter,
    });
  } finally {
    fs.closeSync(descriptor);
  }
}

function assertPrivateDatabaseFile(stats: fs.BigIntStats): void {
  if (
    !stats.isFile() ||
    stats.isSymbolicLink() ||
    stats.nlink !== 1n ||
    stats.uid !== BigInt(currentUid()) ||
    (stats.mode & 0o777n) !== BigInt(PRIVATE_DATABASE_MODE)
  ) {
    throw new Error(
      'Campaign database quiescence requires one current-user-owned mode-0600 single-link file.',
    );
  }
}

function assertSameDatabaseAllocation(before: fs.BigIntStats, after: fs.BigIntStats): void {
  if (
    !after.isFile() ||
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.uid !== after.uid ||
    before.gid !== after.gid ||
    before.mode !== after.mode ||
    before.nlink !== after.nlink
  ) {
    throw new Error('Campaign database allocation changed during offline quiescence.');
  }
}

function assertSameDatabaseSnapshot(before: DatabaseSnapshot, after: DatabaseSnapshot): void {
  if (
    before.bytes !== after.bytes ||
    before.sha256 !== after.sha256 ||
    !sameStableFile(before.stats, after.stats)
  ) {
    throw new Error('Campaign database changed during its final immutable quiescence proof.');
  }
}

function assertSameCampaignImportReceipt(
  expected: CampaignImportReceipt,
  actual: CampaignImportReceipt,
): void {
  if (
    expected.formatVersion !== actual.formatVersion ||
    expected.sourceBytes !== actual.sourceBytes ||
    expected.sourceSha256 !== actual.sourceSha256 ||
    expected.campaignCount !== actual.campaignCount ||
    expected.orderedCampaignsSha256 !== actual.orderedCampaignsSha256
  ) {
    throw new Error('Campaign database quiescence changed its sealed import receipt.');
  }
}

function emitQuiescenceCheckpoint(
  callback: ((checkpoint: CampaignDatabaseQuiescenceCheckpoint) => unknown) | undefined,
  checkpoint: CampaignDatabaseQuiescenceCheckpoint,
): void {
  const result = callback?.(checkpoint);
  if (
    result !== undefined &&
    result !== null &&
    (typeof result === 'object' || typeof result === 'function') &&
    'then' in result
  ) {
    throw new Error('Campaign database quiescence checkpoints must be synchronous.');
  }
}

function sameStableFile(left: fs.BigIntStats, right: fs.BigIntStats): boolean {
  return (
    left.isFile() === right.isFile() &&
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.uid === right.uid &&
    left.gid === right.gid &&
    left.mode === right.mode &&
    left.nlink === right.nlink &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function isMissingPath(error: unknown): boolean {
  return (
    error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}

function requiredConstant(value: number | undefined, name: string): number {
  if (value === undefined) throw new Error(`Campaign database quiescence requires ${name}.`);
  return value;
}

function currentUid(): number {
  if (process.geteuid === undefined) {
    throw new Error('Campaign database quiescence requires POSIX ownership checks.');
  }
  return process.geteuid();
}
