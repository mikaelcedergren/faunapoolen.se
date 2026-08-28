import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';

import {
  CAMPAIGN_ROOT_FIELDS,
  campaignId,
  cloneRecord,
  writerBytes,
} from '../fixtures/campaign-history-records.mjs';

export const EXPECTED_CHECKPOINTS = Object.freeze([
  'source_directory_opened',
  'source_entry_opened',
  'source_validated',
  'temporary_created',
  'target_transaction_started',
  'campaign_inserted',
  'before_commit',
  'target_reopened',
  'marker_durable',
  'before_publish',
  'target_linked',
  'target_published',
  'final_source_verified',
  'replay_pinned',
]);

export const EXPECTED_LIMITS = Object.freeze({
  maxAggregateBytes: 100 * 1024 * 1024,
  maxCampaigns: 200,
  maxFileBytes: 512 * 1024,
});

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
export const COMPILED_IMPORTER_PATH = path.join(REPO_ROOT, 'server', 'dist', 'campaign-import.js');

export function stagingDirectoryPath(databasePath) {
  return path.join(path.dirname(databasePath), `.${path.basename(databasePath)}.import-stage`);
}

export function targetSidecarPaths(databasePath) {
  return [`${databasePath}-journal`, `${databasePath}-shm`, `${databasePath}-wal`];
}

export async function discoverImporter() {
  try {
    const module = await import(pathToFileURL(COMPILED_IMPORTER_PATH).href);
    const missing = [
      'CAMPAIGN_IMPORT_CHECKPOINTS',
      'CAMPAIGN_IMPORT_MAX_AGGREGATE_BYTES',
      'CAMPAIGN_IMPORT_MAX_CAMPAIGNS',
      'CAMPAIGN_IMPORT_MAX_FILE_BYTES',
      'importCampaignDirectory',
      'importCampaignDirectoryForTest',
    ].filter((name) => module[name] === undefined);
    if (missing.length > 0) {
      return {
        error: new Error(`Compiled importer is missing exports: ${missing.join(', ')}`),
        module: undefined,
      };
    }
    return { error: undefined, module };
  } catch (error) {
    return { error, module: undefined };
  }
}

export function setupImportFixture(t) {
  const directory = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), 'faunapoolen-campaign-import-')),
  );
  fs.chmodSync(directory, 0o700);
  t.after(() => fs.rmSync(directory, { force: true, recursive: true }));
  return {
    databasePath: path.join(directory, 'faunapoolen.sqlite'),
    directory,
    sourceDirectory: path.join(directory, 'campaign-history'),
  };
}

export function campaignFileName(id) {
  return `${id}.json`;
}

export function entryFromRecord(record, { bytes = writerBytes(record), name } = {}) {
  return Object.freeze({
    bytes: Buffer.from(bytes),
    name: name ?? campaignFileName(record.id),
    record: cloneRecord(record),
  });
}

export function writeSourceDirectory(
  sourceDirectory,
  entries,
  { directoryMode = 0o750, fileMode = 0o640 } = {},
) {
  fs.mkdirSync(sourceDirectory, { mode: directoryMode });
  for (const entry of entries) {
    fs.writeFileSync(path.join(sourceDirectory, entry.name), entry.bytes, {
      flag: 'wx',
      mode: fileMode,
    });
  }
}

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function canonicalJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new TypeError('Canonical campaign JSON forbids non-finite numbers.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError('Canonical campaign JSON accepts only plain JSON values.');
  }
  return `{${Object.keys(value)
    .toSorted()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(',')}}`;
}

export function canonicalCampaignBytes(record) {
  return Buffer.from(canonicalJson(record), 'utf8');
}

export function campaignHash(record) {
  return sha256(canonicalCampaignBytes(record));
}

function sortedEntries(entries) {
  return [...entries].sort((left, right) => left.name.localeCompare(right.name, 'en'));
}

export function physicalDirectoryHash(entries) {
  const hash = createHash('sha256');
  for (const entry of sortedEntries(entries)) {
    hash.update(entry.name, 'utf8');
    hash.update('\0');
    hash.update(String(entry.bytes.byteLength), 'ascii');
    hash.update('\0');
    hash.update(sha256(entry.bytes), 'ascii');
    hash.update('\n');
  }
  return hash.digest('hex');
}

export function orderedCampaignHash(entries) {
  const hash = createHash('sha256');
  for (const entry of sortedEntries(entries)) {
    hash.update(entry.name, 'utf8');
    hash.update('\0');
    hash.update(campaignHash(entry.record), 'ascii');
    hash.update('\n');
  }
  return hash.digest('hex');
}

export function expectedReceipt(entries) {
  return {
    campaignCount: entries.length,
    formatVersion: 1,
    orderedCampaignsSha256: orderedCampaignHash(entries),
    sourceBytes: entries.reduce((total, entry) => total + entry.bytes.byteLength, 0),
    sourceSha256: physicalDirectoryHash(entries),
  };
}

export function expectedRows(entries) {
  return sortedEntries(entries).map((entry, index) => ({
    campaignSequence: index + 1,
    id: entry.record.id,
    createdAt: entry.record.createdAt,
    createdAtMs: Date.parse(entry.record.createdAt),
    updatedAt: entry.record.updatedAt,
    updatedAtMs: Date.parse(entry.record.updatedAt),
    name: entry.record.name,
    stage: entry.record.stage,
    sourceFilename: entry.name,
    sourceBytes: entry.bytes.byteLength,
    sourceSha256: sha256(entry.bytes),
    recordSha256: campaignHash(entry.record),
    record: cloneRecord(entry.record),
  }));
}

export function capturePath(filePath, { includeBytes = true } = {}) {
  const stats = fs.lstatSync(filePath);
  return {
    bytes: includeBytes && stats.isFile() ? fs.readFileSync(filePath) : undefined,
    dev: stats.dev,
    ino: stats.ino,
    mode: stats.mode & 0o777,
    nlink: stats.nlink,
    size: stats.size,
    type: stats.isDirectory()
      ? 'directory'
      : stats.isFile()
        ? 'file'
        : stats.isSymbolicLink()
          ? 'symlink'
          : 'special',
  };
}

export function captureSourceTree(sourceDirectory) {
  const names = fs.readdirSync(sourceDirectory).toSorted();
  return {
    directory: capturePath(sourceDirectory, { includeBytes: false }),
    entries: Object.fromEntries(
      names.map((name) => [name, capturePath(path.join(sourceDirectory, name))]),
    ),
    names,
  };
}

export function assertPathSnapshot(filePath, snapshot) {
  const current = capturePath(filePath, { includeBytes: snapshot.bytes !== undefined });
  for (const field of ['dev', 'ino', 'mode', 'nlink', 'size', 'type']) {
    assert.equal(current[field], snapshot[field], `${filePath} ${field} changed`);
  }
  if (snapshot.bytes !== undefined) {
    assert.deepEqual(current.bytes, snapshot.bytes, `${filePath} bytes changed`);
  }
}

export function assertSourceTreeSnapshot(sourceDirectory, snapshot) {
  assertPathSnapshot(sourceDirectory, snapshot.directory);
  assert.deepEqual(
    fs.readdirSync(sourceDirectory).toSorted(),
    snapshot.names,
    'source names changed',
  );
  for (const name of snapshot.names) {
    assertPathSnapshot(path.join(sourceDirectory, name), snapshot.entries[name]);
  }
}

export function assertPrivateOwnedRegularFile(filePath) {
  const stats = fs.lstatSync(filePath);
  assert.equal(stats.isFile(), true, `${filePath} is not a regular file`);
  assert.equal(stats.uid, process.getuid(), `${filePath} is not owned by the current user`);
  assert.equal(stats.mode & 0o777, 0o600, `${filePath} is not mode 0600`);
  assert.equal(stats.nlink, 1, `${filePath} is not a single-link file`);
}

export function assertPrivateOwnedDirectory(directoryPath) {
  const stats = fs.lstatSync(directoryPath);
  assert.equal(stats.isDirectory(), true, `${directoryPath} is not a directory`);
  assert.equal(stats.uid, process.getuid(), `${directoryPath} is not owned by the current user`);
  assert.equal(stats.mode & 0o777, 0o700, `${directoryPath} is not mode 0700`);
}

function queryCampaigns(database) {
  const rows = database
    .prepare(
      `SELECT
         campaign_sequence AS campaignSequence,
         id,
         created_at AS createdAt,
         created_at_ms AS createdAtMs,
         updated_at AS updatedAt,
         updated_at_ms AS updatedAtMs,
         name,
         stage,
         source_filename AS sourceFilename,
         source_bytes AS sourceBytes,
         source_sha256 AS sourceSha256,
         record_sha256 AS recordSha256,
         record_json AS recordJson
       FROM campaigns
       ORDER BY campaign_sequence`,
    )
    .all();
  return rows.map((row) => {
    assert.ok(row.recordJson instanceof Uint8Array, 'record_json must be an authoritative BLOB');
    const recordBytes = Buffer.from(row.recordJson);
    const record = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(recordBytes));
    assert.deepEqual(Object.keys(record).toSorted(), CAMPAIGN_ROOT_FIELDS.toSorted());
    assert.deepEqual(recordBytes, canonicalCampaignBytes(record));
    assert.equal(row.recordSha256, sha256(recordBytes));
    const { recordJson: _recordJson, ...projection } = row;
    return { ...projection, record };
  });
}

export function readImportedTarget(databasePath) {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const campaigns = queryCampaigns(database);
    const receipt = database
      .prepare(
        `SELECT
           format_version AS formatVersion,
           source_bytes AS sourceBytes,
           source_sha256 AS sourceSha256,
           campaign_count AS campaignCount,
           ordered_campaigns_sha256 AS orderedCampaignsSha256
         FROM campaign_import_receipts
         WHERE receipt_key = 'legacy_campaign_directory_v1'`,
      )
      .get();
    return {
      campaigns,
      integrity: { ...database.prepare('PRAGMA integrity_check').get() },
      receipt: receipt && { ...receipt },
    };
  } finally {
    database.close();
  }
}

export function assertImportedTarget(databasePath, entries) {
  assert.equal(fs.existsSync(stagingDirectoryPath(databasePath)), false, 'staging residue remains');
  for (const sidecar of targetSidecarPaths(databasePath)) {
    assert.equal(fs.existsSync(sidecar), false, `target sidecar remains: ${sidecar}`);
  }
  assertPrivateOwnedRegularFile(databasePath);
  const target = readImportedTarget(databasePath);
  assert.deepEqual(target.campaigns, expectedRows(entries));
  assert.deepEqual(target.receipt, expectedReceipt(entries));
  assert.deepEqual(target.integrity, { integrity_check: 'ok' });
  assertPrivateOwnedRegularFile(databasePath);
  return target;
}

export async function expectImportError(action, code, details = {}) {
  await assert.rejects(action, (error) => {
    assert.equal(error?.name, 'CampaignImportError');
    assert.equal(error?.code, code);
    if (details.fileName !== undefined) assert.equal(error?.fileName, details.fileName);
    if (details.field !== undefined) assert.equal(error?.field, details.field);
    return true;
  });
}

export function assertNoTargetArtifacts(directory, databasePath, allowedNames = []) {
  assert.equal(fs.existsSync(databasePath), false, 'target database unexpectedly exists');
  const allowed = new Set(allowedNames);
  const unexpected = fs.readdirSync(directory).filter((name) => !allowed.has(name));
  assert.deepEqual(unexpected, [], `unexpected import artifacts: ${unexpected.join(', ')}`);
}

export function recordAt(index, template) {
  const record = cloneRecord(template);
  record.id = campaignId(index);
  return record;
}
