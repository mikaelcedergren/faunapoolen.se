import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';

import { createPreparedSyncSqliteAdapter } from '@mikaelcedergren/cx-framework/server/sqlite';
import type { ReadonlySyncSqliteDatabase } from '@mikaelcedergren/cx-framework/server/sqlite';

import {
  readAllStoredCampaigns,
  readCampaignImportReceipt,
  type CampaignImportReceipt,
} from './campaign-repository.js';
import { canonicalCampaignBytes, sha256Hex } from './campaign-schema.js';
import { verifyFaunapoolenDatabase, verifyFaunapoolenMigrationFoundation } from './database.js';

export interface LegacyCampaignCutoverExpectation extends CampaignImportReceipt {}

interface ImmutableDatabaseProof {
  readonly database: ReadonlySyncSqliteDatabase;
  closeAndVerify(): void;
}

const PRIVATE_FILE_MODE = 0o600;
const NO_FOLLOW = requiredConstant(fs.constants.O_NOFOLLOW, 'O_NOFOLLOW');

/**
 * One-time pre-activation proof. The caller supplies the receipt captured during the stopped
 * import; this verifies its immutable marker and recomputes physical and semantic aggregates from
 * every imported row. It must run before mutable SQLite operation begins, not on every restart.
 */
export function verifyLegacyCampaignImportPreActivation(
  databasePath: string,
  expected: LegacyCampaignCutoverExpectation,
): CampaignImportReceipt {
  const proof = openImmutableDatabaseProof(databasePath);
  let result: CampaignImportReceipt | undefined;
  let primaryError: unknown;
  try {
    result = verifyLegacyCampaignImportLogicalState(proof.database, expected);
  } catch (error) {
    primaryError = error;
  }
  let closeError: unknown;
  try {
    proof.closeAndVerify();
  } catch (error) {
    closeError = error;
  }
  if (primaryError && closeError) {
    throw new AggregateError(
      [primaryError, closeError],
      'Faunapoolen import verification and immutable close proof both failed.',
    );
  }
  if (primaryError) throw primaryError;
  if (closeError) throw closeError;
  if (!result) throw new Error('Faunapoolen import verification produced no receipt.');
  return result;
}

/**
 * Full logical proof shared by the immutable verifier and the one-shot offline WAL quiescer. The
 * caller owns connection immutability: this function performs only bounded read statements and
 * never retains the supplied connection.
 */
export function verifyLegacyCampaignImportLogicalState(
  database: ReadonlySyncSqliteDatabase,
  expected: LegacyCampaignCutoverExpectation,
): CampaignImportReceipt {
  verifyFaunapoolenDatabase(database);
  const receipt = requireRuntimeMarker(database);
  if (
    receipt.formatVersion !== expected.formatVersion ||
    receipt.sourceBytes !== expected.sourceBytes ||
    receipt.sourceSha256 !== expected.sourceSha256 ||
    receipt.campaignCount !== expected.campaignCount ||
    receipt.orderedCampaignsSha256 !== expected.orderedCampaignsSha256
  ) {
    throw new Error('Faunapoolen legacy campaign import receipt does not match cutover evidence.');
  }
  const campaigns = readAllStoredCampaigns(database);
  if (campaigns.length !== receipt.campaignCount) {
    throw new Error('Faunapoolen campaign rows do not match the sealed cutover receipt.');
  }
  const physical = createHash('sha256');
  const semantic = createHash('sha256');
  let sourceBytes = 0;
  let previousFileName: string | undefined;
  for (const [index, campaign] of campaigns.entries()) {
    if (
      !campaign.source ||
      campaign.sequence !== index + 1 ||
      campaign.source.fileName !== `${campaign.record.id}.json` ||
      (previousFileName !== undefined && previousFileName >= campaign.source.fileName)
    ) {
      throw new Error('Pre-activation campaign rows must all come from the sealed import.');
    }
    previousFileName = campaign.source.fileName;
    sourceBytes += campaign.source.bytes;
    physical.update(campaign.source.fileName, 'utf8');
    physical.update('\0');
    physical.update(String(campaign.source.bytes), 'ascii');
    physical.update('\0');
    physical.update(campaign.source.sha256, 'ascii');
    physical.update('\n');
    semantic.update(campaign.source.fileName, 'utf8');
    semantic.update('\0');
    semantic.update(sha256Hex(canonicalCampaignBytes(campaign.record)), 'ascii');
    semantic.update('\n');
  }
  if (
    sourceBytes !== receipt.sourceBytes ||
    physical.digest('hex') !== receipt.sourceSha256 ||
    semantic.digest('hex') !== receipt.orderedCampaignsSha256
  ) {
    throw new Error('Faunapoolen imported campaign rows fail sealed aggregate parity.');
  }
  return receipt;
}

/**
 * Repeatable production-start gate. Runtime campaigns are mutable, so startup proves only that the
 * selected database has the valid immutable import marker. It never reopens the legacy directory
 * or compares the current campaign rows to their one-time cutover state.
 */
export function verifyLegacyCampaignRuntimeMarker(
  database: ReadonlySyncSqliteDatabase,
): CampaignImportReceipt {
  verifyFaunapoolenMigrationFoundation(database);
  return requireRuntimeMarker(database);
}

function requireRuntimeMarker(database: ReadonlySyncSqliteDatabase): CampaignImportReceipt {
  const receipt = readCampaignImportReceipt(database);
  if (!receipt) throw new Error('Faunapoolen legacy campaign import receipt is missing.');
  return receipt;
}

function openImmutableDatabaseProof(databasePath: string): ImmutableDatabaseProof {
  if (
    !path.isAbsolute(databasePath) ||
    path.normalize(databasePath) !== databasePath ||
    fs.realpathSync.native(databasePath) !== databasePath
  ) {
    throw new Error(
      'Faunapoolen import verification requires one canonical absolute database path.',
    );
  }
  const parentPath = path.dirname(databasePath);
  const parentBefore = fs.lstatSync(parentPath, { bigint: true });
  if (
    !parentBefore.isDirectory() ||
    parentBefore.isSymbolicLink() ||
    fs.realpathSync.native(parentPath) !== parentPath
  ) {
    throw new Error(
      'Faunapoolen import verification requires one canonical real parent directory.',
    );
  }
  const namesBefore = fs.readdirSync(parentPath).toSorted();
  const databaseName = path.basename(databasePath);
  if (
    [`${databaseName}-journal`, `${databaseName}-shm`, `${databaseName}-wal`].some((name) =>
      namesBefore.includes(name),
    )
  ) {
    throw new Error(
      'Faunapoolen campaign rows cannot be verified while SQLite sidecars make the database mutable.',
    );
  }
  const pathBefore = fs.lstatSync(databasePath, { bigint: true });
  const descriptor = fs.openSync(databasePath, fs.constants.O_RDONLY | NO_FOLLOW);
  let native: DatabaseSync | undefined;
  try {
    const descriptorBefore = fs.fstatSync(descriptor, { bigint: true });
    if (
      !descriptorBefore.isFile() ||
      descriptorBefore.isSymbolicLink() ||
      descriptorBefore.nlink !== 1n ||
      descriptorBefore.uid !== BigInt(currentUid()) ||
      (descriptorBefore.mode & 0o777n) !== BigInt(PRIVATE_FILE_MODE) ||
      !sameStableFile(pathBefore, descriptorBefore)
    ) {
      throw new Error(
        'Faunapoolen import verification requires one current-user-owned mode-0600 single-link database.',
      );
    }
    const digestBefore = hashDescriptor(descriptor, descriptorBefore.size);
    const immutable = pathToFileURL(`/dev/fd/${descriptor}`);
    immutable.searchParams.set('immutable', '1');
    native = new DatabaseSync(immutable, { readOnly: true });
    const database = createPreparedSyncSqliteAdapter(native);
    let closed = false;
    return Object.freeze({
      database,
      closeAndVerify() {
        if (closed) return;
        closed = true;
        const errors: unknown[] = [];
        try {
          native?.close();
        } catch (error) {
          errors.push(error);
        }
        try {
          const descriptorAfter = fs.fstatSync(descriptor, { bigint: true });
          const pathAfter = fs.lstatSync(databasePath, { bigint: true });
          const parentAfter = fs.lstatSync(parentPath, { bigint: true });
          const namesAfter = fs.readdirSync(parentPath).toSorted();
          if (
            !sameStableFile(descriptorBefore, descriptorAfter) ||
            !sameStableFile(descriptorBefore, pathAfter) ||
            !sameStableDirectory(parentBefore, parentAfter) ||
            namesBefore.length !== namesAfter.length ||
            namesBefore.some((name, index) => name !== namesAfter[index]) ||
            hashDescriptor(descriptor, descriptorBefore.size) !== digestBefore
          ) {
            throw new Error(
              'Faunapoolen import verification changed or raced its database or parent directory.',
            );
          }
        } catch (error) {
          errors.push(error);
        }
        try {
          fs.closeSync(descriptor);
        } catch (error) {
          errors.push(error);
        }
        if (errors.length > 0) {
          throw new AggregateError(errors, 'Faunapoolen immutable database proof failed to close.');
        }
      },
    });
  } catch (error) {
    const errors = [error];
    try {
      native?.close();
    } catch (closeError) {
      errors.push(closeError);
    }
    try {
      fs.closeSync(descriptor);
    } catch (closeError) {
      errors.push(closeError);
    }
    if (errors.length === 1) throw error;
    throw new AggregateError(errors, 'Faunapoolen immutable database proof failed to open.');
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

function sameStableDirectory(left: fs.BigIntStats, right: fs.BigIntStats): boolean {
  return (
    left.isDirectory() === right.isDirectory() &&
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.uid === right.uid &&
    left.gid === right.gid &&
    left.mode === right.mode &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function hashDescriptor(descriptor: number, size: bigint): string {
  if (size < 0n || size > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Faunapoolen database exceeds the immutable verifier hashing range.');
  }
  const hash = createHash('sha256');
  const buffer = Buffer.allocUnsafe(64 * 1024);
  let offset = 0;
  const total = Number(size);
  while (offset < total) {
    const length = Math.min(buffer.length, total - offset);
    const read = fs.readSync(descriptor, buffer, 0, length, offset);
    if (read === 0) throw new Error('Faunapoolen database ended before its pinned size.');
    hash.update(buffer.subarray(0, read));
    offset += read;
  }
  return hash.digest('hex');
}

function requiredConstant(value: number | undefined, name: string): number {
  if (value === undefined) throw new Error(`Faunapoolen import verification requires ${name}.`);
  return value;
}

function currentUid(): number {
  if (process.geteuid === undefined) {
    throw new Error('Faunapoolen import verification requires POSIX ownership checks.');
  }
  return process.geteuid();
}
