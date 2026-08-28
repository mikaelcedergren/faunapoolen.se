import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { withImmediateTransaction } from '@mikaelcedergren/cx-framework/server/sqlite';
import type { ReadonlySyncSqliteDatabase } from '@mikaelcedergren/cx-framework/server/sqlite';

import {
  CAMPAIGN_IMPORT_MAX_AGGREGATE_BYTES,
  CAMPAIGN_IMPORT_MAX_FILE_BYTES,
  CAMPAIGN_MAX_RECORDS,
  CampaignJsonSyntaxError,
  CampaignValidationError,
  canonicalCampaignBytes,
  parseCampaignBytes,
  sha256Hex,
  type CampaignRecord,
} from './campaign-schema.js';
import {
  CAMPAIGN_IMPORT_FORMAT_VERSION,
  insertCampaignImportReceipt,
  insertImportedCampaign,
  readAllStoredCampaigns,
  readCampaignImportReceipt,
  type CampaignImportReceipt,
} from './campaign-repository.js';
import { openFaunapoolenDatabase, verifyFaunapoolenDatabase } from './database.js';

export { CAMPAIGN_IMPORT_MAX_AGGREGATE_BYTES, CAMPAIGN_IMPORT_MAX_FILE_BYTES };
export const CAMPAIGN_IMPORT_MAX_CAMPAIGNS = CAMPAIGN_MAX_RECORDS;

export const CAMPAIGN_IMPORT_CHECKPOINTS = Object.freeze([
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
] as const);

type CampaignImportCheckpoint = (typeof CAMPAIGN_IMPORT_CHECKPOINTS)[number];
type CampaignImportCode =
  | 'campaign_too_large'
  | 'cleanup_failed'
  | 'duplicate_id'
  | 'duplicate_key'
  | 'filename_id_mismatch'
  | 'import_failed'
  | 'invalid_campaign'
  | 'invalid_entry'
  | 'invalid_filename'
  | 'invalid_json'
  | 'invalid_options'
  | 'invalid_utf8'
  | 'recovery_conflict'
  | 'source_changed'
  | 'source_invalid_type'
  | 'source_missing'
  | 'source_too_large'
  | 'target_changed'
  | 'target_conflict'
  | 'too_many_campaigns'
  | 'unsafe_entry';

export class CampaignImportError extends Error {
  readonly code: CampaignImportCode;
  readonly field: string | undefined;
  readonly fileName: string | undefined;

  constructor(
    code: CampaignImportCode,
    message: string,
    options: {
      readonly cause?: unknown;
      readonly field?: string;
      readonly fileName?: string;
    } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'CampaignImportError';
    this.code = code;
    this.field = options.field;
    this.fileName = options.fileName;
  }
}

interface ImportOptions {
  readonly databasePath: string;
  readonly sourceDirectory: string;
}

interface ImportTestOptions {
  readonly onAllocationPhase?: (
    phase:
      | 'intent_allocated'
      | 'intent_prepared'
      | 'intent_linked'
      | 'intent_durable'
      | 'preparation_durable'
      | 'stage_published',
    details: ImportCheckpointDetails,
  ) => unknown;
  readonly onCheckpoint: (
    checkpoint: CampaignImportCheckpoint,
    details: ImportCheckpointDetails,
  ) => unknown;
}

interface ImportCheckpointDetails {
  readonly databasePath?: string;
  readonly fileName?: string;
  readonly campaignSequence?: number;
  readonly stagingDirectory?: string;
}

interface ResolvedOptions extends ImportOptions {
  readonly intentPath: string;
  readonly intentTemporaryNamePrefix: string;
  readonly parentDescriptor: number;
  readonly parentSnapshot: FileSnapshot;
  readonly stagingDirectory: string;
}

interface ValidatedEntry {
  readonly bytes: Buffer;
  readonly canonicalBytes: Buffer;
  readonly canonicalSha256: string;
  readonly descriptor: number;
  readonly fileName: string;
  readonly filePath: string;
  readonly record: CampaignRecord;
  readonly snapshot: FileSnapshot;
  readonly sourceSha256: string;
}

interface ValidatedSource {
  readonly descriptor: number;
  readonly directoryPath: string;
  readonly entries: readonly ValidatedEntry[];
  readonly names: readonly string[];
  readonly receipt: CampaignImportReceipt;
  readonly snapshot: FileSnapshot;
}

interface FileSnapshot {
  readonly ctimeNs: bigint;
  readonly dev: bigint;
  readonly gid: bigint;
  readonly ino: bigint;
  readonly mode: bigint;
  readonly mtimeNs: bigint;
  readonly nlink: bigint;
  readonly size: bigint;
  readonly uid: bigint;
}

interface StableFileProof {
  readonly descriptor: number;
  readonly digest: string;
  readonly snapshot: FileSnapshot;
}

interface ImportStage {
  readonly databaseDescriptor: number;
  readonly databasePath: string;
  readonly databaseSnapshot: FileSnapshot;
  readonly directoryDescriptor: number;
  readonly directoryPath: string;
  readonly directorySnapshot: FileSnapshot;
  markerSnapshot: FileSnapshot;
}

interface StageMarkerBase {
  readonly directoryDev: string;
  readonly directoryIno: string;
  readonly formatVersion: 1;
  readonly kind: 'faunapoolen_campaign_import';
  readonly intentId: string;
  readonly ownerPid: string;
  readonly parentDev: string;
  readonly parentIno: string;
  readonly sourceReceipt: CampaignImportReceipt;
  readonly targetName: string;
}

interface BuildingStageMarker extends StageMarkerBase {
  readonly state: 'building';
}

interface SealedStageMarker extends StageMarkerBase {
  readonly databaseDev: string;
  readonly databaseIno: string;
  readonly databaseSha256: string;
  readonly databaseSize: string;
  readonly state: 'sealed';
}

type StageMarker = BuildingStageMarker | SealedStageMarker;

interface ImportIntentMarker {
  readonly formatVersion: 1;
  readonly intentId: string;
  readonly kind: 'faunapoolen_campaign_import_intent';
  readonly ownerPid: string;
  readonly parentDev: string;
  readonly parentIno: string;
  readonly preparationName: string;
  readonly sourceDev: string;
  readonly sourceDirectory: string;
  readonly sourceIno: string;
  readonly sourceReceipt: CampaignImportReceipt;
  readonly targetName: string;
}

interface ImportIntent {
  readonly descriptor: number;
  readonly marker: ImportIntentMarker;
  readonly path: string;
  readonly preparationPath: string;
  readonly snapshot: FileSnapshot;
}

const PRIVATE_FILE_MODE = 0o600;
const PRIVATE_DIRECTORY_MODE = 0o700;
const STAGE_DATABASE_NAME = 'database.sqlite';
const STAGE_MARKER_NAME = 'operation.json';
const STAGE_MARKER_TEMPORARY_NAME = `${STAGE_MARKER_NAME}.tmp`;
const STAGE_DATABASE_SIDECAR_NAMES = Object.freeze([
  `${STAGE_DATABASE_NAME}-journal`,
  `${STAGE_DATABASE_NAME}-shm`,
  `${STAGE_DATABASE_NAME}-wal`,
]);
const STAGE_MARKER_MAX_BYTES = 8 * 1024;
const INTENT_MARKER_MAX_BYTES = 8 * 1024;
const MAX_INTENT_PREPARATIONS = 16;
const CAMPAIGN_FILE_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.json$/u;
const CAMPAIGN_FILE_CANDIDATE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?:\.[a-z0-9]+)?$/iu;
const EMPTY_DETAILS = Object.freeze({});
const NO_FOLLOW = requiredConstant(fs.constants.O_NOFOLLOW, 'O_NOFOLLOW');
const DIRECTORY_ONLY = requiredConstant(fs.constants.O_DIRECTORY, 'O_DIRECTORY');
const CURRENT_UID = BigInt(currentUid());

export async function importCampaignDirectory(
  options: ImportOptions,
): Promise<CampaignImportReceipt> {
  return runImport(options);
}

export async function importCampaignDirectoryForTest(
  options: ImportOptions,
  testOptions: ImportTestOptions,
): Promise<CampaignImportReceipt> {
  if (
    !testOptions ||
    typeof testOptions !== 'object' ||
    Array.isArray(testOptions) ||
    !['onCheckpoint', 'onAllocationPhase,onCheckpoint'].includes(
      Object.keys(testOptions).toSorted().join(','),
    ) ||
    (testOptions.onAllocationPhase !== undefined &&
      typeof testOptions.onAllocationPhase !== 'function') ||
    typeof testOptions.onCheckpoint !== 'function'
  ) {
    throw new CampaignImportError(
      'invalid_options',
      'Campaign importer test options must contain onCheckpoint and may contain onAllocationPhase.',
    );
  }
  return runImport(options, testOptions.onCheckpoint, testOptions.onAllocationPhase);
}

async function runImport(
  rawOptions: ImportOptions,
  onCheckpoint?: ImportTestOptions['onCheckpoint'],
  onAllocationPhase?: ImportTestOptions['onAllocationPhase'],
): Promise<CampaignImportReceipt> {
  let options: ResolvedOptions | undefined;
  let source: ValidatedSource | undefined;
  let intent: ImportIntent | undefined;
  let stage: ImportStage | undefined;
  let published: StableFileProof | undefined;
  let completed = false;
  let result: CampaignImportReceipt | undefined;
  let primaryError: unknown;

  const checkpoint = (
    name: CampaignImportCheckpoint,
    details: ImportCheckpointDetails = EMPTY_DETAILS,
  ): void => {
    if (!onCheckpoint) return;
    let returned: unknown;
    try {
      returned = onCheckpoint(name, details);
    } catch (error) {
      throw new CampaignImportError('import_failed', `Campaign import failed at ${name}.`, {
        cause: error,
      });
    }
    if (isPromiseLike(returned)) {
      throw new CampaignImportError(
        'invalid_options',
        'Campaign importer checkpoints must be synchronous.',
      );
    }
  };

  const allocationPhase = (
    phase:
      | 'intent_allocated'
      | 'intent_prepared'
      | 'intent_linked'
      | 'intent_durable'
      | 'preparation_durable'
      | 'stage_published',
    details: ImportCheckpointDetails,
  ): void => {
    if (!onAllocationPhase) return;
    const returned = onAllocationPhase(phase, details);
    if (isPromiseLike(returned)) {
      throw new CampaignImportError(
        'invalid_options',
        'Campaign importer allocation hooks must be synchronous.',
      );
    }
  };

  try {
    options = resolveOptions(rawOptions);
    source = openAndValidateSource(options.sourceDirectory, checkpoint);
    checkpoint('source_validated');
    assertParentUnchanged(options, 'target_changed');
    assertTargetSidecarsAbsent(options.databasePath, 'target_conflict');
    recoverIntentPreparations(options);
    intent = readExistingIntent(options, source);
    if (intent) recoverPreparationDirectory(options, source, intent);
    if (!intent && pathExists(options.stagingDirectory)) {
      throw recoveryConflict('Campaign staging exists without its exclusive import intent.');
    }

    const recovered = intent ? recoverStage(options, source, intent) : undefined;
    if (recovered) {
      stage = recovered.stage;
      if (recovered.published) {
        published = recovered.proof;
      } else {
        checkpoint('before_publish');
        published = linkStage(options, stage);
        checkpoint('target_linked', stageDetails(stage));
        published = publishLinkedStage(options, stage, published);
        checkpoint('target_published', stageDetails(stage));
      }
      assertSourceUnchanged(source);
      checkpoint('final_source_verified');
      assertTargetStable(options, published, 'target_changed');
      verifyImportedTarget(options.databasePath, source);
      cleanupStage(options, stage);
      stage = undefined;
      if (!intent) throw new Error('Recovered campaign staging lost its exclusive import intent.');
      removeIntent(options, intent);
      intent = undefined;
      completed = true;
      result = source.receipt;
    } else {
      const existing = inspectTarget(options.databasePath);
      if (existing) {
        result = verifyExactReplay(options, source, existing, checkpoint);
        if (intent) {
          removeIntent(options, intent);
          intent = undefined;
        }
        completed = true;
      } else {
        if (intent) {
          removeIntent(options, intent);
          intent = undefined;
        }
        intent = createIntent(options, source, allocationPhase);
        allocationPhase('intent_durable', {
          stagingDirectory: intent.preparationPath,
        });
        stage = createStage(options, source, intent, allocationPhase);
        checkpoint('temporary_created', stageDetails(stage));
        buildStageDatabase(stage, source, checkpoint);
        checkpoint('target_reopened', stageDetails(stage));
        const proof = stableProof(stage.databaseDescriptor);
        verifyImportedTarget(stage.databasePath, source);
        sealMarker(options, stage, source, intent, proof);
        checkpoint('marker_durable', stageDetails(stage));
        checkpoint('before_publish');
        published = linkStage(options, stage);
        checkpoint('target_linked', stageDetails(stage));
        published = publishLinkedStage(options, stage, published);
        checkpoint('target_published', stageDetails(stage));
        assertTargetStable(options, published, 'target_changed');
        assertSourceUnchanged(source);
        checkpoint('final_source_verified');
        assertTargetStable(options, published, 'target_changed');
        verifyImportedTarget(options.databasePath, source);
        cleanupStage(options, stage);
        stage = undefined;
        removeIntent(options, intent);
        intent = undefined;
        completed = true;
        result = source.receipt;
      }
    }
  } catch (error) {
    primaryError = normalizeImportError(error);
  }

  const cleanupErrors: unknown[] = [];
  if (!completed && options) {
    if (published) {
      captureCleanup(cleanupErrors, () => rollbackPublishedTarget(options, published));
    }
    if (stage) captureCleanup(cleanupErrors, () => cleanupStage(options, stage));
    if (
      intent &&
      cleanupErrors.length === 0 &&
      !pathExists(options.databasePath) &&
      !pathExists(options.stagingDirectory) &&
      !pathExists(intent.preparationPath)
    ) {
      captureCleanup(cleanupErrors, () => removeIntent(options, intent as ImportIntent));
      if (cleanupErrors.length === 0) intent = undefined;
    }
  }
  if (intent) captureCleanup(cleanupErrors, () => closeDescriptor(intent?.descriptor ?? -1));
  if (source) captureCleanup(cleanupErrors, () => closeSource(source));
  if (options) captureCleanup(cleanupErrors, () => fs.closeSync(options.parentDescriptor));

  if (primaryError || cleanupErrors.length > 0) {
    if (primaryError && cleanupErrors.length === 0) throw primaryError;
    const errors = primaryError ? [primaryError, ...cleanupErrors] : cleanupErrors;
    throw new CampaignImportError(
      primaryError instanceof CampaignImportError ? primaryError.code : 'cleanup_failed',
      'Campaign import and cleanup did not complete cleanly.',
      { cause: new AggregateError(errors) },
    );
  }
  if (!result)
    throw new CampaignImportError('import_failed', 'Campaign import produced no result.');
  return result;
}

function resolveOptions(raw: ImportOptions): ResolvedOptions {
  if (
    !raw ||
    typeof raw !== 'object' ||
    Array.isArray(raw) ||
    Object.keys(raw).toSorted().join(',') !== 'databasePath,sourceDirectory' ||
    !normalizedAbsolute(raw.databasePath) ||
    !normalizedAbsolute(raw.sourceDirectory)
  ) {
    throw new CampaignImportError(
      'invalid_options',
      'Campaign import requires normalized absolute databasePath and sourceDirectory paths.',
    );
  }
  if (
    raw.databasePath === raw.sourceDirectory ||
    raw.databasePath.startsWith(`${raw.sourceDirectory}${path.sep}`)
  ) {
    throw new CampaignImportError(
      'invalid_options',
      'Campaign database cannot be inside its source.',
    );
  }
  const parentPath = path.dirname(raw.databasePath);
  let parentStats: fs.BigIntStats;
  try {
    parentStats = fs.lstatSync(parentPath, { bigint: true });
  } catch (error) {
    throw new CampaignImportError('invalid_options', 'Campaign database parent is unavailable.', {
      cause: error,
    });
  }
  const parentSnapshot = fileSnapshot(parentStats);
  if (
    !parentStats.isDirectory() ||
    parentStats.isSymbolicLink() ||
    !isPrivateOwnedDirectory(parentSnapshot) ||
    fs.realpathSync.native(parentPath) !== parentPath
  ) {
    throw new CampaignImportError(
      'invalid_options',
      'Campaign database parent must be one canonical owned mode-0700 directory.',
    );
  }
  const parentDescriptor = fs.openSync(
    parentPath,
    fs.constants.O_RDONLY | DIRECTORY_ONLY | NO_FOLLOW,
  );
  const descriptorSnapshot = fileSnapshot(fs.fstatSync(parentDescriptor, { bigint: true }));
  if (
    !sameFileIdentity(descriptorSnapshot, parentSnapshot) ||
    !isPrivateOwnedDirectory(descriptorSnapshot)
  ) {
    fs.closeSync(parentDescriptor);
    throw new CampaignImportError(
      'target_changed',
      'Campaign database parent changed while opening.',
    );
  }
  return Object.freeze({
    databasePath: raw.databasePath,
    intentPath: path.join(parentPath, `.${path.basename(raw.databasePath)}.import-intent.json`),
    intentTemporaryNamePrefix: `.${path.basename(raw.databasePath)}.import-intent.prepare-`,
    parentDescriptor,
    parentSnapshot: descriptorSnapshot,
    sourceDirectory: raw.sourceDirectory,
    stagingDirectory: path.join(parentPath, `.${path.basename(raw.databasePath)}.import-stage`),
  });
}

function openAndValidateSource(
  sourceDirectory: string,
  checkpoint: (name: CampaignImportCheckpoint, details?: ImportCheckpointDetails) => void,
): ValidatedSource {
  let pathStats: fs.BigIntStats;
  try {
    pathStats = fs.lstatSync(sourceDirectory, { bigint: true });
  } catch (error) {
    if (errorCode(error) === 'ENOENT') {
      throw new CampaignImportError('source_missing', 'Campaign source directory is missing.');
    }
    throw new CampaignImportError('source_invalid_type', 'Campaign source cannot be inspected.', {
      cause: error,
    });
  }
  if (!pathStats.isDirectory() || pathStats.isSymbolicLink()) {
    throw new CampaignImportError(
      'source_invalid_type',
      'Campaign source must be a real directory.',
    );
  }
  let descriptor: number;
  try {
    descriptor = fs.openSync(sourceDirectory, fs.constants.O_RDONLY | DIRECTORY_ONLY | NO_FOLLOW);
  } catch (error) {
    throw new CampaignImportError(
      'source_invalid_type',
      'Campaign source directory cannot be pinned.',
      {
        cause: error,
      },
    );
  }
  const snapshot = fileSnapshot(fs.fstatSync(descriptor, { bigint: true }));
  if (!sameFileIdentity(snapshot, fileSnapshot(pathStats))) {
    fs.closeSync(descriptor);
    throw new CampaignImportError('source_changed', 'Campaign source changed while opening.');
  }
  checkpoint('source_directory_opened');

  const opened: ValidatedEntry[] = [];
  try {
    const names = fs.readdirSync(sourceDirectory).toSorted();
    if (names.length > CAMPAIGN_MAX_RECORDS) {
      throw new CampaignImportError(
        'too_many_campaigns',
        `Campaign source exceeds ${String(CAMPAIGN_MAX_RECORDS)} files.`,
      );
    }
    const ids = new Set<string>();
    let aggregateBytes = 0;
    for (const fileName of names) {
      const match = CAMPAIGN_FILE_PATTERN.exec(fileName);
      if (!match) {
        const code =
          fileName.endsWith('.json') || CAMPAIGN_FILE_CANDIDATE_PATTERN.test(fileName)
            ? 'invalid_filename'
            : 'invalid_entry';
        throw new CampaignImportError(code, 'Campaign source contains an invalid entry name.', {
          fileName,
        });
      }
      const expectedId = match[1];
      if (!expectedId) {
        throw new CampaignImportError('invalid_filename', 'Campaign filename has no UUID.', {
          fileName,
        });
      }
      const filePath = path.join(sourceDirectory, fileName);
      const entry = openSourceEntry(filePath, fileName, expectedId, checkpoint);
      opened.push(entry);
      aggregateBytes += entry.bytes.byteLength;
      if (aggregateBytes > CAMPAIGN_IMPORT_MAX_AGGREGATE_BYTES) {
        throw new CampaignImportError(
          'source_too_large',
          'Campaign source exceeds the aggregate byte ceiling.',
          { fileName },
        );
      }
      if (ids.has(entry.record.id)) {
        throw new CampaignImportError('duplicate_id', 'Campaign source contains a duplicate id.', {
          fileName,
          field: 'id',
        });
      }
      ids.add(entry.record.id);
    }
    const receipt = receiptFor(opened);
    const source: ValidatedSource = Object.freeze({
      descriptor,
      directoryPath: sourceDirectory,
      entries: Object.freeze(opened),
      names: Object.freeze(names),
      receipt,
      snapshot,
    });
    assertSourceUnchanged(source);
    return source;
  } catch (error) {
    for (const entry of opened) closeDescriptor(entry.descriptor);
    closeDescriptor(descriptor);
    throw error;
  }
}

function openSourceEntry(
  filePath: string,
  fileName: string,
  expectedId: string,
  checkpoint: (name: CampaignImportCheckpoint, details?: ImportCheckpointDetails) => void,
): ValidatedEntry {
  let pathStats: fs.BigIntStats;
  try {
    pathStats = fs.lstatSync(filePath, { bigint: true });
  } catch (error) {
    throw new CampaignImportError('source_changed', 'Campaign entry changed before opening.', {
      cause: error,
      fileName,
    });
  }
  if (!pathStats.isFile() || pathStats.isSymbolicLink() || pathStats.nlink !== 1n) {
    throw new CampaignImportError(
      'unsafe_entry',
      'Campaign entry is linked or not a regular file.',
      {
        fileName,
      },
    );
  }
  if (pathStats.size > BigInt(CAMPAIGN_IMPORT_MAX_FILE_BYTES)) {
    throw new CampaignImportError('campaign_too_large', 'Campaign entry exceeds 512 KiB.', {
      fileName,
    });
  }
  let descriptor: number;
  try {
    descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | NO_FOLLOW);
  } catch (error) {
    throw new CampaignImportError('source_changed', 'Campaign entry could not be pinned.', {
      cause: error,
      fileName,
    });
  }
  try {
    const snapshot = fileSnapshot(fs.fstatSync(descriptor, { bigint: true }));
    if (!sameSnapshot(snapshot, fileSnapshot(pathStats)) || !isRegularSingleLink(snapshot)) {
      throw new CampaignImportError('source_changed', 'Campaign entry changed while opening.', {
        fileName,
      });
    }
    checkpoint('source_entry_opened', { fileName });
    const bytes = readDescriptor(descriptor, snapshot.size, CAMPAIGN_IMPORT_MAX_FILE_BYTES);
    assertDescriptorAndPath(filePath, descriptor, snapshot, fileName);
    let record: CampaignRecord;
    try {
      if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
        throw new CampaignValidationError('campaign', 'Campaign JSON cannot begin with a BOM.');
      }
      record = parseCampaignBytes(bytes);
    } catch (error) {
      if (error instanceof CampaignValidationError) {
        throw new CampaignImportError('invalid_campaign', error.message, {
          cause: error,
          field: error.field,
          fileName,
        });
      }
      if (error instanceof CampaignJsonSyntaxError) {
        const invalidUtf8 = error.message.includes('not valid UTF-8');
        throw new CampaignImportError(
          error.duplicateField ? 'duplicate_key' : invalidUtf8 ? 'invalid_utf8' : 'invalid_json',
          error.message,
          {
            cause: error,
            ...(error.duplicateField ? { field: error.duplicateField } : {}),
            fileName,
          },
        );
      }
      throw error;
    }
    if (record.id !== expectedId) {
      throw new CampaignImportError(
        'filename_id_mismatch',
        'Campaign filename UUID does not match record id.',
        { fileName, field: 'id' },
      );
    }
    const canonicalBytes = canonicalCampaignBytes(record);
    return Object.freeze({
      bytes,
      canonicalBytes,
      canonicalSha256: sha256Hex(canonicalBytes),
      descriptor,
      fileName,
      filePath,
      record,
      snapshot,
      sourceSha256: sha256Hex(bytes),
    });
  } catch (error) {
    closeDescriptor(descriptor);
    throw error;
  }
}

function receiptFor(entries: readonly ValidatedEntry[]): CampaignImportReceipt {
  const physical = createHash('sha256');
  const semantic = createHash('sha256');
  let sourceBytes = 0;
  for (const entry of entries) {
    sourceBytes += entry.bytes.byteLength;
    physical.update(entry.fileName, 'utf8');
    physical.update('\0');
    physical.update(String(entry.bytes.byteLength), 'ascii');
    physical.update('\0');
    physical.update(entry.sourceSha256, 'ascii');
    physical.update('\n');
    semantic.update(entry.fileName, 'utf8');
    semantic.update('\0');
    semantic.update(entry.canonicalSha256, 'ascii');
    semantic.update('\n');
  }
  return Object.freeze({
    campaignCount: entries.length,
    formatVersion: CAMPAIGN_IMPORT_FORMAT_VERSION,
    orderedCampaignsSha256: semantic.digest('hex'),
    sourceBytes,
    sourceSha256: physical.digest('hex'),
  });
}

function assertSourceUnchanged(source: ValidatedSource): void {
  let pathStats: fs.BigIntStats;
  try {
    pathStats = fs.lstatSync(source.directoryPath, { bigint: true });
  } catch (error) {
    throw new CampaignImportError('source_changed', 'Campaign source directory disappeared.', {
      cause: error,
    });
  }
  const descriptorSnapshot = fileSnapshot(fs.fstatSync(source.descriptor, { bigint: true }));
  if (
    !pathStats.isDirectory() ||
    pathStats.isSymbolicLink() ||
    !sameSnapshot(source.snapshot, descriptorSnapshot) ||
    !sameSnapshot(source.snapshot, fileSnapshot(pathStats)) ||
    !sameFileIdentity(descriptorSnapshot, fileSnapshot(pathStats))
  ) {
    throw new CampaignImportError('source_changed', 'Campaign source directory changed.');
  }
  const names = fs.readdirSync(source.directoryPath).toSorted();
  if (
    names.length !== source.names.length ||
    names.some((name, index) => name !== source.names[index])
  ) {
    throw new CampaignImportError('source_changed', 'Campaign source directory inventory changed.');
  }
  for (const entry of source.entries) {
    assertDescriptorAndPath(entry.filePath, entry.descriptor, entry.snapshot, entry.fileName);
    const bytes = readDescriptor(
      entry.descriptor,
      entry.snapshot.size,
      CAMPAIGN_IMPORT_MAX_FILE_BYTES,
    );
    if (!bytes.equals(entry.bytes)) {
      throw new CampaignImportError('source_changed', 'Campaign source bytes changed.', {
        fileName: entry.fileName,
      });
    }
  }
}

function assertDescriptorAndPath(
  filePath: string,
  descriptor: number,
  expected: FileSnapshot,
  fileName: string,
): void {
  let pathStats: fs.BigIntStats;
  try {
    pathStats = fs.lstatSync(filePath, { bigint: true });
  } catch (error) {
    throw new CampaignImportError('source_changed', 'Campaign source entry disappeared.', {
      cause: error,
      fileName,
    });
  }
  const descriptorSnapshot = fileSnapshot(fs.fstatSync(descriptor, { bigint: true }));
  const currentPath = fileSnapshot(pathStats);
  if (
    !pathStats.isFile() ||
    pathStats.isSymbolicLink() ||
    !isRegularSingleLink(descriptorSnapshot) ||
    !sameSnapshot(expected, descriptorSnapshot) ||
    !sameSnapshot(expected, currentPath)
  ) {
    throw new CampaignImportError('source_changed', 'Campaign source entry changed.', {
      fileName,
    });
  }
}

function inspectTarget(databasePath: string): StableFileProof | undefined {
  let stats: fs.BigIntStats;
  try {
    stats = fs.lstatSync(databasePath, { bigint: true });
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return undefined;
    throw new CampaignImportError('target_conflict', 'Campaign target cannot be inspected.', {
      cause: error,
    });
  }
  const snapshot = fileSnapshot(stats);
  if (
    !stats.isFile() ||
    stats.isSymbolicLink() ||
    !isPrivateOwnedFile(snapshot) ||
    snapshot.nlink !== 1n
  ) {
    throw new CampaignImportError(
      'target_conflict',
      'Campaign target is not one private single-link regular file.',
    );
  }
  let descriptor: number;
  try {
    descriptor = fs.openSync(databasePath, fs.constants.O_RDONLY | NO_FOLLOW);
  } catch (error) {
    throw new CampaignImportError('target_conflict', 'Campaign target cannot be pinned.', {
      cause: error,
    });
  }
  try {
    const proof = stableProof(descriptor);
    if (!sameSnapshot(snapshot, proof.snapshot)) {
      throw new CampaignImportError('target_changed', 'Campaign target changed while opening.');
    }
    return proof;
  } catch (error) {
    closeDescriptor(descriptor);
    throw error;
  }
}

function verifyExactReplay(
  options: ResolvedOptions,
  source: ValidatedSource,
  target: StableFileProof,
  checkpoint: (name: CampaignImportCheckpoint, details?: ImportCheckpointDetails) => void,
): CampaignImportReceipt {
  try {
    checkpoint('replay_pinned');
    assertTargetSidecarsAbsent(options.databasePath, 'target_conflict');
    verifyImportedTarget(options.databasePath, source);
    assertSourceUnchanged(source);
    assertTargetStable(options, target, 'target_changed');
    return source.receipt;
  } catch (error) {
    if (error instanceof CampaignImportError) throw error;
    throw new CampaignImportError(
      'target_conflict',
      'Existing campaign target is not the identical sealed import.',
      { cause: error },
    );
  } finally {
    closeDescriptor(target.descriptor);
  }
}

function createIntent(
  options: ResolvedOptions,
  source: ValidatedSource,
  allocationPhase: (
    phase:
      | 'intent_allocated'
      | 'intent_prepared'
      | 'intent_linked'
      | 'intent_durable'
      | 'preparation_durable'
      | 'stage_published',
    details: ImportCheckpointDetails,
  ) => void,
): ImportIntent {
  assertParentUnchanged(options, 'target_changed');
  if (pathExists(options.intentPath)) {
    throw recoveryConflict('Campaign import intent appeared before exclusive allocation.');
  }
  const intentId = randomUUID();
  const ownerPid = String(process.pid);
  const preparationName = `${path.basename(options.stagingDirectory)}.prepare-${intentId}`;
  const temporaryPath = path.join(
    path.dirname(options.databasePath),
    `${options.intentTemporaryNamePrefix}${ownerPid}-${intentId}`,
  );
  const marker: ImportIntentMarker = Object.freeze({
    formatVersion: 1,
    intentId,
    kind: 'faunapoolen_campaign_import_intent',
    ownerPid,
    parentDev: options.parentSnapshot.dev.toString(),
    parentIno: options.parentSnapshot.ino.toString(),
    preparationName,
    sourceDev: source.snapshot.dev.toString(),
    sourceDirectory: source.directoryPath,
    sourceIno: source.snapshot.ino.toString(),
    sourceReceipt: source.receipt,
    targetName: path.basename(options.databasePath),
  });
  const bytes = Buffer.from(`${JSON.stringify(marker)}\n`, 'utf8');
  if (bytes.byteLength > INTENT_MARKER_MAX_BYTES) {
    throw new CampaignImportError(
      'import_failed',
      'Campaign import intent exceeds its byte bound.',
    );
  }
  let descriptor = -1;
  let canonicalLinked = false;
  let temporaryUnlinked = false;
  try {
    descriptor = fs.openSync(
      temporaryPath,
      fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR | NO_FOLLOW,
      PRIVATE_FILE_MODE,
    );
    allocationPhase('intent_allocated', {
      stagingDirectory: path.join(path.dirname(options.databasePath), preparationName),
    });
    writeAll(descriptor, bytes);
    fs.fsyncSync(descriptor);
    fs.fsyncSync(options.parentDescriptor);
    const preparedSnapshot = fileSnapshot(fs.fstatSync(descriptor, { bigint: true }));
    const temporarySnapshot = fileSnapshot(fs.lstatSync(temporaryPath, { bigint: true }));
    if (
      !isPrivateOwnedFile(preparedSnapshot) ||
      preparedSnapshot.nlink !== 1n ||
      !sameSnapshot(preparedSnapshot, temporarySnapshot)
    ) {
      throw new Error('Campaign import prepared intent is not one private owned file.');
    }
    allocationPhase('intent_prepared', {
      stagingDirectory: path.join(path.dirname(options.databasePath), preparationName),
    });
    assertParentUnchanged(options, 'target_changed');
    fs.linkSync(temporaryPath, options.intentPath);
    canonicalLinked = true;
    fs.fsyncSync(options.parentDescriptor);
    const linkedDescriptorSnapshot = fileSnapshot(fs.fstatSync(descriptor, { bigint: true }));
    const linkedTemporarySnapshot = fileSnapshot(fs.lstatSync(temporaryPath, { bigint: true }));
    const linkedCanonicalSnapshot = fileSnapshot(
      fs.lstatSync(options.intentPath, { bigint: true }),
    );
    if (
      linkedDescriptorSnapshot.nlink !== 2n ||
      !sameSnapshot(linkedDescriptorSnapshot, linkedTemporarySnapshot) ||
      !sameSnapshot(linkedDescriptorSnapshot, linkedCanonicalSnapshot)
    ) {
      throw new Error('Campaign import intent hard-link publication is not identity-exact.');
    }
    allocationPhase('intent_linked', {
      stagingDirectory: path.join(path.dirname(options.databasePath), preparationName),
    });
    fs.unlinkSync(temporaryPath);
    temporaryUnlinked = true;
    fs.fsyncSync(options.parentDescriptor);
    const snapshot = fileSnapshot(fs.fstatSync(descriptor, { bigint: true }));
    const pathSnapshot = fileSnapshot(fs.lstatSync(options.intentPath, { bigint: true }));
    if (snapshot.nlink !== 1n || !sameSnapshot(snapshot, pathSnapshot)) {
      throw new Error('Campaign import intent changed after exclusive publication.');
    }
    return Object.freeze({
      descriptor,
      marker,
      path: options.intentPath,
      preparationPath: path.join(path.dirname(options.databasePath), preparationName),
      snapshot,
    });
  } catch (error) {
    const cleanupErrors: unknown[] = [];
    // A caught error can remove only this process's exact descriptor-proven control links; a hard
    // stop never reaches this block, so the PID/UUID recovery path remains authoritative there.
    if (descriptor >= 0) {
      try {
        if (!temporaryUnlinked) {
          unlinkOwnedIntentControl(temporaryPath, descriptor, canonicalLinked ? 2n : 1n);
        }
        if (canonicalLinked) unlinkOwnedIntentControl(options.intentPath, descriptor, 1n);
        fs.fsyncSync(options.parentDescriptor);
      } catch (cleanupError) {
        if (errorCode(cleanupError) !== 'ENOENT') cleanupErrors.push(cleanupError);
      }
    }
    closeDescriptor(descriptor);
    if (cleanupErrors.length > 0) {
      throw new CampaignImportError('cleanup_failed', 'Campaign intent cleanup failed.', {
        cause: new AggregateError([error, ...cleanupErrors]),
      });
    }
    throw new CampaignImportError('import_failed', 'Campaign import intent could not be sealed.', {
      cause: error,
    });
  }
}

function unlinkOwnedIntentControl(
  filePath: string,
  descriptor: number,
  expectedLinks: bigint,
): void {
  const stats = fs.lstatSync(filePath, { bigint: true });
  const pathSnapshot = fileSnapshot(stats);
  const descriptorSnapshot = fileSnapshot(fs.fstatSync(descriptor, { bigint: true }));
  if (
    !stats.isFile() ||
    stats.isSymbolicLink() ||
    pathSnapshot.nlink !== expectedLinks ||
    descriptorSnapshot.nlink !== expectedLinks ||
    !isPrivateOwnedFile(pathSnapshot) ||
    !sameFileIdentity(pathSnapshot, descriptorSnapshot)
  ) {
    throw new Error('Campaign intent control changed before owned cleanup.');
  }
  fs.unlinkSync(filePath);
}

function recoverIntentPreparations(options: ResolvedOptions): void {
  const parentPath = path.dirname(options.databasePath);
  const candidates: Array<{
    readonly intentId: string;
    readonly ownerPid: string;
    readonly path: string;
  }> = [];
  const directory = fs.opendirSync(parentPath);
  try {
    for (;;) {
      const entry = directory.readSync();
      if (!entry) break;
      if (!entry.name.startsWith(options.intentTemporaryNamePrefix)) continue;
      if (candidates.length >= MAX_INTENT_PREPARATIONS) {
        throw recoveryConflict('Campaign prepared-intent discovery exceeded its hard bound.');
      }
      const suffix = entry.name.slice(options.intentTemporaryNamePrefix.length);
      const match =
        /^([1-9][0-9]{0,9})-([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/u.exec(
          suffix,
        );
      if (!match?.[1] || !match[2]) {
        throw recoveryConflict('Campaign prepared intent has an invalid ownership name.');
      }
      candidates.push({
        intentId: match[2],
        ownerPid: match[1],
        path: path.join(parentPath, entry.name),
      });
    }
  } finally {
    directory.closeSync();
  }
  if (candidates.length === 0) return;

  // Prove every encoded owner stopped before reclaiming any control entry. A live concurrent
  // importer always wins preservation, including when its file is still empty before the write.
  for (const candidate of candidates) {
    assertIntentPreparationOwnerStopped(candidate.ownerPid);
  }

  for (const candidate of candidates) {
    let descriptor = -1;
    try {
      const stats = fs.lstatSync(candidate.path, { bigint: true });
      const pathSnapshot = fileSnapshot(stats);
      if (
        !stats.isFile() ||
        stats.isSymbolicLink() ||
        !isPrivateOwnedFile(pathSnapshot) ||
        pathSnapshot.size > BigInt(INTENT_MARKER_MAX_BYTES) ||
        (pathSnapshot.nlink !== 1n && pathSnapshot.nlink !== 2n)
      ) {
        throw new Error('Campaign prepared intent is not one bounded private control file.');
      }
      descriptor = fs.openSync(candidate.path, fs.constants.O_RDONLY | NO_FOLLOW);
      const descriptorSnapshot = fileSnapshot(fs.fstatSync(descriptor, { bigint: true }));
      const currentPathSnapshot = fileSnapshot(fs.lstatSync(candidate.path, { bigint: true }));
      if (
        !sameSnapshot(descriptorSnapshot, pathSnapshot) ||
        !sameSnapshot(currentPathSnapshot, pathSnapshot)
      ) {
        throw new Error('Campaign prepared intent changed while proving its identity.');
      }

      let canonicalStats: fs.BigIntStats | undefined;
      try {
        canonicalStats = fs.lstatSync(options.intentPath, { bigint: true });
      } catch (error) {
        if (errorCode(error) !== 'ENOENT') throw error;
      }
      if (canonicalStats) {
        const canonicalSnapshot = fileSnapshot(canonicalStats);
        const sameCanonical = sameFileIdentity(canonicalSnapshot, descriptorSnapshot);
        if (sameCanonical) {
          if (
            pathExists(options.stagingDirectory) ||
            pathExists(options.databasePath) ||
            canonicalStats.isSymbolicLink() ||
            !canonicalStats.isFile() ||
            !isPrivateOwnedFile(canonicalSnapshot) ||
            canonicalSnapshot.nlink !== 2n ||
            descriptorSnapshot.nlink !== 2n
          ) {
            throw new Error('Campaign two-link intent coexists with an ambiguous later artifact.');
          }
          assertPreparedIntentIdentity(descriptor, descriptorSnapshot, candidate);
        } else if (descriptorSnapshot.nlink !== 1n) {
          throw new Error('Campaign prepared intent has an unrelated extra hard link.');
        }
      } else if (
        descriptorSnapshot.nlink !== 1n ||
        pathExists(options.stagingDirectory) ||
        pathExists(options.databasePath)
      ) {
        throw new Error('Campaign prepared intent has an ambiguous publication state.');
      }

      fs.unlinkSync(candidate.path);
      fs.fsyncSync(options.parentDescriptor);
      if (canonicalStats && sameFileIdentity(fileSnapshot(canonicalStats), descriptorSnapshot)) {
        const recoveredCanonical = fileSnapshot(fs.lstatSync(options.intentPath, { bigint: true }));
        if (
          recoveredCanonical.nlink !== 1n ||
          !isPrivateOwnedFile(recoveredCanonical) ||
          !sameFileIdentity(recoveredCanonical, descriptorSnapshot)
        ) {
          throw new Error('Campaign canonical intent did not recover to one stable link.');
        }
      }
    } catch (error) {
      if (error instanceof CampaignImportError) throw error;
      throw recoveryConflict('Campaign prepared intent is ambiguous and was preserved.', error);
    } finally {
      closeDescriptor(descriptor);
    }
  }
}

function assertPreparedIntentIdentity(
  descriptor: number,
  snapshot: FileSnapshot,
  candidate: { readonly intentId: string; readonly ownerPid: string },
): void {
  const bytes = readDescriptor(descriptor, snapshot.size, INTENT_MARKER_MAX_BYTES);
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    throw new Error('Campaign linked prepared intent is invalid JSON.', { cause: error });
  }
  if (
    !plainObject(value) ||
    value['formatVersion'] !== 1 ||
    value['kind'] !== 'faunapoolen_campaign_import_intent' ||
    value['intentId'] !== candidate.intentId ||
    value['ownerPid'] !== candidate.ownerPid
  ) {
    throw new Error('Campaign linked prepared intent does not match its encoded owner.');
  }
}

function assertIntentPreparationOwnerStopped(ownerPidText: string): void {
  const ownerPid = Number(ownerPidText);
  if (!Number.isSafeInteger(ownerPid) || ownerPid < 1) {
    throw recoveryConflict('Campaign prepared-intent owner is invalid.');
  }
  if (ownerPid === process.pid) {
    throw recoveryConflict('Campaign prepared intent is owned by this live process.');
  }
  try {
    process.kill(ownerPid, 0);
  } catch (error) {
    if (errorCode(error) === 'ESRCH') return;
    throw recoveryConflict('Campaign prepared-intent owner cannot be proven stopped.', error);
  }
  throw recoveryConflict('Campaign prepared intent is owned by a live process.');
}

function readExistingIntent(
  options: ResolvedOptions,
  source: ValidatedSource,
): ImportIntent | undefined {
  let stats: fs.BigIntStats;
  try {
    stats = fs.lstatSync(options.intentPath, { bigint: true });
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return undefined;
    throw recoveryConflict('Campaign import intent cannot be inspected.', error);
  }
  const pathSnapshot = fileSnapshot(stats);
  if (
    !stats.isFile() ||
    stats.isSymbolicLink() ||
    pathSnapshot.nlink !== 1n ||
    !isPrivateOwnedFile(pathSnapshot) ||
    pathSnapshot.size > BigInt(INTENT_MARKER_MAX_BYTES)
  ) {
    throw recoveryConflict('Campaign import intent is not one bounded private owned file.');
  }
  const descriptor = fs.openSync(options.intentPath, fs.constants.O_RDONLY | NO_FOLLOW);
  try {
    const snapshot = fileSnapshot(fs.fstatSync(descriptor, { bigint: true }));
    if (!sameSnapshot(snapshot, pathSnapshot)) {
      throw new Error('Campaign import intent changed while opening.');
    }
    const bytes = readDescriptor(descriptor, snapshot.size, INTENT_MARKER_MAX_BYTES);
    let value: unknown;
    try {
      value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch (error) {
      throw new Error('Campaign import intent is invalid JSON.', { cause: error });
    }
    if (
      !plainObject(value) ||
      Object.keys(value).toSorted().join('\0') !==
        [
          'formatVersion',
          'intentId',
          'kind',
          'ownerPid',
          'parentDev',
          'parentIno',
          'preparationName',
          'sourceDev',
          'sourceDirectory',
          'sourceIno',
          'sourceReceipt',
          'targetName',
        ]
          .toSorted()
          .join('\0')
    ) {
      throw new Error('Campaign import intent fields are not canonical.');
    }
    const marker = value as unknown as ImportIntentMarker;
    const expectedPreparationName = `${path.basename(options.stagingDirectory)}.prepare-${marker.intentId}`;
    if (
      marker.formatVersion !== 1 ||
      marker.kind !== 'faunapoolen_campaign_import_intent' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
        marker.intentId,
      ) ||
      !/^[0-9]+$/u.test(marker.ownerPid) ||
      marker.parentDev !== options.parentSnapshot.dev.toString() ||
      marker.parentIno !== options.parentSnapshot.ino.toString() ||
      marker.preparationName !== expectedPreparationName ||
      marker.sourceDirectory !== source.directoryPath ||
      marker.sourceDev !== source.snapshot.dev.toString() ||
      marker.sourceIno !== source.snapshot.ino.toString() ||
      !sameReceipt(marker.sourceReceipt, source.receipt) ||
      marker.targetName !== path.basename(options.databasePath)
    ) {
      throw new Error('Campaign import intent does not match this source and target.');
    }
    assertStoppedOwner(marker.ownerPid, 'Campaign import intent');
    return Object.freeze({
      descriptor,
      marker,
      path: options.intentPath,
      preparationPath: path.join(path.dirname(options.databasePath), marker.preparationName),
      snapshot,
    });
  } catch (error) {
    closeDescriptor(descriptor);
    if (error instanceof CampaignImportError) throw error;
    throw recoveryConflict('Campaign import intent is ambiguous and was preserved.', error);
  }
}

function removeIntent(options: ResolvedOptions, intent: ImportIntent): void {
  assertParentUnchanged(options, 'cleanup_failed');
  const descriptorSnapshot = fileSnapshot(fs.fstatSync(intent.descriptor, { bigint: true }));
  const pathStats = fs.lstatSync(intent.path, { bigint: true });
  const pathSnapshot = fileSnapshot(pathStats);
  if (
    !pathStats.isFile() ||
    pathStats.isSymbolicLink() ||
    pathSnapshot.nlink !== 1n ||
    !isPrivateOwnedFile(pathSnapshot) ||
    !sameSnapshot(descriptorSnapshot, intent.snapshot) ||
    !sameSnapshot(pathSnapshot, intent.snapshot)
  ) {
    throw new CampaignImportError(
      'cleanup_failed',
      'Campaign import intent changed before durable removal.',
    );
  }
  fs.unlinkSync(intent.path);
  fs.fsyncSync(options.parentDescriptor);
  closeDescriptor(intent.descriptor);
}

function recoverPreparationDirectory(
  options: ResolvedOptions,
  source: ValidatedSource,
  intent: ImportIntent,
): void {
  let stats: fs.BigIntStats;
  try {
    stats = fs.lstatSync(intent.preparationPath, { bigint: true });
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return;
    throw recoveryConflict('Campaign import preparation cannot be inspected.', error);
  }
  const pathSnapshot = fileSnapshot(stats);
  if (
    !stats.isDirectory() ||
    stats.isSymbolicLink() ||
    !isPrivateOwnedDirectory(pathSnapshot) ||
    fs.realpathSync.native(intent.preparationPath) !== intent.preparationPath
  ) {
    throw recoveryConflict('Campaign import preparation is not an owned private directory.');
  }
  const descriptor = fs.openSync(
    intent.preparationPath,
    fs.constants.O_RDONLY | DIRECTORY_ONLY | NO_FOLLOW,
  );
  try {
    const snapshot = fileSnapshot(fs.fstatSync(descriptor, { bigint: true }));
    if (!sameFileIdentity(snapshot, pathSnapshot)) {
      throw new Error('Campaign import preparation changed while opening.');
    }
    const names = fs.readdirSync(intent.preparationPath).toSorted();
    if (names.length === 0) {
      fs.rmdirSync(intent.preparationPath);
      fs.fsyncSync(options.parentDescriptor);
      return;
    }
    const allowed = new Set([
      STAGE_DATABASE_NAME,
      ...STAGE_DATABASE_SIDECAR_NAMES,
      STAGE_MARKER_NAME,
      STAGE_MARKER_TEMPORARY_NAME,
    ]);
    if (names.some((name) => !allowed.has(name))) {
      throw new Error('Campaign import preparation contains unknown residue.');
    }
    const markerNames = [STAGE_MARKER_NAME, STAGE_MARKER_TEMPORARY_NAME].filter((name) =>
      names.includes(name),
    );
    if (markerNames.length !== 1) {
      throw new Error('Campaign import preparation has no unique durable stage marker.');
    }
    const markerPath = path.join(intent.preparationPath, markerNames[0] as string);
    const markerStats = fs.lstatSync(markerPath, { bigint: true });
    const markerSnapshot = fileSnapshot(markerStats);
    if (
      !markerStats.isFile() ||
      markerStats.isSymbolicLink() ||
      markerSnapshot.nlink !== 1n ||
      !isPrivateOwnedFile(markerSnapshot)
    ) {
      throw new Error('Campaign import preparation marker is unsafe.');
    }
    const marker = readMarker(markerPath, markerSnapshot);
    assertMarker(marker, options, source, snapshot, intent);
    if (marker.state !== 'building') {
      throw new Error('Campaign import preparation unexpectedly contains a sealed stage.');
    }
    assertStoppedOwner(marker.ownerPid, 'Campaign import preparation');
    if (inspectRecoveryTarget(options.databasePath)) {
      throw new Error('Campaign import preparation cannot own an existing target.');
    }
    for (const name of names) {
      unlinkPrivateStageFile(path.join(intent.preparationPath, name), `preparation ${name}`);
    }
    fs.fsyncSync(descriptor);
    if (fs.readdirSync(intent.preparationPath).length !== 0) {
      throw new Error('Campaign import preparation remains nonempty after cleanup.');
    }
    fs.rmdirSync(intent.preparationPath);
    fs.fsyncSync(options.parentDescriptor);
  } catch (error) {
    if (error instanceof CampaignImportError && error.code === 'recovery_conflict') throw error;
    throw recoveryConflict('Campaign import preparation is ambiguous and was preserved.', error);
  } finally {
    closeDescriptor(descriptor);
  }
}

function createStage(
  options: ResolvedOptions,
  source: ValidatedSource,
  intent: ImportIntent,
  allocationPhase: (
    phase:
      | 'intent_allocated'
      | 'intent_prepared'
      | 'intent_linked'
      | 'intent_durable'
      | 'preparation_durable'
      | 'stage_published',
    details: ImportCheckpointDetails,
  ) => void,
): ImportStage {
  assertParentUnchanged(options, 'target_changed');
  if (pathExists(options.stagingDirectory)) {
    throw new CampaignImportError(
      'recovery_conflict',
      'Campaign import staging appeared before allocation.',
    );
  }
  const preparationDirectory = intent.preparationPath;
  try {
    fs.mkdirSync(preparationDirectory, { mode: PRIVATE_DIRECTORY_MODE });
  } catch (error) {
    throw new CampaignImportError(
      'import_failed',
      'Campaign import preparation cannot be created.',
      { cause: error },
    );
  }
  let directoryDescriptor = -1;
  let databaseDescriptor = -1;
  let fixedStage = false;
  try {
    const directoryStats = fs.lstatSync(preparationDirectory, { bigint: true });
    if (
      !directoryStats.isDirectory() ||
      directoryStats.isSymbolicLink() ||
      !isPrivateOwnedDirectory(fileSnapshot(directoryStats))
    ) {
      throw new Error('Campaign staging is not an owned private directory.');
    }
    directoryDescriptor = fs.openSync(
      preparationDirectory,
      fs.constants.O_RDONLY | DIRECTORY_ONLY | NO_FOLLOW,
    );
    const directorySnapshot = fileSnapshot(fs.fstatSync(directoryDescriptor, { bigint: true }));
    const markerSnapshot = writeStageMarker(
      options,
      preparationDirectory,
      directoryDescriptor,
      buildingStageMarker(options, source, intent, directorySnapshot),
    );
    const preparationDatabasePath = path.join(preparationDirectory, STAGE_DATABASE_NAME);
    databaseDescriptor = fs.openSync(
      preparationDatabasePath,
      fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR | NO_FOLLOW,
      PRIVATE_FILE_MODE,
    );
    const databaseSnapshot = fileSnapshot(fs.fstatSync(databaseDescriptor, { bigint: true }));
    if (!isPrivateOwnedFile(databaseSnapshot) || databaseSnapshot.nlink !== 1n) {
      throw new Error('Campaign staging database is not one private owned file.');
    }
    fs.fsyncSync(directoryDescriptor);
    allocationPhase('preparation_durable', {
      databasePath: preparationDatabasePath,
      stagingDirectory: preparationDirectory,
    });
    assertParentUnchanged(options, 'target_changed');
    if (pathExists(options.stagingDirectory)) {
      throw new Error('Campaign import staging appeared before durable intent publication.');
    }
    fs.renameSync(preparationDirectory, options.stagingDirectory);
    fixedStage = true;
    fs.fsyncSync(options.parentDescriptor);
    allocationPhase('stage_published', {
      databasePath: path.join(options.stagingDirectory, STAGE_DATABASE_NAME),
      stagingDirectory: options.stagingDirectory,
    });
    const fixedStats = fs.lstatSync(options.stagingDirectory, { bigint: true });
    if (
      !fixedStats.isDirectory() ||
      fixedStats.isSymbolicLink() ||
      !sameFileIdentity(fileSnapshot(fixedStats), directorySnapshot)
    ) {
      throw new Error('Campaign staging identity changed during durable intent publication.');
    }
    return {
      databaseDescriptor,
      databasePath: path.join(options.stagingDirectory, STAGE_DATABASE_NAME),
      databaseSnapshot,
      directoryDescriptor,
      directoryPath: options.stagingDirectory,
      directorySnapshot,
      markerSnapshot,
    };
  } catch (error) {
    closeDescriptor(databaseDescriptor);
    closeDescriptor(directoryDescriptor);
    if (!fixedStage) {
      try {
        cleanupOwnedPreparationDirectory(preparationDirectory);
      } catch (cleanupError) {
        throw new CampaignImportError(
          'cleanup_failed',
          'Campaign staging allocation and preparation cleanup both failed.',
          { cause: new AggregateError([error, cleanupError]) },
        );
      }
    }
    throw new CampaignImportError('import_failed', 'Campaign staging could not be allocated.', {
      cause: error,
    });
  }
}

function cleanupOwnedPreparationDirectory(directoryPath: string): void {
  const directoryStats = fs.lstatSync(directoryPath, { bigint: true });
  const directorySnapshot = fileSnapshot(directoryStats);
  if (
    !directoryStats.isDirectory() ||
    directoryStats.isSymbolicLink() ||
    !isPrivateOwnedDirectory(directorySnapshot)
  ) {
    throw new Error('Campaign import preparation is not safely removable.');
  }
  const allowed = new Set([
    STAGE_DATABASE_NAME,
    ...STAGE_DATABASE_SIDECAR_NAMES,
    STAGE_MARKER_NAME,
    STAGE_MARKER_TEMPORARY_NAME,
  ]);
  const names = fs.readdirSync(directoryPath);
  if (names.some((name) => !allowed.has(name))) {
    throw new Error('Campaign import preparation contains unknown residue.');
  }
  for (const name of names)
    unlinkPrivateStageFile(path.join(directoryPath, name), 'preparation file');
  fs.rmdirSync(directoryPath);
}

function buildStageDatabase(
  stage: ImportStage,
  source: ValidatedSource,
  checkpoint: (name: CampaignImportCheckpoint, details?: ImportCheckpointDetails) => void,
): void {
  assertStageIdentity(stage, 1n);
  const canonicalStageDirectory = fs.realpathSync.native(stage.directoryPath);
  const productDatabase = openFaunapoolenDatabase({
    databasePath: path.join(canonicalStageDirectory, path.basename(stage.databasePath)),
    operationalRoot: canonicalStageDirectory,
  });
  try {
    checkpoint('target_transaction_started', stageDetails(stage));
    withImmediateTransaction(productDatabase.sqlite, () => {
      for (const [index, entry] of source.entries.entries()) {
        insertImportedCampaign(productDatabase.sqlite, entry.record, index + 1, {
          bytes: entry.bytes,
          fileName: entry.fileName,
          sha256: entry.sourceSha256,
        });
        checkpoint('campaign_inserted', {
          ...stageDetails(stage),
          campaignSequence: index + 1,
        });
      }
      insertCampaignImportReceipt(productDatabase.sqlite, source.receipt);
      checkpoint('before_commit', stageDetails(stage));
    });
  } finally {
    productDatabase.close();
  }
  assertStageSidecarsAbsent(stage.directoryPath, 'import_failed');
  fs.fsyncSync(stage.databaseDescriptor);
  fs.fsyncSync(stage.directoryDescriptor);
  assertStageIdentity(stage, 1n);
}

function verifyImportedTarget(databasePath: string, source: ValidatedSource): void {
  assertTargetSidecarsAbsent(databasePath, 'target_conflict');
  let productDatabase: ReturnType<typeof openFaunapoolenDatabase> | undefined;
  try {
    const operationalRoot = fs.realpathSync.native(path.dirname(databasePath));
    productDatabase = openFaunapoolenDatabase({
      databasePath,
      operationalRoot,
      requireExisting: true,
      verifyBeforeWrite(database) {
        verifyImportedTargetParity(database, source);
      },
    });
    if (!productDatabase.isReady()) {
      throw new Error('Campaign target failed the normal persistence readiness contract.');
    }
  } catch (error) {
    if (error instanceof CampaignImportError) throw error;
    throw new CampaignImportError(
      'target_conflict',
      'Campaign target failed receipt or reopened SQLite parity.',
      { cause: error },
    );
  } finally {
    productDatabase?.close();
  }
  assertTargetSidecarsAbsent(databasePath, 'target_conflict');
}

function verifyImportedTargetParity(
  database: ReadonlySyncSqliteDatabase,
  source: ValidatedSource,
): void {
  verifyFaunapoolenDatabase(database);
  const receipt = readCampaignImportReceipt(database);
  if (!receipt || !sameReceipt(receipt, source.receipt)) {
    throw new Error('Campaign import receipt does not match the complete source.');
  }
  const campaigns = readAllStoredCampaigns(database);
  if (campaigns.length !== source.entries.length) {
    throw new Error('Campaign target row count does not match the complete source.');
  }
  for (const [index, entry] of source.entries.entries()) {
    const campaign = campaigns[index];
    if (
      !campaign ||
      campaign.sequence !== index + 1 ||
      campaign.revision !== 1 ||
      !campaign.source ||
      campaign.source.fileName !== entry.fileName ||
      campaign.source.bytes !== entry.bytes.byteLength ||
      campaign.source.sha256 !== entry.sourceSha256 ||
      !canonicalCampaignBytes(campaign.record).equals(entry.canonicalBytes)
    ) {
      throw new Error('Campaign target row does not match its source entry.');
    }
  }
}

function buildingStageMarker(
  options: ResolvedOptions,
  source: ValidatedSource,
  intent: ImportIntent,
  directorySnapshot: FileSnapshot,
): BuildingStageMarker {
  return Object.freeze({
    directoryDev: directorySnapshot.dev.toString(),
    directoryIno: directorySnapshot.ino.toString(),
    formatVersion: 1,
    intentId: intent.marker.intentId,
    kind: 'faunapoolen_campaign_import' as const,
    ownerPid: String(process.pid),
    parentDev: options.parentSnapshot.dev.toString(),
    parentIno: options.parentSnapshot.ino.toString(),
    sourceReceipt: source.receipt,
    state: 'building' as const,
    targetName: path.basename(options.databasePath),
  });
}

function writeStageMarker(
  options: ResolvedOptions,
  stageDirectory: string,
  directoryDescriptor: number,
  marker: StageMarker,
  replacedSnapshot?: FileSnapshot,
): FileSnapshot {
  assertParentUnchanged(options, 'target_changed');
  const bytes = Buffer.from(`${JSON.stringify(marker)}\n`, 'utf8');
  if (bytes.byteLength > STAGE_MARKER_MAX_BYTES) {
    throw new Error('Campaign import marker exceeds its fixed byte bound.');
  }
  const temporaryPath = path.join(stageDirectory, STAGE_MARKER_TEMPORARY_NAME);
  const markerPath = path.join(stageDirectory, STAGE_MARKER_NAME);
  let descriptor = -1;
  try {
    descriptor = fs.openSync(
      temporaryPath,
      fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | NO_FOLLOW,
      PRIVATE_FILE_MODE,
    );
    writeAll(descriptor, bytes);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = -1;

    if (replacedSnapshot) {
      const current = fs.lstatSync(markerPath, { bigint: true });
      const currentSnapshot = fileSnapshot(current);
      if (
        !current.isFile() ||
        current.isSymbolicLink() ||
        currentSnapshot.nlink !== 1n ||
        !isPrivateOwnedFile(currentSnapshot) ||
        !sameSnapshot(currentSnapshot, replacedSnapshot)
      ) {
        throw new Error('Campaign import marker changed before sealing.');
      }
    } else if (pathExists(markerPath)) {
      throw new Error('Campaign import marker appeared before allocation.');
    }

    fs.renameSync(temporaryPath, markerPath);
    fs.fsyncSync(directoryDescriptor);
    const markerStats = fs.lstatSync(markerPath, { bigint: true });
    const markerSnapshot = fileSnapshot(markerStats);
    if (
      !markerStats.isFile() ||
      markerStats.isSymbolicLink() ||
      !isPrivateOwnedFile(markerSnapshot) ||
      markerSnapshot.nlink !== 1n
    ) {
      throw new Error('Campaign import marker is not one private owned file.');
    }
    return markerSnapshot;
  } catch (error) {
    closeDescriptor(descriptor);
    try {
      fs.unlinkSync(temporaryPath);
    } catch (cleanupError) {
      if (errorCode(cleanupError) !== 'ENOENT') {
        throw new AggregateError(
          [error, cleanupError],
          'Campaign marker creation and cleanup failed.',
        );
      }
    }
    throw error;
  }
}

function sealMarker(
  options: ResolvedOptions,
  stage: ImportStage,
  source: ValidatedSource,
  intent: ImportIntent,
  proof: StableFileProof,
): void {
  assertParentUnchanged(options, 'target_changed');
  assertStageIdentity(stage, 1n);
  const current = readMarker(
    path.join(stage.directoryPath, STAGE_MARKER_NAME),
    stage.markerSnapshot,
  );
  assertMarker(current, options, source, stage.directorySnapshot, intent);
  if (current.state !== 'building') throw new Error('Campaign import marker is already sealed.');
  const marker: SealedStageMarker = Object.freeze({
    databaseDev: proof.snapshot.dev.toString(),
    databaseIno: proof.snapshot.ino.toString(),
    databaseSha256: proof.digest,
    databaseSize: proof.snapshot.size.toString(),
    directoryDev: stage.directorySnapshot.dev.toString(),
    directoryIno: stage.directorySnapshot.ino.toString(),
    formatVersion: 1,
    intentId: intent.marker.intentId,
    kind: 'faunapoolen_campaign_import',
    ownerPid: String(process.pid),
    parentDev: options.parentSnapshot.dev.toString(),
    parentIno: options.parentSnapshot.ino.toString(),
    sourceReceipt: source.receipt,
    state: 'sealed',
    targetName: path.basename(options.databasePath),
  });
  stage.markerSnapshot = writeStageMarker(
    options,
    stage.directoryPath,
    stage.directoryDescriptor,
    marker,
    stage.markerSnapshot,
  );
}

function cleanupBuildingStage(
  options: ResolvedOptions,
  directoryDescriptor: number,
  directorySnapshot: FileSnapshot,
  markerSnapshot: FileSnapshot,
  names: readonly string[],
): void {
  assertParentUnchanged(options, 'recovery_conflict');
  if (inspectRecoveryTarget(options.databasePath)) {
    throw recoveryConflict('Unsealed campaign staging cannot own an existing target.');
  }
  assertTargetSidecarsAbsent(options.databasePath, 'recovery_conflict');

  const directoryStats = fs.lstatSync(options.stagingDirectory, { bigint: true });
  const currentDirectory = fileSnapshot(directoryStats);
  if (
    !directoryStats.isDirectory() ||
    directoryStats.isSymbolicLink() ||
    !sameFileIdentity(currentDirectory, directorySnapshot) ||
    !sameFileIdentity(
      fileSnapshot(fs.fstatSync(directoryDescriptor, { bigint: true })),
      directorySnapshot,
    )
  ) {
    throw recoveryConflict('Unsealed campaign staging directory changed identity.');
  }

  if (names.includes(STAGE_MARKER_TEMPORARY_NAME)) {
    unlinkPrivateStageFile(
      path.join(options.stagingDirectory, STAGE_MARKER_TEMPORARY_NAME),
      'temporary marker',
    );
  }
  for (const sidecarName of STAGE_DATABASE_SIDECAR_NAMES) {
    if (names.includes(sidecarName)) {
      unlinkPrivateStageFile(
        path.join(options.stagingDirectory, sidecarName),
        `SQLite ${sidecarName.slice(STAGE_DATABASE_NAME.length + 1)} sidecar`,
      );
    }
  }
  if (names.includes(STAGE_DATABASE_NAME)) {
    unlinkPrivateStageFile(path.join(options.stagingDirectory, STAGE_DATABASE_NAME), 'database');
  }

  const markerPath = path.join(options.stagingDirectory, STAGE_MARKER_NAME);
  const markerStats = fs.lstatSync(markerPath, { bigint: true });
  const currentMarker = fileSnapshot(markerStats);
  if (
    !markerStats.isFile() ||
    markerStats.isSymbolicLink() ||
    currentMarker.nlink !== 1n ||
    !isPrivateOwnedFile(currentMarker) ||
    !sameSnapshot(currentMarker, markerSnapshot)
  ) {
    throw recoveryConflict('Unsealed campaign staging marker changed identity.');
  }
  fs.unlinkSync(markerPath);
  fs.fsyncSync(directoryDescriptor);
  if (fs.readdirSync(options.stagingDirectory).length !== 0) {
    throw recoveryConflict('Unsealed campaign staging contains ownership-unproven residue.');
  }
  fs.rmdirSync(options.stagingDirectory);
  fs.fsyncSync(options.parentDescriptor);
}

function unlinkPrivateStageFile(filePath: string, label: string): void {
  const pathStats = fs.lstatSync(filePath, { bigint: true });
  const pathSnapshot = fileSnapshot(pathStats);
  if (
    !pathStats.isFile() ||
    pathStats.isSymbolicLink() ||
    pathSnapshot.nlink !== 1n ||
    !isPrivateOwnedFile(pathSnapshot)
  ) {
    throw recoveryConflict(`Unsealed campaign staging ${label} is unsafe.`);
  }
  const descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | NO_FOLLOW);
  try {
    const descriptorSnapshot = fileSnapshot(fs.fstatSync(descriptor, { bigint: true }));
    if (!sameSnapshot(pathSnapshot, descriptorSnapshot)) {
      throw recoveryConflict(`Unsealed campaign staging ${label} changed while opening.`);
    }
  } finally {
    fs.closeSync(descriptor);
  }
  fs.unlinkSync(filePath);
}

function linkStage(options: ResolvedOptions, stage: ImportStage): StableFileProof {
  assertParentUnchanged(options, 'target_changed');
  assertStageIdentity(stage, 1n);
  assertTargetSidecarsAbsent(options.databasePath, 'target_changed');
  if (pathExists(options.databasePath)) {
    throw new CampaignImportError('target_changed', 'Campaign target appeared before publication.');
  }
  try {
    fs.linkSync(stage.databasePath, options.databasePath);
  } catch (error) {
    throw new CampaignImportError(
      'target_changed',
      'Campaign target could not be linked atomically.',
      {
        cause: error,
      },
    );
  }
  fs.fsyncSync(options.parentDescriptor);
  const targetStats = fs.lstatSync(options.databasePath, { bigint: true });
  const stageStats = fs.fstatSync(stage.databaseDescriptor, { bigint: true });
  if (
    !targetStats.isFile() ||
    targetStats.isSymbolicLink() ||
    targetStats.dev !== stageStats.dev ||
    targetStats.ino !== stageStats.ino ||
    targetStats.nlink !== 2n ||
    stageStats.nlink !== 2n
  ) {
    throw new CampaignImportError('target_changed', 'Campaign target link identity is ambiguous.');
  }
  return stableProof(stage.databaseDescriptor);
}

function publishLinkedStage(
  options: ResolvedOptions,
  stage: ImportStage,
  linked: StableFileProof,
): StableFileProof {
  assertParentUnchanged(options, 'target_changed');
  assertTargetMatchesProof(options.databasePath, linked, 2n, 'target_changed');
  const stageStats = fs.lstatSync(stage.databasePath, { bigint: true });
  if (
    stageStats.dev !== linked.snapshot.dev ||
    stageStats.ino !== linked.snapshot.ino ||
    stageStats.nlink !== 2n
  ) {
    throw new CampaignImportError(
      'target_changed',
      'Campaign staging link changed before publish.',
    );
  }
  fs.unlinkSync(stage.databasePath);
  fs.fsyncSync(stage.directoryDescriptor);
  fs.fsyncSync(options.parentDescriptor);
  const published = stableProof(stage.databaseDescriptor);
  assertTargetMatchesProof(options.databasePath, published, 1n, 'target_changed');
  return published;
}

function recoverStage(
  options: ResolvedOptions,
  source: ValidatedSource,
  intent: ImportIntent,
):
  | Readonly<{
      readonly proof: StableFileProof;
      readonly published: boolean;
      readonly stage: ImportStage;
    }>
  | undefined {
  let stageStats: fs.BigIntStats;
  try {
    stageStats = fs.lstatSync(options.stagingDirectory, { bigint: true });
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return undefined;
    throw recoveryConflict('Campaign staging cannot be inspected.', error);
  }
  const stageSnapshot = fileSnapshot(stageStats);
  if (
    !stageStats.isDirectory() ||
    stageStats.isSymbolicLink() ||
    !isPrivateOwnedDirectory(stageSnapshot)
  ) {
    throw recoveryConflict('Campaign staging is not an owned private directory.');
  }
  let directoryDescriptor = -1;
  let databaseDescriptor = -1;
  try {
    directoryDescriptor = fs.openSync(
      options.stagingDirectory,
      fs.constants.O_RDONLY | DIRECTORY_ONLY | NO_FOLLOW,
    );
    const directorySnapshot = fileSnapshot(fs.fstatSync(directoryDescriptor, { bigint: true }));
    if (!sameFileIdentity(stageSnapshot, directorySnapshot)) {
      throw new Error('Campaign staging directory changed while opening.');
    }
    const names = fs.readdirSync(options.stagingDirectory).toSorted();
    const allowed = new Set([
      STAGE_DATABASE_NAME,
      ...STAGE_DATABASE_SIDECAR_NAMES,
      STAGE_MARKER_NAME,
      STAGE_MARKER_TEMPORARY_NAME,
    ]);
    if (!names.includes(STAGE_MARKER_NAME) || names.some((name) => !allowed.has(name))) {
      throw new Error('Campaign staging has missing or unknown entries.');
    }
    const markerPath = path.join(options.stagingDirectory, STAGE_MARKER_NAME);
    const markerStats = fs.lstatSync(markerPath, { bigint: true });
    const markerSnapshot = fileSnapshot(markerStats);
    if (
      !markerStats.isFile() ||
      !isPrivateOwnedFile(markerSnapshot) ||
      markerSnapshot.nlink !== 1n
    ) {
      throw new Error('Campaign staging marker is unsafe.');
    }
    const marker = readMarker(markerPath, markerSnapshot);
    assertMarker(marker, options, source, directorySnapshot, intent);
    assertMarkerOwnerStopped(marker);

    if (marker.state === 'building') {
      cleanupBuildingStage(options, directoryDescriptor, directorySnapshot, markerSnapshot, names);
      closeDescriptor(directoryDescriptor);
      directoryDescriptor = -1;
      return undefined;
    }
    assertStageSidecarsAbsent(options.stagingDirectory, 'recovery_conflict');
    if (
      names.includes(STAGE_MARKER_TEMPORARY_NAME) ||
      STAGE_DATABASE_SIDECAR_NAMES.some((name) => names.includes(name))
    ) {
      throw new Error('Sealed campaign staging has unresolved temporary entries.');
    }

    const databasePath = path.join(options.stagingDirectory, STAGE_DATABASE_NAME);
    const databaseExists = names.includes(STAGE_DATABASE_NAME);
    let proof: StableFileProof;
    if (databaseExists) {
      const databaseStats = fs.lstatSync(databasePath, { bigint: true });
      const databaseSnapshot = fileSnapshot(databaseStats);
      if (
        !databaseStats.isFile() ||
        databaseStats.isSymbolicLink() ||
        !isPrivateOwnedFile(databaseSnapshot) ||
        (databaseSnapshot.nlink !== 1n && databaseSnapshot.nlink !== 2n)
      ) {
        throw new Error('Campaign staging database identity is unsafe.');
      }
      databaseDescriptor = fs.openSync(databasePath, fs.constants.O_RDONLY | NO_FOLLOW);
      proof = stableProof(databaseDescriptor);
      assertProofMatchesMarker(proof, marker);
      // A crash after hard-linking leaves the stage inode at nlink=2. The production owning-open
      // contract correctly rejects that ambiguous shape, so complete the pinned publish first and
      // verify the final one-link target below.
      if (proof.snapshot.nlink === 1n) verifyImportedTarget(databasePath, source);
    } else {
      const target = inspectTarget(options.databasePath);
      if (!target) throw new Error('Published campaign recovery target is missing.');
      databaseDescriptor = target.descriptor;
      proof = target;
      assertProofMatchesMarker(proof, marker);
      verifyImportedTarget(options.databasePath, source);
    }
    const stage: ImportStage = {
      databaseDescriptor,
      databasePath,
      databaseSnapshot: proof.snapshot,
      directoryDescriptor,
      directoryPath: options.stagingDirectory,
      directorySnapshot,
      markerSnapshot,
    };

    const target = inspectRecoveryTarget(options.databasePath);
    if (!databaseExists) {
      if (!target) throw new Error('Published campaign target disappeared during recovery.');
      assertTargetMatchesProof(options.databasePath, proof, 1n, 'recovery_conflict');
      return Object.freeze({ proof, published: true, stage });
    }
    if (!target) {
      if (proof.snapshot.nlink !== 1n) {
        throw new Error('Unpublished campaign staging has an unexpected link count.');
      }
      return Object.freeze({ proof, published: false, stage });
    }
    if (
      target.dev !== proof.snapshot.dev ||
      target.ino !== proof.snapshot.ino ||
      proof.snapshot.nlink !== 2n ||
      target.nlink !== 2n
    ) {
      throw new Error('Campaign recovery target and staging database are ambiguous.');
    }
    const published = publishLinkedStage(options, stage, proof);
    verifyImportedTarget(options.databasePath, source);
    return Object.freeze({ proof: published, published: true, stage });
  } catch (error) {
    closeDescriptor(databaseDescriptor);
    closeDescriptor(directoryDescriptor);
    if (error instanceof CampaignImportError && error.code === 'recovery_conflict') throw error;
    throw recoveryConflict('Interrupted campaign import is ambiguous and was preserved.', error);
  }
}

function readMarker(markerPath: string, snapshot: FileSnapshot): StageMarker {
  if (snapshot.size > BigInt(STAGE_MARKER_MAX_BYTES)) {
    throw new Error('Campaign staging marker exceeds its fixed byte bound.');
  }
  const bytes = fs.readFileSync(markerPath);
  if (BigInt(bytes.byteLength) !== snapshot.size)
    throw new Error('Campaign staging marker changed.');
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    throw new Error('Campaign staging marker is invalid JSON.', { cause: error });
  }
  if (!plainObject(value)) throw new Error('Campaign staging marker is not an object.');
  const base = [
    'directoryDev',
    'directoryIno',
    'formatVersion',
    'intentId',
    'kind',
    'ownerPid',
    'parentDev',
    'parentIno',
    'sourceReceipt',
    'state',
    'targetName',
  ];
  const required = [
    ...base,
    ...(value['state'] === 'sealed'
      ? ['databaseDev', 'databaseIno', 'databaseSha256', 'databaseSize']
      : []),
  ].toSorted();
  if (Object.keys(value).toSorted().join('\0') !== required.join('\0')) {
    throw new Error('Campaign staging marker fields are not canonical.');
  }
  return value as unknown as StageMarker;
}

function assertMarker(
  marker: StageMarker,
  options: ResolvedOptions,
  source: ValidatedSource,
  stageDirectory: FileSnapshot,
  intent: ImportIntent,
): void {
  if (
    marker.kind !== 'faunapoolen_campaign_import' ||
    marker.formatVersion !== 1 ||
    marker.intentId !== intent.marker.intentId ||
    marker.ownerPid !== intent.marker.ownerPid ||
    marker.targetName !== path.basename(options.databasePath) ||
    marker.parentDev !== options.parentSnapshot.dev.toString() ||
    marker.parentIno !== options.parentSnapshot.ino.toString() ||
    marker.directoryDev !== stageDirectory.dev.toString() ||
    marker.directoryIno !== stageDirectory.ino.toString() ||
    !sameReceipt(marker.sourceReceipt, source.receipt) ||
    !/^[0-9]+$/u.test(marker.ownerPid) ||
    (marker.state !== 'building' && marker.state !== 'sealed') ||
    (marker.state === 'sealed' &&
      (!/^[0-9]+$/u.test(marker.databaseDev) ||
        !/^[0-9]+$/u.test(marker.databaseIno) ||
        !/^[0-9]+$/u.test(marker.databaseSize) ||
        !/^[0-9a-f]{64}$/u.test(marker.databaseSha256)))
  ) {
    throw new Error('Campaign staging marker does not match this import operation.');
  }
}

function assertMarkerOwnerStopped(marker: StageMarker): void {
  assertStoppedOwner(marker.ownerPid, 'Campaign staging');
}

function assertStoppedOwner(ownerPidText: string, label: string): void {
  const ownerPid = Number(ownerPidText);
  if (!Number.isSafeInteger(ownerPid) || ownerPid < 1) {
    throw new Error(`${label} owner is invalid.`);
  }
  if (ownerPid === process.pid) return;
  try {
    process.kill(ownerPid, 0);
  } catch (error) {
    if (errorCode(error) === 'ESRCH') return;
    throw new Error(`${label} owner cannot be proven stopped.`, { cause: error });
  }
  throw new Error(`${label} is owned by a live process.`);
}

function assertProofMatchesMarker(proof: StableFileProof, marker: SealedStageMarker): void {
  if (
    proof.snapshot.dev.toString() !== marker.databaseDev ||
    proof.snapshot.ino.toString() !== marker.databaseIno ||
    proof.snapshot.size.toString() !== marker.databaseSize ||
    proof.digest !== marker.databaseSha256
  ) {
    throw new Error('Campaign staging database does not match its durable marker.');
  }
}

function rollbackPublishedTarget(options: ResolvedOptions, proof: StableFileProof): void {
  assertParentUnchanged(options, 'cleanup_failed');
  let stats: fs.BigIntStats;
  try {
    stats = fs.lstatSync(options.databasePath, { bigint: true });
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return;
    throw cleanupFailure('Published campaign target cannot be inspected for rollback.', error);
  }
  const snapshot = fileSnapshot(stats);
  if (
    !stats.isFile() ||
    stats.isSymbolicLink() ||
    snapshot.dev !== proof.snapshot.dev ||
    snapshot.ino !== proof.snapshot.ino ||
    !isPrivateOwnedFile(snapshot)
  ) {
    throw cleanupFailure('Published campaign target is no longer owned by this import.');
  }
  fs.unlinkSync(options.databasePath);
  fs.fsyncSync(options.parentDescriptor);
}

function cleanupStage(options: ResolvedOptions, stage: ImportStage): void {
  const errors: unknown[] = [];
  let parentStable = true;
  try {
    assertParentUnchanged(options, 'cleanup_failed');
  } catch (error) {
    parentStable = false;
    errors.push(error);
  }
  if (parentStable) {
    try {
      const directoryStats = fs.lstatSync(stage.directoryPath, { bigint: true });
      if (
        !directoryStats.isDirectory() ||
        directoryStats.isSymbolicLink() ||
        !sameFileIdentity(fileSnapshot(directoryStats), stage.directorySnapshot)
      ) {
        throw new Error('Campaign staging directory identity changed.');
      }
      const names = fs.readdirSync(stage.directoryPath).toSorted();
      const allowed = new Set([STAGE_DATABASE_NAME, STAGE_MARKER_NAME]);
      if (names.some((name) => !allowed.has(name))) {
        throw new Error('Campaign staging contains ownership-unproven residue.');
      }
      assertStageSidecarsAbsent(stage.directoryPath, 'cleanup_failed');

      if (names.includes(STAGE_DATABASE_NAME)) {
        const stats = fs.lstatSync(stage.databasePath, { bigint: true });
        const snapshot = fileSnapshot(stats);
        const descriptor = fileSnapshot(fs.fstatSync(stage.databaseDescriptor, { bigint: true }));
        if (
          !stats.isFile() ||
          stats.isSymbolicLink() ||
          snapshot.dev !== descriptor.dev ||
          snapshot.ino !== descriptor.ino ||
          snapshot.nlink !== 1n ||
          !isPrivateOwnedFile(snapshot)
        ) {
          throw new Error('Campaign staging database is no longer safely removable.');
        }
        fs.unlinkSync(stage.databasePath);
      }
      if (names.includes(STAGE_MARKER_NAME)) {
        const markerPath = path.join(stage.directoryPath, STAGE_MARKER_NAME);
        const stats = fs.lstatSync(markerPath, { bigint: true });
        const snapshot = fileSnapshot(stats);
        if (
          !stage.markerSnapshot ||
          !stats.isFile() ||
          stats.isSymbolicLink() ||
          !sameFileIdentity(snapshot, stage.markerSnapshot) ||
          snapshot.nlink !== 1n ||
          !isPrivateOwnedFile(snapshot)
        ) {
          throw new Error('Campaign staging marker is no longer safely removable.');
        }
        fs.unlinkSync(markerPath);
      }
      fs.fsyncSync(stage.directoryDescriptor);
      if (fs.readdirSync(stage.directoryPath).length !== 0) {
        throw new Error('Campaign staging remains nonempty after owned cleanup.');
      }
      fs.rmdirSync(stage.directoryPath);
      fs.fsyncSync(options.parentDescriptor);
    } catch (error) {
      errors.push(error);
    }
  }
  captureCleanup(errors, () => closeDescriptor(stage.databaseDescriptor));
  captureCleanup(errors, () => closeDescriptor(stage.directoryDescriptor));
  if (errors.length > 0) {
    throw cleanupFailure(
      'Campaign import staging could not be cleaned completely.',
      new AggregateError(errors),
    );
  }
}

function assertStageIdentity(stage: ImportStage, expectedLinks: bigint): void {
  const directoryStats = fs.lstatSync(stage.directoryPath, { bigint: true });
  const directoryDescriptor = fileSnapshot(
    fs.fstatSync(stage.directoryDescriptor, { bigint: true }),
  );
  if (
    !directoryStats.isDirectory() ||
    directoryStats.isSymbolicLink() ||
    !sameFileIdentity(fileSnapshot(directoryStats), directoryDescriptor) ||
    !sameFileIdentity(directoryDescriptor, stage.directorySnapshot) ||
    !isPrivateOwnedDirectory(directoryDescriptor)
  ) {
    throw new CampaignImportError('target_changed', 'Campaign staging directory changed identity.');
  }
  const databaseStats = fs.lstatSync(stage.databasePath, { bigint: true });
  const databaseDescriptor = fileSnapshot(fs.fstatSync(stage.databaseDescriptor, { bigint: true }));
  if (
    !databaseStats.isFile() ||
    databaseStats.isSymbolicLink() ||
    !sameFileIdentity(fileSnapshot(databaseStats), databaseDescriptor) ||
    databaseDescriptor.nlink !== expectedLinks ||
    !isPrivateOwnedFile(databaseDescriptor)
  ) {
    throw new CampaignImportError('target_changed', 'Campaign staging database changed identity.');
  }
}

function assertTargetStable(
  options: ResolvedOptions,
  proof: StableFileProof,
  code: Extract<CampaignImportCode, 'recovery_conflict' | 'target_changed'>,
): void {
  assertParentUnchanged(options, code);
  assertTargetSidecarsAbsent(options.databasePath, code);
  assertTargetMatchesProof(options.databasePath, proof, 1n, code);
  const current = stableProof(proof.descriptor);
  if (current.digest !== proof.digest || !sameSnapshot(current.snapshot, proof.snapshot)) {
    throw new CampaignImportError(code, 'Campaign target changed after publication.');
  }
}

function assertTargetMatchesProof(
  databasePath: string,
  proof: StableFileProof,
  expectedLinks: bigint,
  code: Extract<CampaignImportCode, 'recovery_conflict' | 'target_changed'>,
): void {
  let stats: fs.BigIntStats;
  try {
    stats = fs.lstatSync(databasePath, { bigint: true });
  } catch (error) {
    throw new CampaignImportError(code, 'Campaign target disappeared.', { cause: error });
  }
  const snapshot = fileSnapshot(stats);
  if (
    !stats.isFile() ||
    stats.isSymbolicLink() ||
    snapshot.dev !== proof.snapshot.dev ||
    snapshot.ino !== proof.snapshot.ino ||
    snapshot.size !== proof.snapshot.size ||
    snapshot.mode !== proof.snapshot.mode ||
    snapshot.uid !== proof.snapshot.uid ||
    snapshot.gid !== proof.snapshot.gid ||
    snapshot.nlink !== expectedLinks
  ) {
    throw new CampaignImportError(code, 'Campaign target no longer matches its pinned identity.');
  }
}

function inspectRecoveryTarget(databasePath: string): FileSnapshot | undefined {
  let stats: fs.BigIntStats;
  try {
    stats = fs.lstatSync(databasePath, { bigint: true });
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return undefined;
    throw error;
  }
  const snapshot = fileSnapshot(stats);
  if (!stats.isFile() || stats.isSymbolicLink() || !isPrivateOwnedFile(snapshot)) {
    throw new Error('Campaign recovery target is unsafe.');
  }
  return snapshot;
}

function stableProof(descriptor: number): StableFileProof {
  const snapshot = fileSnapshot(fs.fstatSync(descriptor, { bigint: true }));
  if (!isPrivateOwnedFile(snapshot)) {
    throw new Error('Campaign database proof requires a private owned file.');
  }
  return Object.freeze({
    descriptor,
    digest: hashDescriptor(descriptor, snapshot.size),
    snapshot,
  });
}

function assertParentUnchanged(
  options: ResolvedOptions,
  code: Extract<CampaignImportCode, 'cleanup_failed' | 'recovery_conflict' | 'target_changed'>,
): void {
  const descriptor = fileSnapshot(fs.fstatSync(options.parentDescriptor, { bigint: true }));
  let pathStats: fs.BigIntStats;
  try {
    pathStats = fs.lstatSync(path.dirname(options.databasePath), { bigint: true });
  } catch (error) {
    throw new CampaignImportError(code, 'Campaign database parent disappeared.', { cause: error });
  }
  const current = fileSnapshot(pathStats);
  if (
    !pathStats.isDirectory() ||
    pathStats.isSymbolicLink() ||
    !isPrivateOwnedDirectory(descriptor) ||
    !isPrivateOwnedDirectory(current) ||
    fs.realpathSync.native(path.dirname(options.databasePath)) !==
      path.dirname(options.databasePath) ||
    !sameDirectoryIdentity(descriptor, options.parentSnapshot) ||
    !sameDirectoryIdentity(current, options.parentSnapshot)
  ) {
    throw new CampaignImportError(code, 'Campaign database parent changed identity.');
  }
}

function assertTargetSidecarsAbsent(
  databasePath: string,
  code: Extract<CampaignImportCode, 'recovery_conflict' | 'target_changed' | 'target_conflict'>,
): void {
  const sidecar = targetSidecars(databasePath).find(pathExists);
  if (sidecar) {
    throw new CampaignImportError(
      code,
      `Campaign target has unresolved sidecar ${path.basename(sidecar)}.`,
    );
  }
}

function assertStageSidecarsAbsent(
  stageDirectory: string,
  code: Extract<CampaignImportCode, 'cleanup_failed' | 'import_failed' | 'recovery_conflict'>,
): void {
  const sidecar = targetSidecars(path.join(stageDirectory, STAGE_DATABASE_NAME)).find(pathExists);
  if (sidecar) {
    throw new CampaignImportError(code, 'Campaign staging has an unresolved SQLite sidecar.');
  }
}

function targetSidecars(databasePath: string): readonly string[] {
  return [`${databasePath}-journal`, `${databasePath}-shm`, `${databasePath}-wal`];
}

function stageDetails(stage: ImportStage): ImportCheckpointDetails {
  return Object.freeze({
    databasePath: stage.databasePath,
    stagingDirectory: stage.directoryPath,
  });
}

function readDescriptor(descriptor: number, size: bigint, maximum: number): Buffer {
  if (size < 0n || size > BigInt(maximum) || size > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Campaign source descriptor size is outside its bound.');
  }
  const bytes = Buffer.alloc(Number(size));
  let offset = 0;
  while (offset < bytes.length) {
    const read = fs.readSync(descriptor, bytes, offset, bytes.length - offset, offset);
    if (read === 0) throw new Error('Campaign source ended before its pinned size.');
    offset += read;
  }
  return bytes;
}

function hashDescriptor(descriptor: number, size: bigint): string {
  if (size < 0n || size > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Campaign database size exceeds the safe hashing range.');
  }
  const hash = createHash('sha256');
  const buffer = Buffer.allocUnsafe(64 * 1024);
  let offset = 0;
  const total = Number(size);
  while (offset < total) {
    const length = Math.min(buffer.length, total - offset);
    const read = fs.readSync(descriptor, buffer, 0, length, offset);
    if (read === 0) throw new Error('Campaign database ended before its pinned size.');
    hash.update(buffer.subarray(0, read));
    offset += read;
  }
  return hash.digest('hex');
}

function writeAll(descriptor: number, bytes: Buffer): void {
  let offset = 0;
  while (offset < bytes.length) {
    const written = fs.writeSync(descriptor, bytes, offset, bytes.length - offset, offset);
    if (written === 0) throw new Error('Campaign marker write made no progress.');
    offset += written;
  }
}

function closeSource(source: ValidatedSource): void {
  const errors: unknown[] = [];
  for (const entry of source.entries)
    captureCleanup(errors, () => closeDescriptor(entry.descriptor));
  captureCleanup(errors, () => closeDescriptor(source.descriptor));
  if (errors.length > 0)
    throw new AggregateError(errors, 'Campaign source descriptors failed to close.');
}

function sameReceipt(left: CampaignImportReceipt, right: CampaignImportReceipt): boolean {
  return (
    left.formatVersion === right.formatVersion &&
    left.sourceBytes === right.sourceBytes &&
    left.sourceSha256 === right.sourceSha256 &&
    left.campaignCount === right.campaignCount &&
    left.orderedCampaignsSha256 === right.orderedCampaignsSha256
  );
}

function fileSnapshot(stats: fs.BigIntStats): FileSnapshot {
  return Object.freeze({
    ctimeNs: stats.ctimeNs,
    dev: stats.dev,
    gid: stats.gid,
    ino: stats.ino,
    mode: stats.mode,
    mtimeNs: stats.mtimeNs,
    nlink: stats.nlink,
    size: stats.size,
    uid: stats.uid,
  });
}

function sameSnapshot(left: FileSnapshot, right: FileSnapshot): boolean {
  return (
    left.ctimeNs === right.ctimeNs &&
    left.dev === right.dev &&
    left.gid === right.gid &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.mtimeNs === right.mtimeNs &&
    left.nlink === right.nlink &&
    left.size === right.size &&
    left.uid === right.uid
  );
}

function sameFileIdentity(left: FileSnapshot, right: FileSnapshot): boolean {
  return (
    left.dev === right.dev &&
    left.gid === right.gid &&
    left.ino === right.ino &&
    left.mode === right.mode &&
    left.uid === right.uid
  );
}

function sameDirectoryIdentity(left: FileSnapshot, right: FileSnapshot): boolean {
  return sameFileIdentity(left, right);
}

function isPrivateOwnedFile(snapshot: FileSnapshot): boolean {
  return snapshot.uid === CURRENT_UID && (snapshot.mode & 0o777n) === BigInt(PRIVATE_FILE_MODE);
}

function isPrivateOwnedDirectory(snapshot: FileSnapshot): boolean {
  return (
    snapshot.uid === CURRENT_UID && (snapshot.mode & 0o777n) === BigInt(PRIVATE_DIRECTORY_MODE)
  );
}

function isRegularSingleLink(snapshot: FileSnapshot): boolean {
  return snapshot.nlink === 1n;
}

function normalizedAbsolute(value: unknown): value is string {
  return typeof value === 'string' && path.isAbsolute(value) && path.normalize(value) === value;
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredConstant(value: number | undefined, name: string): number {
  if (value === undefined) throw new Error(`Campaign importer requires ${name}.`);
  return value;
}

function currentUid(): number {
  if (process.geteuid === undefined) {
    throw new Error('Campaign importing requires POSIX ownership checks.');
  }
  return process.geteuid();
}

function normalizeImportError(error: unknown): CampaignImportError {
  if (error instanceof CampaignImportError) return error;
  return new CampaignImportError('import_failed', 'Campaign import failed.', { cause: error });
}

function recoveryConflict(message: string, cause?: unknown): CampaignImportError {
  return new CampaignImportError(
    'recovery_conflict',
    message,
    cause === undefined ? {} : { cause },
  );
}

function cleanupFailure(message: string, cause?: unknown): CampaignImportError {
  return new CampaignImportError('cleanup_failed', message, cause === undefined ? {} : { cause });
}

function captureCleanup(errors: unknown[], action: () => void): void {
  try {
    action();
  } catch (error) {
    errors.push(error);
  }
}

function closeDescriptor(descriptor: number): void {
  if (descriptor >= 0) fs.closeSync(descriptor);
}

function pathExists(filePath: string): boolean {
  try {
    fs.lstatSync(filePath);
    return true;
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return false;
    throw error;
  }
}

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    Boolean(value) &&
    (typeof value === 'object' || typeof value === 'function') &&
    'then' in (value as object) &&
    typeof (value as { readonly then?: unknown }).then === 'function'
  );
}
