import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { openFaunapoolenDatabase } from './database.js';
import { createEnquiryService, parseEnquiry } from './enquiry-service.js';
import type { EnquiryInput } from './enquiry-contracts.js';

function input(): EnquiryInput {
  return {
    requestId: randomUUID(),
    language: 'da',
    name: 'Synthetic visitor',
    email: 'visitor@example.test',
    phone: '',
    location: 'Test garden',
    contactPeriod: '',
    notes: 'Synthetic enquiry only.',
    service: 'pool',
    packageId: 'unsure',
    siteId: 'unsure',
    sizeId: 'included',
    featureIds: [],
    annualCare: false,
  };
}
const secret = 'synthetic-enquiry-test-secret-only';

test('global admission and the inbox hard bound refuse capacity without evicting records', () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fauna-enquiry-capacity-')));
  const db = openFaunapoolenDatabase({
    operationalRoot: root,
    databasePath: path.join(root, 'synthetic.db'),
  });
  let now = 1_800_000_000_000;
  try {
    const service = createEnquiryService({ database: db.sqlite, secret, now: () => now });
    const first = input();
    service.submit(first);
    for (let i = 1; i < 100; i++) service.submit({ ...input(), email: `visitor${i}@example.test` });
    assert.throws(() => service.submit({ ...input(), email: 'other@example.test' }), /wait/);
    for (let batch = 1; batch < 10; batch++) {
      now += 3_600_000;
      for (let i = 0; i < 100; i++)
        service.submit({ ...input(), email: `visitor${i}@example.test` });
    }
    assert.equal(service.list().length, 1000);
    assert.throws(() => service.submit(input()), /cannot receive/);
    assert.deepEqual(service.submit(first), { id: first.requestId });
    assert.equal(service.list().length, 1000);
  } finally {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('enquiries survive reopen, retry once, and use compare-and-swap', () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fauna-enquiry-test-')));
  const options = { operationalRoot: root, databasePath: path.join(root, 'synthetic.db') };
  let db = openFaunapoolenDatabase(options);
  try {
    let service = createEnquiryService({ database: db.sqlite, secret });
    const enquiry = input();
    assert.deepEqual(service.submit(enquiry), { id: enquiry.requestId });
    assert.deepEqual(service.submit(enquiry), { id: enquiry.requestId });
    assert.equal(service.list().length, 1);
    assert.equal(service.list()[0]?.language, 'da');
    assert.throws(
      () => service.submit({ ...enquiry, notes: 'Different submission' }),
      /already used/,
    );
    const updated = service.update(enquiry.requestId, { status: 'contacted', expectedRevision: 1 });
    assert.equal(updated.revision, 2);
    assert.throws(
      () => service.update(enquiry.requestId, { status: 'closed', expectedRevision: 1 }),
      /changed/,
    );
    db.close();
    db = openFaunapoolenDatabase(options);
    service = createEnquiryService({ database: db.sqlite, secret });
    assert.equal(service.list()[0]?.status, 'contacted');
    assert.equal(service.list()[0]?.fields.find((f) => f.id === 'notes')?.value, enquiry.notes);
    service.update(enquiry.requestId, { status: 'closed', expectedRevision: 2 });
    assert.equal(service.list()[0]?.status, 'closed');
  } finally {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('persistent rate limits do not charge successful retries and expire', () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fauna-enquiry-limit-')));
  const db = openFaunapoolenDatabase({
    operationalRoot: root,
    databasePath: path.join(root, 'synthetic.db'),
  });
  let now = 1_800_000_000_000;
  try {
    const service = createEnquiryService({ database: db.sqlite, secret, now: () => now });
    const first = input();
    service.submit(first);
    for (let i = 0; i < 10; i++) service.submit(first);
    for (let i = 0; i < 4; i++) service.submit(input());
    assert.throws(() => service.submit(input()), /wait/);
    assert.equal(service.list().length, 5);
    now += 3_600_000;
    service.submit(input());
    assert.equal(service.list().length, 6);
    assert.equal(db.sqlite.all('SELECT * FROM enquiry_windows').length, 2);
  } finally {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('boundary validation refuses unknown fields, oversized text, invalid choices and duplicate additions', () => {
  assert.throws(() => parseEnquiry({ ...input(), extra: true }), /fields/);
  assert.throws(() => parseEnquiry({ ...input(), notes: 'x'.repeat(4001) }), /too long/);
  assert.throws(() => parseEnquiry({ ...input(), language: 'fr' }), /choice/);
  assert.throws(() => parseEnquiry({ ...input(), featureIds: ['deck', 'deck'] }), /additions/);
  assert.throws(() => parseEnquiry({ ...input(), email: 'not-email' }), /email/);
  assert.equal(
    parseEnquiry({ ...input(), email: ' VISITOR@example.test ' }).email,
    'visitor@example.test',
  );
});

test('flexible forms group by email and retain original names, labels and values', () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fauna-customers-')));
  const options = { operationalRoot: root, databasePath: path.join(root, 'synthetic.db') };
  let db = openFaunapoolenDatabase(options);
  try {
    let service = createEnquiryService({ database: db.sqlite, secret });
    const first = {
      requestId: randomUUID(),
      email: ' Visitor@example.test ',
      formVersion: 'experiment-1',
      fields: [{ id: 'budget', label: 'Budget at the time', value: 'Not decided' }],
    };
    service.submit(first);
    service.submit(first);
    const second = {
      requestId: randomUUID(),
      email: 'visitor@example.test',
      name: 'A visitor',
      formVersion: 'experiment-2',
      fields: [],
    };
    service.submit(second);
    assert.equal(service.customers().length, 1);
    const customer = service.customers()[0]!;
    assert.equal(customer.name, 'A visitor');
    assert.equal(customer.enquiries.length, 2);
    assert.equal(customer.enquiries.find((e) => e.requestId === first.requestId)?.name, '');
    assert.deepEqual(
      customer.enquiries.find((e) => e.requestId === first.requestId)?.fields,
      first.fields,
    );
    assert.equal(db.sqlite.get('SELECT count(*) AS n FROM enquiry_notifications')?.['n'], 2);
    service.updateCustomer(customer.id, {
      status: 'customer',
      expectedRevision: customer.revision,
    });
    assert.throws(
      () =>
        service.updateCustomer(customer.id, {
          status: 'lead',
          expectedRevision: customer.revision,
        }),
      /changed/,
    );
    db.close();
    db = openFaunapoolenDatabase(options);
    service = createEnquiryService({ database: db.sqlite, secret });
    assert.equal(service.customers()[0]?.id, customer.id);
    assert.equal(service.customers()[0]?.status, 'customer');
    assert.equal(service.customers()[0]?.enquiries.length, 2);
    assert.throws(
      () =>
        service.submit({
          ...second,
          requestId: randomUUID(),
          fields: [{ id: 'x', label: 'x', value: 'x'.repeat(4001) }],
        }),
      /too long/,
    );
    assert.throws(
      () =>
        service.submit({
          ...second,
          requestId: randomUUID(),
          fields: Array.from({ length: 4 }, (_, i) => ({
            id: `f${i}`,
            label: 'x',
            value: 'x'.repeat(3900),
          })),
        }),
      /too long/,
    );
  } finally {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('customer and enquiry admission roll back when the notification cannot be saved', () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fauna-atomic-')));
  const db = openFaunapoolenDatabase({
    operationalRoot: root,
    databasePath: path.join(root, 'synthetic.db'),
  });
  try {
    db.sqlite.run(
      "CREATE TRIGGER synthetic_refusal BEFORE INSERT ON enquiry_notifications BEGIN SELECT RAISE(ABORT,'synthetic refusal'); END",
    );
    const service = createEnquiryService({ database: db.sqlite, secret });
    assert.throws(() => service.submit(input()), /synthetic refusal/);
    assert.equal(service.list().length, 0);
    assert.equal(service.customers().length, 0);
  } finally {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('migration groups historical email identities without queuing old notifications', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const { applySqliteMigrations, createPreparedSyncSqliteAdapter } =
    await import('@mikaelcedergren/cx-framework/server/sqlite');
  const { FAUNAPOOLEN_MIGRATIONS } = await import('./database.js');
  const { createHash } = await import('node:crypto');
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fauna-customer-migration-')));
  const databasePath = path.join(root, 'synthetic.db');
  const native = new DatabaseSync(databasePath);
  const sql = createPreparedSyncSqliteAdapter(native);
  const options = {
    fingerprint: (s: string) => createHash('sha256').update(s).digest('hex'),
    now: () => new Date().toISOString(),
  };
  applySqliteMigrations(
    sql,
    FAUNAPOOLEN_MIGRATIONS.filter((m) => m.version <= 14),
    options,
  );
  const first = input(),
    second = { ...input(), email: 'VISITOR@example.test' };
  for (const entry of [first, second]) {
    const json = JSON.stringify(entry);
    sql.run(
      "INSERT INTO enquiries(id,request_hash,record_json,status,revision,created_at,updated_at) VALUES(?,?,?,'new',1,?,?)",
      [
        entry.requestId,
        createHash('sha256')
          .update(JSON.stringify(parseEnquiry(entry)))
          .digest('hex'),
        json,
        '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z',
      ],
    );
  }
  applySqliteMigrations(sql, FAUNAPOOLEN_MIGRATIONS, options);
  native.close();
  fs.chmodSync(databasePath, 0o600);
  const db = openFaunapoolenDatabase({ operationalRoot: root, databasePath });
  try {
    const service = createEnquiryService({ database: db.sqlite, secret });
    assert.equal(service.customers().length, 1);
    assert.equal(service.list().length, 2);
    assert.ok(service.list().every((e) => e.notification.state === 'historical'));
    service.submit(first);
    assert.equal(service.list().length, 2);
    assert.equal(db.sqlite.get('SELECT count(*) AS n FROM enquiry_notifications')?.['n'], 0);
  } finally {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
