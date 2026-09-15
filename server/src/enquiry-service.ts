import { createHash, createHmac } from 'node:crypto';
import { HttpError } from '@mikaelcedergren/cx-framework/server/errors';
import {
  withImmediateTransaction,
  type SqliteRow,
  type SyncSqliteDatabase,
} from '@mikaelcedergren/cx-framework/server/sqlite';
import type {
  EnquiryInput,
  EnquiryRecord,
  EnquiryService,
  EnquiryStatus,
} from './enquiry-contracts.js';
import { MAX_ENQUIRIES } from './enquiry-schema.js';

const HOUR_MS = 3_600_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function fail(code: string, message: string, status = 400): never {
  throw new HttpError({ code, message, status });
}
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail('invalid_enquiry', 'Expected an enquiry object.');
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(',') !== [...keys].sort().join(','))
    fail('invalid_enquiry', 'The enquiry fields are incomplete or unsupported.');
  return record;
}
function text(value: unknown, min: number, max: number): string {
  if (
    typeof value !== 'string' ||
    value.trim().length < min ||
    value.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  )
    fail('invalid_enquiry', 'An enquiry field is invalid or too long.');
  return value.trim();
}
function choice<const T extends readonly string[]>(value: unknown, choices: T): T[number] {
  if (typeof value !== 'string' || !choices.includes(value))
    fail('invalid_enquiry', 'An enquiry choice is invalid.');
  return value as T[number];
}
export function parseEnquiry(value: unknown): EnquiryInput {
  const r = object(value, [
    'requestId',
    'language',
    'name',
    'email',
    'phone',
    'location',
    'contactPeriod',
    'notes',
    'service',
    'packageId',
    'siteId',
    'sizeId',
    'featureIds',
    'annualCare',
  ]);
  const requestId = text(r['requestId'], 36, 36).toLowerCase();
  if (!UUID.test(requestId)) fail('invalid_enquiry', 'The enquiry reference is invalid.');
  const email = text(r['email'], 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fail('invalid_enquiry', 'Enter a valid email address.');
  const features = r['featureIds'];
  if (!Array.isArray(features) || features.length > 5 || new Set(features).size !== features.length)
    fail('invalid_enquiry', 'The enquiry additions are invalid.');
  if (typeof r['annualCare'] !== 'boolean')
    fail('invalid_enquiry', 'The maintenance choice is invalid.');
  return {
    requestId,
    email,
    language: choice(r['language'], ['en', 'sv', 'da']),
    name: text(r['name'], 1, 120),
    phone: text(r['phone'], 0, 60),
    location: text(r['location'], 1, 160),
    notes: text(r['notes'], 0, 4000),
    contactPeriod: choice(r['contactPeriod'], ['', 'morning', 'afternoon', 'evening']),
    service: choice(r['service'], ['pool', 'pond', 'stream', 'unsure']),
    packageId: choice(r['packageId'], ['glade', 'summer', 'horizon', 'unsure']),
    siteId: choice(r['siteId'], ['open', 'limited', 'complex', 'unsure']),
    sizeId: choice(r['sizeId'], ['included', 'larger', 'expansive']),
    featureIds: features
      .map((v) => choice(v, ['stream', 'deck', 'stone', 'lighting', 'heating']))
      .sort(),
    annualCare: r['annualCare'],
  };
}
function record(row: SqliteRow): EnquiryRecord {
  return {
    ...parseEnquiry(JSON.parse(String(row['record_json']))),
    status: row['status'] as EnquiryStatus,
    revision: Number(row['revision']),
    createdAt: String(row['created_at']),
    updatedAt: String(row['updated_at']),
  };
}
export function createEnquiryService({
  database,
  secret,
  now = Date.now,
}: {
  database: SyncSqliteDatabase;
  secret: string;
  now?: () => number;
}): EnquiryService {
  if (secret.length < 16) throw new Error('Enquiry admission needs the configured session secret.');
  const key = (value: string) =>
    createHmac('sha256', secret)
      .update('enquiries:' + value)
      .digest('hex');
  return {
    submit(value) {
      const input = parseEnquiry(value),
        json = JSON.stringify(input),
        hash = createHash('sha256').update(json).digest('hex');
      return withImmediateTransaction(database, () => {
        const existing = database.get('SELECT request_hash FROM enquiries WHERE id=?', [
          input.requestId,
        ]);
        if (existing) {
          if (existing['request_hash'] !== hash)
            fail('enquiry_conflict', 'This reference was already used for another enquiry.', 409);
          return { id: input.requestId };
        }
        if (Number(database.get('SELECT count(*) AS n FROM enquiries')?.['n']) >= MAX_ENQUIRIES)
          fail('enquiry_capacity', 'The inbox cannot receive more enquiries at the moment.', 503);
        const time = now();
        database.run('DELETE FROM enquiry_windows WHERE window_started <= ?', [time - HOUR_MS]);
        for (const [scope, limit] of [
          ['all', 100],
          [input.email, 5],
        ] as const) {
          const hash = key(scope),
            window = database.get('SELECT count FROM enquiry_windows WHERE key_hash=?', [hash]);
          if (Number(window?.['count'] ?? 0) >= limit)
            fail('enquiry_rate_limit', 'Please wait before sending another enquiry.', 429);
          if (window)
            database.run('UPDATE enquiry_windows SET count=count+1 WHERE key_hash=?', [hash]);
          else
            database.run(
              'INSERT INTO enquiry_windows(key_hash,window_started,count) VALUES(?,?,1)',
              [hash, time],
            );
        }
        const timestamp = new Date(time).toISOString();
        database.run(
          "INSERT INTO enquiries(id,request_hash,record_json,status,revision,created_at,updated_at) VALUES(?,?,?,'new',1,?,?)",
          [input.requestId, hash, json, timestamp, timestamp],
        );
        return { id: input.requestId };
      });
    },
    list() {
      return database
        .all('SELECT * FROM enquiries ORDER BY created_at DESC,id LIMIT ?', [MAX_ENQUIRIES])
        .map(record);
    },
    update(id, value) {
      if (!UUID.test(id)) fail('invalid_enquiry', 'The enquiry reference is invalid.');
      const r = object(value, ['status', 'expectedRevision']);
      const status = choice(r['status'], ['new', 'contacted', 'closed']);
      if (!Number.isSafeInteger(r['expectedRevision']) || Number(r['expectedRevision']) < 1)
        fail('invalid_enquiry', 'The enquiry revision is invalid.');
      return withImmediateTransaction(database, () => {
        const row = database.get('SELECT * FROM enquiries WHERE id=?', [id]);
        if (!row) fail('enquiry_not_found', 'This enquiry no longer exists.', 404);
        if (row['revision'] !== r['expectedRevision'])
          fail('enquiry_conflict', 'This enquiry changed. Reload it before saving.', 409);
        database.run(
          'UPDATE enquiries SET status=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?',
          [status, new Date(now()).toISOString(), id, Number(r['expectedRevision'])],
        );
        return record(database.get('SELECT * FROM enquiries WHERE id=?', [id])!);
      });
    },
  };
}
