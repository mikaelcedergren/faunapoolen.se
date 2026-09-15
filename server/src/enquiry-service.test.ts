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
    assert.equal(service.list()[0]?.notes, enquiry.notes);
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
