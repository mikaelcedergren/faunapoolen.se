import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import {
  CAMPAIGN_ROOT_FIELDS,
  CAMPAIGN_STAGES,
  COPY_FIELDS,
  COPY_FIELD_IDS,
  IMAGE_CONCEPTS,
  IMAGE_PROMPT_FIELDS,
  MARKETING_RULE_IDS,
  PERMISSIVE_READER_ONLY_CASES,
  REACHABLE_CAMPAIGNS,
  STRATEGY_FIELDS,
  WRITER_LIMITS,
  campaignId,
  campaignRecord,
  cloneRecord,
  maximalCampaignRecord,
  ownerEditedCopy,
  validCopy,
  validImagePrompts,
  writerBytes,
} from '../fixtures/campaign-history-records.mjs';
import {
  assertImportedTarget,
  assertNoTargetArtifacts,
  assertPathSnapshot,
  assertPrivateOwnedDirectory,
  assertPrivateOwnedRegularFile,
  assertSourceTreeSnapshot,
  campaignFileName,
  campaignHash,
  canonicalCampaignBytes,
  capturePath,
  captureSourceTree,
  COMPILED_IMPORTER_PATH,
  discoverImporter,
  entryFromRecord,
  EXPECTED_CHECKPOINTS,
  EXPECTED_LIMITS,
  expectImportError,
  expectedReceipt,
  expectedRows,
  orderedCampaignHash,
  physicalDirectoryHash,
  readImportedTarget,
  recordAt,
  setupImportFixture,
  sha256,
  stagingDirectoryPath,
  targetSidecarPaths,
  writeSourceDirectory,
} from './campaign-import-contract-support.mjs';

const discovery = await discoverImporter();
const importer = discovery.module;
const CONTRACT_SKIP = importer
  ? false
  : `compiled strict TypeScript importer not available at ${COMPILED_IMPORTER_PATH}`;

function contractTest(name, optionsOrHandler, maybeHandler) {
  const options = typeof optionsOrHandler === 'function' ? {} : optionsOrHandler;
  const handler = typeof optionsOrHandler === 'function' ? optionsOrHandler : maybeHandler;
  return test(name, { ...options, skip: CONTRACT_SKIP || options.skip }, handler);
}

async function importSource(databasePath, sourceDirectory) {
  return importer.importCampaignDirectory({ databasePath, sourceDirectory });
}

async function importSourceForTest(databasePath, sourceDirectory, onCheckpoint) {
  return importer.importCampaignDirectoryForTest(
    { databasePath, sourceDirectory },
    Object.freeze({ onCheckpoint }),
  );
}

function validEntries(records = REACHABLE_CAMPAIGNS) {
  return records.map((record) => entryFromRecord(record));
}

function setupValidSource(t, records = REACHABLE_CAMPAIGNS) {
  const fixture = setupImportFixture(t);
  const entries = validEntries(records);
  writeSourceDirectory(fixture.sourceDirectory, entries);
  return { ...fixture, entries };
}

function importerChildEnvironment({
  checkpoint,
  databasePath,
  mode,
  readyPath,
  releasePath,
  sourceDirectory,
}) {
  if (mode !== 'kill' && mode !== 'pause') {
    throw new Error(`Unsupported importer child mode: ${String(mode)}`);
  }
  return Object.freeze({
    FAUNAPOOLEN_CAMPAIGN_DATABASE_PATH: databasePath,
    FAUNAPOOLEN_CAMPAIGN_IMPORTER_PATH: COMPILED_IMPORTER_PATH,
    ...(mode === 'kill'
      ? { FAUNAPOOLEN_CAMPAIGN_KILL_CHECKPOINT: checkpoint }
      : {
          FAUNAPOOLEN_CAMPAIGN_PAUSE_CHECKPOINT: checkpoint,
          FAUNAPOOLEN_CAMPAIGN_READY_PATH: readyPath,
          FAUNAPOOLEN_CAMPAIGN_RELEASE_PATH: releasePath,
        }),
    FAUNAPOOLEN_CAMPAIGN_SOURCE_DIRECTORY: sourceDirectory,
  });
}

function killImporterAtCheckpoint(databasePath, sourceDirectory, checkpoint) {
  const childProgram = String.raw`
    import { pathToFileURL } from 'node:url';
    const importer = await import(pathToFileURL(process.env.FAUNAPOOLEN_CAMPAIGN_IMPORTER_PATH).href);
    await importer.importCampaignDirectoryForTest(
      {
        databasePath: process.env.FAUNAPOOLEN_CAMPAIGN_DATABASE_PATH,
        sourceDirectory: process.env.FAUNAPOOLEN_CAMPAIGN_SOURCE_DIRECTORY,
      },
      {
        onCheckpoint(observed) {
          if (observed === process.env.FAUNAPOOLEN_CAMPAIGN_KILL_CHECKPOINT) {
            process.kill(process.pid, 'SIGKILL');
          }
        },
      },
    );
  `;
  const child = spawnSync(process.execPath, ['--input-type=module', '--eval', childProgram], {
    encoding: 'utf8',
    env: importerChildEnvironment({ checkpoint, databasePath, mode: 'kill', sourceDirectory }),
    timeout: 15_000,
  });
  assert.equal(child.error, undefined, child.error?.message);
  assert.equal(child.signal, 'SIGKILL', child.stderr || child.stdout);
  assert.equal(child.status, null);
}

function startPausedImporter(databasePath, sourceDirectory, checkpoint, readyPath, releasePath) {
  const childProgram = String.raw`
    import fs from 'node:fs';
    import { pathToFileURL } from 'node:url';
    const importer = await import(pathToFileURL(process.env.FAUNAPOOLEN_CAMPAIGN_IMPORTER_PATH).href);
    const waitCell = new Int32Array(new SharedArrayBuffer(4));
    await importer.importCampaignDirectoryForTest(
      {
        databasePath: process.env.FAUNAPOOLEN_CAMPAIGN_DATABASE_PATH,
        sourceDirectory: process.env.FAUNAPOOLEN_CAMPAIGN_SOURCE_DIRECTORY,
      },
      {
        onCheckpoint(observed) {
          if (observed !== process.env.FAUNAPOOLEN_CAMPAIGN_PAUSE_CHECKPOINT) return;
          fs.writeFileSync(process.env.FAUNAPOOLEN_CAMPAIGN_READY_PATH, 'ready', {
            flag: 'wx',
            mode: 0o600,
          });
          const deadline = Date.now() + 15_000;
          while (!fs.existsSync(process.env.FAUNAPOOLEN_CAMPAIGN_RELEASE_PATH)) {
            if (Date.now() >= deadline) throw new Error('Timed out waiting for test release.');
            Atomics.wait(waitCell, 0, 0, 10);
          }
        },
      },
    );
  `;
  const child = spawn(process.execPath, ['--input-type=module', '--eval', childProgram], {
    env: importerChildEnvironment({
      checkpoint,
      databasePath,
      mode: 'pause',
      readyPath,
      releasePath,
      sourceDirectory,
    }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const completion = new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('exit', (status, signal) => resolve({ signal, status, stderr, stdout }));
  });
  return { child, completion };
}

async function waitForPath(filePath, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (!fs.existsSync(filePath)) {
    if (Date.now() >= deadline) assert.fail(`Timed out waiting for ${filePath}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function exactKeys(value, expected) {
  assert.deepEqual(Object.keys(value), expected);
}

function replaceRecordId(record, id) {
  const replacement = cloneRecord(record);
  replacement.id = id;
  return replacement;
}

async function expectRecordRejected(
  t,
  record,
  code = 'invalid_campaign',
  details = {},
  entryOptions = {},
) {
  const fixture = setupImportFixture(t);
  const entry = entryFromRecord(record, entryOptions);
  writeSourceDirectory(fixture.sourceDirectory, [entry]);
  await expectImportError(() => importSource(fixture.databasePath, fixture.sourceDirectory), code, {
    fileName: entry.name,
    ...details,
  });
  assertNoTargetArtifacts(fixture.directory, fixture.databasePath, [
    path.basename(fixture.sourceDirectory),
  ]);
}

function createPartialCampaignDatabase(databasePath, statements) {
  const database = new DatabaseSync(databasePath);
  try {
    database.exec(statements);
  } finally {
    database.close();
  }
  fs.chmodSync(databasePath, 0o600);
}

function stagingTreeModes(stagingDirectory) {
  assertPrivateOwnedDirectory(stagingDirectory);
  return fs.readdirSync(stagingDirectory).map((name) => {
    const entryPath = path.join(stagingDirectory, name);
    const stats = fs.lstatSync(entryPath);
    assert.equal(stats.uid, process.getuid());
    assert.equal(stats.isSymbolicLink(), false);
    if (stats.isDirectory()) assert.equal(stats.mode & 0o777, 0o700);
    if (stats.isFile()) assert.equal(stats.mode & 0o777, 0o600);
    return { name, type: stats.isDirectory() ? 'directory' : 'file' };
  });
}

test('synthetic fixtures freeze the exact legacy root and nested field sets', () => {
  for (const campaign of REACHABLE_CAMPAIGNS) {
    exactKeys(campaign, CAMPAIGN_ROOT_FIELDS);
    exactKeys(campaign.strategy, STRATEGY_FIELDS);
    for (const copy of Object.values(campaign.copy)) exactKeys(copy, COPY_FIELDS);
    for (const prompt of campaign.imagePrompts) exactKeys(prompt, IMAGE_PROMPT_FIELDS);
    assert.equal(campaign.name, campaign.strategy.name);
  }
  assert.deepEqual(COPY_FIELD_IDS, [
    'headline',
    'description',
    'primaryText',
    'fullCaption',
    'callToAction',
    'hashtags',
  ]);
  assert.equal(MARKETING_RULE_IDS.length, 14);
  assert.equal(new Set(MARKETING_RULE_IDS).size, 14);
});

test('fixtures cover every writer-reachable stage, partial-copy, and retry state', () => {
  assert.deepEqual(CAMPAIGN_STAGES, ['strategy', 'copy', 'complete']);
  assert.deepEqual(
    REACHABLE_CAMPAIGNS.map((campaign) => ({
      copies: Object.keys(campaign.copy),
      prompts: campaign.imagePrompts.length,
      stage: campaign.stage,
    })),
    [
      { copies: [], prompts: 0, stage: 'strategy' },
      { copies: ['sv'], prompts: 0, stage: 'copy' },
      { copies: ['en'], prompts: 0, stage: 'copy' },
      { copies: ['sv', 'en'], prompts: 0, stage: 'copy' },
      { copies: [], prompts: 3, stage: 'complete' },
      { copies: ['en'], prompts: 3, stage: 'complete' },
      { copies: ['sv', 'en'], prompts: 3, stage: 'complete' },
      { copies: ['sv'], prompts: 3, stage: 'copy' },
    ],
  );
});

test('owner-edited fields preserve the writer widening without weakening generated-only fields', () => {
  const edited = ownerEditedCopy('en');
  assert.ok([...edited.headline].length > WRITER_LIMITS.generatedCopy.headline);
  assert.ok([...edited.headline].length <= WRITER_LIMITS.storedCopyCharacters);
  assert.equal(edited.fullCaption.startsWith(edited.primaryText), false);
  assert.equal(edited.hashtags.length, WRITER_LIMITS.storedHashtags);
  for (const hashtag of edited.hashtags) {
    assert.ok([...hashtag].length <= WRITER_LIMITS.storedHashtagCharacters);
  }
  assert.equal(edited.variations.headline.length, 3);
  assert.equal(edited.rationale.length, COPY_FIELD_IDS.length);
});

test('the proven writer maxima fit the closed file, count, and aggregate ceilings', () => {
  const maximum = maximalCampaignRecord();
  const maximumBytes = writerBytes(maximum);
  assert.equal(maximumBytes.byteLength, 401_639);
  assert.ok(maximumBytes.byteLength <= EXPECTED_LIMITS.maxFileBytes);
  assert.equal(EXPECTED_LIMITS.maxCampaigns, 200);
  assert.equal(
    EXPECTED_LIMITS.maxAggregateBytes,
    EXPECTED_LIMITS.maxCampaigns * EXPECTED_LIMITS.maxFileBytes,
  );
  assert.equal(EXPECTED_LIMITS.maxAggregateBytes, 100 * 1024 * 1024);
});

test('writer fixture bytes are strict UTF-8 pretty JSON with no trailing residue', () => {
  for (const campaign of REACHABLE_CAMPAIGNS) {
    const bytes = writerBytes(campaign);
    assert.equal(bytes.at(-1), '}'.charCodeAt(0));
    assert.deepEqual(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), campaign);
    assert.equal(campaignFileName(campaign.id), `${campaign.id}.json`);
  }
});

test('physical and semantic receipts are sorted, explicit, and intentionally distinct', () => {
  const campaign = cloneRecord(REACHABLE_CAMPAIGNS[0]);
  const compact = entryFromRecord(campaign, { bytes: Buffer.from(JSON.stringify(campaign)) });
  const pretty = entryFromRecord(campaign);
  assert.notEqual(sha256(compact.bytes), sha256(pretty.bytes));
  assert.equal(campaignHash(compact.record), campaignHash(pretty.record));
  assert.notEqual(physicalDirectoryHash([compact]), physicalDirectoryHash([pretty]));
  assert.equal(orderedCampaignHash([compact]), orderedCampaignHash([pretty]));

  const entries = validEntries(REACHABLE_CAMPAIGNS.slice(0, 3));
  assert.equal(physicalDirectoryHash(entries), physicalDirectoryHash(entries.toReversed()));
  assert.equal(orderedCampaignHash(entries), orderedCampaignHash(entries.toReversed()));
  assert.deepEqual(expectedReceipt([]), {
    campaignCount: 0,
    formatVersion: 1,
    orderedCampaignsSha256: sha256(Buffer.alloc(0)),
    sourceBytes: 0,
    sourceSha256: sha256(Buffer.alloc(0)),
  });
});

test('permissive-reader-only synthetic cases are outside the accepted writer contract', () => {
  assert.equal(PERMISSIVE_READER_ONLY_CASES.length, 4);
  for (const fixtureCase of PERMISSIVE_READER_ONLY_CASES) {
    assert.equal(typeof fixtureCase.record.id, 'string');
    assert.ok(fixtureCase.name.length > 0);
  }
  assert.notEqual(
    PERMISSIVE_READER_ONLY_CASES[1].fileName,
    campaignFileName(PERMISSIVE_READER_ONLY_CASES[1].record.id),
  );
  assert.deepEqual(Object.keys(PERMISSIVE_READER_ONLY_CASES[0].record), ['id']);
  assert.equal(PERMISSIVE_READER_ONLY_CASES[2].record.legacyExtra, true);
  assert.equal(PERMISSIVE_READER_ONLY_CASES[3].record.stage, 'writing');
});

test('fixture snapshots prove directory and file inode, mode, link count, and bytes', (t) => {
  const fixture = setupImportFixture(t);
  const entries = validEntries(REACHABLE_CAMPAIGNS.slice(0, 2));
  writeSourceDirectory(fixture.sourceDirectory, entries, { directoryMode: 0o750, fileMode: 0o640 });
  const snapshot = captureSourceTree(fixture.sourceDirectory);
  assert.equal(snapshot.directory.mode, 0o750);
  assert.deepEqual(
    Object.values(snapshot.entries).map((entry) => entry.mode),
    [0o640, 0o640],
  );
  assertSourceTreeSnapshot(fixture.sourceDirectory, snapshot);
});

test('checkpoints and importer child environments are closed synthetic contracts', () => {
  assert.deepEqual(EXPECTED_CHECKPOINTS, [
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
  const common = {
    checkpoint: 'marker_durable',
    databasePath: '/synthetic/faunapoolen.sqlite',
    sourceDirectory: '/synthetic/campaign-history',
  };
  const killed = importerChildEnvironment({ ...common, mode: 'kill' });
  const paused = importerChildEnvironment({
    ...common,
    mode: 'pause',
    readyPath: '/synthetic/ready',
    releasePath: '/synthetic/release',
  });
  assert.deepEqual(Object.keys(killed).toSorted(), [
    'FAUNAPOOLEN_CAMPAIGN_DATABASE_PATH',
    'FAUNAPOOLEN_CAMPAIGN_IMPORTER_PATH',
    'FAUNAPOOLEN_CAMPAIGN_KILL_CHECKPOINT',
    'FAUNAPOOLEN_CAMPAIGN_SOURCE_DIRECTORY',
  ]);
  assert.deepEqual(Object.keys(paused).toSorted(), [
    'FAUNAPOOLEN_CAMPAIGN_DATABASE_PATH',
    'FAUNAPOOLEN_CAMPAIGN_IMPORTER_PATH',
    'FAUNAPOOLEN_CAMPAIGN_PAUSE_CHECKPOINT',
    'FAUNAPOOLEN_CAMPAIGN_READY_PATH',
    'FAUNAPOOLEN_CAMPAIGN_RELEASE_PATH',
    'FAUNAPOOLEN_CAMPAIGN_SOURCE_DIRECTORY',
  ]);
  for (const forbidden of ['HOME', 'NODE_EXTRA_CA_CERTS', 'NODE_OPTIONS', 'PATH']) {
    assert.equal(killed[forbidden], undefined);
    assert.equal(paused[forbidden], undefined);
  }
  assert.throws(() => importerChildEnvironment({ ...common, mode: 'run' }), /Unsupported/u);
});

test('the compiled strict TypeScript importer exposes the closed migration contract', () => {
  if (!importer) {
    assert.fail(
      `Expected the compiled importer at ${COMPILED_IMPORTER_PATH}. ` +
        'Phase 7 must add server/src/campaign-import.ts and build the server before this contract can run. ' +
        `Discovery failed with: ${discovery.error?.message ?? 'unknown error'}`,
    );
  }
  assert.equal(typeof importer.importCampaignDirectory, 'function');
  assert.equal(typeof importer.importCampaignDirectoryForTest, 'function');
  assert.deepEqual(importer.CAMPAIGN_IMPORT_CHECKPOINTS, EXPECTED_CHECKPOINTS);
  assert.equal(importer.CAMPAIGN_IMPORT_MAX_CAMPAIGNS, EXPECTED_LIMITS.maxCampaigns);
  assert.equal(importer.CAMPAIGN_IMPORT_MAX_FILE_BYTES, EXPECTED_LIMITS.maxFileBytes);
  assert.equal(importer.CAMPAIGN_IMPORT_MAX_AGGREGATE_BYTES, EXPECTED_LIMITS.maxAggregateBytes);
});

contractTest(
  'every structurally reachable campaign imports with exact reopened SQLite parity',
  async (t) => {
    const fixture = setupValidSource(t);
    const sourceBefore = captureSourceTree(fixture.sourceDirectory);

    const receipt = await importSource(fixture.databasePath, fixture.sourceDirectory);

    assert.deepEqual(receipt, expectedReceipt(fixture.entries));
    const target = assertImportedTarget(fixture.databasePath, fixture.entries);
    assert.deepEqual(target.campaigns, expectedRows(fixture.entries));
    assertSourceTreeSnapshot(fixture.sourceDirectory, sourceBefore);
  },
);

contractTest('empty campaign history imports as one sealed zero-record receipt', async (t) => {
  const fixture = setupImportFixture(t);
  writeSourceDirectory(fixture.sourceDirectory, []);
  const sourceBefore = captureSourceTree(fixture.sourceDirectory);

  const receipt = await importSource(fixture.databasePath, fixture.sourceDirectory);

  assert.deepEqual(receipt, expectedReceipt([]));
  assertImportedTarget(fixture.databasePath, []);
  assertSourceTreeSnapshot(fixture.sourceDirectory, sourceBefore);
});

contractTest(
  'filename order defines explicit campaign_sequence and both sorted aggregate hashes',
  async (t) => {
    const records = [REACHABLE_CAMPAIGNS[7], REACHABLE_CAMPAIGNS[0], REACHABLE_CAMPAIGNS[3]];
    const fixture = setupValidSource(t, records);

    await importSource(fixture.databasePath, fixture.sourceDirectory);

    const target = assertImportedTarget(fixture.databasePath, fixture.entries);
    assert.deepEqual(
      target.campaigns.map(({ id, campaignSequence, sourceFilename }) => ({
        id,
        campaignSequence,
        sourceFilename,
      })),
      expectedRows(fixture.entries).map(({ id, campaignSequence, sourceFilename }) => ({
        id,
        campaignSequence,
        sourceFilename,
      })),
    );
  },
);

contractTest(
  'physical JSON spelling changes exact hashes without changing semantic hashes',
  async (t) => {
    const record = cloneRecord(REACHABLE_CAMPAIGNS[0]);
    const reordered = Object.fromEntries(Object.entries(record).toReversed());
    const entries = [
      entryFromRecord(record, {
        bytes: Buffer.from(`  ${JSON.stringify(reordered)}\n`, 'utf8'),
      }),
    ];
    const fixture = setupImportFixture(t);
    writeSourceDirectory(fixture.sourceDirectory, entries);

    await importSource(fixture.databasePath, fixture.sourceDirectory);

    const target = assertImportedTarget(fixture.databasePath, entries);
    assert.equal(target.campaigns[0].sourceSha256, sha256(entries[0].bytes));
    assert.equal(target.campaigns[0].recordSha256, campaignHash(record));
    assert.notEqual(target.campaigns[0].sourceSha256, target.campaigns[0].recordSha256);
  },
);

contractTest(
  'the conservative maximal writer-shaped campaign imports below the file ceiling',
  async (t) => {
    const maximum = maximalCampaignRecord();
    const fixture = setupValidSource(t, [maximum]);
    assert.equal(fixture.entries[0].bytes.byteLength, 401_639);

    await importSource(fixture.databasePath, fixture.sourceDirectory);

    assertImportedTarget(fixture.databasePath, fixture.entries);
  },
);

contractTest(
  'the exact 200-campaign writer cap succeeds and the 201st blocks all writes',
  { timeout: 60_000 },
  async (t) => {
    const template = REACHABLE_CAMPAIGNS[0];
    const exactRecords = Array.from({ length: EXPECTED_LIMITS.maxCampaigns }, (_, index) =>
      recordAt(index + 1_000, template),
    );

    await t.test('exact cap', async (t) => {
      const fixture = setupValidSource(t, exactRecords);
      await importSource(fixture.databasePath, fixture.sourceDirectory);
      assertImportedTarget(fixture.databasePath, fixture.entries);
    });

    await t.test('one over cap', async (t) => {
      const fixture = setupValidSource(t, [
        ...exactRecords,
        recordAt(EXPECTED_LIMITS.maxCampaigns + 1_000, template),
      ]);
      await expectImportError(
        () => importSource(fixture.databasePath, fixture.sourceDirectory),
        'too_many_campaigns',
      );
      assertNoTargetArtifacts(fixture.directory, fixture.databasePath, [
        path.basename(fixture.sourceDirectory),
      ]);
    });
  },
);

contractTest(
  'a physical file above 512 KiB and aggregate overflow fail before target creation',
  async (t) => {
    await t.test('file ceiling', async (t) => {
      const fixture = setupImportFixture(t);
      const record = cloneRecord(REACHABLE_CAMPAIGNS[0]);
      const bytes = Buffer.alloc(EXPECTED_LIMITS.maxFileBytes + 1, 0x20);
      const entries = [entryFromRecord(record, { bytes })];
      writeSourceDirectory(fixture.sourceDirectory, entries);
      await expectImportError(
        () => importSource(fixture.databasePath, fixture.sourceDirectory),
        'campaign_too_large',
        { fileName: entries[0].name },
      );
      assertNoTargetArtifacts(fixture.directory, fixture.databasePath, [
        path.basename(fixture.sourceDirectory),
      ]);
    });

    await t.test('aggregate ceiling is exported as count times file ceiling', () => {
      assert.equal(
        importer.CAMPAIGN_IMPORT_MAX_AGGREGATE_BYTES,
        importer.CAMPAIGN_IMPORT_MAX_CAMPAIGNS * importer.CAMPAIGN_IMPORT_MAX_FILE_BYTES,
      );
    });
  },
);

contractTest(
  'owner-edited widened fields import without normalizing them back to model budgets',
  async (t) => {
    const record = campaignRecord({
      id: campaignId(40),
      stage: 'copy',
      copy: { en: ownerEditedCopy('en') },
      updatedAt: '2026-08-02T01:02:03.004Z',
    });
    const fixture = setupValidSource(t, [record]);

    await importSource(fixture.databasePath, fixture.sourceDirectory);

    const target = assertImportedTarget(fixture.databasePath, fixture.entries);
    assert.deepEqual(target.campaigns[0].record.copy.en, record.copy.en);
  },
);

contractTest(
  'escaped lone surrogates remain exact writer data while invalid raw UTF-8 fails',
  async (t) => {
    await t.test('escaped surrogate', async (t) => {
      const record = campaignRecord({
        id: campaignId(41),
        idea: 'A valid idea containing an escaped lone surrogate: \ud800',
      });
      const fixture = setupValidSource(t, [record]);
      await importSource(fixture.databasePath, fixture.sourceDirectory);
      assertImportedTarget(fixture.databasePath, fixture.entries);
    });

    await t.test('invalid UTF-8', async (t) => {
      const fixture = setupImportFixture(t);
      const record = REACHABLE_CAMPAIGNS[0];
      const entry = entryFromRecord(record, { bytes: Buffer.from([0x7b, 0xc3, 0x28, 0x7d]) });
      writeSourceDirectory(fixture.sourceDirectory, [entry]);
      await expectImportError(
        () => importSource(fixture.databasePath, fixture.sourceDirectory),
        'invalid_utf8',
        { fileName: entry.name },
      );
      assertNoTargetArtifacts(fixture.directory, fixture.databasePath, [
        path.basename(fixture.sourceDirectory),
      ]);
    });
  },
);

contractTest(
  'malformed JSON and every non-object JSON value fail before target creation',
  async (t) => {
    const record = REACHABLE_CAMPAIGNS[0];
    const cases = [
      ['malformed', Buffer.from('{not json')],
      ['null', Buffer.from('null')],
      ['array', Buffer.from('[]')],
      ['string', Buffer.from('"campaign"')],
      ['number', Buffer.from('42')],
      ['boolean', Buffer.from('true')],
      ['bom', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), writerBytes(record)])],
    ];
    for (const [name, bytes] of cases) {
      await t.test(name, async (t) => {
        const fixture = setupImportFixture(t);
        const entry = entryFromRecord(record, { bytes });
        writeSourceDirectory(fixture.sourceDirectory, [entry]);
        await expectImportError(
          () => importSource(fixture.databasePath, fixture.sourceDirectory),
          name === 'malformed' ? 'invalid_json' : 'invalid_campaign',
          { fileName: entry.name },
        );
        assertNoTargetArtifacts(fixture.directory, fixture.databasePath, [
          path.basename(fixture.sourceDirectory),
        ]);
      });
    }
  },
);

contractTest('plain and escaped-equivalent duplicate JSON keys fail as ambiguous', async (t) => {
  const record = REACHABLE_CAMPAIGNS[0];
  const canonical = JSON.stringify(record);
  const cases = [
    canonical.replace(`"id":"${record.id}"`, `"id":"${record.id}","id":"${campaignId(50)}"`),
    canonical.replace(`"id":"${record.id}"`, `"id":"${record.id}","i\\u0064":"${campaignId(50)}"`),
  ];
  for (const bytes of cases.map((source) => Buffer.from(source))) {
    const fixture = setupImportFixture(t);
    const entry = entryFromRecord(record, { bytes });
    writeSourceDirectory(fixture.sourceDirectory, [entry]);
    await expectImportError(
      () => importSource(fixture.databasePath, fixture.sourceDirectory),
      'duplicate_key',
      { fileName: entry.name, field: 'id' },
    );
    assertNoTargetArtifacts(fixture.directory, fixture.databasePath, [
      path.basename(fixture.sourceDirectory),
    ]);
  }
});

contractTest('UUID filenames are lowercase, exact, and identical to the campaign id', async (t) => {
  const record = replaceRecordId(
    cloneRecord(REACHABLE_CAMPAIGNS[0]),
    'abcdefab-cdef-4abc-8def-abcdefabcdef',
  );
  const cases = [
    {
      code: 'invalid_filename',
      entry: entryFromRecord(record, { name: `${record.id.toUpperCase()}.json` }),
      name: 'uppercase UUID filename',
    },
    {
      code: 'invalid_filename',
      entry: entryFromRecord(record, { name: `${record.id}.JSON` }),
      name: 'uppercase extension',
    },
    {
      code: 'invalid_filename',
      entry: entryFromRecord(record, { name: record.id }),
      name: 'missing extension',
    },
    {
      code: 'filename_id_mismatch',
      entry: entryFromRecord(record, { name: campaignFileName(campaignId(60)) }),
      name: 'different valid filename UUID',
    },
    {
      code: 'invalid_campaign',
      entry: entryFromRecord(replaceRecordId(record, 'not-a-uuid'), {
        name: campaignFileName(record.id),
      }),
      name: 'invalid content UUID',
    },
    {
      code: 'invalid_campaign',
      entry: entryFromRecord(replaceRecordId(record, record.id.toUpperCase()), {
        name: campaignFileName(record.id),
      }),
      name: 'uppercase content UUID',
    },
  ];

  for (const fixtureCase of cases) {
    await t.test(fixtureCase.name, async (t) => {
      const fixture = setupImportFixture(t);
      writeSourceDirectory(fixture.sourceDirectory, [fixtureCase.entry]);
      await expectImportError(
        () => importSource(fixture.databasePath, fixture.sourceDirectory),
        fixtureCase.code,
        { fileName: fixtureCase.entry.name },
      );
      assertNoTargetArtifacts(fixture.directory, fixture.databasePath, [
        path.basename(fixture.sourceDirectory),
      ]);
    });
  }
});

contractTest(
  'a duplicate content id cannot bypass the filename-content identity invariant',
  async (t) => {
    const first = cloneRecord(REACHABLE_CAMPAIGNS[0]);
    const secondName = campaignFileName(campaignId(61));
    const entries = [entryFromRecord(first), entryFromRecord(first, { name: secondName })];
    const fixture = setupImportFixture(t);
    writeSourceDirectory(fixture.sourceDirectory, entries);

    await expectImportError(
      () => importSource(fixture.databasePath, fixture.sourceDirectory),
      'filename_id_mismatch',
      { fileName: secondName },
    );
    assertNoTargetArtifacts(fixture.directory, fixture.databasePath, [
      path.basename(fixture.sourceDirectory),
    ]);
  },
);

contractTest('root fields are an exact closed schema with JSON-native value types', async (t) => {
  const base = cloneRecord(REACHABLE_CAMPAIGNS[0]);
  const cases = [];
  for (const field of CAMPAIGN_ROOT_FIELDS) {
    const record = cloneRecord(base);
    delete record[field];
    cases.push({ field, name: `missing ${field}`, record });
  }
  cases.push({
    field: 'legacyExtra',
    name: 'unknown root field',
    record: { ...cloneRecord(base), legacyExtra: true },
  });
  for (const [field, value] of [
    ['createdAt', 1],
    ['updatedAt', null],
    ['idea', ['idea']],
    ['name', { text: base.name }],
    ['stage', 1],
    ['strategy', null],
    ['copy', []],
    ['imagePrompts', {}],
  ]) {
    const record = cloneRecord(base);
    record[field] = value;
    cases.push({ field, name: `wrong ${field} type`, record });
  }

  for (const fixtureCase of cases) {
    await t.test(fixtureCase.name, (t) =>
      expectRecordRejected(
        t,
        fixtureCase.record,
        'invalid_campaign',
        {
          field: fixtureCase.field,
        },
        fixtureCase.name === 'missing id' ? { name: campaignFileName(base.id) } : {},
      ),
    );
  }
});

contractTest('strategy, copy, and prompt objects reject missing and unknown fields', async (t) => {
  const base = cloneRecord(REACHABLE_CAMPAIGNS[6]);
  const cases = [];

  for (const field of STRATEGY_FIELDS) {
    const record = cloneRecord(base);
    delete record.strategy[field];
    cases.push({ field: `strategy.${field}`, name: `missing strategy ${field}`, record });
  }
  {
    const record = cloneRecord(base);
    record.strategy.legacyExtra = true;
    cases.push({ field: 'strategy.legacyExtra', name: 'extra strategy field', record });
  }
  {
    const record = cloneRecord(base);
    record.copy.fr = validCopy('en');
    cases.push({ field: 'copy.fr', name: 'unknown copy language', record });
  }
  for (const field of COPY_FIELDS) {
    const record = cloneRecord(base);
    delete record.copy.en[field];
    cases.push({ field: `copy.en.${field}`, name: `missing copy ${field}`, record });
  }
  {
    const record = cloneRecord(base);
    record.copy.en.legacyExtra = true;
    cases.push({ field: 'copy.en.legacyExtra', name: 'extra copy field', record });
  }
  for (const field of IMAGE_PROMPT_FIELDS) {
    const record = cloneRecord(base);
    delete record.imagePrompts[0][field];
    cases.push({
      field: `imagePrompts[0].${field}`,
      name: `missing image prompt ${field}`,
      record,
    });
  }
  {
    const record = cloneRecord(base);
    record.imagePrompts[0].legacyExtra = true;
    cases.push({
      field: 'imagePrompts[0].legacyExtra',
      name: 'extra image prompt field',
      record,
    });
  }

  for (const fixtureCase of cases) {
    await t.test(fixtureCase.name, (t) =>
      expectRecordRejected(t, fixtureCase.record, 'invalid_campaign', {
        field: fixtureCase.field,
      }),
    );
  }
});

contractTest('strategy bounds and nested rationale relations are enforced exactly', async (t) => {
  const base = cloneRecord(REACHABLE_CAMPAIGNS[0]);
  const cases = [];
  for (const [field, maximum] of [
    ['name', WRITER_LIMITS.strategy.name],
    ['audience', WRITER_LIMITS.strategy.audience],
    ['desiredOutcome', WRITER_LIMITS.strategy.desiredOutcome],
    ['singleMessage', WRITER_LIMITS.strategy.singleMessage],
    ['externalProblem', WRITER_LIMITS.strategy.problem],
    ['internalProblem', WRITER_LIMITS.strategy.problem],
  ]) {
    for (const [suffix, value] of [
      ['blank', ' '],
      ['over maximum', 'x'.repeat(maximum + 1)],
    ]) {
      const record = cloneRecord(base);
      record.strategy[field] = value;
      if (field === 'name') record.name = value;
      cases.push({ field: `strategy.${field}`, name: `${field} ${suffix}`, record });
    }
  }
  for (const length of [0, 2, 4]) {
    const record = cloneRecord(base);
    record.strategy.plan = Array.from({ length }, () => 'A valid plan step');
    cases.push({ field: 'strategy.plan', name: `plan length ${length}`, record });
  }
  {
    const record = cloneRecord(base);
    record.strategy.plan[0] = 'x'.repeat(WRITER_LIMITS.strategy.planStep + 1);
    cases.push({ field: 'strategy.plan[0]', name: 'plan step over maximum', record });
  }
  {
    const record = cloneRecord(base);
    record.strategy.assumptions = Array.from({ length: 4 }, () => 'A valid assumption');
    cases.push({ field: 'strategy.assumptions', name: 'too many assumptions', record });
  }
  {
    const record = cloneRecord(base);
    record.strategy.assumptions = ['x'.repeat(WRITER_LIMITS.strategy.assumption + 1)];
    cases.push({ field: 'strategy.assumptions[0]', name: 'assumption over maximum', record });
  }
  {
    const record = cloneRecord(base);
    record.strategy.rationale.pop();
    cases.push({ field: 'strategy.rationale', name: 'too few rationale topics', record });
  }
  {
    const record = cloneRecord(base);
    record.strategy.rationale[1].topic = record.strategy.rationale[0].topic;
    cases.push({ field: 'strategy.rationale[1].topic', name: 'duplicate rationale topic', record });
  }
  {
    const record = cloneRecord(base);
    record.strategy.rationale[0].topic = 'unknown';
    cases.push({ field: 'strategy.rationale[0].topic', name: 'unknown rationale topic', record });
  }
  {
    const record = cloneRecord(base);
    record.strategy.rationale[0].ruleIds = ['not-a-rule'];
    cases.push({ field: 'strategy.rationale[0].ruleIds', name: 'unknown rationale rule', record });
  }
  {
    const record = cloneRecord(base);
    record.strategy.rationale[0].ruleIds = ['hero-is-customer', 'hero-is-customer'];
    cases.push({
      field: 'strategy.rationale[0].ruleIds',
      name: 'duplicate rationale rule',
      record,
    });
  }
  {
    const record = cloneRecord(base);
    record.strategy.rationale[0].why = 'x'.repeat(WRITER_LIMITS.strategy.why + 1);
    cases.push({ field: 'strategy.rationale[0].why', name: 'rationale why over maximum', record });
  }

  for (const fixtureCase of cases) {
    await t.test(fixtureCase.name, (t) =>
      expectRecordRejected(t, fixtureCase.record, 'invalid_campaign', {
        field: fixtureCase.field,
      }),
    );
  }
});

contractTest(
  'stored copy allows only the owner-edit widening and keeps generated fields strict',
  async (t) => {
    const base = cloneRecord(REACHABLE_CAMPAIGNS[3]);
    const cases = [];
    for (const field of ['headline', 'description', 'primaryText', 'fullCaption', 'callToAction']) {
      for (const [suffix, value] of [
        ['blank', ' '],
        ['over owner maximum', 'x'.repeat(WRITER_LIMITS.storedCopyCharacters + 1)],
      ]) {
        const record = cloneRecord(base);
        record.copy.en[field] = value;
        cases.push({ field: `copy.en.${field}`, name: `${field} ${suffix}`, record });
      }
    }
    {
      const record = cloneRecord(base);
      record.copy.en.hashtags = Array.from(
        { length: WRITER_LIMITS.storedHashtags + 1 },
        (_, index) => `#tag-${index}`,
      );
      cases.push({ field: 'copy.en.hashtags', name: 'too many hashtags', record });
    }
    {
      const record = cloneRecord(base);
      record.copy.en.hashtags = [' '];
      cases.push({ field: 'copy.en.hashtags[0]', name: 'blank hashtag', record });
    }
    {
      const record = cloneRecord(base);
      record.copy.en.hashtags = ['#'.concat('x'.repeat(WRITER_LIMITS.storedHashtagCharacters))];
      cases.push({ field: 'copy.en.hashtags[0]', name: 'hashtag over owner maximum', record });
    }
    {
      const record = cloneRecord(base);
      record.copy.en.variations.headline.pop();
      cases.push({ field: 'copy.en.variations.headline', name: 'two headline variations', record });
    }
    {
      const record = cloneRecord(base);
      record.copy.en.variations.primaryText.push('A fourth variation');
      cases.push({
        field: 'copy.en.variations.primaryText',
        name: 'four primary variations',
        record,
      });
    }
    {
      const record = cloneRecord(base);
      record.copy.en.variations.headline[0] = 'x'.repeat(WRITER_LIMITS.generatedCopy.headline + 1);
      cases.push({
        field: 'copy.en.variations.headline[0]',
        name: 'generated headline variation over maximum',
        record,
      });
    }
    {
      const record = cloneRecord(base);
      record.copy.en.variations.primaryText[0] = 'x'.repeat(
        WRITER_LIMITS.generatedCopy.primaryText + 1,
      );
      cases.push({
        field: 'copy.en.variations.primaryText[0]',
        name: 'generated primary variation over maximum',
        record,
      });
    }
    {
      const record = cloneRecord(base);
      record.copy.en.variations.extra = [];
      cases.push({ field: 'copy.en.variations.extra', name: 'unknown variations field', record });
    }
    {
      const record = cloneRecord(base);
      record.copy.en.rationale.pop();
      cases.push({ field: 'copy.en.rationale', name: 'missing copy rationale', record });
    }
    {
      const record = cloneRecord(base);
      record.copy.en.rationale[1].field = record.copy.en.rationale[0].field;
      cases.push({
        field: 'copy.en.rationale[1].field',
        name: 'duplicate copy rationale field',
        record,
      });
    }
    {
      const record = cloneRecord(base);
      record.copy.en.rationale[0].field = 'unknown';
      cases.push({
        field: 'copy.en.rationale[0].field',
        name: 'unknown copy rationale field',
        record,
      });
    }
    {
      const record = cloneRecord(base);
      record.copy.en.rationale[0].ruleIds = [];
      cases.push({
        field: 'copy.en.rationale[0].ruleIds',
        name: 'empty copy rationale rules',
        record,
      });
    }
    {
      const record = cloneRecord(base);
      record.copy.en.rationale[0].guidance = 'x'.repeat(WRITER_LIMITS.generatedCopy.guidance + 1);
      cases.push({
        field: 'copy.en.rationale[0].guidance',
        name: 'copy rationale guidance over maximum',
        record,
      });
    }

    for (const fixtureCase of cases) {
      await t.test(fixtureCase.name, (t) =>
        expectRecordRejected(t, fixtureCase.record, 'invalid_campaign', {
          field: fixtureCase.field,
        }),
      );
    }
  },
);

contractTest(
  'image prompt concept order, labels, bounds, and rule evidence are closed',
  async (t) => {
    const base = cloneRecord(REACHABLE_CAMPAIGNS[6]);
    const cases = [];
    for (const length of [1, 2, 4]) {
      const record = cloneRecord(base);
      record.imagePrompts = Array.from({ length }, (_, index) =>
        cloneRecord(base.imagePrompts[index % base.imagePrompts.length]),
      );
      cases.push({ field: 'imagePrompts', name: `prompt count ${length}`, record });
    }
    {
      const record = cloneRecord(base);
      record.imagePrompts.reverse();
      cases.push({ field: 'imagePrompts', name: 'wrong concept order', record });
    }
    {
      const record = cloneRecord(base);
      record.imagePrompts[0].label = 'A different label';
      cases.push({ field: 'imagePrompts[0].label', name: 'wrong concept label', record });
    }
    for (const [index, concept] of IMAGE_CONCEPTS.entries()) {
      const record = cloneRecord(base);
      record.imagePrompts[index].prompt = 'x'.repeat(concept.maxPromptCharacters + 1);
      cases.push({
        field: `imagePrompts[${index}].prompt`,
        name: `${concept.id} prompt over derived maximum`,
        record,
      });
    }
    {
      const record = cloneRecord(base);
      record.imagePrompts[0].altText = 'x'.repeat(WRITER_LIMITS.image.altText + 1);
      cases.push({ field: 'imagePrompts[0].altText', name: 'alt text over maximum', record });
    }
    {
      const record = cloneRecord(base);
      record.imagePrompts[0].why = 'x'.repeat(WRITER_LIMITS.image.why + 1);
      cases.push({ field: 'imagePrompts[0].why', name: 'image why over maximum', record });
    }
    {
      const record = cloneRecord(base);
      record.imagePrompts[0].ruleIds = [];
      cases.push({ field: 'imagePrompts[0].ruleIds', name: 'empty image rules', record });
    }
    {
      const record = cloneRecord(base);
      record.imagePrompts[0].ruleIds = ['photo-not-poster', 'photo-not-poster'];
      cases.push({ field: 'imagePrompts[0].ruleIds', name: 'duplicate image rules', record });
    }

    for (const fixtureCase of cases) {
      await t.test(fixtureCase.name, (t) =>
        expectRecordRejected(t, fixtureCase.record, 'invalid_campaign', {
          field: fixtureCase.field,
        }),
      );
    }
  },
);

contractTest('only the eight writer-reachable stage/copy/prompt shapes are accepted', async (t) => {
  const cases = [
    campaignRecord({
      id: campaignId(70),
      stage: 'strategy',
      copy: { sv: validCopy('sv') },
    }),
    campaignRecord({
      id: campaignId(71),
      stage: 'strategy',
      imagePrompts: validImagePrompts(),
    }),
    campaignRecord({ id: campaignId(72), stage: 'copy' }),
    campaignRecord({
      id: campaignId(73),
      stage: 'complete',
      imagePrompts: [],
    }),
    campaignRecord({
      id: campaignId(74),
      stage: 'complete',
      imagePrompts: validImagePrompts().slice(0, 2),
    }),
    { ...campaignRecord({ id: campaignId(75) }), stage: 'writing' },
  ];

  for (const [index, record] of cases.entries()) {
    await t.test(`unreachable shape ${index + 1}`, (t) =>
      expectRecordRejected(t, record, 'invalid_campaign', {
        field: index === 3 || index === 4 ? 'imagePrompts' : 'stage',
      }),
    );
  }
});

contractTest(
  'timestamps and campaign name stay relational while normalized idea stays canonical',
  async (t) => {
    const base = cloneRecord(REACHABLE_CAMPAIGNS[0]);
    const cases = [];
    for (const [field, value] of [
      ['createdAt', '2026-08-01'],
      ['createdAt', '2026-08-01T09:10:11Z'],
      ['createdAt', '2026-08-01T11:10:11.123+02:00'],
      ['createdAt', '2026-02-30T09:10:11.123Z'],
      ['updatedAt', 'not-a-timestamp'],
    ]) {
      const record = cloneRecord(base);
      record[field] = value;
      cases.push({ field, name: `${field} ${value}`, record });
    }
    {
      const record = cloneRecord(base);
      record.createdAt = '2026-08-02T00:00:00.000Z';
      record.updatedAt = '2026-08-01T00:00:00.000Z';
      cases.push({ field: 'updatedAt', name: 'updated before created', record });
    }
    for (const [name, idea] of [
      ['under minimum', '1234567'],
      ['over maximum', 'x'.repeat(WRITER_LIMITS.ideaCodeUnits + 1)],
      ['leading whitespace', ` ${base.idea}`],
      ['trailing whitespace', `${base.idea} `],
      ['unfolded carriage return', `${base.idea}\rnext`],
      ['unfolded tab run', `${base.idea}\t next`],
      ['three consecutive newlines', `${base.idea}\n\n\nnext`],
    ]) {
      const record = cloneRecord(base);
      record.idea = idea;
      cases.push({ field: 'idea', name: `idea ${name}`, record });
    }
    {
      const record = cloneRecord(base);
      record.name = `${record.strategy.name} changed`;
      cases.push({ field: 'name', name: 'name differs from strategy name', record });
    }

    for (const fixtureCase of cases) {
      await t.test(fixtureCase.name, (t) =>
        expectRecordRejected(t, fixtureCase.record, 'invalid_campaign', {
          field: fixtureCase.field,
        }),
      );
    }
  },
);

contractTest(
  'every permissive-reader-only malformed legacy object is rejected explicitly',
  async (t) => {
    const codes = [
      'invalid_campaign',
      'filename_id_mismatch',
      'invalid_campaign',
      'invalid_campaign',
    ];
    for (const [index, fixtureCase] of PERMISSIVE_READER_ONLY_CASES.entries()) {
      await t.test(fixtureCase.name, async (t) => {
        const fixture = setupImportFixture(t);
        const entry = entryFromRecord(fixtureCase.record, {
          name: fixtureCase.fileName,
        });
        writeSourceDirectory(fixture.sourceDirectory, [entry]);
        await expectImportError(
          () => importSource(fixture.databasePath, fixture.sourceDirectory),
          codes[index],
          { fileName: entry.name },
        );
        assertNoTargetArtifacts(fixture.directory, fixture.databasePath, [
          path.basename(fixture.sourceDirectory),
        ]);
      });
    }
  },
);

contractTest(
  'the complete directory rejects hidden, temporary, extra, and non-JSON entries',
  async (t) => {
    const names = ['.DS_Store', '.hidden', 'README.txt', 'campaign.tmp', 'orphan.json.tmp'];
    for (const name of names) {
      await t.test(name, async (t) => {
        const fixture = setupValidSource(t, REACHABLE_CAMPAIGNS.slice(0, 1));
        const extraPath = path.join(fixture.sourceDirectory, name);
        fs.writeFileSync(extraPath, 'synthetic extra entry', { mode: 0o640 });
        const sourceBefore = captureSourceTree(fixture.sourceDirectory);

        await expectImportError(
          () => importSource(fixture.databasePath, fixture.sourceDirectory),
          'invalid_entry',
          { fileName: name },
        );

        assertSourceTreeSnapshot(fixture.sourceDirectory, sourceBefore);
        assertNoTargetArtifacts(fixture.directory, fixture.databasePath, [
          path.basename(fixture.sourceDirectory),
        ]);
      });
    }
  },
);

contractTest('all directory entries validate before any staging database is created', async (t) => {
  const records = REACHABLE_CAMPAIGNS.slice(0, 3);
  const fixture = setupValidSource(t, records);
  fs.writeFileSync(path.join(fixture.sourceDirectory, 'zz-invalid.txt'), 'last after UUID files', {
    mode: 0o640,
  });
  const checkpoints = [];

  await expectImportError(
    () =>
      importSourceForTest(fixture.databasePath, fixture.sourceDirectory, (checkpoint) => {
        checkpoints.push(checkpoint);
      }),
    'invalid_entry',
    { fileName: 'zz-invalid.txt' },
  );

  assert.equal(checkpoints.includes('temporary_created'), false);
  assert.equal(checkpoints.includes('target_transaction_started'), false);
  assertNoTargetArtifacts(fixture.directory, fixture.databasePath, [
    path.basename(fixture.sourceDirectory),
  ]);
});

contractTest('missing, file, and symlink source-directory paths fail closed', async (t) => {
  await t.test('missing', async (t) => {
    const fixture = setupImportFixture(t);
    await expectImportError(
      () => importSource(fixture.databasePath, fixture.sourceDirectory),
      'source_missing',
    );
    assertNoTargetArtifacts(fixture.directory, fixture.databasePath);
  });

  await t.test('regular file', async (t) => {
    const fixture = setupImportFixture(t);
    fs.writeFileSync(fixture.sourceDirectory, 'not a directory', { mode: 0o640 });
    const sourceBefore = capturePath(fixture.sourceDirectory);
    await expectImportError(
      () => importSource(fixture.databasePath, fixture.sourceDirectory),
      'source_invalid_type',
    );
    assertPathSnapshot(fixture.sourceDirectory, sourceBefore);
    assert.equal(fs.existsSync(fixture.databasePath), false);
  });

  await t.test('symlink', async (t) => {
    const fixture = setupImportFixture(t);
    const protectedDirectory = path.join(fixture.directory, 'protected-history');
    const entries = validEntries(REACHABLE_CAMPAIGNS.slice(0, 1));
    writeSourceDirectory(protectedDirectory, entries);
    const protectedBefore = captureSourceTree(protectedDirectory);
    fs.symlinkSync(protectedDirectory, fixture.sourceDirectory);

    await expectImportError(
      () => importSource(fixture.databasePath, fixture.sourceDirectory),
      'source_invalid_type',
    );

    assert.equal(fs.lstatSync(fixture.sourceDirectory).isSymbolicLink(), true);
    assertSourceTreeSnapshot(protectedDirectory, protectedBefore);
    assert.equal(fs.existsSync(fixture.databasePath), false);
  });
});

contractTest(
  'linked, nested, and special directory entries are never followed or opened as JSON',
  async (t) => {
    const cases = ['directory', 'symlink', 'hardlink', 'FIFO', 'socket'];
    for (const entryType of cases) {
      await t.test(entryType, async (t) => {
        const directory = fs.realpathSync.native(fs.mkdtempSync('/tmp/fp-campaign-import-'));
        fs.chmodSync(directory, 0o700);
        t.after(() => fs.rmSync(directory, { force: true, recursive: true }));
        const sourceDirectory = path.join(directory, 'history');
        fs.mkdirSync(sourceDirectory, { mode: 0o750 });
        const databasePath = path.join(directory, 'faunapoolen.sqlite');
        const entryPath = path.join(sourceDirectory, campaignFileName(campaignId(80)));
        const protectedPath = path.join(directory, `protected-${entryType}`);
        let server;
        let protectedBefore;

        if (entryType === 'directory') fs.mkdirSync(entryPath, { mode: 0o700 });
        if (entryType === 'symlink') {
          fs.writeFileSync(protectedPath, writerBytes(REACHABLE_CAMPAIGNS[0]), { mode: 0o600 });
          protectedBefore = capturePath(protectedPath);
          fs.symlinkSync(protectedPath, entryPath);
        }
        if (entryType === 'hardlink') {
          fs.writeFileSync(protectedPath, writerBytes(REACHABLE_CAMPAIGNS[0]), { mode: 0o600 });
          fs.linkSync(protectedPath, entryPath);
          protectedBefore = capturePath(protectedPath);
        }
        if (entryType === 'FIFO') {
          const result = spawnSync('mkfifo', [entryPath], { encoding: 'utf8' });
          assert.equal(result.status, 0, result.stderr);
        }
        if (entryType === 'socket') {
          server = net.createServer();
          t.after(() => server.close());
          await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(entryPath, resolve);
          });
        }

        await expectImportError(() => importSource(databasePath, sourceDirectory), 'unsafe_entry', {
          fileName: path.basename(entryPath),
        });

        if (protectedBefore) assertPathSnapshot(protectedPath, protectedBefore);
        assert.equal(fs.existsSync(databasePath), false);
        assert.equal(fs.existsSync(stagingDirectoryPath(databasePath)), false);
      });
    }
  },
);

contractTest(
  'a hardlinked campaign file is rejected even when its bytes and name are valid',
  async (t) => {
    const fixture = setupImportFixture(t);
    fs.mkdirSync(fixture.sourceDirectory, { mode: 0o750 });
    const record = cloneRecord(REACHABLE_CAMPAIGNS[0]);
    const protectedPath = path.join(fixture.directory, 'protected-campaign.json');
    fs.writeFileSync(protectedPath, writerBytes(record), { mode: 0o640 });
    const entryPath = path.join(fixture.sourceDirectory, campaignFileName(record.id));
    fs.linkSync(protectedPath, entryPath);
    const protectedBefore = capturePath(protectedPath);

    await expectImportError(
      () => importSource(fixture.databasePath, fixture.sourceDirectory),
      'unsafe_entry',
      { fileName: path.basename(entryPath) },
    );

    assertPathSnapshot(protectedPath, protectedBefore);
    assertPathSnapshot(entryPath, protectedBefore);
    assert.equal(fs.existsSync(fixture.databasePath), false);
  },
);

contractTest(
  'pre-existing non-regular, linked, or arbitrary target paths are never replaced',
  async (t) => {
    const cases = ['directory', 'symlink', 'hardlink', 'FIFO', 'arbitrary-bytes'];
    for (const targetType of cases) {
      await t.test(targetType, async (t) => {
        const fixture = setupValidSource(t, REACHABLE_CAMPAIGNS.slice(0, 2));
        const sourceBefore = captureSourceTree(fixture.sourceDirectory);
        const protectedPath = path.join(fixture.directory, `protected-${targetType}`);
        let protectedBefore;
        let targetBefore;

        if (targetType === 'directory') fs.mkdirSync(fixture.databasePath, { mode: 0o700 });
        if (targetType === 'symlink') {
          fs.writeFileSync(protectedPath, 'protected target', { mode: 0o600 });
          protectedBefore = capturePath(protectedPath);
          fs.symlinkSync(protectedPath, fixture.databasePath);
        }
        if (targetType === 'hardlink') {
          fs.writeFileSync(protectedPath, 'protected target', { mode: 0o600 });
          fs.linkSync(protectedPath, fixture.databasePath);
          protectedBefore = capturePath(protectedPath);
        }
        if (targetType === 'FIFO') {
          const result = spawnSync('mkfifo', [fixture.databasePath], { encoding: 'utf8' });
          assert.equal(result.status, 0, result.stderr);
        }
        if (targetType === 'arbitrary-bytes') {
          fs.writeFileSync(fixture.databasePath, 'not a Faunapoolen database', { mode: 0o600 });
        }
        targetBefore = capturePath(fixture.databasePath);

        await expectImportError(
          () => importSource(fixture.databasePath, fixture.sourceDirectory),
          'target_conflict',
        );

        assertSourceTreeSnapshot(fixture.sourceDirectory, sourceBefore);
        assertPathSnapshot(fixture.databasePath, targetBefore);
        if (protectedBefore) assertPathSnapshot(protectedPath, protectedBefore);
        assert.equal(fs.existsSync(stagingDirectoryPath(fixture.databasePath)), false);
      });
    }
  },
);

contractTest(
  'pre-existing SQLite journal, WAL, and SHM sidecars block an absent target',
  async (t) => {
    for (const sidecarPathFor of targetSidecarPaths('/synthetic/faunapoolen.sqlite').map((value) =>
      value.slice('/synthetic/faunapoolen.sqlite'.length),
    )) {
      await t.test(sidecarPathFor, async (t) => {
        const fixture = setupValidSource(t, REACHABLE_CAMPAIGNS.slice(0, 1));
        const sourceBefore = captureSourceTree(fixture.sourceDirectory);
        const sidecarPath = `${fixture.databasePath}${sidecarPathFor}`;
        fs.writeFileSync(sidecarPath, `existing ${sidecarPathFor} evidence`, { mode: 0o600 });
        const sidecarBefore = capturePath(sidecarPath);

        await expectImportError(
          () => importSource(fixture.databasePath, fixture.sourceDirectory),
          'target_conflict',
        );

        assertSourceTreeSnapshot(fixture.sourceDirectory, sourceBefore);
        assertPathSnapshot(sidecarPath, sidecarBefore);
        assert.equal(fs.existsSync(fixture.databasePath), false);
        assert.equal(fs.existsSync(stagingDirectoryPath(fixture.databasePath)), false);
      });
    }
  },
);

contractTest(
  'partial and corrupt SQLite targets cannot masquerade as an import receipt',
  async (t) => {
    const cases = [
      {
        name: 'campaign table without receipt',
        statements: `CREATE TABLE campaigns (id TEXT PRIMARY KEY);`,
      },
      {
        name: 'receipt table without campaigns',
        statements: `CREATE TABLE campaign_import_receipts (
        receipt_key TEXT PRIMARY KEY,
        format_version INTEGER NOT NULL,
        source_bytes INTEGER NOT NULL,
        source_sha256 TEXT NOT NULL,
        campaign_count INTEGER NOT NULL,
        ordered_campaigns_sha256 TEXT NOT NULL
      );`,
      },
      {
        name: 'foreign application database',
        statements: `CREATE TABLE unrelated (value TEXT NOT NULL); INSERT INTO unrelated VALUES ('keep');`,
      },
    ];

    for (const fixtureCase of cases) {
      await t.test(fixtureCase.name, async (t) => {
        const fixture = setupValidSource(t, REACHABLE_CAMPAIGNS.slice(0, 1));
        createPartialCampaignDatabase(fixture.databasePath, fixtureCase.statements);
        const targetBefore = capturePath(fixture.databasePath);
        await expectImportError(
          () => importSource(fixture.databasePath, fixture.sourceDirectory),
          'target_conflict',
        );
        assertPathSnapshot(fixture.databasePath, targetBefore);
        assert.equal(fs.existsSync(stagingDirectoryPath(fixture.databasePath)), false);
      });
    }
  },
);

contractTest(
  'unknown or corrupt private staging residue is preserved for explicit recovery',
  async (t) => {
    for (const residueType of ['file', 'symlink', 'empty-directory', 'foreign-marker']) {
      await t.test(residueType, async (t) => {
        const fixture = setupValidSource(t, REACHABLE_CAMPAIGNS.slice(0, 1));
        const stagingPath = stagingDirectoryPath(fixture.databasePath);
        const protectedPath = path.join(fixture.directory, 'protected-staging');
        let residueBefore;
        let protectedBefore;

        if (residueType === 'file') {
          fs.writeFileSync(stagingPath, 'unowned staging evidence', { mode: 0o600 });
          residueBefore = capturePath(stagingPath);
        }
        if (residueType === 'symlink') {
          fs.writeFileSync(protectedPath, 'protected staging evidence', { mode: 0o600 });
          protectedBefore = capturePath(protectedPath);
          fs.symlinkSync(protectedPath, stagingPath);
          residueBefore = capturePath(stagingPath);
        }
        if (residueType === 'empty-directory') {
          fs.mkdirSync(stagingPath, { mode: 0o700 });
          residueBefore = captureSourceTree(stagingPath);
        }
        if (residueType === 'foreign-marker') {
          fs.mkdirSync(stagingPath, { mode: 0o700 });
          fs.writeFileSync(path.join(stagingPath, 'operation.json'), '{"foreign":true}', {
            mode: 0o600,
          });
          residueBefore = captureSourceTree(stagingPath);
        }

        await expectImportError(
          () => importSource(fixture.databasePath, fixture.sourceDirectory),
          'recovery_conflict',
        );

        if (residueBefore.entries) assertSourceTreeSnapshot(stagingPath, residueBefore);
        else assertPathSnapshot(stagingPath, residueBefore);
        if (protectedBefore) assertPathSnapshot(protectedPath, protectedBefore);
        assert.equal(fs.existsSync(fixture.databasePath), false);
      });
    }
  },
);

contractTest(
  'the checkpoint seam proves private staging and the complete success lifecycle',
  async (t) => {
    const records = REACHABLE_CAMPAIGNS.slice(0, 3);
    const fixture = setupValidSource(t, records);
    const expectedNames = fixture.entries.map((entry) => entry.name).toSorted();
    const observed = [];

    await importSourceForTest(
      fixture.databasePath,
      fixture.sourceDirectory,
      (checkpoint, details) => {
        if (checkpoint === 'source_entry_opened') {
          observed.push(`${checkpoint}:${details.fileName}`);
        } else if (checkpoint === 'campaign_inserted') {
          observed.push(`${checkpoint}:${details.campaignSequence}`);
        } else {
          observed.push(checkpoint);
        }
        if (checkpoint === 'temporary_created') {
          assert.equal(details.stagingDirectory, stagingDirectoryPath(fixture.databasePath));
          stagingTreeModes(details.stagingDirectory);
          assertPrivateOwnedRegularFile(details.databasePath);
        }
        if (checkpoint === 'marker_durable') {
          stagingTreeModes(details.stagingDirectory);
          assertPrivateOwnedRegularFile(path.join(details.stagingDirectory, 'operation.json'));
        }
      },
    );

    assert.deepEqual(observed, [
      'source_directory_opened',
      ...expectedNames.map((name) => `source_entry_opened:${name}`),
      'source_validated',
      'temporary_created',
      'target_transaction_started',
      ...expectedNames.map((_, index) => `campaign_inserted:${index + 1}`),
      'before_commit',
      'target_reopened',
      'marker_durable',
      'before_publish',
      'target_linked',
      'target_published',
      'final_source_verified',
    ]);
    assertImportedTarget(fixture.databasePath, fixture.entries);
  },
);

contractTest('every injected initial-import checkpoint failure is all-or-nothing', async (t) => {
  const checkpoints = EXPECTED_CHECKPOINTS.filter((checkpoint) => checkpoint !== 'replay_pinned');
  for (const failingCheckpoint of checkpoints) {
    await t.test(failingCheckpoint, async (t) => {
      const fixture = setupValidSource(t, REACHABLE_CAMPAIGNS.slice(0, 3));
      const sourceBefore = captureSourceTree(fixture.sourceDirectory);
      let entryOpenCount = 0;
      let insertCount = 0;

      await expectImportError(
        () =>
          importSourceForTest(fixture.databasePath, fixture.sourceDirectory, (checkpoint) => {
            if (checkpoint === 'source_entry_opened') entryOpenCount += 1;
            if (checkpoint === 'campaign_inserted') insertCount += 1;
            const isSelectedOccurrence =
              checkpoint !== 'source_entry_opened' && checkpoint !== 'campaign_inserted'
                ? true
                : checkpoint === 'source_entry_opened'
                  ? entryOpenCount === 2
                  : insertCount === 2;
            if (checkpoint === failingCheckpoint && isSelectedOccurrence) {
              throw new Error(`synthetic failure at ${failingCheckpoint}`);
            }
          }),
        'import_failed',
      );

      assertSourceTreeSnapshot(fixture.sourceDirectory, sourceBefore);
      assertNoTargetArtifacts(fixture.directory, fixture.databasePath, [
        path.basename(fixture.sourceDirectory),
      ]);
    });
  }
});
