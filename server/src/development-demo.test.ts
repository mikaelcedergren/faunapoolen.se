import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { openFaunapoolenDatabase, verifyFaunapoolenDatabaseBeforeWrite } from './database.js';
import { seedDevelopmentDemo, demoId, type DemoMedia } from './development-demo.js';
import { createCampaignRepository } from './campaign-repository.js';
import { createSocialService } from './social-service.js';
import { createEnquiryService } from './enquiry-service.js';

// Synthetic bytes only; tests never read local photos or an operational database.
const media: DemoMedia = {
  bytes: Buffer.from('synthetic-image'),
  metadata: {
    sha256: 'a'.repeat(64),
    kind: 'image',
    name: 'synthetic.jpg',
    type: 'image/jpeg',
    bytes: 15,
    width: 1200,
    height: 900,
    duration: 0,
  },
};
test('local design fixtures persist after reopen and repeated setup preserves edits without work or email jobs', (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'fauna-demo-test-')));
  const options = { operationalRoot: root, databasePath: join(root, 'synthetic.db') };
  let db = openFaunapoolenDatabase(options);
  t.after(() => {
    db.close();
    rmSync(root, { recursive: true, force: true });
  });
  assert.deepEqual(seedDevelopmentDemo(db.sqlite, [media, media]), {
    enquiries: 8,
    campaigns: 4,
    posts: 4,
  });
  const enquiries = createEnquiryService({
    database: db.sqlite,
    secret: 'synthetic-demo-test-secret',
  });
  assert.equal(enquiries.customers().length, 6);
  const campaignRepo = createCampaignRepository(db.sqlite);
  assert.deepEqual(
    new Set(campaignRepo.list().map((c) => c.stage)),
    new Set(['strategy', 'copy', 'complete']),
  );
  campaignRepo.updateCopy({
    campaignId: demoId(2, 2),
    expectedRevision: 1,
    language: 'en',
    field: 'headline',
    value: 'My locally edited headline',
  });
  const social = createSocialService(db.sqlite);
  const post = social.get(demoId(3, 0));
  social.update(post.id, post.revision, {
    name: 'My locally edited post',
    text: post.text,
    variants: post.variants,
  });
  const customer = enquiries.customers().find((c) => c.status === 'lead')!;
  enquiries.updateCustomer(customer.id, {
    status: 'customer',
    expectedRevision: customer.revision,
  });
  db.close();
  db = openFaunapoolenDatabase({
    ...options,
    requireExisting: true,
    verifyBeforeWrite: verifyFaunapoolenDatabaseBeforeWrite,
  });
  assert.deepEqual(seedDevelopmentDemo(db.sqlite, [media, media]), {
    enquiries: 0,
    campaigns: 0,
    posts: 0,
  });
  assert.equal(
    createCampaignRepository(db.sqlite).get(demoId(2, 2))!.record.copy.en!.headline,
    'My locally edited headline',
  );
  const reopenedSocial = createSocialService(db.sqlite);
  assert.equal(reopenedSocial.get(post.id).name, 'My locally edited post');
  assert.deepEqual(reopenedSocial.media(post.id), media.bytes);
  assert.deepEqual(reopenedSocial.list().find((p) => p.id === demoId(3, 3))!.published, [
    'facebook',
    'instagram',
  ]);
  assert.equal(
    createEnquiryService({ database: db.sqlite, secret: 'synthetic-demo-test-secret' })
      .customers()
      .find((c) => c.id === customer.id)!.status,
    'customer',
  );
  assert.equal(db.sqlite.get('SELECT count(*) AS n FROM enquiry_notifications')?.n, 0);
  assert.equal(db.sqlite.get('SELECT count(*) AS n FROM generation_runs')?.n, 0);
  assert.equal(db.sqlite.get('SELECT count(*) AS n FROM provider_effects')?.n, 0);
});
