import assert from 'node:assert/strict';
import {
  lstat,
  link,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  createCampaignId,
  createCampaignStore,
  isCampaignId,
  MAX_CAMPAIGNS,
} from '../../server/campaign-store.mjs';
import {
  CURRENT_CAMPAIGN_IDS,
  currentCampaign,
  currentCopy,
} from '../fixtures/current-campaigns.mjs';

async function temporaryDirectory(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'faunapoolen-current-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function writeJson(directory, filenameId, value) {
  const file = path.join(directory, `${filenameId}.json`);
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  return file;
}

test('current campaign writer persists every reachable stage and partial-copy shape verbatim', async (t) => {
  const directory = await temporaryDirectory(t);
  const store = createCampaignStore({ directory });
  const records = [
    currentCampaign({ id: CURRENT_CAMPAIGN_IDS.strategy, stage: 'strategy' }),
    currentCampaign({ id: CURRENT_CAMPAIGN_IDS.copy, stage: 'copy' }),
    currentCampaign({ id: CURRENT_CAMPAIGN_IDS.complete, stage: 'complete' }),
    currentCampaign({
      id: CURRENT_CAMPAIGN_IDS.partial,
      stage: 'copy',
      copy: { sv: currentCopy('sv') },
    }),
    currentCampaign({
      id: '88888888-8888-4888-8888-888888888888',
      stage: 'complete',
      copy: {},
    }),
    currentCampaign({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      stage: 'complete',
      copy: { en: currentCopy('en') },
    }),
    currentCampaign({
      id: '99999999-9999-4999-8999-999999999999',
      stage: 'copy',
      imagePrompts: currentCampaign({ stage: 'complete' }).imagePrompts,
    }),
  ];

  for (const record of records) await store.save(structuredClone(record));
  assert.equal(await store.size(), records.length);

  const reopened = createCampaignStore({ directory });
  for (const expected of records) {
    assert.deepEqual(await reopened.get(expected.id), expected);
  }
  assert.deepEqual(
    (await reopened.list()).map((entry) => Object.keys(entry)),
    records.map(() => ['id', 'name', 'createdAt', 'idea', 'stage']),
  );
});

test('current save is atomic-looking JSON but deliberately target-changing mode and validation stay visible', async (t) => {
  const directory = await temporaryDirectory(t);
  const store = createCampaignStore({ directory });
  const campaign = currentCampaign();
  await store.save(campaign);

  const paths = await readdir(directory);
  assert.deepEqual(paths, [`${campaign.id}.json`]);
  assert.deepEqual(JSON.parse(await readFile(path.join(directory, paths[0]), 'utf8')), campaign);
  assert.equal((await stat(path.join(directory, paths[0]))).mode & 0o777, 0o644);

  const permissive = { id: createCampaignId(), arbitrary: { nested: true } };
  await store.save(permissive);
  assert.deepEqual(await store.get(permissive.id), permissive);

  // Phase 7 intentionally replaces permissive writes and 0644 files with validated records and
  // hardened 0600 storage; this assertion documents the legacy source, not the target contract.
  assert.equal(isCampaignId(permissive.id), true);
});

test('current list is newest-first while open, delete, and invalid ids retain their exact semantics', async (t) => {
  const directory = await temporaryDirectory(t);
  const store = createCampaignStore({ directory });
  const oldest = currentCampaign({
    id: CURRENT_CAMPAIGN_IDS.strategy,
    createdAt: '2026-01-01T00:00:00.000Z',
    name: 'Oldest',
  });
  const newest = currentCampaign({
    id: CURRENT_CAMPAIGN_IDS.complete,
    createdAt: '2026-03-01T00:00:00.000Z',
    name: 'Newest',
  });
  await store.save(oldest);
  await store.save(newest);
  assert.deepEqual(
    (await store.list()).map((entry) => entry.name),
    ['Newest', 'Oldest'],
  );
  assert.equal(await store.get('not-a-uuid'), undefined);
  assert.equal(await store.remove('not-a-uuid'), false);
  assert.equal(await store.remove(oldest.id), true);
  assert.equal(await store.remove(oldest.id), false);
  assert.equal(await lstat(path.join(directory, `${newest.id}.json`)).then(() => true), true);
});

test('deliberate target change: current capacity silently evicts and deletes the oldest campaign', async (t) => {
  assert.equal(MAX_CAMPAIGNS, 200);
  const directory = await temporaryDirectory(t);
  const store = createCampaignStore({ directory, maxCampaigns: 2 });
  const oldest = currentCampaign({
    id: CURRENT_CAMPAIGN_IDS.strategy,
    createdAt: '2026-01-01T00:00:00.000Z',
    name: 'Oldest',
  });
  const middle = currentCampaign({
    id: CURRENT_CAMPAIGN_IDS.copy,
    createdAt: '2026-02-01T00:00:00.000Z',
    name: 'Middle',
  });
  const newest = currentCampaign({
    id: CURRENT_CAMPAIGN_IDS.complete,
    createdAt: '2026-03-01T00:00:00.000Z',
    name: 'Newest',
  });
  await store.save(oldest);
  await store.save(middle);
  await store.save(newest);
  assert.equal(await store.size(), 2);
  assert.equal(await store.get(oldest.id), undefined);
  assert.equal(
    await lstat(path.join(directory, `${oldest.id}.json`)).then(
      () => true,
      () => false,
    ),
    false,
  );
  assert.deepEqual(
    (await store.list()).map((entry) => entry.name),
    ['Newest', 'Middle'],
  );
  // The SQLite target intentionally refuses at capacity rather than retaining this data-loss rule.
});

test('deliberate target change: current loader skips corrupt, invalid-name, invalid-id, and special entries', async (t) => {
  const directory = await temporaryDirectory(t);
  await writeFile(
    path.join(directory, `${CURRENT_CAMPAIGN_IDS.strategy}.json`),
    '{ broken',
    'utf8',
  );
  await writeJson(directory, 'not-a-campaign-id', currentCampaign());
  await writeJson(directory, CURRENT_CAMPAIGN_IDS.copy, { id: 'not-an-id', name: 'Invalid' });
  await mkdir(path.join(directory, `${CURRENT_CAMPAIGN_IDS.complete}.json`));
  await writeFile(path.join(directory, 'notes.txt'), 'ignored', 'utf8');

  const store = createCampaignStore({ directory });
  assert.deepEqual(await store.list(), []);
  assert.equal(await store.size(), 0);
  // The atomic importer intentionally turns every one of these skips into an all-or-nothing error.
});

test('deliberate target change: current loader follows linked campaign files inside synthetic roots', async (t) => {
  const root = await temporaryDirectory(t);
  const directory = path.join(root, 'campaigns');
  const outside = path.join(root, 'outside');
  await mkdir(directory);
  await mkdir(outside);
  const campaign = currentCampaign({ id: CURRENT_CAMPAIGN_IDS.strategy });
  const outsideFile = await writeJson(outside, CURRENT_CAMPAIGN_IDS.strategy, campaign);
  await symlink(outsideFile, path.join(directory, `${CURRENT_CAMPAIGN_IDS.strategy}.json`));
  const hardlinkedCampaign = currentCampaign({ id: CURRENT_CAMPAIGN_IDS.copy, stage: 'copy' });
  const outsideHardlinkSource = await writeJson(
    outside,
    CURRENT_CAMPAIGN_IDS.copy,
    hardlinkedCampaign,
  );
  const hardlink = path.join(directory, `${CURRENT_CAMPAIGN_IDS.copy}.json`);
  await link(outsideHardlinkSource, hardlink);

  const store = createCampaignStore({ directory });
  assert.deepEqual(await store.get(campaign.id), campaign);
  assert.deepEqual(await store.get(hardlinkedCampaign.id), hardlinkedCampaign);
  assert.equal((await lstat(path.join(directory, `${campaign.id}.json`))).isSymbolicLink(), true);
  assert.equal((await lstat(hardlink)).nlink, 2);
  // Phase 7 intentionally rejects linked input before target creation.
});

test('current mismatched filename/content ids load under the content id and removal leaves source behind', async (t) => {
  const directory = await temporaryDirectory(t);
  const mismatched = currentCampaign({ id: CURRENT_CAMPAIGN_IDS.mismatchRecord });
  await writeJson(directory, CURRENT_CAMPAIGN_IDS.mismatchFile, mismatched);

  const store = createCampaignStore({ directory });
  assert.equal(await store.get(CURRENT_CAMPAIGN_IDS.mismatchFile), undefined);
  assert.deepEqual(await store.get(CURRENT_CAMPAIGN_IDS.mismatchRecord), mismatched);
  assert.equal(await store.remove(CURRENT_CAMPAIGN_IDS.mismatchRecord), true);
  assert.equal(
    await lstat(path.join(directory, `${CURRENT_CAMPAIGN_IDS.mismatchFile}.json`)).then(
      () => true,
      () => false,
    ),
    true,
  );
  assert.deepEqual(
    await createCampaignStore({ directory }).get(CURRENT_CAMPAIGN_IDS.mismatchRecord),
    mismatched,
  );
});

test('current duplicate internal ids collapse nondeterministically in memory while both files survive', async (t) => {
  const directory = await temporaryDirectory(t);
  const first = currentCampaign({
    id: CURRENT_CAMPAIGN_IDS.mismatchRecord,
    name: 'First physical file',
  });
  const second = currentCampaign({
    id: CURRENT_CAMPAIGN_IDS.mismatchRecord,
    name: 'Second physical file',
  });
  await writeJson(directory, CURRENT_CAMPAIGN_IDS.mismatchFile, first);
  await writeJson(directory, CURRENT_CAMPAIGN_IDS.duplicateFile, second);

  const store = createCampaignStore({ directory });
  assert.equal(await store.size(), 1);
  assert.ok(['First physical file', 'Second physical file'].includes((await store.list())[0].name));
  assert.equal((await readdir(directory)).length, 2);
  // The importer intentionally rejects this ambiguity instead of choosing filesystem iteration order.
});

test('current storage root and save failures reject without touching any operational directory', async (t) => {
  const root = await temporaryDirectory(t);
  const fileAsDirectory = path.join(root, 'campaign-root-is-a-file');
  await writeFile(fileAsDirectory, 'synthetic', { mode: 0o600 });
  const brokenStore = createCampaignStore({ directory: fileAsDirectory });
  await assert.rejects(() => brokenStore.list(), /EEXIST|ENOTDIR/);

  assert.throws(() => createCampaignStore({ directory: root, maxCampaigns: 0 }), {
    name: 'TypeError',
    message: 'maxCampaigns must be a positive integer.',
  });
  const store = createCampaignStore({ directory: path.join(root, 'valid') });
  await assert.rejects(() => store.save({ id: '../../outside' }), /Invalid campaign id/);
});

test('deliberate target change: current failed rename leaves its predictable staging file', async (t) => {
  const directory = await temporaryDirectory(t);
  const campaign = currentCampaign();
  await mkdir(path.join(directory, `${campaign.id}.json`));
  const store = createCampaignStore({ directory });
  await assert.rejects(() => store.save(campaign), /EISDIR|ENOTDIR|EEXIST/);
  assert.deepEqual((await readdir(directory)).sort(), [
    `${campaign.id}.json`,
    `${campaign.id}.json.${String(process.pid)}.tmp`,
  ]);
  // The target importer uses exclusive owned staging plus verified cleanup and never leaves this.
});
