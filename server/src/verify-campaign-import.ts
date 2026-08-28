import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  CAMPAIGN_IMPORT_MAX_AGGREGATE_BYTES,
  CAMPAIGN_IMPORT_MAX_CAMPAIGNS,
} from './campaign-import.js';
import {
  CAMPAIGN_IMPORT_FORMAT_VERSION,
  type CampaignImportReceipt,
} from './campaign-repository.js';
import { verifyLegacyCampaignImportPreActivation } from './legacy-cutover.js';

const RECEIPT_MAX_BYTES = 2 * 1024;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const RECEIPT_KEYS = Object.freeze([
  'campaignCount',
  'formatVersion',
  'orderedCampaignsSha256',
  'sourceBytes',
  'sourceSha256',
]);

interface VerificationArguments {
  readonly databasePath: string;
  readonly receiptPath: string;
}

export function parseCampaignImportVerificationArguments(
  arguments_: readonly string[],
): VerificationArguments {
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
      'Usage: node server/dist/verify-campaign-import.js --database <restored-database> --receipt <captured-import-receipt>',
    );
  }
  if (!databasePath || !receiptPath) {
    throw new Error(
      'Campaign import verification requires explicit --database and --receipt paths.',
    );
  }
  return Object.freeze({ databasePath, receiptPath });
}

export function readCampaignImportReceiptEvidence(receiptPath: string): CampaignImportReceipt {
  const value: unknown = JSON.parse(readStableReceipt(receiptPath).toString('utf8'));
  if (!plainObject(value) || Object.keys(value).toSorted().join(',') !== RECEIPT_KEYS.join(',')) {
    throw new Error('Campaign import receipt evidence has an unexpected shape.');
  }
  const campaignCount = value['campaignCount'];
  const formatVersion = value['formatVersion'];
  const orderedCampaignsSha256 = value['orderedCampaignsSha256'];
  const sourceBytes = value['sourceBytes'];
  const sourceSha256 = value['sourceSha256'];
  if (formatVersion !== CAMPAIGN_IMPORT_FORMAT_VERSION) {
    throw new Error('Campaign import receipt evidence has an unsupported format version.');
  }
  if (
    typeof campaignCount !== 'number' ||
    !Number.isSafeInteger(campaignCount) ||
    campaignCount < 0 ||
    campaignCount > CAMPAIGN_IMPORT_MAX_CAMPAIGNS
  ) {
    throw new Error('Campaign import receipt evidence has an invalid campaign count.');
  }
  if (
    typeof sourceBytes !== 'number' ||
    !Number.isSafeInteger(sourceBytes) ||
    sourceBytes < 0 ||
    sourceBytes > CAMPAIGN_IMPORT_MAX_AGGREGATE_BYTES
  ) {
    throw new Error('Campaign import receipt evidence has an invalid source byte count.');
  }
  if (
    typeof sourceSha256 !== 'string' ||
    !SHA256_PATTERN.test(sourceSha256) ||
    typeof orderedCampaignsSha256 !== 'string' ||
    !SHA256_PATTERN.test(orderedCampaignsSha256)
  ) {
    throw new Error('Campaign import receipt evidence has an invalid aggregate hash.');
  }
  return Object.freeze({
    campaignCount,
    formatVersion: CAMPAIGN_IMPORT_FORMAT_VERSION,
    orderedCampaignsSha256,
    sourceBytes,
    sourceSha256,
  });
}

export function verifyCampaignImportEvidence(arguments_: readonly string[]): CampaignImportReceipt {
  const options = parseCampaignImportVerificationArguments(arguments_);
  const expected = readCampaignImportReceiptEvidence(options.receiptPath);
  return verifyLegacyCampaignImportPreActivation(options.databasePath, expected);
}

export function runCampaignImportVerification(arguments_: readonly string[]): void {
  const receipt = verifyCampaignImportEvidence(arguments_);
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  runCampaignImportVerification(process.argv.slice(2));
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readStableReceipt(receiptPath: string): Buffer {
  if (
    !path.isAbsolute(receiptPath) ||
    path.normalize(receiptPath) !== receiptPath ||
    fs.realpathSync.native(receiptPath) !== receiptPath
  ) {
    throw new Error('Campaign import receipt evidence must use one canonical absolute path.');
  }
  const pathBefore = fs.lstatSync(receiptPath, { bigint: true });
  const noFollow = fs.constants.O_NOFOLLOW;
  if (noFollow === undefined) {
    throw new Error('Campaign import receipt verification requires O_NOFOLLOW.');
  }
  const descriptor = fs.openSync(receiptPath, fs.constants.O_RDONLY | noFollow);
  try {
    const before = fs.fstatSync(descriptor, { bigint: true });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.nlink !== 1n ||
      before.uid !== BigInt(currentUid()) ||
      (before.mode & 0o777n) !== 0o600n ||
      before.size <= 0n ||
      before.size > BigInt(RECEIPT_MAX_BYTES) ||
      !sameReceiptFile(pathBefore, before)
    ) {
      throw new Error(
        'Campaign import receipt evidence must be one current-user-owned mode-0600 single-link file within its byte bound.',
      );
    }
    const bytes = Buffer.alloc(Number(before.size));
    let offset = 0;
    while (offset < bytes.length) {
      const read = fs.readSync(descriptor, bytes, offset, bytes.length - offset, offset);
      if (read === 0) throw new Error('Campaign import receipt evidence ended early.');
      offset += read;
    }
    const extra = Buffer.allocUnsafe(1);
    if (fs.readSync(descriptor, extra, 0, 1, bytes.length) !== 0) {
      throw new Error('Campaign import receipt evidence grew while being read.');
    }
    const after = fs.fstatSync(descriptor, { bigint: true });
    const pathAfter = fs.lstatSync(receiptPath, { bigint: true });
    if (!sameReceiptFile(before, after) || !sameReceiptFile(before, pathAfter)) {
      throw new Error('Campaign import receipt evidence changed while being read.');
    }
    return bytes;
  } finally {
    fs.closeSync(descriptor);
  }
}

function sameReceiptFile(left: fs.BigIntStats, right: fs.BigIntStats): boolean {
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

function currentUid(): number {
  if (process.geteuid === undefined) {
    throw new Error('Campaign import receipt verification requires POSIX ownership checks.');
  }
  return process.geteuid();
}
