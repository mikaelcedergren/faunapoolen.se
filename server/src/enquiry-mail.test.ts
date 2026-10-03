import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { openFaunapoolenDatabase } from './database.js';
import { createEnquiryService } from './enquiry-service.js';
import { createEnquiryMailWorker, enquiryMailConfiguration } from './enquiry-mail.js';

function fixture(t: TestContext) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fauna-mail-')));
  const db = openFaunapoolenDatabase({
    operationalRoot: root,
    databasePath: path.join(root, 'synthetic.db'),
  });
  t.after(() => {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  let clock = 1_800_000_000_000;
  const service = createEnquiryService({
    database: db.sqlite,
    secret: 'synthetic-mail-test-secret',
    now: () => clock,
  });
  const id = randomUUID();
  service.submit({
    requestId: id,
    email: 'visitor@example.test',
    formVersion: 'test-v1',
    fields: [{ id: 'message', label: 'My message', value: 'A synthetic garden' }],
  });
  const worker = (fetcher: typeof fetch, scope = 'test') =>
    createEnquiryMailWorker({
      database: db.sqlite,
      configuration: { apiKey: 'synthetic-key', recipient: 'owner@example.test' },
      executionScope: scope,
      appOrigin: 'https://example.test',
      fetcher,
      now: () => clock,
    });
  return {
    db,
    service,
    id,
    worker,
    advance: () => {
      clock += 3_600_000;
    },
    status: () => service.list()[0]!.notification,
  };
}
test('notifications are scoped and a saved receipt prevents a second send', async (t) => {
  const f = fixture(t);
  let count = 0;
  const send: typeof fetch = async (url, init) => {
    count++;
    assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
    const body = JSON.parse(String(init?.body));
    assert.equal(body.to[0].email, 'owner@example.test');
    assert.equal(body.replyTo.email, 'visitor@example.test');
    assert.equal(body.sender.email, 'michael@wargr.com');
    assert.match(body.textContent, /My message\nA synthetic garden/);
    assert.match(body.htmlContent, />View customer<\/a>/);
    assert.match(body.textContent, /\/en\/admin\/customers\/\?customer=/);
    assert.equal(body.headers.idempotencyKey, f.id);
    return Response.json({ messageId: 'synthetic-provider-receipt' }, { status: 201 });
  };
  await f.worker(send, 'production').runOnce();
  assert.equal(count, 0);
  const worker = f.worker(send);
  await Promise.all([worker.runOnce(), worker.runOnce(), f.worker(send).runOnce()]);
  await f.worker(send).runOnce();
  assert.equal(count, 1);
  assert.equal(f.status().state, 'sent');
  assert.equal(f.status().messageId, 'synthetic-provider-receipt');
});
test('explicit quota refusals retry later; permanent refusals need manual retry', async (t) => {
  const f = fixture(t);
  let calls = 0;
  const worker = f.worker(async () => {
    calls++;
    return new Response('', { status: 429 });
  });
  await worker.runOnce();
  assert.equal(f.status().state, 'queued');
  await worker.runOnce();
  assert.equal(calls, 1);
  f.advance();
  await f.worker(async () => Response.json({ code: 'unauthorized' }, { status: 401 })).runOnce();
  assert.equal(f.status().state, 'failed');
  const revision = f.status().revision;
  assert.throws(
    () => f.service.retryNotification(f.id, { expectedRevision: revision - 1 }),
    /changed/,
  );
  f.service.retryNotification(f.id, { expectedRevision: revision });
  assert.equal(f.status().state, 'queued');
});
test('timeouts, duplicate responses and interrupted claims stay uncertain after restart', async (t) => {
  const f = fixture(t);
  await f
    .worker(async () => {
      throw new Error('synthetic timeout');
    })
    .runOnce();
  assert.equal(f.status().state, 'uncertain');
  assert.throws(
    () => f.service.retryNotification(f.id, { expectedRevision: f.status().revision }),
    /safely/,
  );
  let sent = false;
  await f
    .worker(async () => {
      sent = true;
      return Response.json({ messageId: 'bad' });
    })
    .runOnce();
  assert.equal(sent, false);
  f.db.sqlite.run(
    "UPDATE enquiry_notifications SET state='sending',lease_until=0 WHERE enquiry_id=?",
    [f.id],
  );
  await f
    .worker(async () => {
      throw new Error('should not send');
    })
    .runOnce();
  assert.equal(f.status().state, 'uncertain');
  f.db.sqlite.run("UPDATE enquiry_notifications SET state='queued' WHERE enquiry_id=?", [f.id]);
  await f
    .worker(async () => Response.json({ code: 'duplicate_parameter' }, { status: 400 }))
    .runOnce();
  assert.equal(f.status().state, 'uncertain');
});
test('email configuration is explicitly enabled and independent of campaign generation', () => {
  assert.equal(enquiryMailConfiguration({ BREVO_API_KEY: 'synthetic' }), undefined);
  assert.throws(() => enquiryMailConfiguration({ ENQUIRY_EMAIL_ENABLED: '1' }), /BREVO_API_KEY/);
  assert.throws(
    () =>
      enquiryMailConfiguration({
        ENQUIRY_EMAIL_ENABLED: '1',
        BREVO_API_KEY: 'synthetic',
        COMPANY_EMAIL: 'bad',
      }),
    /COMPANY_EMAIL/,
  );
  assert.deepEqual(
    enquiryMailConfiguration({
      ENQUIRY_EMAIL_ENABLED: '1',
      BREVO_API_KEY: 'synthetic',
      COMPANY_EMAIL: 'owner@example.test',
      CAMPAIGN_GENERATION_ENABLED: '0',
    }),
    { apiKey: 'synthetic', recipient: 'owner@example.test' },
  );
});

test('a provider receipt followed by a local save failure never triggers an automatic second send', async (t) => {
  const f = fixture(t);
  let calls = 0;
  const send: typeof fetch = async () => {
    calls++;
    return Response.json({ messageId: 'synthetic-receipt' });
  };
  f.db.sqlite.run(
    "CREATE TRIGGER synthetic_receipt_failure BEFORE UPDATE OF message_id ON enquiry_notifications WHEN NEW.message_id IS NOT NULL BEGIN SELECT RAISE(ABORT,'synthetic disk failure'); END",
  );
  await assert.rejects(f.worker(send).runOnce(), /synthetic disk failure/);
  assert.equal(f.status().state, 'sending');
  f.advance();
  await f.worker(send).runOnce();
  assert.equal(f.status().state, 'uncertain');
  assert.equal(calls, 1);
  f.service.resolveNotification(f.id, { expectedRevision: f.status().revision, outcome: 'sent' });
  assert.equal(f.status().state, 'sent');
});
