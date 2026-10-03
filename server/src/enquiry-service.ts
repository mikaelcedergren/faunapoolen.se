import { createHash, createHmac, randomUUID } from 'node:crypto';
import { HttpError } from '@mikaelcedergren/cx-framework/server/errors';
import {
  withImmediateTransaction,
  type SqliteRow,
  type SyncSqliteDatabase,
} from '@mikaelcedergren/cx-framework/server/sqlite';
import type {
  EnquiryInput,
  EnquiryField,
  EnquirySubmission,
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
const LEGACY_LABELS: Record<string, string> = {
  phone: 'Phone',
  location: 'Town or postcode',
  notes: 'Message',
  contactPeriod: 'Contact time',
  service: 'Project',
  packageId: 'Package',
  siteId: 'Site access',
  sizeId: 'Swim area',
  featureIds: 'Additions',
  annualCare: 'Annual maintenance',
};
const CHOICES: Record<string, string> = {
  pool: 'Nature pool',
  pond: 'Pond',
  stream: 'Stream or waterfall',
  unsure: 'Not sure yet',
  glade: 'The glade',
  summer: 'Summer days',
  horizon: 'The horizon',
  open: 'Open access',
  limited: 'Constrained access',
  complex: 'Rock or major level changes',
  included: 'Within the package range',
  larger: 'Larger',
  expansive: 'Extra large',
  deck: 'Deck',
  stone: 'Natural stone',
  lighting: 'Lighting',
  heating: 'Heating',
  morning: 'Weekdays 08:00–12:00',
  afternoon: 'Weekdays 12:00–17:00',
  evening: 'Weekdays 17:00–20:00',
};
function legacyFields(input: EnquiryInput): EnquiryField[] {
  return Object.entries(LEGACY_LABELS)
    .map(([id, label]) => {
      const value = input[id as keyof EnquiryInput];
      return {
        id,
        label,
        value: Array.isArray(value)
          ? value.map((v) => CHOICES[v] ?? v).join(', ')
          : typeof value === 'boolean'
            ? value
              ? 'Requested'
              : 'Not requested'
            : (CHOICES[String(value)] ?? String(value)),
      };
    })
    .filter((field) => field.value !== '');
}
function submission(value: unknown): Required<EnquirySubmission> {
  if (value && typeof value === 'object' && 'formVersion' in value) {
    const source = value as Record<string, unknown>;
    const r = object(source, [
      'requestId',
      'email',
      'formVersion',
      'fields',
      ...('name' in source ? ['name'] : []),
      ...('language' in source ? ['language'] : []),
    ]);
    const requestId = text(r['requestId'], 36, 36).toLowerCase();
    if (!UUID.test(requestId)) fail('invalid_enquiry', 'The enquiry reference is invalid.');
    const email = text(r['email'], 3, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      fail('invalid_enquiry', 'Enter a valid email address.');
    const formVersion = text(r['formVersion'], 1, 80);
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(formVersion))
      fail('invalid_enquiry', 'The form version is invalid.');
    if (!Array.isArray(r['fields']) || r['fields'].length > 30)
      fail('invalid_enquiry', 'Too many enquiry fields.');
    const fields = r['fields'].map((v): EnquiryField => {
      const f = object(v, ['id', 'label', 'value']);
      const id = text(f['id'], 1, 60);
      if (!/^[a-z][a-zA-Z0-9_-]*$/.test(id)) fail('invalid_enquiry', 'Invalid field identifier.');
      return { id, label: text(f['label'], 1, 120), value: text(f['value'], 0, 4000) };
    });
    if (new Set(fields.map((f) => f.id)).size !== fields.length)
      fail('invalid_enquiry', 'Duplicate enquiry fields.');
    return {
      requestId,
      email,
      name: text(r['name'] ?? '', 0, 120),
      language: choice(r['language'] ?? 'en', ['en', 'sv', 'da']),
      formVersion,
      fields,
    };
  }
  const input = parseEnquiry(value);
  return {
    requestId: input.requestId,
    email: input.email,
    name: input.name,
    language: input.language,
    formVersion: 'legacy-v1',
    fields: legacyFields(input),
  };
}
function record(row: SqliteRow): EnquiryRecord {
  const input = JSON.parse(String(row['record_json'])) as EnquiryInput & Partial<EnquirySubmission>;
  return {
    requestId: input.requestId,
    email: input.email,
    name: input.name,
    language: input.language,
    customerId: String(row['customer_id']),
    formVersion: input.formVersion ?? 'legacy-v1',
    fields: input.fields ?? legacyFields(input),
    notification: {
      state: (row['mail_state'] ?? 'historical') as EnquiryRecord['notification']['state'],
      revision: Number(row['mail_revision'] ?? 0),
      attempts: Number(row['mail_attempts'] ?? 0),
      recipient: row['recipient'] == null ? null : String(row['recipient']),
      messageId: row['message_id'] == null ? null : String(row['message_id']),
    },
    status: row['status'] as EnquiryStatus,
    revision: Number(row['revision']),
    createdAt: String(row['created_at']),
    updatedAt: String(row['updated_at']),
  };
}
const ENQUIRY_SELECT = `SELECT e.*,n.state AS mail_state,n.revision AS mail_revision,
 n.attempts AS mail_attempts,n.recipient,n.message_id FROM enquiries e
 LEFT JOIN enquiry_notifications n ON n.enquiry_id=e.id`;
export function createEnquiryService({
  database,
  secret,
  now = Date.now,
  executionScope = 'test',
}: {
  database: SyncSqliteDatabase;
  secret: string;
  now?: () => number;
  executionScope?: string;
}): EnquiryService {
  if (!['development', 'production', 'test', 'validation'].includes(executionScope))
    throw new Error('Unsupported enquiry execution scope.');
  if (secret.length < 16) throw new Error('Enquiry admission needs the configured session secret.');
  const key = (value: string) =>
    createHmac('sha256', secret)
      .update('enquiries:' + value)
      .digest('hex');
  return {
    submit(value) {
      const input = submission(value),
        json = JSON.stringify(input),
        hash = createHash('sha256').update(json).digest('hex');
      if (json.length > 12000) fail('invalid_enquiry', 'The enquiry is too long.');
      return withImmediateTransaction(database, () => {
        const existing = database.get('SELECT request_hash FROM enquiries WHERE id=?', [
          input.requestId,
        ]);
        if (existing) {
          if (
            existing['request_hash'] !== hash &&
            !(
              input.formVersion === 'legacy-v1' &&
              existing['request_hash'] ===
                createHash('sha256')
                  .update(JSON.stringify(parseEnquiry(value)))
                  .digest('hex')
            )
          )
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
        let customer = database.get('SELECT id FROM customers WHERE email=?', [input.email]);
        if (!customer) {
          const id = randomUUID();
          database.run(
            'INSERT INTO customers(id,email,name,created_at,updated_at) VALUES(?,?,?,?,?)',
            [id, input.email, input.name, timestamp, timestamp],
          );
          customer = { id };
        } else {
          // A new submission may fill an empty name, but never overwrite an established identity.
          database.run(
            "UPDATE customers SET name=CASE WHEN name='' THEN ? ELSE name END,updated_at=?,revision=revision+1 WHERE id=?",
            [input.name, timestamp, String(customer['id'])],
          );
        }
        database.run(
          "INSERT INTO enquiries(id,request_hash,record_json,status,revision,created_at,updated_at,customer_id) VALUES(?,?,?,'new',1,?,?,?)",
          [input.requestId, hash, json, timestamp, timestamp, String(customer['id'])],
        );
        database.run(
          "INSERT INTO enquiry_notifications(enquiry_id,execution_scope,state,available_at,updated_at) VALUES(?,?,'queued',?,?)",
          [input.requestId, executionScope, time, timestamp],
        );
        return { id: input.requestId };
      });
    },
    list() {
      return database
        .all(ENQUIRY_SELECT + ' ORDER BY e.created_at DESC,e.id LIMIT ?', [MAX_ENQUIRIES])
        .map(record);
    },
    customers() {
      const enquiries = this.list();
      return database
        .all('SELECT * FROM customers ORDER BY updated_at DESC,id LIMIT 1000')
        .map((c) => ({
          id: String(c['id']),
          email: String(c['email']),
          name: String(c['name']),
          status: c['status'] as 'lead' | 'customer',
          revision: Number(c['revision']),
          createdAt: String(c['created_at']),
          updatedAt: String(c['updated_at']),
          enquiries: enquiries.filter((e) => e.customerId === c['id']),
        }));
    },
    updateCustomer(id, value) {
      const r = object(value, ['status', 'expectedRevision']);
      const status = choice(r['status'], ['lead', 'customer']);
      if (!UUID.test(id) || !Number.isSafeInteger(r['expectedRevision']))
        fail('invalid_customer', 'Invalid customer reference.');
      withImmediateTransaction(database, () => {
        const row = database.get('SELECT revision FROM customers WHERE id=?', [id]);
        if (!row) fail('customer_not_found', 'This customer no longer exists.', 404);
        if (row['revision'] !== r['expectedRevision'])
          fail('customer_conflict', 'This customer changed. Reload before saving.', 409);
        database.run('UPDATE customers SET status=?,revision=revision+1,updated_at=? WHERE id=?', [
          status,
          new Date(now()).toISOString(),
          id,
        ]);
      });
      return this.customers().find((c) => c.id === id)!;
    },
    resolveNotification(id, value) {
      const r = object(value, ['expectedRevision', 'outcome']);
      const outcome = choice(r['outcome'], ['sent', 'not-sent']);
      withImmediateTransaction(database, () => {
        const row = database.get('SELECT * FROM enquiry_notifications WHERE enquiry_id=?', [id]);
        if (
          !row ||
          row['revision'] !== r['expectedRevision'] ||
          row['state'] !== 'uncertain' ||
          row['execution_scope'] !== executionScope
        )
          fail('notification_conflict', 'Email status changed. Reload before reviewing it.', 409);
        database.run(
          "UPDATE enquiry_notifications SET state=?,attempts=0,revision=revision+1,available_at=?,updated_at=?,error_code='owner_reviewed' WHERE enquiry_id=?",
          [outcome === 'sent' ? 'sent' : 'queued', now(), new Date(now()).toISOString(), id],
        );
      });
    },
    retryNotification(id, value) {
      const r = object(value, ['expectedRevision']);
      withImmediateTransaction(database, () => {
        const row = database.get('SELECT * FROM enquiry_notifications WHERE enquiry_id=?', [id]);
        if (!row) fail('notification_not_found', 'There is no email to retry.', 404);
        if (row['revision'] !== r['expectedRevision'])
          fail('notification_conflict', 'Email status changed. Reload before retrying.', 409);
        if (row['execution_scope'] !== executionScope || row['state'] !== 'failed')
          fail('notification_conflict', 'This email cannot be safely retried.', 409);
        database.run(
          "UPDATE enquiry_notifications SET state='queued',attempts=0,revision=revision+1,available_at=?,updated_at=?,error_code=NULL WHERE enquiry_id=?",
          [now(), new Date(now()).toISOString(), id],
        );
      });
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
        return record(database.get(ENQUIRY_SELECT + ' WHERE e.id=?', [id])!);
      });
    },
  };
}
