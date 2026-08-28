import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test, type TestContext } from 'node:test';
import { pathToFileURL } from 'node:url';

import {
  createDurableWorker,
  type DurableJobStore,
} from '@mikaelcedergren/cx-framework/server/jobs';
import {
  applySqliteMigrations,
  openOwnedSqliteDatabase,
  withImmediateTransaction,
  type SqliteRow,
  type SqliteValue,
  type SyncSqliteDatabase,
} from '@mikaelcedergren/cx-framework/server/sqlite';

import {
  CampaignActiveGenerationError,
  CampaignCapacityError,
  CampaignRevisionConflictError,
  CampaignSequenceCapacityError,
  GenerationRunCapacityError,
  PersistenceRevisionConflictError,
  ProviderEffectReplayBlockedError,
  createFaunapoolenPersistence,
  insertCampaignImportReceipt,
  insertImportedCampaign,
  type CreateGenerationRunInput,
  type FaunapoolenPersistence,
  type GenerationRun,
} from './campaign-repository.js';
import {
  CampaignJsonSyntaxError,
  CampaignValidationError,
  canonicalCampaign,
  canonicalCampaignBytes,
  parseCampaignJson,
  sha256Hex,
  validateCampaignRecord,
  type CampaignCopy,
  type CampaignRecord,
} from './campaign-schema.js';
import {
  FAUNAPOOLEN_MIGRATIONS,
  MAX_GENERATION_RUNS,
  MAX_PROVIDER_RESPONSE_BYTES,
  openFaunapoolenDatabase,
  verifyFaunapoolenDatabase,
  verifyFaunapoolenDatabaseReadiness,
} from './database.js';
import { COPY_FIELD_IDS } from './copy-budgets.js';
import { buildCampaignGenerationJob } from './generation-jobs.js';
import { strategyGenerationSpec } from './generation-content.js';
import {
  classifyCampaignGenerationFailure,
  createCampaignGenerationHandlers,
} from './generation-handlers.js';
import { createGenerationService } from './generation-service.js';
import {
  CampaignImportError,
  importCampaignDirectory,
  importCampaignDirectoryForTest,
} from './campaign-import.js';
import { IMAGE_CONCEPTS } from './image-style.js';
import {
  verifyLegacyCampaignImportPreActivation,
  verifyLegacyCampaignRuntimeMarker,
} from './legacy-cutover.js';
import { createOpenAiResponsesProvider } from './openai-provider.js';

const OWNER_HASH = 'a'.repeat(64);
const CLIENT_HASH = 'b'.repeat(64);
const REQUEST_HASH = 'c'.repeat(64);
const CREATED_AT = '2026-08-01T01:02:03.004Z';
const UPDATED_AT = '2026-08-01T02:03:04.005Z';
const TEST_GENERATION_POLICY = Object.freeze({ maximumGenerations: 1_000, windowMs: 60_000 });

function privateTempDirectory(prefix: string): string {
  const directory = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  fs.chmodSync(directory, 0o700);
  return directory;
}

function captureMigrationAuthority(databasePath: string): Readonly<{
  readonly bytes: Buffer;
  readonly ledger: string;
  readonly schema: string;
}> {
  const immutable = pathToFileURL(databasePath);
  immutable.searchParams.set('immutable', '1');
  const native = new DatabaseSync(immutable, { readOnly: true });
  let ledger: string;
  let schema: string;
  try {
    ledger = JSON.stringify(
      native
        .prepare(
          `SELECT version, name, fingerprint, applied_at
           FROM cx_schema_migrations
           ORDER BY version`,
        )
        .all(),
    );
    schema = JSON.stringify(
      native
        .prepare(
          `SELECT type, name, tbl_name, sql
           FROM sqlite_schema
           WHERE name NOT GLOB 'sqlite_*'
           ORDER BY type, name, tbl_name`,
        )
        .all(),
    );
  } finally {
    native.close();
  }
  return Object.freeze({
    bytes: fs.readFileSync(databasePath),
    ledger,
    schema,
  });
}

function campaignId(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
}

function copy(language: 'sv' | 'en'): CampaignCopy {
  return {
    callToAction: language === 'sv' ? 'Boka nu' : 'Book now',
    description: language === 'sv' ? 'En beskrivning' : 'A description',
    fullCaption: language === 'sv' ? 'En fullständig bildtext' : 'A complete caption',
    hashtags: language === 'sv' ? ['#pool', '#sommar', '#hemma'] : ['#pool', '#summer', '#home'],
    headline: language === 'sv' ? 'Din egen pool' : 'Your own pool',
    primaryText: language === 'sv' ? 'Gör sommaren längre.' : 'Make summer last longer.',
    rationale: COPY_FIELD_IDS.map((field) => ({
      field,
      guidance: `Specific guidance for ${field}.`,
      ruleIds: ['hero-is-customer'],
    })),
    variations: {
      headline: ['Clear headline one', 'Clear headline two', 'Clear headline three'],
      primaryText: ['Clear primary one', 'Clear primary two', 'Clear primary three'],
    },
  };
}

function record(index: number, stage: CampaignRecord['stage'] = 'complete'): CampaignRecord {
  const name = `Campaign ${String(index)}`;
  return validateCampaignRecord({
    copy: stage === 'strategy' ? {} : { en: copy('en'), sv: copy('sv') },
    createdAt: CREATED_AT,
    id: campaignId(index),
    idea: `A synthetic campaign idea number ${String(index)}`,
    imagePrompts:
      stage === 'complete'
        ? IMAGE_CONCEPTS.map((concept) => ({
            altText: `A precise description of the ${concept.id} image.`,
            concept: concept.id,
            label: concept.label,
            prompt: `A physically believable ${concept.id} photograph in Nordic daylight.`,
            ruleIds: ['photo-not-poster'],
            why: 'The photograph makes the promised outcome concrete.',
          }))
        : [],
    name,
    stage,
    strategy: {
      assumptions: ['The reader wants a durable private pool.'],
      audience: 'Homeowners planning a long-term outdoor space.',
      desiredOutcome: 'A confident request for a pool consultation.',
      externalProblem: 'The swimming season feels too short.',
      internalProblem: 'The homeowner is unsure where to begin.',
      name,
      plan: ['Choose the pool', 'Plan the build', 'Enjoy the water'],
      rationale: [
        {
          ruleIds: ['hero-is-customer'],
          topic: 'audience',
          why: 'The customer remains the protagonist.',
        },
        {
          ruleIds: ['outcome-first'],
          topic: 'desiredOutcome',
          why: 'The strategy begins with the changed situation.',
        },
        {
          ruleIds: ['one-promise'],
          topic: 'singleMessage',
          why: 'One clear promise keeps the campaign focused.',
        },
      ],
      singleMessage: 'A well-planned pool makes more of every Swedish summer.',
    },
    updatedAt: UPDATED_AT,
  });
}

function persistenceFixture(
  t: TestContext,
  clock: () => number = () => Date.parse(UPDATED_AT),
): FaunapoolenPersistence {
  const directory = privateTempDirectory('faunapoolen-persistence-test-');
  const databasePath = path.join(directory, 'faunapoolen.db');
  let jobSequence = 0;
  const persistence = createFaunapoolenPersistence({
    clock,
    createJobId: () => `job-${String(++jobSequence).padStart(8, '0')}`,
    createLeaseToken: () => `lease-${String(jobSequence).padStart(8, '0')}`,
    databasePath,
    operationalRoot: directory,
  });
  t.after(() => {
    persistence.close();
    fs.rmSync(directory, { force: true, recursive: true });
  });
  return persistence;
}

function runInput(
  index: number,
  overrides: Partial<CreateGenerationRunInput> = {},
): CreateGenerationRunInput {
  const id = overrides.campaignId ?? campaignId(index);
  const expectedCampaignRevision = overrides.expectedCampaignRevision ?? 0;
  const runId = overrides.runId ?? campaignId(index + 10_000);
  const stage = overrides.stage ?? 'strategy';
  const strategyIdea =
    'strategyIdea' in overrides
      ? (overrides.strategyIdea ?? null)
      : stage === 'strategy'
        ? `A durable synthetic strategy idea for ${id}.`
        : null;
  return {
    campaignId: id,
    expectedCampaignRevision,
    job: buildCampaignGenerationJob({
      campaignId: id,
      expectedCampaignRevision,
      ...(strategyIdea === null ? {} : { idea: strategyIdea }),
      runId,
      stage,
    }),
    ownerSessionIdHash: OWNER_HASH,
    runId,
    stage,
    strategyIdea,
    ...overrides,
  };
}

type TestGenerationAdmission =
  | { readonly kind: 'imported' | 'initial'; readonly run: CreateGenerationRunInput }
  | {
      readonly kind: 'retry';
      readonly requiredCampaignRevision: number;
      readonly run: CreateGenerationRunInput;
    };

function admitRun(
  persistence: FaunapoolenPersistence,
  input: TestGenerationAdmission,
  now = Date.parse(UPDATED_AT),
): GenerationRun {
  const result = persistence.generationAdmission.admit({
    ...input,
    now,
    policy: TEST_GENERATION_POLICY,
  });
  assert.equal(result.status, 'accepted');
  return result.run;
}

function insertSyntheticImport(
  persistence: FaunapoolenPersistence,
  campaign: CampaignRecord,
  campaignSequence: number,
): void {
  const bytes = canonicalCampaignBytes(campaign);
  insertImportedCampaign(persistence.database.sqlite, campaign, campaignSequence, {
    bytes,
    fileName: `${campaign.id}.json`,
    sha256: sha256Hex(bytes),
  });
}

function insertTerminalGenerationRun(
  persistence: FaunapoolenPersistence,
  index: number,
  options: {
    readonly campaignId?: string;
    readonly finishedAt?: number;
    readonly state?: 'ambiguous' | 'failed' | 'succeeded';
  } = {},
): Readonly<{ jobId: string; runId: string }> {
  const state = options.state ?? 'succeeded';
  const finishedAt = options.finishedAt ?? 1_000;
  const runId = campaignId(index + 100_000);
  const jobId = `terminal-job-${String(index).padStart(8, '0')}`;
  const failed = state === 'failed' || state === 'ambiguous';
  persistence.database.sqlite.run(
    `INSERT INTO generation_runs (
       run_id, campaign_id, owner_session_id_hash, stage, strategy_idea, state,
       expected_campaign_revision, job_id, attempt, error_code, error_message,
       created_at, updated_at, finished_at, revision
     ) VALUES (?, ?, ?, 'strategy', ?, ?, 0, ?, 1, ?, ?, ?, ?, ?, 1)`,
    [
      runId,
      options.campaignId ?? campaignId(index),
      OWNER_HASH,
      `A durable synthetic terminal idea for run ${String(index)}.`,
      state,
      jobId,
      failed ? `synthetic_${state}` : null,
      failed ? `Synthetic ${state} terminal generation.` : null,
      finishedAt,
      finishedAt,
      finishedAt,
    ],
  );
  return Object.freeze({ jobId, runId });
}

function campaignImportFixture(t: TestContext, index: number) {
  const directory = privateTempDirectory('faunapoolen-import-test-');
  const sourceDirectory = path.join(directory, 'campaign-history');
  fs.mkdirSync(sourceDirectory, { mode: 0o750 });
  const campaign = record(index);
  const filePath = path.join(sourceDirectory, `${campaign.id}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(campaign, null, 2)}\n`, {
    flag: 'wx',
    mode: 0o640,
  });
  t.after(() => fs.rmSync(directory, { force: true, recursive: true }));
  return Object.freeze({
    databasePath: path.join(directory, 'faunapoolen.db'),
    directory,
    filePath,
    intentPath: path.join(directory, '.faunapoolen.db.import-intent.json'),
    sourceDirectory,
    stagingDirectory: path.join(directory, '.faunapoolen.db.import-stage'),
  });
}

function sourceFileProof(filePath: string) {
  const stats = fs.statSync(filePath, { bigint: true });
  return Object.freeze({
    bytes: fs.readFileSync(filePath),
    dev: stats.dev,
    ino: stats.ino,
    mode: stats.mode,
  });
}

function assertSourceFileProof(filePath: string, expected: ReturnType<typeof sourceFileProof>) {
  const current = sourceFileProof(filePath);
  assert.equal(current.dev, expected.dev);
  assert.equal(current.ino, expected.ino);
  assert.equal(current.mode, expected.mode);
  assert.deepEqual(current.bytes, expected.bytes);
}

function errorTreeMatches(error: unknown, pattern: RegExp): boolean {
  if (error instanceof Error && pattern.test(error.message)) return true;
  return (
    error instanceof AggregateError &&
    error.errors.some((nested: unknown) => errorTreeMatches(nested, pattern))
  );
}

test('campaign validation uses the shared registries and produces stable canonical bytes', () => {
  const campaign = record(1);
  const canonical = canonicalCampaign(campaign);
  assert.deepEqual(parseCampaignJson(canonical.bytes.toString('utf8')), campaign);
  assert.equal(canonical.sha256.length, 64);
  assert.deepEqual(
    campaign.imagePrompts.map(({ concept, label }) => ({ concept, label })),
    IMAGE_CONCEPTS.map(({ id: concept, label }) => ({ concept, label })),
  );
  const astralIdea = '💧'.repeat(1_501);
  assert.ok(astralIdea.length > 3_000);
  assert.equal(validateCampaignRecord({ ...campaign, idea: astralIdea }).idea, astralIdea);

  const unknownRule = structuredClone(campaign) as unknown as {
    strategy: { rationale: { ruleIds: string[] }[] };
  };
  unknownRule.strategy.rationale[0]?.ruleIds.splice(0, 1, 'invented-rule');
  assert.throws(
    () => validateCampaignRecord(unknownRule),
    (error: unknown) =>
      error instanceof CampaignValidationError && error.field === 'strategy.rationale[0].ruleIds',
  );

  const duplicate = canonical.bytes
    .toString('utf8')
    .replace(`"id":"${campaign.id}"`, `"id":"${campaign.id}","i\\u0064":"${campaign.id}"`);
  assert.throws(
    () => parseCampaignJson(duplicate),
    (error: unknown) => error instanceof CampaignJsonSyntaxError && error.duplicateField === 'id',
  );
});

test('the append-only product and durable-job migration ledger reopens and detects drift', (t) => {
  const directory = privateTempDirectory('faunapoolen-migration-test-');
  const databasePath = path.join(directory, 'faunapoolen.db');
  t.after(() => fs.rmSync(directory, { force: true, recursive: true }));

  const first = openFaunapoolenDatabase({
    databasePath,
    operationalRoot: directory,
  });
  assert.equal(first.isReady(), true);
  const ledger = first.sqlite.all<{ readonly name: string; readonly version: number | bigint }>(
    'SELECT version, name FROM cx_schema_migrations ORDER BY version',
  );
  assert.deepEqual(
    ledger.map(({ version }) => Number(version)),
    FAUNAPOOLEN_MIGRATIONS.map(({ version }) => version),
  );
  assert.equal(
    ledger.some(({ name }) => name === 'shared_initial_durable_jobs'),
    true,
  );
  first.close();

  const reopened = openFaunapoolenDatabase({
    databasePath,
    operationalRoot: directory,
  });
  assert.equal(reopened.isReady(), true);
  reopened.sqlite.run('UPDATE cx_schema_migrations SET name = ? WHERE version = 1', [
    'tampered_migration',
  ]);
  assert.equal(reopened.isReady(), false);
  assert.throws(() => verifyFaunapoolenDatabase(reopened.sqlite), /migration/iu);
  reopened.close();
});

test('a sealed canonical migration prefix is verified before pending runtime migrations', (t) => {
  const directory = privateTempDirectory('faunapoolen-migration-prefix-test-');
  const databasePath = path.join(directory, 'faunapoolen.db');
  t.after(() => fs.rmSync(directory, { force: true, recursive: true }));

  const seed = openOwnedSqliteDatabase({
    configuration: { busyTimeoutMs: 5_000, journalMode: 'wal' },
    databasePath,
    operationalRoot: directory,
  });
  applySqliteMigrations(seed.database, FAUNAPOOLEN_MIGRATIONS.slice(0, 1), {
    fingerprint: sha256Hex,
    now: () => '2026-08-01T00:00:00.000Z',
  });
  const receipt = Object.freeze({
    campaignCount: 0,
    formatVersion: 1 as const,
    orderedCampaignsSha256: 'd'.repeat(64),
    sourceBytes: 0,
    sourceSha256: 'e'.repeat(64),
  });
  insertCampaignImportReceipt(seed.database, receipt);
  seed.close();

  let verified;
  const upgraded = openFaunapoolenDatabase({
    databasePath,
    operationalRoot: directory,
    requireExisting: true,
    verifyBeforeWrite(database) {
      verified = verifyLegacyCampaignRuntimeMarker(database);
    },
  });
  try {
    assert.deepEqual(verified, receipt);
    assert.equal(upgraded.isReady(), true);
    assert.deepEqual(
      upgraded.sqlite
        .all<{
          readonly version: number | bigint;
        }>('SELECT version FROM cx_schema_migrations ORDER BY version')
        .map(({ version }) => Number(version)),
      FAUNAPOOLEN_MIGRATIONS.map(({ version }) => version),
    );
  } finally {
    upgraded.close();
  }
});

test('an old migration prefix rejects ledger and complete-schema drift before pending migrations', async (t) => {
  const cases = [
    {
      expected: /migration foundation is not the canonical contiguous prefix/,
      label: 'malformed application timestamp',
      statements: [
        `UPDATE cx_schema_migrations
         SET applied_at = '2026-08-01T00:00:00Z'
         WHERE version = 1`,
      ],
    },
    {
      expected: /migration foundation sqlite_schema/,
      label: 'missing schema object',
      statements: ['DROP INDEX campaigns_updated_idx'],
    },
    {
      expected: /migration foundation sqlite_schema/,
      label: 'altered schema object',
      statements: [
        'DROP TRIGGER campaigns_capacity_guard',
        `CREATE TRIGGER campaigns_capacity_guard
         BEFORE INSERT ON campaigns
         BEGIN
           SELECT RAISE(ABORT, 'altered campaign capacity');
         END`,
      ],
    },
    {
      expected: /migration foundation sqlite_schema/,
      label: 'extra schema object',
      statements: ['CREATE TABLE unregistered_prefix_state (id INTEGER PRIMARY KEY) STRICT'],
    },
  ] as const;

  for (const drift of cases) {
    await t.test(drift.label, (context) => {
      const directory = privateTempDirectory('faunapoolen-prefix-drift-test-');
      const databasePath = path.join(directory, 'faunapoolen.db');
      context.after(() => fs.rmSync(directory, { force: true, recursive: true }));
      const seed = openOwnedSqliteDatabase({
        configuration: { busyTimeoutMs: 5_000, journalMode: 'wal' },
        databasePath,
        operationalRoot: directory,
      });
      applySqliteMigrations(seed.database, FAUNAPOOLEN_MIGRATIONS.slice(0, 1), {
        fingerprint: sha256Hex,
        now: () => '2026-08-01T00:00:00.000Z',
      });
      insertCampaignImportReceipt(seed.database, {
        campaignCount: 0,
        formatVersion: 1,
        orderedCampaignsSha256: 'd'.repeat(64),
        sourceBytes: 0,
        sourceSha256: 'e'.repeat(64),
      });
      for (const statement of drift.statements) seed.database.execute(statement);
      seed.close();
      const before = captureMigrationAuthority(databasePath);

      assert.throws(
        () =>
          openFaunapoolenDatabase({
            databasePath,
            operationalRoot: directory,
            requireExisting: true,
            verifyBeforeWrite(database) {
              verifyLegacyCampaignRuntimeMarker(database);
            },
          }),
        drift.expected,
      );

      assert.deepEqual(captureMigrationAuthority(databasePath), before);
      assert.equal(JSON.parse(before.ledger).length, 1);
      for (const suffix of ['-journal', '-shm', '-wal']) {
        assert.equal(fs.existsSync(`${databasePath}${suffix}`), false);
      }
    });
  }
});

test('database allocation pins canonical private storage while readiness stays constant-size', (t) => {
  const root = privateTempDirectory('faunapoolen-storage-test-');
  const databasePath = path.join(root, 'data', 'faunapoolen.db');
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));

  const database = openFaunapoolenDatabase({ databasePath, operationalRoot: root });
  const dataStats = fs.lstatSync(path.dirname(databasePath));
  const databaseStats = fs.lstatSync(databasePath);
  assert.equal(dataStats.isDirectory(), true);
  assert.equal(dataStats.isSymbolicLink(), false);
  assert.equal(dataStats.uid, process.geteuid?.());
  assert.equal(dataStats.mode & 0o777, 0o700);
  assert.equal(databaseStats.isFile(), true);
  assert.equal(databaseStats.nlink, 1);
  assert.equal(databaseStats.uid, process.geteuid?.());
  assert.equal(databaseStats.mode & 0o777, 0o600);
  for (const suffix of ['-wal', '-shm', '-journal']) {
    const sidecar = `${databasePath}${suffix}`;
    if (fs.existsSync(sidecar)) assert.equal(fs.lstatSync(sidecar).mode & 0o777, 0o600);
  }

  const statements: string[] = [];
  const recording: SyncSqliteDatabase = {
    execute(sql) {
      statements.push(sql);
      database.sqlite.execute(sql);
    },
    run(sql, parameters) {
      statements.push(sql);
      return database.sqlite.run(sql, parameters);
    },
    get<Row extends SqliteRow = SqliteRow>(sql: string, parameters?: readonly SqliteValue[]) {
      statements.push(sql);
      return database.sqlite.get<Row>(sql, parameters);
    },
    all<Row extends SqliteRow = SqliteRow>(sql: string, parameters?: readonly SqliteValue[]) {
      statements.push(sql);
      return database.sqlite.all<Row>(sql, parameters);
    },
  };
  verifyFaunapoolenDatabaseReadiness(recording);
  assert.equal(
    statements.some((sql) => /integrity_check|foreign_key_check/iu.test(sql)),
    false,
  );
  assert.equal(database.isReady(), true);

  const originalPath = `${databasePath}.original`;
  fs.renameSync(databasePath, originalPath);
  fs.copyFileSync(originalPath, databasePath, fs.constants.COPYFILE_EXCL);
  fs.chmodSync(databasePath, 0o600);
  assert.equal(database.isReady(), false);
  assert.throws(
    () => database.close(),
    (error) => {
      assert.ok(error instanceof AggregateError);
      assert.match(error.message, /Owned SQLite close failed/u);
      assert.ok(
        error.errors.some((cause) =>
          /Owned SQLite database path changed while SQLite was owned/u.test(String(cause)),
        ),
      );
      return true;
    },
  );
  assert.equal(database.isReady(), false);
});

test('database allocation rejects linked, public, escaped, and interchanged directory ancestors', (t) => {
  const root = privateTempDirectory('faunapoolen-storage-escape-test-');
  const outside = privateTempDirectory('faunapoolen-storage-outside-test-');
  t.after(() => {
    fs.rmSync(root, { force: true, recursive: true });
    fs.rmSync(outside, { force: true, recursive: true });
  });

  fs.symlinkSync(outside, path.join(root, 'linked'));
  assert.throws(
    () =>
      openFaunapoolenDatabase({
        databasePath: path.join(root, 'linked', 'private', 'faunapoolen.db'),
        operationalRoot: root,
      }),
    /real mode-0700|symbolic/iu,
  );
  assert.equal(fs.existsSync(path.join(outside, 'private')), false);

  const publicDirectory = path.join(root, 'public-data');
  fs.mkdirSync(publicDirectory, { mode: 0o750 });
  fs.chmodSync(publicDirectory, 0o750);
  assert.throws(
    () =>
      openFaunapoolenDatabase({
        databasePath: path.join(publicDirectory, 'faunapoolen.db'),
        operationalRoot: root,
      }),
    /mode-0700/iu,
  );

  assert.throws(
    () =>
      openFaunapoolenDatabase({
        databasePath: path.join(outside, 'faunapoolen.db'),
        operationalRoot: root,
      }),
    /inside its operational root/iu,
  );

  const pinnedPath = path.join(root, 'pinned', 'faunapoolen.db');
  const pinned = openFaunapoolenDatabase({
    databasePath: pinnedPath,
    operationalRoot: root,
  });
  fs.renameSync(path.dirname(pinnedPath), path.join(root, 'pinned-original'));
  fs.mkdirSync(path.dirname(pinnedPath), { mode: 0o700 });
  assert.equal(pinned.isReady(), false);
  assert.throws(
    () => pinned.close(),
    (error) => {
      assert.ok(error instanceof AggregateError);
      assert.match(error.message, /Owned SQLite close failed/u);
      assert.ok(
        error.errors.some((cause) =>
          /Owned SQLite database directory identity changed while SQLite was owned/u.test(
            String(cause),
          ),
        ),
      );
      return true;
    },
  );
});

test('campaign records enforce canonical projections, capacity, optimistic revisions, and active-run deletion', (t) => {
  let now = Date.parse(UPDATED_AT);
  const persistence = persistenceFixture(t, () => now);
  const created = persistence.campaigns.create(record(10, 'copy'));
  assert.equal(created.revision, 1);
  assert.equal(persistence.campaigns.get(created.record.id)?.record.name, created.record.name);
  assert.deepEqual(
    persistence.campaigns.list().map(({ id }) => id),
    [created.record.id],
  );

  now += 1_000;
  const updated = persistence.campaigns.updateCopy({
    campaignId: created.record.id,
    expectedRevision: 1,
    field: 'headline',
    language: 'en',
    value: 'A deliberately owner-edited headline',
  });
  assert.equal(updated?.revision, 2);
  assert.equal(updated?.record.copy.en?.headline, 'A deliberately owner-edited headline');
  assert.throws(
    () =>
      persistence.campaigns.updateCopy({
        campaignId: created.record.id,
        expectedRevision: 1,
        field: 'headline',
        language: 'en',
        value: 'Stale edit',
      }),
    CampaignRevisionConflictError,
  );

  const strategyRun = admitRun(persistence, { kind: 'initial', run: runInput(211) });
  const runningStrategy = persistence.generations.transitionRun({
    expectedRevision: strategyRun.revision,
    runId: strategyRun.runId,
    state: 'running',
  });
  const finalizedStrategy = persistence.generations.finalizeStage({
    expectedRunRevision: runningStrategy.revision,
    outcome: {
      campaign: { kind: 'create', record: record(211, 'strategy') },
      nextRun: runInput(212, {
        campaignId: campaignId(211),
        expectedCampaignRevision: 1,
        ownerSessionIdHash: OWNER_HASH,
        stage: 'copy',
      }),
      state: 'succeeded',
    },
    runId: runningStrategy.runId,
  });
  assert.throws(
    () => persistence.campaigns.delete(finalizedStrategy.campaign?.record.id ?? '', 1),
    CampaignActiveGenerationError,
  );

  for (let index = 11; index < 209; index += 1) {
    persistence.campaigns.create(record(index, 'strategy'));
  }
  assert.equal(persistence.campaigns.list().length, 200);
  assert.throws(() => persistence.campaigns.create(record(209, 'strategy')), CampaignCapacityError);
});

test('every owner and generation mutation advances global campaign activity under clock skew', (t) => {
  let now = Date.parse(CREATED_AT) + 1;
  const persistence = persistenceFixture(t, () => now);
  const olderRecord = validateCampaignRecord({
    ...record(213, 'copy'),
    updatedAt: '2026-08-01T03:00:00.000Z',
  });
  const newerRecord = validateCampaignRecord({
    ...record(214, 'copy'),
    updatedAt: '2026-08-01T04:00:00.000Z',
  });
  const older = persistence.campaigns.create(olderRecord);
  const newer = persistence.campaigns.create(newerRecord);
  assert.deepEqual(
    persistence.campaigns.list().map(({ id }) => id),
    [newer.record.id, older.record.id],
  );

  const regressed = persistence.campaigns.updateCopy({
    campaignId: older.record.id,
    expectedRevision: older.revision,
    field: 'headline',
    language: 'en',
    value: 'Owner edit after the wall clock regressed',
  });
  assert.ok(regressed);
  assert.ok(Date.parse(regressed.record.updatedAt) > Date.parse(newer.record.updatedAt));
  assert.deepEqual(
    persistence.campaigns.list().map(({ id }) => id),
    [older.record.id, newer.record.id],
  );

  now = Date.parse(regressed.record.updatedAt);
  const tied = persistence.campaigns.updateCopy({
    campaignId: older.record.id,
    expectedRevision: regressed.revision,
    field: 'headline',
    language: 'en',
    value: 'Owner edit at the exact prior activity timestamp',
  });
  assert.ok(tied);
  assert.ok(Date.parse(tied.record.updatedAt) > Date.parse(regressed.record.updatedAt));

  const imported = validateCampaignRecord({
    ...record(215, 'strategy'),
    updatedAt: '2026-08-01T05:00:00.000Z',
  });
  insertSyntheticImport(persistence, imported, 3);
  const admitted = admitRun(
    persistence,
    {
      kind: 'imported',
      run: runInput(215, {
        campaignId: imported.id,
        expectedCampaignRevision: 1,
        stage: 'copy',
      }),
    },
    now,
  );
  const running = persistence.generations.transitionRun({
    expectedRevision: admitted.revision,
    runId: admitted.runId,
    state: 'running',
  });
  const generated = persistence.generations.finalizeStage({
    expectedRunRevision: running.revision,
    outcome: {
      campaign: {
        expectedRevision: 1,
        kind: 'replace',
        record: validateCampaignRecord({ ...record(215, 'copy'), updatedAt: CREATED_AT }),
      },
      errorCode: 'synthetic_partial_copy',
      errorMessage: 'Synthetic partial copy is preserved for the monotonic activity test.',
      state: 'failed',
    },
    runId: running.runId,
  });
  assert.ok(generated.campaign);
  assert.ok(Date.parse(generated.campaign.record.updatedAt) > Date.parse(imported.updatedAt));
  assert.deepEqual(
    persistence.campaigns.list().map(({ id }) => id),
    [imported.id, older.record.id, newer.record.id],
  );
});

test('campaign sequence never reuses a deleted row and fails before its safe-integer ceiling', (t) => {
  const persistence = persistenceFixture(t);
  const first = persistence.campaigns.create(record(210, 'strategy'));
  assert.equal(first.sequence, 1);
  assert.equal(persistence.campaigns.delete(first.record.id, first.revision), true);
  const second = persistence.campaigns.create(record(211, 'strategy'));
  assert.equal(second.sequence, 2);
  assert.ok(second.sequence > first.sequence);

  persistence.database.sqlite.run(`UPDATE sqlite_sequence SET seq = ? WHERE name = 'campaigns'`, [
    Number.MAX_SAFE_INTEGER,
  ]);
  assert.throws(
    () => persistence.campaigns.create(record(212, 'strategy')),
    CampaignSequenceCapacityError,
  );
  assert.equal(persistence.campaigns.get(campaignId(212)), null);
});

test('owner authentication persists only hashes and atomically throttles, creates, touches, and deletes sessions', async (t) => {
  const persistence = persistenceFixture(t);
  const repository = persistence.ownerAuth;
  const now = 1_800_000_000;
  assert.deepEqual(await repository.readLoginThrottle(CLIENT_HASH, now), { status: 'allowed' });
  for (let attempt = 1; attempt < 5; attempt += 1) {
    assert.deepEqual(await repository.recordLoginFailure(CLIENT_HASH, now + attempt), {
      status: 'allowed',
    });
  }
  assert.deepEqual(await repository.recordLoginFailure(CLIENT_HASH, now + 5), {
    retryAfterSeconds: 900,
    status: 'rate_limited',
  });

  const session = {
    createdAt: now + 10,
    expiresAt: now + 3_610,
    lastSeenAt: now + 10,
    revision: 1,
    sessionIdHash: 'd'.repeat(64),
  };
  assert.equal(
    await repository.createSessionAndClearLoginFailures({ clientKeyHash: CLIENT_HASH, session }),
    'created',
  );
  assert.deepEqual(await repository.readLoginThrottle(CLIENT_HASH, now + 10), {
    status: 'allowed',
  });
  assert.deepEqual(await repository.findSession(session.sessionIdHash), session);
  const touched = await repository.touchSession({
    expectedRevision: session.revision,
    lastSeenAt: session.lastSeenAt + 60,
    sessionIdHash: session.sessionIdHash,
  });
  assert.deepEqual(touched, { ...session, lastSeenAt: now + 70, revision: 2 });

  // A concurrent request holding the old revision cannot overwrite the winner, and a later
  // retry can never move activity backward even when its observed timestamp is older.
  assert.equal(
    await repository.touchSession({
      expectedRevision: session.revision,
      lastSeenAt: session.lastSeenAt + 30,
      sessionIdHash: session.sessionIdHash,
    }),
    null,
  );
  const monotonic = await repository.touchSession({
    expectedRevision: 2,
    lastSeenAt: session.lastSeenAt + 30,
    sessionIdHash: session.sessionIdHash,
  });
  assert.deepEqual(monotonic, { ...session, lastSeenAt: now + 70, revision: 3 });
  assert.deepEqual(await repository.findSession(session.sessionIdHash), monotonic);
  assert.equal(await repository.deleteSession(session.sessionIdHash), true);
  assert.equal(await repository.findSession(session.sessionIdHash), null);

  const rawAddress = '203.0.113.42';
  const persistedThrottle = persistence.database.sqlite.get<{
    readonly client_key_hash: string;
  }>('SELECT client_key_hash FROM login_failure_windows LIMIT 1');
  assert.notEqual(persistedThrottle?.client_key_hash, rawAddress);
});

test('generation admission charges only atomically accepted runs and enforces its bounded window', (t) => {
  const persistence = persistenceFixture(t);
  const policy = { maximumGenerations: 2, windowMs: 60_000 };
  const first = persistence.generationAdmission.admit({
    kind: 'initial',
    now: 1_000,
    policy,
    run: runInput(220),
  });
  assert.equal(first.status, 'accepted');
  assert.deepEqual(first.allowance, { allowed: true, count: 1, retryAt: 61_000 });
  assert.equal(persistence.generations.getRunByJobId(first.run.jobId)?.runId, first.run.runId);
  assert.equal(persistence.generations.getRunByJobId('missing-job-0001'), null);
  const second = persistence.generationAdmission.admit({
    kind: 'initial',
    now: 2_000,
    policy,
    run: runInput(221),
  });
  assert.equal(second.status, 'accepted');
  assert.deepEqual(second.allowance, { allowed: true, count: 2, retryAt: 61_000 });
  const limited = persistence.generationAdmission.admit({
    kind: 'initial',
    now: 3_000,
    policy,
    run: runInput(222),
  });
  assert.deepEqual(limited, {
    allowance: { allowed: false, count: 2, retryAt: 61_000 },
    status: 'rate_limited',
  });
  assert.equal(persistence.generations.getRun(runInput(222).runId), null);
  const reset = persistence.generationAdmission.admit({
    kind: 'initial',
    now: 61_000,
    policy,
    run: runInput(223),
  });
  assert.equal(reset.status, 'accepted');
  assert.deepEqual(reset.allowance, { allowed: true, count: 1, retryAt: 121_000 });
});

test('generation admission rolls back its allowance and enqueued job when run persistence fails', (t) => {
  const persistence = persistenceFixture(t);
  const first = persistence.generationAdmission.admit({
    kind: 'initial',
    now: 1_000,
    policy: TEST_GENERATION_POLICY,
    run: runInput(230),
  });
  assert.equal(first.status, 'accepted');
  if (first.status !== 'accepted')
    assert.fail('Initial synthetic admission was unexpectedly denied.');
  const jobCountBefore = Number(
    persistence.database.sqlite.get<{ readonly count: number | bigint }>(
      'SELECT COUNT(*) AS count FROM cx_jobs',
    )?.count,
  );

  const failingRun = runInput(231);
  persistence.database.sqlite.execute(`
    CREATE TRIGGER synthetic_admission_crash_seam
    BEFORE INSERT ON generation_runs
    WHEN NEW.run_id = '${failingRun.runId}'
    BEGIN
      SELECT RAISE(ABORT, 'synthetic admission crash seam');
    END
  `);
  // This private test trigger fails only after durable enqueue. The immediate transaction is the
  // crash seam: neither the charged window nor the newly inserted job may survive.
  assert.throws(
    () =>
      persistence.generationAdmission.admit({
        kind: 'initial',
        now: 2_000,
        policy: TEST_GENERATION_POLICY,
        run: failingRun,
      }),
    /synthetic admission crash seam/iu,
  );
  assert.equal(
    Number(
      persistence.database.sqlite.get<{ readonly generation_count: number | bigint }>(
        'SELECT generation_count FROM generation_windows WHERE owner_scope = ?',
        ['global-owner'],
      )?.generation_count,
    ),
    1,
  );
  assert.equal(
    Number(
      persistence.database.sqlite.get<{ readonly count: number | bigint }>(
        'SELECT COUNT(*) AS count FROM cx_jobs',
      )?.count,
    ),
    jobCountBefore,
  );
  assert.equal(persistence.generations.getLatestRun(campaignId(231)), null);
});

test('generation admission uses one global owner budget across concurrent and renewed sessions', (t) => {
  const persistence = persistenceFixture(t);
  const policy = { maximumGenerations: 1, windowMs: 60_000 };
  assert.equal(
    persistence.generationAdmission.admit({
      kind: 'initial',
      now: 1_000,
      policy,
      run: runInput(232, { ownerSessionIdHash: OWNER_HASH }),
    }).status,
    'accepted',
  );
  const renewedSessionResult = persistence.generationAdmission.admit({
    kind: 'initial',
    now: 2_000,
    policy,
    run: runInput(233, { ownerSessionIdHash: 'f'.repeat(64) }),
  });
  assert.equal(renewedSessionResult.status, 'rate_limited');
  assert.equal(persistence.generations.getLatestRun(campaignId(233)), null);
});

test('generation admission reclaims only the expired global owner window', (t) => {
  const persistence = persistenceFixture(t);
  persistence.database.sqlite.run(
    `INSERT INTO generation_windows (
       owner_scope, window_started_at, window_duration_ms, generation_count, updated_at
     ) VALUES ('global-owner', 1, 100, 1, 1)`,
  );
  const accepted = persistence.generationAdmission.admit({
    kind: 'initial',
    now: 2_000,
    policy: TEST_GENERATION_POLICY,
    run: runInput(234, { ownerSessionIdHash: 'f'.repeat(64) }),
  });
  assert.equal(accepted.status, 'accepted');
  assert.equal(
    Number(
      persistence.database.sqlite.get<{ readonly count: number | bigint }>(
        'SELECT COUNT(*) AS count FROM generation_windows',
      )?.count,
    ),
    1,
  );
});

test('auth capacity refuses atomically without clearing the keyed failure row', async (t) => {
  const persistence = persistenceFixture(t);
  const repository = persistence.ownerAuth;
  const now = 1_800_000_000;
  await repository.recordLoginFailure(CLIENT_HASH, now);
  for (let index = 0; index < 64; index += 1) {
    const result = await repository.createSessionAndClearLoginFailures({
      clientKeyHash: `${index.toString(16).padStart(64, '0')}`,
      session: {
        createdAt: now,
        expiresAt: now + 3_600,
        lastSeenAt: now,
        revision: 1,
        sessionIdHash: `${(index + 1_000).toString(16).padStart(64, '0')}`,
      },
    });
    assert.equal(result, 'created');
  }
  assert.equal(
    await repository.createSessionAndClearLoginFailures({
      clientKeyHash: CLIENT_HASH,
      session: {
        createdAt: now,
        expiresAt: now + 3_600,
        lastSeenAt: now,
        revision: 1,
        sessionIdHash: 'e'.repeat(64),
      },
    }),
    'capacity_reached',
  );
  assert.equal(
    persistence.database.sqlite.get(
      'SELECT 1 AS present FROM login_failure_windows WHERE client_key_hash = ?',
      [CLIENT_HASH],
    ) !== undefined,
    true,
  );
  assert.equal(await repository.findSession('e'.repeat(64)), null);
});

test('login-failure storage returns capacity without losing concurrent policy state', async (t) => {
  const persistence = persistenceFixture(t);
  const now = 1_800_000_000;
  withImmediateTransaction(persistence.database.sqlite, () => {
    for (let index = 0; index < 10_000; index += 1) {
      persistence.database.sqlite.run(
        `INSERT INTO login_failure_windows (
           client_key_hash, window_started_at, failure_count, blocked_until, updated_at
         ) VALUES (?, ?, 1, NULL, ?)`,
        [index.toString(16).padStart(64, '0'), now, now],
      );
    }
  });
  assert.deepEqual(await persistence.ownerAuth.recordLoginFailure('f'.repeat(64), now), {
    status: 'capacity_reached',
  });
  assert.equal(
    Number(
      persistence.database.sqlite.get<{ readonly count: number | bigint }>(
        'SELECT COUNT(*) AS count FROM login_failure_windows',
      )?.count,
    ),
    10_000,
  );
});

test('login-failure storage reclaims only windows whose policy and block have both expired', async (t) => {
  const persistence = persistenceFixture(t);
  const now = 1_800_000_000;
  withImmediateTransaction(persistence.database.sqlite, () => {
    for (let index = 0; index < 10_000; index += 1) {
      persistence.database.sqlite.run(
        `INSERT INTO login_failure_windows (
           client_key_hash, window_started_at, failure_count, blocked_until, updated_at
         ) VALUES (?, ?, 1, ?, ?)`,
        [
          index.toString(16).padStart(64, '0'),
          now - 901,
          index === 0 ? now + 100 : null,
          now - 901,
        ],
      );
    }
  });
  assert.deepEqual(await persistence.ownerAuth.recordLoginFailure('f'.repeat(64), now), {
    status: 'allowed',
  });
  assert.equal(
    Number(
      persistence.database.sqlite.get<{ readonly count: number | bigint }>(
        'SELECT COUNT(*) AS count FROM login_failure_windows',
      )?.count,
    ),
    2,
  );
  assert.notEqual(
    persistence.database.sqlite.get(
      'SELECT 1 AS present FROM login_failure_windows WHERE client_key_hash = ?',
      ['0'.repeat(64)],
    ),
    undefined,
  );
});

test('revision-zero strategy generation retries only after an absent-campaign failed or ambiguous run', (t) => {
  let now = 1_800_000_000_000;
  const persistence = persistenceFixture(t, () => ++now);
  const first = admitRun(persistence, { kind: 'initial', run: runInput(300) }, now);
  const running = persistence.generations.transitionRun({
    expectedRevision: first.revision,
    runId: first.runId,
    state: 'running',
  });
  const failed = persistence.generations.transitionRun({
    errorCode: 'provider_failed',
    errorMessage: 'Synthetic provider failure.',
    expectedRevision: running.revision,
    runId: first.runId,
    state: 'failed',
  });
  assert.equal(failed.state, 'failed');

  assert.throws(
    () =>
      admitRun(
        persistence,
        {
          kind: 'retry',
          requiredCampaignRevision: 0,
          run: runInput(301, {
            attempt: 2,
            campaignId: first.campaignId,
            expectedCampaignRevision: 0,
            strategyIdea: 'A different durable idea cannot replace the original lineage.',
          }),
        },
        now,
      ),
    /failed or ambiguous prior run|next attempt/iu,
  );
  assert.equal(
    Number(
      persistence.database.sqlite.get<{ readonly count: number | bigint }>(
        'SELECT COUNT(*) AS count FROM generation_windows',
      )?.count,
    ),
    1,
  );

  const retried = admitRun(
    persistence,
    {
      kind: 'retry',
      requiredCampaignRevision: 0,
      run: runInput(301, {
        attempt: 2,
        campaignId: first.campaignId,
        expectedCampaignRevision: 0,
      }),
    },
    now,
  );
  assert.equal(retried.expectedCampaignRevision, 0);
  assert.equal(retried.stage, 'strategy');
  assert.equal(retried.strategyIdea, first.strategyIdea);

  const existingId = campaignId(302);
  persistence.campaigns.create(record(302, 'strategy'));
  assert.throws(
    () =>
      admitRun(persistence, {
        kind: 'retry',
        requiredCampaignRevision: 0,
        run: runInput(302, { campaignId: existingId, expectedCampaignRevision: 0 }),
      }),
    CampaignRevisionConflictError,
  );
  assert.throws(
    () =>
      admitRun(persistence, {
        kind: 'retry',
        requiredCampaignRevision: 0,
        run: runInput(303, { expectedCampaignRevision: 0, stage: 'copy' }),
      }),
    /Only absent-campaign strategy|Campaign/iu,
  );
});

test('strategy retry retains its immutable idea across restart after the terminal job is pruned', (t) => {
  const directory = privateTempDirectory('faunapoolen-restart-test-');
  const databasePath = path.join(directory, 'faunapoolen.db');
  let jobSequence = 0;
  let now = 1_800_000_000_000;
  const open = () =>
    createFaunapoolenPersistence({
      clock: () => now,
      createJobId: () => `restart-job-${String(++jobSequence).padStart(8, '0')}`,
      createLeaseToken: () => `restart-lease-${String(jobSequence).padStart(8, '0')}`,
      databasePath,
      operationalRoot: directory,
    });
  let persistence = open();
  t.after(() => {
    persistence.close();
    fs.rmSync(directory, { force: true, recursive: true });
  });

  const initial = admitRun(persistence, { kind: 'initial', run: runInput(305) }, now);
  const claimed = persistence.jobs.claim('restart-test-worker');
  assert.ok(claimed);
  assert.equal(claimed.id, initial.jobId);
  persistence.jobs.complete(claimed);
  const running = persistence.generations.transitionRun({
    expectedRevision: initial.revision,
    runId: initial.runId,
    state: 'running',
  });
  persistence.generations.transitionRun({
    errorCode: 'synthetic_terminal_failure',
    errorMessage: 'The synthetic strategy run stopped after its durable job completed.',
    expectedRevision: running.revision,
    runId: running.runId,
    state: 'failed',
  });
  now += 1;
  assert.equal(persistence.jobs.pruneTerminal(now, 10), 1);
  assert.equal(persistence.jobs.get(initial.jobId), null);
  persistence.close();

  persistence = open();
  const restarted = persistence.generations.getLatestRun(initial.campaignId);
  assert.equal(restarted?.strategyIdea, initial.strategyIdea);
  assert.equal(restarted?.state, 'failed');
  assert.deepEqual(
    persistence.generations
      .listLatestRecoverableRuns({ limit: 100 })
      .map(({ campaignId, runId, state }) => ({ campaignId, runId, state })),
    [{ campaignId: initial.campaignId, runId: initial.runId, state: 'failed' }],
  );
  assert.throws(
    () => persistence.generations.listLatestRecoverableRuns({ limit: 0 }),
    /between 1 and 100/iu,
  );
  assert.throws(
    () => persistence.generations.listLatestRecoverableRuns({ limit: 101 }),
    /between 1 and 100/iu,
  );
  const retry = admitRun(
    persistence,
    {
      kind: 'retry',
      requiredCampaignRevision: 0,
      run: runInput(306, {
        attempt: 2,
        campaignId: initial.campaignId,
        expectedCampaignRevision: 0,
        ownerSessionIdHash: CLIENT_HASH,
        strategyIdea: restarted?.strategyIdea ?? null,
      }),
    },
    now,
  );
  assert.equal(retry.strategyIdea, initial.strategyIdea);
  assert.equal(retry.ownerSessionIdHash, CLIENT_HASH);
  assert.equal(persistence.jobs.get(retry.jobId)?.status, 'queued');
  assert.deepEqual(
    persistence.generations
      .listLatestRecoverableRuns({ limit: 100 })
      .map(({ runId, state }) => ({ runId, state })),
    [{ runId: retry.runId, state: 'queued' }],
  );
});

test('stage finalization atomically hands off by monotonic sequence and preserves partial copy on terminal failure', (t) => {
  const fixedNow = 1_800_000_000_000;
  const persistence = persistenceFixture(t, () => fixedNow);
  const initial = admitRun(
    persistence,
    {
      kind: 'initial',
      run: runInput(310, { runId: 'ffffffff-ffff-4fff-bfff-ffffffffffff' }),
    },
    fixedNow,
  );
  const strategyRunning = persistence.generations.transitionRun({
    expectedRevision: initial.revision,
    runId: initial.runId,
    state: 'running',
  });
  const strategyDone = persistence.generations.finalizeStage({
    expectedRunRevision: strategyRunning.revision,
    outcome: {
      campaign: { kind: 'create', record: record(310, 'strategy') },
      nextRun: runInput(311, {
        campaignId: campaignId(310),
        expectedCampaignRevision: 1,
        runId: '00000000-0000-4000-8000-000000000001',
        stage: 'copy',
      }),
      state: 'succeeded',
    },
    runId: initial.runId,
  });
  assert.equal(strategyDone.finalizedRun.createdAt, strategyDone.nextRun?.createdAt);
  assert.ok((strategyDone.nextRun?.runSequence ?? 0) > strategyDone.finalizedRun.runSequence);
  assert.equal(
    persistence.generations.getLatestRun(campaignId(310))?.runId,
    '00000000-0000-4000-8000-000000000001',
  );
  assert.throws(
    () =>
      persistence.database.sqlite.run(
        `INSERT INTO generation_runs (
           run_id, campaign_id, owner_session_id_hash, stage, strategy_idea, state,
           expected_campaign_revision, job_id, attempt, created_at, updated_at,
           finished_at, revision
         ) VALUES (?, ?, ?, 'prompts', NULL, 'queued', 1, ?, 1, ?, ?, NULL, 1)`,
        [
          '00000000-0000-4000-8000-000000000002',
          campaignId(310),
          OWNER_HASH,
          'cross-stage-job-0001',
          fixedNow,
          fixedNow,
        ],
      ),
    /UNIQUE/iu,
  );
  assert.equal(
    Number(
      persistence.database.sqlite.get<{ readonly count: number | bigint }>(
        `SELECT COUNT(*) AS count FROM generation_runs
         WHERE campaign_id = ? AND state IN ('queued', 'running')`,
        [campaignId(310)],
      )?.count,
    ),
    1,
  );

  const copyRunning = persistence.generations.transitionRun({
    expectedRevision: strategyDone.nextRun?.revision ?? 0,
    runId: strategyDone.nextRun?.runId ?? '',
    state: 'running',
  });
  const partial = validateCampaignRecord({
    ...record(310, 'copy'),
    copy: { en: copy('en') },
  });
  assert.throws(
    () =>
      persistence.generations.finalizeStage({
        expectedRunRevision: copyRunning.revision,
        outcome: {
          campaign: { expectedRevision: 1, kind: 'replace', record: partial },
          nextRun: runInput(312, {
            campaignId: campaignId(310),
            expectedCampaignRevision: 999,
            stage: 'prompts',
          }),
          state: 'succeeded',
        },
        runId: copyRunning.runId,
      }),
    /next generation run/iu,
  );
  assert.equal(persistence.campaigns.get(campaignId(310))?.revision, 1);
  assert.equal(persistence.generations.getRun(copyRunning.runId)?.state, 'running');

  const partialFailure = persistence.generations.finalizeStage({
    expectedRunRevision: copyRunning.revision,
    outcome: {
      campaign: { expectedRevision: 1, kind: 'replace', record: partial },
      errorCode: 'partial_copy',
      errorMessage: 'English succeeded while Swedish failed.',
      state: 'failed',
    },
    runId: copyRunning.runId,
  });
  assert.equal(partialFailure.finalizedRun.state, 'failed');
  assert.equal(partialFailure.nextRun, null);
  assert.deepEqual(Object.keys(partialFailure.campaign?.record.copy ?? {}), ['en']);
  assert.equal(partialFailure.campaign?.revision, 2);
});

test('generation sequence capacity fails before enqueue and never infers order from clocks or ids', (t) => {
  const persistence = persistenceFixture(t, () => 1_800_000_000_000);
  persistence.database.sqlite.run(
    `INSERT INTO sqlite_sequence(name, seq) VALUES ('generation_runs', ?)`,
    [Number.MAX_SAFE_INTEGER],
  );
  const jobsBefore = Number(
    persistence.database.sqlite.get<{ readonly count: number | bigint }>(
      'SELECT COUNT(*) AS count FROM cx_jobs',
    )?.count,
  );
  assert.throws(
    () =>
      persistence.generationAdmission.admit({
        kind: 'initial',
        now: 1_800_000_000_000,
        policy: TEST_GENERATION_POLICY,
        run: runInput(315),
      }),
    GenerationRunCapacityError,
  );
  const jobsAfter = Number(
    persistence.database.sqlite.get<{ readonly count: number | bigint }>(
      'SELECT COUNT(*) AS count FROM cx_jobs',
    )?.count,
  );
  assert.equal(jobsAfter, jobsBefore);
  assert.equal(
    Number(
      persistence.database.sqlite.get<{ readonly count: number | bigint }>(
        'SELECT COUNT(*) AS count FROM generation_windows',
      )?.count,
    ),
    0,
  );
});

test('coordinated maintenance reclaims fresh terminal run and job history before hard capacity', (t) => {
  const now = 1_000;
  const persistence = persistenceFixture(t, () => now);
  const owned = admitRun(persistence, { kind: 'initial', run: runInput(330) }, now);
  const claim = persistence.jobs.claim('retention-pressure-worker');
  assert.ok(claim);
  const running = persistence.generations.transitionRun({
    expectedRevision: owned.revision,
    runId: owned.runId,
    state: 'running',
  });
  persistence.generations.transitionRun({
    expectedRevision: running.revision,
    runId: owned.runId,
    state: 'succeeded',
  });
  persistence.jobs.complete(claim);

  const pressureTarget = Math.floor(MAX_GENERATION_RUNS * 0.9);
  withImmediateTransaction(persistence.database.sqlite, () => {
    for (let index = 0; index < pressureTarget - 1; index += 1) {
      insertTerminalGenerationRun(persistence, 400_000 + index, { finishedAt: now });
    }
  });
  assert.equal(
    Number(
      persistence.database.sqlite.get<{ readonly count: number | bigint }>(
        'SELECT COUNT(*) AS count FROM generation_runs',
      )?.count,
    ),
    pressureTarget,
  );
  assert.deepEqual(persistence.generationMaintenance.maintainTerminalStorage({ limit: 1, now }), {
    effects: 0,
    jobs: 1,
    responseBytes: 0,
    runs: 1,
  });
  assert.equal(persistence.generations.getRun(owned.runId), null);
  assert.equal(persistence.jobs.get(owned.jobId), null);
  assert.equal(
    persistence.generationAdmission.admit({
      kind: 'initial',
      now: now + 1,
      policy: TEST_GENERATION_POLICY,
      run: runInput(500_000),
    }).status,
    'accepted',
  );
});

test('retention bounds fresh revision-zero failures and restores admission before hard capacity', (t) => {
  const now = 2_000;
  const persistence = persistenceFixture(t, () => now);
  const pressureTarget = Math.floor(MAX_GENERATION_RUNS * 0.9);
  withImmediateTransaction(persistence.database.sqlite, () => {
    for (let index = 0; index < pressureTarget; index += 1) {
      insertTerminalGenerationRun(persistence, 600_000 + index, {
        finishedAt: now,
        state: 'failed',
      });
    }
  });
  assert.equal(persistence.generations.listLatestRecoverableRuns({ limit: 100 }).length, 100);
  assert.deepEqual(persistence.generationMaintenance.maintainTerminalStorage({ limit: 100, now }), {
    effects: 0,
    jobs: 0,
    responseBytes: 0,
    runs: 100,
  });
  assert.equal(
    Number(
      persistence.database.sqlite.get<{ readonly count: number | bigint }>(
        'SELECT COUNT(*) AS count FROM generation_runs',
      )?.count,
    ),
    pressureTarget - 100,
  );
  assert.equal(
    persistence.generationAdmission.admit({
      kind: 'initial',
      now: now + 1,
      policy: TEST_GENERATION_POLICY,
      run: runInput(800_000),
    }).status,
    'accepted',
  );
});

test('retention survives restart, deletes whole old aggregates, and preserves latest retry lineage', (t) => {
  const directory = privateTempDirectory('faunapoolen-retention-restart-test-');
  const databasePath = path.join(directory, 'faunapoolen.db');
  const open = () =>
    createFaunapoolenPersistence({
      databasePath,
      operationalRoot: directory,
    });
  let persistence = open();
  t.after(() => {
    persistence.close();
    fs.rmSync(directory, { force: true, recursive: true });
  });

  const sharedCampaignId = campaignId(335);
  persistence.campaigns.create(record(335, 'strategy'));
  const succeeded = insertTerminalGenerationRun(persistence, 335, {
    campaignId: sharedCampaignId,
    finishedAt: 1_000,
  });
  const recoverable = insertTerminalGenerationRun(persistence, 336, {
    campaignId: sharedCampaignId,
    finishedAt: 1_001,
    state: 'failed',
  });
  const responseBytes = Buffer.from('{"sealed":"old"}', 'utf8');
  persistence.database.sqlite.run(
    `INSERT INTO provider_effects (
       effect_id, run_id, effect_key, operation, request_sha256, state,
       provider_response_id, response_sha256, response_json,
       created_at, updated_at, finished_at, revision
     ) VALUES (?, ?, 'old-effect', 'responses.create', ?, 'succeeded',
               'old-response-id', ?, ?, 1000, 1000, 1000, 1)`,
    [
      'retained-effect-old-0001',
      succeeded.runId,
      REQUEST_HASH,
      sha256Hex(responseBytes),
      responseBytes,
    ],
  );
  persistence.database.sqlite.run(
    `INSERT INTO provider_effects (
       effect_id, run_id, effect_key, operation, request_sha256, state,
       error_code, error_message, created_at, updated_at, finished_at, revision
     ) VALUES (?, ?, 'recoverable-effect', 'responses.create', ?, 'ambiguous',
               'synthetic_ambiguity', 'Synthetic ambiguous provider receipt.',
               1001, 1001, 1001, 1)`,
    ['retained-effect-latest-0001', recoverable.runId, 'd'.repeat(64)],
  );
  persistence.close();

  persistence = open();
  assert.deepEqual(
    persistence.generationMaintenance.maintainTerminalStorage({
      limit: 100,
      now: 30 * 24 * 60 * 60 * 1_000 + 2_000,
    }),
    { effects: 1, jobs: 0, responseBytes: responseBytes.byteLength, runs: 1 },
  );
  assert.equal(persistence.generations.getRun(succeeded.runId), null);
  assert.equal(persistence.generations.getRun(recoverable.runId)?.state, 'failed');
  assert.equal(
    persistence.generations.getEffect('retained-effect-latest-0001')?.state,
    'ambiguous',
  );
  persistence.close();
  persistence = open();
  assert.equal(persistence.isReady(), true);
  assert.equal(persistence.generations.getRun(recoverable.runId)?.strategyIdea?.length !== 0, true);
});

test('imported continuation derives work from sealed content and copy can finish without replaying prompts', (t) => {
  let now = 1_800_000_000_000;
  const persistence = persistenceFixture(t, () => ++now);
  const completeMissingCopy = validateCampaignRecord({
    ...record(316, 'complete'),
    copy: { en: copy('en') },
  });
  const copyWithoutPrompts = validateCampaignRecord({
    ...record(317, 'copy'),
    copy: { sv: copy('sv') },
  });
  const retryWithPrompts = validateCampaignRecord({
    ...record(318, 'complete'),
    copy: { en: copy('en') },
    stage: 'copy',
  });
  const fullyComplete = record(319, 'complete');
  [completeMissingCopy, copyWithoutPrompts, retryWithPrompts, fullyComplete].forEach(
    (campaign, index) => insertSyntheticImport(persistence, campaign, index + 1),
  );

  const missingCopyRun = admitRun(persistence, {
    kind: 'imported',
    run: runInput(316, {
      campaignId: completeMissingCopy.id,
      expectedCampaignRevision: 1,
      stage: 'copy',
    }),
  });
  assert.equal(missingCopyRun.stage, 'copy');
  const promptRun = admitRun(persistence, {
    kind: 'imported',
    run: runInput(317, {
      campaignId: copyWithoutPrompts.id,
      expectedCampaignRevision: 1,
      stage: 'prompts',
    }),
  });
  assert.equal(promptRun.stage, 'prompts');
  const retryRun = admitRun(persistence, {
    kind: 'imported',
    run: runInput(318, {
      campaignId: retryWithPrompts.id,
      expectedCampaignRevision: 1,
      stage: 'copy',
    }),
  });
  const retryRunning = persistence.generations.transitionRun({
    expectedRevision: retryRun.revision,
    runId: retryRun.runId,
    state: 'running',
  });
  const completedCopy = validateCampaignRecord({
    ...retryWithPrompts,
    copy: { en: copy('en'), sv: copy('sv') },
    stage: 'complete',
    updatedAt: '2026-08-01T03:04:05.006Z',
  });
  const finalized = persistence.generations.finalizeStage({
    expectedRunRevision: retryRunning.revision,
    outcome: {
      campaign: { expectedRevision: 1, kind: 'replace', record: completedCopy },
      state: 'succeeded',
    },
    runId: retryRunning.runId,
  });
  assert.equal(finalized.campaign?.record.stage, 'complete');
  assert.equal(finalized.nextRun, null);
  assert.throws(
    () =>
      admitRun(persistence, {
        kind: 'imported',
        run: runInput(319, {
          campaignId: fullyComplete.id,
          expectedCampaignRevision: 1,
          stage: 'copy',
        }),
      }),
    /sealed campaign stage/iu,
  );
  assert.throws(
    () =>
      admitRun(persistence, {
        kind: 'imported',
        run: runInput(320, {
          campaignId: completeMissingCopy.id,
          expectedCampaignRevision: 1,
          stage: 'copy',
        }),
      }),
    CampaignRevisionConflictError,
  );
});

test('positive-revision generation retries retain campaign CAS and atomically enqueue runs', (t) => {
  let now = 1_800_000_000_000;
  const persistence = persistenceFixture(t, () => ++now);
  const imported = record(320, 'strategy');
  insertSyntheticImport(persistence, imported, 1);
  const initial = admitRun(persistence, {
    kind: 'imported',
    run: runInput(320, {
      campaignId: imported.id,
      expectedCampaignRevision: 1,
      stage: 'copy',
    }),
  });
  const running = persistence.generations.transitionRun({
    expectedRevision: initial.revision,
    runId: initial.runId,
    state: 'running',
  });
  persistence.generations.transitionRun({
    errorCode: 'invalid_output',
    errorMessage: 'Synthetic invalid output.',
    expectedRevision: running.revision,
    runId: initial.runId,
    state: 'ambiguous',
  });
  const retry = admitRun(persistence, {
    kind: 'retry',
    requiredCampaignRevision: 1,
    run: runInput(321, {
      attempt: 2,
      campaignId: imported.id,
      expectedCampaignRevision: 1,
      stage: 'copy',
    }),
  });
  assert.equal(persistence.jobs.get(retry.jobId)?.status, 'queued');
  assert.throws(
    () =>
      admitRun(persistence, {
        kind: 'retry',
        requiredCampaignRevision: 2,
        run: runInput(322, {
          attempt: 3,
          campaignId: imported.id,
          expectedCampaignRevision: 2,
          stage: 'copy',
        }),
      }),
    CampaignRevisionConflictError,
  );
});

test('creating-effect recovery preserves another worker lease and quarantines it only after expiry', (t) => {
  let now = 10_000;
  const persistence = persistenceFixture(t, () => now);
  const run = admitRun(persistence, { kind: 'initial', run: runInput(339) }, now);
  const claim = persistence.jobs.claim('synthetic-worker-owner-a');
  assert.ok(claim);
  assert.equal(claim.id, run.jobId);
  const effect = persistence.generations.prepareEffect({
    effectId: 'effect-live-lease-0001',
    effectKey: 'strategy-create',
    operation: 'responses.create',
    requestSha256: REQUEST_HASH,
    runId: run.runId,
  });
  persistence.generations.transitionEffect({
    effectId: effect.effectId,
    expectedRevision: effect.revision,
    state: 'creating',
  });

  now = claim.leaseExpiresAt - 1;
  assert.equal(persistence.generations.markCreatingEffectsAmbiguous(now), 0);
  assert.equal(persistence.generations.getEffect(effect.effectId)?.state, 'creating');
  now = claim.leaseExpiresAt;
  assert.equal(persistence.generations.markCreatingEffectsAmbiguous(now), 1);
  assert.equal(persistence.generations.getEffect(effect.effectId)?.state, 'ambiguous');
});

test('post-restart reconciliation closes max-attempt job orphans and restores deletion', (t) => {
  const directory = privateTempDirectory('faunapoolen-reconciliation-test-');
  const databasePath = path.join(directory, 'faunapoolen.db');
  let now = 20_000;
  let jobSequence = 0;
  const open = () =>
    createFaunapoolenPersistence({
      clock: () => now,
      createJobId: () => `reconcile-job-${String(++jobSequence).padStart(8, '0')}`,
      createLeaseToken: () => `reconcile-lease-${String(jobSequence).padStart(8, '0')}`,
      databasePath,
      operationalRoot: directory,
    });
  let persistence = open();
  t.after(() => {
    persistence.close();
    fs.rmSync(directory, { force: true, recursive: true });
  });

  const campaign = record(338, 'strategy');
  insertSyntheticImport(persistence, campaign, 1);
  const run = admitRun(
    persistence,
    {
      kind: 'imported',
      run: runInput(338, {
        campaignId: campaign.id,
        expectedCampaignRevision: 1,
        stage: 'copy',
      }),
    },
    now,
  );
  const maximumAttempts = persistence.jobs.get(run.jobId)?.maxAttempts;
  assert.ok(maximumAttempts);
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const claim = persistence.jobs.claim(`reconciliation-worker-${String(attempt)}`);
    assert.ok(claim);
    assert.equal(claim.id, run.jobId);
    if (attempt === 1) {
      persistence.generations.transitionRun({
        expectedRevision: run.revision,
        runId: run.runId,
        state: 'running',
      });
    }
    now = claim.leaseExpiresAt;
    const recovery = persistence.jobs.recoverExpired();
    assert.deepEqual(
      recovery,
      attempt === maximumAttempts ? { failed: 1, retried: 0 } : { failed: 0, retried: 1 },
    );
    if (attempt < maximumAttempts) {
      const queued = persistence.jobs.get(run.jobId);
      assert.equal(queued?.status, 'queued');
      now = queued?.availableAt ?? now;
    }
  }
  assert.equal(persistence.generations.getRun(run.runId)?.state, 'running');
  persistence.close();

  persistence = open();
  assert.deepEqual(persistence.generationMaintenance.reconcileTerminalJobs({ limit: 100, now }), {
    ambiguous: 0,
    failed: 1,
    resumed: 0,
  });
  assert.equal(persistence.generations.getRun(run.runId)?.state, 'failed');
  assert.deepEqual(
    persistence.generations.listLatestRecoverableRuns({ limit: 100 }).map(({ runId, state }) => ({
      runId,
      state,
    })),
    [{ runId: run.runId, state: 'failed' }],
  );
  assert.equal(persistence.campaigns.delete(campaign.id, 1), true);
  assert.equal(persistence.generations.getRun(run.runId), null);
  assert.equal(persistence.jobs.get(run.jobId), null);
});

test('terminal-job reconciliation preserves pending response identity as ambiguous', (t) => {
  let now = 30_000;
  const persistence = persistenceFixture(t, () => now);
  const run = admitRun(persistence, { kind: 'initial', run: runInput(337) }, now);
  const claim = persistence.jobs.claim('pending-reconciliation-worker');
  assert.ok(claim);
  persistence.generations.transitionRun({
    expectedRevision: run.revision,
    runId: run.runId,
    state: 'running',
  });
  const prepared = persistence.generations.prepareEffect({
    effectId: 'effect-reconcile-pending-0001',
    effectKey: 'strategy-create',
    operation: 'responses.create',
    requestSha256: REQUEST_HASH,
    runId: run.runId,
  });
  const creating = persistence.generations.transitionEffect({
    effectId: prepared.effectId,
    expectedRevision: prepared.revision,
    state: 'creating',
  });
  const submitted = persistence.generations.transitionEffect({
    effectId: prepared.effectId,
    expectedRevision: creating.revision,
    providerResponseId: 'response-reconcile-pending-0001',
    state: 'submitted',
  });
  persistence.generations.transitionEffect({
    effectId: prepared.effectId,
    expectedRevision: submitted.revision,
    state: 'polling',
  });
  now = claim.leaseExpiresAt;
  persistence.database.sqlite.run(
    `UPDATE cx_jobs
     SET status = 'failed', barrier = 0,
         lease_owner = NULL, lease_token = NULL, lease_expires_at = NULL,
         failure_code = 'lease_expired',
         failure_message = 'The worker stopped and exhausted its attempts.',
         finished_at = ?, updated_at = ?
     WHERE id = ? AND status = 'running'`,
    [now, now, run.jobId],
  );
  assert.deepEqual(persistence.generationMaintenance.reconcileTerminalJobs({ limit: 100, now }), {
    ambiguous: 1,
    failed: 0,
    resumed: 0,
  });
  const effect = persistence.generations.getEffect(prepared.effectId);
  assert.equal(effect?.state, 'ambiguous');
  assert.equal(effect?.providerResponseId, 'response-reconcile-pending-0001');
  assert.equal(effect?.errorCode, 'provider_effect_incomplete_at_job_failure');
  assert.equal(persistence.generations.getRun(run.runId)?.state, 'ambiguous');
});

test('a succeeded paid receipt gets one same-run application recovery and can never post again', async (t) => {
  const directory = privateTempDirectory('faunapoolen-receipt-recovery-test-');
  const databasePath = path.join(directory, 'faunapoolen.db');
  let now = 100_000;
  let jobSequence = 0;
  const persistence = createFaunapoolenPersistence({
    clock: () => now,
    createJobId: () => `receipt-job-${String(++jobSequence).padStart(8, '0')}`,
    createLeaseToken: () => `receipt-lease-${String(jobSequence).padStart(8, '0')}`,
    databasePath,
    operationalRoot: directory,
  });
  t.after(() => {
    persistence.close();
    fs.rmSync(directory, { force: true, recursive: true });
  });

  const uuids = [
    '00000000-0000-4000-8000-000000000901',
    '00000000-0000-4000-8000-000000000902',
    '00000000-0000-4000-8000-000000000903',
  ];
  const generation = createGenerationService({
    campaigns: persistence.campaigns,
    clock: () => now,
    createUuid: () => {
      const value = uuids.shift();
      if (!value) throw new Error('Unexpected synthetic generation UUID request.');
      return value;
    },
    generationAdmission: persistence.generationAdmission,
    generations: persistence.generations,
    providerConfigured: true,
  });
  const idea = 'A durable idea whose completed paid result must survive application crashes.';
  const accepted = await generation.createCampaign({ idea, ownerSessionIdHash: OWNER_HASH });
  const firstRun = persistence.generations.getLatestRun(accepted.campaignId);
  assert.ok(firstRun);
  const firstClaim = persistence.jobs.claim('receipt-recovery-worker-1');
  assert.ok(firstClaim);
  assert.equal(firstClaim.id, firstRun.jobId);
  persistence.generations.transitionRun({
    expectedRevision: firstRun.revision,
    runId: firstRun.runId,
    state: 'running',
  });

  let posts = 0;
  const strategy = record(1, 'strategy').strategy;
  const provider = createOpenAiResponsesProvider({
    apiKey: 'synthetic-never-sent',
    clock: () => now,
    fetch: async () => {
      posts += 1;
      return new Response(
        JSON.stringify({
          id: `resp_succeeded_${String(posts).padStart(4, '0')}`,
          output: [
            {
              content: [{ text: JSON.stringify(strategy), type: 'output_text' }],
              type: 'message',
            },
          ],
          status: 'completed',
        }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 },
      );
    },
    repository: persistence.generations,
  });
  assert.deepEqual(
    await provider.generateStructured({
      runId: firstRun.runId,
      signal: new AbortController().signal,
      spec: (correction) => strategyGenerationSpec(idea, correction),
    }),
    strategy,
  );
  assert.equal(posts, 1);
  const effectId = persistence.database.sqlite.get<{ readonly effect_id: string }>(
    'SELECT effect_id FROM provider_effects WHERE run_id = ?',
    [firstRun.runId],
  )?.effect_id;
  assert.ok(effectId);
  const sealedEffect = persistence.generations.getEffect(effectId);
  assert.ok(sealedEffect);

  persistence.database.sqlite.run(
    `UPDATE cx_jobs SET attempts = max_attempts WHERE id = ? AND status = 'running'`,
    [firstRun.jobId],
  );
  now = firstClaim.leaseExpiresAt;
  assert.deepEqual(persistence.jobs.recoverExpired(), { failed: 1, retried: 0 });
  assert.deepEqual(persistence.generationMaintenance.reconcileTerminalJobs({ limit: 100, now }), {
    ambiguous: 0,
    failed: 0,
    resumed: 1,
  });
  const resumedRun = persistence.generations.getRun(firstRun.runId);
  assert.ok(resumedRun);
  assert.equal(resumedRun.runId, firstRun.runId);
  assert.notEqual(resumedRun.jobId, firstRun.jobId);
  assert.equal(resumedRun.state, 'running');
  assert.deepEqual(persistence.generations.getEffect(effectId), sealedEffect);
  assert.equal(persistence.jobs.get(firstRun.jobId)?.status, 'failed');
  assert.equal(persistence.jobs.get(resumedRun.jobId)?.status, 'queued');
  assert.equal(
    Number(
      persistence.database.sqlite.get<{ readonly count: number | bigint }>(
        'SELECT COUNT(*) AS count FROM generation_receipt_recoveries WHERE run_id = ?',
        [firstRun.runId],
      )?.count,
    ),
    1,
  );
  await assert.rejects(
    generation.retryCampaign({
      campaignId: accepted.campaignId,
      expectedRevision: 0,
      ownerSessionIdHash: CLIENT_HASH,
      stage: 'strategy',
    }),
    (error: unknown) =>
      !!error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'generation_retry_unavailable',
  );
  assert.equal(posts, 1);

  let claimed = false;
  const singleRecoveryClaimStore: DurableJobStore = {
    leaseDurationMs: persistence.jobs.leaseDurationMs,
    maxConcurrentJobs: persistence.jobs.maxConcurrentJobs,
    claim(owner) {
      if (claimed) return null;
      claimed = true;
      return persistence.jobs.claim(owner);
    },
    complete: (claim) => persistence.jobs.complete(claim),
    defer: (claim, deferral) => persistence.jobs.defer(claim, deferral),
    delay: (claim, delay) => persistence.jobs.delay(claim, delay),
    enqueue: (input) => persistence.jobs.enqueue(input),
    fail: (claim, failure) => persistence.jobs.fail(claim, failure),
    get: (id) => persistence.jobs.get(id),
    heartbeat: (claim) => persistence.jobs.heartbeat(claim),
    pruneTerminal: (before, limit) => persistence.jobs.pruneTerminal(before, limit),
    recoverExpired: () => persistence.jobs.recoverExpired(),
    withTransaction: (work) => persistence.jobs.withTransaction(work),
  };
  const recoveryWorker = createDurableWorker({
    classifyFailure: (error, claim) => classifyCampaignGenerationFailure(error, claim.updatedAt),
    handlers: createCampaignGenerationHandlers({
      campaigns: persistence.campaigns,
      clock: () => now,
      createUuid: () => {
        const value = uuids.shift();
        if (!value) throw new Error('Unexpected synthetic recovery UUID request.');
        return value;
      },
      generations: persistence.generations,
      provider,
    }),
    owner: 'receipt-recovery-worker-2',
    scheduleHeartbeat: () => () => {},
    scheduleTimeout: () => () => {},
    store: singleRecoveryClaimStore,
  });
  assert.equal(await recoveryWorker.runUntilIdle(), 1);
  assert.equal(claimed, true);
  assert.equal(posts, 1);
  const completedRun = persistence.generations.getRun(firstRun.runId);
  assert.ok(completedRun);
  assert.equal(completedRun.state, 'succeeded');
  assert.equal(completedRun.runId, firstRun.runId);
  assert.equal(completedRun.jobId, resumedRun.jobId);
  assert.equal(persistence.jobs.get(resumedRun.jobId)?.status, 'succeeded');
  assert.deepEqual(persistence.generations.getEffect(effectId), sealedEffect);
  const campaign = persistence.campaigns.get(accepted.campaignId);
  assert.ok(campaign);
  assert.equal(campaign.record.stage, 'strategy');
  assert.equal(campaign.revision, 1);
  const nextRun = persistence.generations.getLatestRun(accepted.campaignId);
  assert.ok(nextRun);
  assert.notEqual(nextRun.runId, firstRun.runId);
  assert.equal(nextRun.stage, 'copy');
  assert.equal(nextRun.state, 'queued');
  assert.equal(persistence.jobs.get(nextRun.jobId)?.status, 'queued');
  assert.deepEqual(
    persistence.database.sqlite.all<{
      readonly job_id: string;
      readonly run_id: string;
      readonly stage: string;
      readonly state: string;
    }>(
      `SELECT run_id, job_id, stage, state FROM generation_runs
       WHERE campaign_id = ? ORDER BY run_sequence`,
      [accepted.campaignId],
    ),
    [
      {
        job_id: resumedRun.jobId,
        run_id: firstRun.runId,
        stage: 'strategy',
        state: 'succeeded',
      },
      {
        job_id: nextRun.jobId,
        run_id: nextRun.runId,
        stage: 'copy',
        state: 'queued',
      },
    ],
  );
  assert.equal(
    Number(
      persistence.database.sqlite.get<{ readonly count: number | bigint }>(
        'SELECT COUNT(*) AS count FROM provider_effects WHERE run_id = ?',
        [firstRun.runId],
      )?.count,
    ),
    1,
  );
});

test('completed receipt application recovery is a one-use reserve after another crash', (t) => {
  let now = 120_000;
  const persistence = persistenceFixture(t, () => now);
  const run = admitRun(persistence, { kind: 'initial', run: runInput(355) }, now);
  const originalClaim = persistence.jobs.claim('receipt-reserve-worker-1');
  assert.ok(originalClaim);
  const running = persistence.generations.transitionRun({
    expectedRevision: run.revision,
    runId: run.runId,
    state: 'running',
  });
  const prepared = persistence.generations.prepareEffect({
    effectId: 'receipt-reserve-effect-0001',
    effectKey: 'campaign.strategy:attempt:1',
    operation: 'campaign.strategy',
    requestSha256: REQUEST_HASH,
    runId: run.runId,
  });
  const creating = persistence.generations.transitionEffect({
    effectId: prepared.effectId,
    expectedRevision: prepared.revision,
    state: 'creating',
  });
  const submitted = persistence.generations.transitionEffect({
    effectId: prepared.effectId,
    expectedRevision: creating.revision,
    providerResponseId: 'response-receipt-reserve-0001',
    state: 'submitted',
  });
  const succeeded = persistence.generations.transitionEffect({
    effectId: prepared.effectId,
    expectedRevision: submitted.revision,
    providerResponseId: 'response-receipt-reserve-0001',
    response: { id: 'response-receipt-reserve-0001', output: [] },
    state: 'succeeded',
  });
  persistence.database.sqlite.run(
    `UPDATE cx_jobs SET attempts = max_attempts WHERE id = ? AND status = 'running'`,
    [originalClaim.id],
  );
  now = originalClaim.leaseExpiresAt;
  assert.deepEqual(persistence.jobs.recoverExpired(), { failed: 1, retried: 0 });
  assert.deepEqual(persistence.generationMaintenance.reconcileTerminalJobs({ limit: 100, now }), {
    ambiguous: 0,
    failed: 0,
    resumed: 1,
  });
  const resumed = persistence.generations.getRun(run.runId);
  assert.ok(resumed);
  assert.equal(resumed.state, 'running');
  assert.equal(resumed.revision, running.revision + 1);
  assert.notEqual(resumed.jobId, originalClaim.id);
  assert.deepEqual(persistence.generations.getEffect(prepared.effectId), succeeded);

  const recoveryClaim = persistence.jobs.claim('receipt-reserve-worker-2');
  assert.ok(recoveryClaim);
  assert.equal(recoveryClaim.id, resumed.jobId);
  persistence.database.sqlite.run(
    `UPDATE cx_jobs SET attempts = max_attempts WHERE id = ? AND status = 'running'`,
    [recoveryClaim.id],
  );
  now = recoveryClaim.leaseExpiresAt;
  assert.deepEqual(persistence.jobs.recoverExpired(), { failed: 1, retried: 0 });
  assert.deepEqual(persistence.generationMaintenance.reconcileTerminalJobs({ limit: 100, now }), {
    ambiguous: 0,
    failed: 1,
    resumed: 0,
  });
  assert.equal(persistence.generations.getRun(run.runId)?.state, 'failed');
  assert.deepEqual(persistence.generations.getEffect(prepared.effectId), succeeded);
  assert.equal(
    Number(
      persistence.database.sqlite.get<{ readonly count: number | bigint }>(
        'SELECT COUNT(*) AS count FROM generation_receipt_recoveries WHERE run_id = ?',
        [run.runId],
      )?.count,
    ),
    1,
  );
  assert.equal(
    Number(
      persistence.database.sqlite.get<{ readonly count: number | bigint }>(
        `SELECT COUNT(*) AS count FROM cx_jobs
         WHERE idempotency_key LIKE 'campaign-generation-receipt-recovery:%'`,
      )?.count,
    ),
    1,
  );
});

test('provider effects seal requests, allow only forward transitions, and quarantine creating ambiguity', (t) => {
  let now = 1_800_000_000_000;
  const persistence = persistenceFixture(t, () => ++now);
  const run = admitRun(persistence, { kind: 'initial', run: runInput(340) });
  const uncertain = persistence.generations.prepareEffect({
    effectId: 'effect-00000001',
    effectKey: 'strategy-create',
    operation: 'responses.create',
    requestSha256: REQUEST_HASH,
    runId: run.runId,
  });
  assert.deepEqual(
    persistence.generations.prepareEffect({
      effectId: 'effect-00000001',
      effectKey: 'strategy-create',
      operation: 'responses.create',
      requestSha256: REQUEST_HASH,
      runId: run.runId,
    }),
    uncertain,
  );
  const creating = persistence.generations.transitionEffect({
    effectId: uncertain.effectId,
    expectedRevision: uncertain.revision,
    state: 'creating',
  });
  assert.equal(creating.state, 'creating');
  assert.deepEqual(
    persistence.generations.transitionEffect({
      effectId: uncertain.effectId,
      expectedRevision: uncertain.revision,
      state: 'creating',
    }),
    creating,
  );
  assert.equal(persistence.generations.markCreatingEffectsAmbiguous(++now), 1);
  const ambiguous = persistence.generations.getEffect(uncertain.effectId);
  assert.equal(ambiguous?.state, 'ambiguous');
  assert.throws(
    () =>
      persistence.generations.transitionEffect({
        effectId: uncertain.effectId,
        expectedRevision: ambiguous?.revision ?? 0,
        providerResponseId: 'response-00000001',
        state: 'submitted',
      }),
    ProviderEffectReplayBlockedError,
  );

  const safe = persistence.generations.prepareEffect({
    effectId: 'effect-00000002',
    effectKey: 'strategy-poll',
    operation: 'responses.create',
    requestSha256: REQUEST_HASH,
    runId: run.runId,
  });
  const safeCreating = persistence.generations.transitionEffect({
    effectId: safe.effectId,
    expectedRevision: safe.revision,
    state: 'creating',
  });
  const submitted = persistence.generations.transitionEffect({
    effectId: safe.effectId,
    expectedRevision: safeCreating.revision,
    providerResponseId: 'response-00000002',
    state: 'submitted',
  });
  const polling = persistence.generations.transitionEffect({
    effectId: safe.effectId,
    expectedRevision: submitted.revision,
    state: 'polling',
  });
  const succeeded = persistence.generations.transitionEffect({
    effectId: safe.effectId,
    expectedRevision: polling.revision,
    response: { output: ['synthetic', { accepted: true }] },
    state: 'succeeded',
  });
  assert.equal(succeeded.state, 'succeeded');
  assert.equal(succeeded.providerResponseId, 'response-00000002');
  assert.equal(succeeded.responseSha256?.length, 64);
  assert.deepEqual(
    persistence.generations.transitionEffect({
      effectId: safe.effectId,
      expectedRevision: polling.revision,
      response: { output: ['synthetic', { accepted: true }] },
      state: 'succeeded',
    }),
    succeeded,
  );
  assert.throws(
    () =>
      persistence.generations.transitionEffect({
        effectId: safe.effectId,
        expectedRevision: succeeded.revision - 1,
        state: 'polling',
      }),
    PersistenceRevisionConflictError,
  );

  const exhausted = persistence.generations.prepareEffect({
    effectId: 'effect-00000003',
    effectKey: 'strategy-exhausted-poll',
    operation: 'responses.create',
    requestSha256: 'd'.repeat(64),
    runId: run.runId,
  });
  const exhaustedCreating = persistence.generations.transitionEffect({
    effectId: exhausted.effectId,
    expectedRevision: exhausted.revision,
    state: 'creating',
  });
  const exhaustedSubmitted = persistence.generations.transitionEffect({
    effectId: exhausted.effectId,
    expectedRevision: exhaustedCreating.revision,
    providerResponseId: 'response-00000003',
    state: 'submitted',
  });
  const exhaustedPolling = persistence.generations.transitionEffect({
    effectId: exhausted.effectId,
    expectedRevision: exhaustedSubmitted.revision,
    state: 'polling',
  });
  const exhaustedAmbiguous = persistence.generations.transitionEffect({
    effectId: exhausted.effectId,
    errorCode: 'retrieval_exhausted',
    errorMessage: 'The provider result remained pending after every bounded retrieval attempt.',
    expectedRevision: exhaustedPolling.revision,
    state: 'ambiguous',
  });
  assert.equal(exhaustedAmbiguous.providerResponseId, 'response-00000003');
  assert.deepEqual(
    persistence.generations.transitionEffect({
      effectId: exhausted.effectId,
      errorCode: 'retrieval_exhausted',
      errorMessage: 'The provider result remained pending after every bounded retrieval attempt.',
      expectedRevision: exhaustedPolling.revision,
      state: 'ambiguous',
    }),
    exhaustedAmbiguous,
  );
  assert.throws(
    () =>
      persistence.generations.transitionEffect({
        effectId: exhausted.effectId,
        expectedRevision: exhaustedAmbiguous.revision,
        response: { late: true },
        state: 'succeeded',
      }),
    ProviderEffectReplayBlockedError,
  );

  const oversized = persistence.generations.prepareEffect({
    effectId: 'effect-00000004',
    effectKey: 'strategy-oversized-response',
    operation: 'responses.create',
    requestSha256: 'e'.repeat(64),
    runId: run.runId,
  });
  const oversizedCreating = persistence.generations.transitionEffect({
    effectId: oversized.effectId,
    expectedRevision: oversized.revision,
    state: 'creating',
  });
  const oversizedSubmitted = persistence.generations.transitionEffect({
    effectId: oversized.effectId,
    expectedRevision: oversizedCreating.revision,
    providerResponseId: 'response-00000004',
    state: 'submitted',
  });
  assert.throws(
    () =>
      persistence.generations.transitionEffect({
        effectId: oversized.effectId,
        expectedRevision: oversizedSubmitted.revision,
        response: { output: 'x'.repeat(MAX_PROVIDER_RESPONSE_BYTES) },
        state: 'succeeded',
      }),
    /hard bound/iu,
  );
});

test('campaign deletion removes its complete terminal job, run, effect, and response aggregate', (t) => {
  let now = 1_800_000_000_000;
  const persistence = persistenceFixture(t, () => ++now);
  const campaign = record(345, 'strategy');
  insertSyntheticImport(persistence, campaign, 1);
  const run = admitRun(persistence, {
    kind: 'imported',
    run: runInput(345, {
      campaignId: campaign.id,
      expectedCampaignRevision: 1,
      stage: 'copy',
    }),
  });
  const claim = persistence.jobs.claim('campaign-delete-worker');
  assert.ok(claim);
  const running = persistence.generations.transitionRun({
    expectedRevision: run.revision,
    runId: run.runId,
    state: 'running',
  });
  const prepared = persistence.generations.prepareEffect({
    effectId: 'effect-delete-0001',
    effectKey: 'copy-create',
    operation: 'responses.create',
    requestSha256: REQUEST_HASH,
    runId: run.runId,
  });
  const creating = persistence.generations.transitionEffect({
    effectId: prepared.effectId,
    expectedRevision: prepared.revision,
    state: 'creating',
  });
  const submitted = persistence.generations.transitionEffect({
    effectId: prepared.effectId,
    expectedRevision: creating.revision,
    providerResponseId: 'response-delete-0001',
    state: 'submitted',
  });
  persistence.generations.transitionEffect({
    effectId: prepared.effectId,
    expectedRevision: submitted.revision,
    response: { copy: 'synthetic private provider output' },
    state: 'succeeded',
  });
  persistence.generations.transitionRun({
    errorCode: 'invalid_copy_output',
    errorMessage: 'The synthetic provider output failed product validation.',
    expectedRevision: running.revision,
    runId: run.runId,
    state: 'failed',
  });
  persistence.jobs.complete(claim);

  assert.throws(
    () =>
      persistence.database.sqlite.run('DELETE FROM provider_effects WHERE effect_id = ?', [
        prepared.effectId,
      ]),
    /only be deleted with their run aggregate/iu,
  );
  assert.equal(persistence.campaigns.delete(campaign.id, 1), true);
  for (const table of ['campaigns', 'generation_runs', 'provider_effects', 'cx_jobs']) {
    assert.equal(
      Number(
        persistence.database.sqlite.get<{ readonly count: number | bigint }>(
          `SELECT COUNT(*) AS count FROM ${table}`,
        )?.count,
      ),
      0,
    );
  }
});

test('campaign import replay is immutable and a raced source change rolls back every target artifact', async (t) => {
  const fixture = campaignImportFixture(t, 930);
  const sourceBefore = sourceFileProof(fixture.filePath);
  const receipt = await importCampaignDirectory({
    databasePath: fixture.databasePath,
    sourceDirectory: fixture.sourceDirectory,
  });
  assert.equal(receipt.campaignCount, 1);
  assertSourceFileProof(fixture.filePath, sourceBefore);
  const targetBefore = sourceFileProof(fixture.databasePath);

  assert.deepEqual(
    await importCampaignDirectory({
      databasePath: fixture.databasePath,
      sourceDirectory: fixture.sourceDirectory,
    }),
    receipt,
  );
  assertSourceFileProof(fixture.filePath, sourceBefore);
  assertSourceFileProof(fixture.databasePath, targetBefore);

  const race = campaignImportFixture(t, 931);
  await assert.rejects(
    importCampaignDirectoryForTest(
      { databasePath: race.databasePath, sourceDirectory: race.sourceDirectory },
      {
        onCheckpoint(checkpoint) {
          if (checkpoint === 'before_publish') fs.appendFileSync(race.filePath, ' ');
        },
      },
    ),
    (error: unknown) => error instanceof CampaignImportError && error.code === 'source_changed',
  );
  assert.equal(fs.existsSync(race.databasePath), false);
  assert.equal(fs.existsSync(race.stagingDirectory), false);
});

test('campaign import requires the same private parent contract as ordinary persistence open', async (t) => {
  const fixture = campaignImportFixture(t, 932);
  const dataDirectory = path.join(fixture.directory, 'private-data');
  fs.mkdirSync(dataDirectory, { mode: 0o700 });
  fs.chmodSync(dataDirectory, 0o777);
  const databasePath = path.join(dataDirectory, 'faunapoolen.db');
  const stagingDirectory = path.join(dataDirectory, '.faunapoolen.db.import-stage');
  const intentPath = path.join(dataDirectory, '.faunapoolen.db.import-intent.json');

  await assert.rejects(
    importCampaignDirectory({ databasePath, sourceDirectory: fixture.sourceDirectory }),
    (error: unknown) => error instanceof CampaignImportError && error.code === 'invalid_options',
  );
  assert.equal(fs.existsSync(databasePath), false);
  assert.equal(fs.existsSync(stagingDirectory), false);
  assert.equal(fs.existsSync(intentPath), false);

  fs.chmodSync(dataDirectory, 0o700);
  const receipt = await importCampaignDirectory({
    databasePath,
    sourceDirectory: fixture.sourceDirectory,
  });
  let verified: ReturnType<typeof verifyLegacyCampaignRuntimeMarker> | undefined;
  const persistence = createFaunapoolenPersistence({
    databasePath,
    operationalRoot: fixture.directory,
    requireExisting: true,
    verifyBeforeWrite(database) {
      verified = verifyLegacyCampaignRuntimeMarker(database);
    },
  });
  try {
    assert.deepEqual(verified, receipt);
    assert.equal(persistence.isReady(), true);
    assert.equal(persistence.campaigns.list().length, 1);
  } finally {
    persistence.close();
  }
});

test('campaign import preserves a live owner even before its intent bytes are written', async (t) => {
  const fixture = campaignImportFixture(t, 939);
  const importerUrl = pathToFileURL(path.join(import.meta.dirname, 'campaign-import.ts')).href;
  const childProgram = String.raw`
    const importer = await import(process.env.FAUNAPOOLEN_TEST_IMPORTER_URL);
    await importer.importCampaignDirectoryForTest(
      {
        databasePath: process.env.FAUNAPOOLEN_TEST_DATABASE_PATH,
        sourceDirectory: process.env.FAUNAPOOLEN_TEST_SOURCE_DIRECTORY,
      },
      {
        onAllocationPhase(observed) {
          if (observed === 'intent_allocated') {
            process.stdout.write('INTENT_ALLOCATED\n');
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 30_000);
          }
        },
        onCheckpoint() {},
      },
    );
  `;
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', '--input-type=module', '--eval', childProgram],
    {
      cwd: import.meta.dirname,
      env: {
        ...process.env,
        FAUNAPOOLEN_TEST_DATABASE_PATH: fixture.databasePath,
        FAUNAPOOLEN_TEST_IMPORTER_URL: importerUrl,
        FAUNAPOOLEN_TEST_SOURCE_DIRECTORY: fixture.sourceDirectory,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  t.after(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  });
  let childStderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    childStderr += chunk;
  });
  await new Promise<void>((resolve, reject) => {
    let stdout = '';
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for live importer intent. ${childStderr}`)),
      10_000,
    );
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
      if (!stdout.includes('INTENT_ALLOCATED\n')) return;
      clearTimeout(timer);
      resolve();
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      reject(
        new Error(
          `Live importer exited before ownership proof (${String(code)}/${String(signal)}). ${childStderr}`,
        ),
      );
    });
  });

  await assert.rejects(
    importCampaignDirectory({
      databasePath: fixture.databasePath,
      sourceDirectory: fixture.sourceDirectory,
    }),
    (error: unknown) =>
      error instanceof CampaignImportError &&
      error.code === 'recovery_conflict' &&
      /live process/iu.test(error.message),
  );
  assert.equal(fs.existsSync(fixture.databasePath), false);
  assert.equal(fs.existsSync(fixture.stagingDirectory), false);
  assert.equal(fs.existsSync(fixture.intentPath), false);
  assert.equal(
    fs
      .readdirSync(fixture.directory)
      .filter((name) => name.startsWith('.faunapoolen.db.import-intent.prepare-')).length,
    1,
  );

  const childExitPromise = new Promise<{
    readonly code: number | null;
    readonly signal: string | null;
  }>((resolve) => {
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  child.kill('SIGKILL');
  const childExit = await childExitPromise;
  assert.equal(childExit.code, null);
  assert.equal(childExit.signal, 'SIGKILL');
  const receipt = await importCampaignDirectory({
    databasePath: fixture.databasePath,
    sourceDirectory: fixture.sourceDirectory,
  });
  assert.equal(receipt.campaignCount, 1);
  assert.equal(fs.existsSync(fixture.databasePath), true);
  assert.equal(fs.existsSync(fixture.intentPath), false);
  assert.deepEqual(
    fs
      .readdirSync(fixture.directory)
      .filter((name) => name.startsWith('.faunapoolen.db.import-intent.prepare-')),
    [],
  );
});

test('campaign import recovers identity-proven private staging after process death', async (t) => {
  const failurePoints = [
    { kind: 'allocation', name: 'intent_allocated' },
    { kind: 'allocation', name: 'intent_prepared' },
    { kind: 'allocation', name: 'intent_linked' },
    { kind: 'allocation', name: 'intent_durable' },
    { kind: 'allocation', name: 'preparation_durable' },
    { kind: 'allocation', name: 'stage_published' },
    { kind: 'checkpoint', name: 'temporary_created' },
    { kind: 'checkpoint', name: 'target_transaction_started' },
    { kind: 'checkpoint', name: 'campaign_inserted' },
    { kind: 'checkpoint', name: 'before_commit' },
    { kind: 'checkpoint', name: 'target_reopened' },
    { kind: 'checkpoint', name: 'marker_durable' },
    { kind: 'checkpoint', name: 'before_publish' },
    { kind: 'checkpoint', name: 'target_linked' },
    { kind: 'checkpoint', name: 'target_published' },
    { kind: 'checkpoint', name: 'final_source_verified' },
  ] as const;
  for (const [index, failurePoint] of failurePoints.entries()) {
    await t.test(`${failurePoint.kind}:${failurePoint.name}`, async (t) => {
      const fixture = campaignImportFixture(t, 940 + index);
      const sourceBefore = sourceFileProof(fixture.filePath);
      const importerUrl = pathToFileURL(path.join(import.meta.dirname, 'campaign-import.ts')).href;
      const childProgram = String.raw`
        const importer = await import(process.env.FAUNAPOOLEN_TEST_IMPORTER_URL);
        await importer.importCampaignDirectoryForTest(
          {
            databasePath: process.env.FAUNAPOOLEN_TEST_DATABASE_PATH,
            sourceDirectory: process.env.FAUNAPOOLEN_TEST_SOURCE_DIRECTORY,
          },
          {
            onAllocationPhase(observed) {
              if (
                process.env.FAUNAPOOLEN_TEST_KILL_KIND === 'allocation' &&
                observed === process.env.FAUNAPOOLEN_TEST_KILL_POINT
              ) {
                process.kill(process.pid, 'SIGKILL');
              }
            },
            onCheckpoint(observed) {
              if (
                process.env.FAUNAPOOLEN_TEST_KILL_KIND === 'checkpoint' &&
                observed === process.env.FAUNAPOOLEN_TEST_KILL_POINT
              ) {
                process.kill(process.pid, 'SIGKILL');
              }
            },
          },
        );
      `;
      const child = spawnSync(
        process.execPath,
        ['--import', 'tsx', '--input-type=module', '--eval', childProgram],
        {
          encoding: 'utf8',
          env: {
            ...process.env,
            FAUNAPOOLEN_TEST_DATABASE_PATH: fixture.databasePath,
            FAUNAPOOLEN_TEST_IMPORTER_URL: importerUrl,
            FAUNAPOOLEN_TEST_KILL_KIND: failurePoint.kind,
            FAUNAPOOLEN_TEST_KILL_POINT: failurePoint.name,
            FAUNAPOOLEN_TEST_SOURCE_DIRECTORY: fixture.sourceDirectory,
          },
          timeout: 15_000,
        },
      );
      assert.equal(child.error, undefined, child.error?.message ?? 'Importer child spawn failed.');
      assert.equal(child.status, null, child.stderr || child.stdout);
      assert.equal(child.signal, 'SIGKILL', child.stderr || child.stdout);
      const preparedIntentNames = fs
        .readdirSync(fixture.directory)
        .filter((name) => name.startsWith('.faunapoolen.db.import-intent.prepare-'));
      assert.equal(
        fs.existsSync(fixture.intentPath),
        !['intent_allocated', 'intent_prepared'].includes(failurePoint.name),
      );
      assert.equal(
        preparedIntentNames.length,
        ['intent_allocated', 'intent_prepared', 'intent_linked'].includes(failurePoint.name)
          ? 1
          : 0,
      );
      if (failurePoint.name === 'intent_linked') {
        const temporaryStats = fs.statSync(
          path.join(fixture.directory, preparedIntentNames[0] as string),
        );
        const canonicalStats = fs.statSync(fixture.intentPath);
        assert.equal(temporaryStats.ino, canonicalStats.ino);
        assert.equal(temporaryStats.nlink, 2);
        assert.equal(canonicalStats.nlink, 2);
      }
      const preparationNames = fs
        .readdirSync(fixture.directory)
        .filter((name) => name.startsWith('.faunapoolen.db.import-stage.prepare-'));
      if (
        ['intent_allocated', 'intent_prepared', 'intent_linked', 'intent_durable'].includes(
          failurePoint.name,
        )
      ) {
        assert.equal(fs.existsSync(fixture.stagingDirectory), false);
        assert.deepEqual(preparationNames, []);
      } else if (failurePoint.name === 'preparation_durable') {
        assert.equal(fs.existsSync(fixture.stagingDirectory), false);
        assert.equal(preparationNames.length, 1);
        assert.equal(
          fs.existsSync(
            path.join(fixture.directory, preparationNames[0] as string, 'operation.json'),
          ),
          true,
        );
      } else {
        assert.equal(fs.existsSync(fixture.stagingDirectory), true);
        assert.deepEqual(preparationNames, []);
        const marker = JSON.parse(
          fs.readFileSync(path.join(fixture.stagingDirectory, 'operation.json'), 'utf8'),
        ) as { readonly state: string };
        const building = new Set([
          'stage_published',
          'temporary_created',
          'target_transaction_started',
          'campaign_inserted',
          'before_commit',
          'target_reopened',
        ]);
        assert.equal(marker.state, building.has(failurePoint.name) ? 'building' : 'sealed');
      }

      const receipt = await importCampaignDirectory({
        databasePath: fixture.databasePath,
        sourceDirectory: fixture.sourceDirectory,
      });
      assert.equal(receipt.campaignCount, 1);
      assert.equal(fs.existsSync(fixture.databasePath), true);
      assert.equal(fs.statSync(fixture.databasePath).mode & 0o777, 0o600);
      assert.equal(fs.existsSync(fixture.stagingDirectory), false);
      assert.equal(fs.existsSync(fixture.intentPath), false);
      assert.deepEqual(
        fs
          .readdirSync(fixture.directory)
          .filter((name) => name.startsWith('.faunapoolen.db.import-intent.prepare-')),
        [],
      );
      assert.deepEqual(
        fs
          .readdirSync(fixture.directory)
          .filter((name) => name.startsWith('.faunapoolen.db.import-stage.prepare-')),
        [],
      );
      assertSourceFileProof(fixture.filePath, sourceBefore);
    });
  }
});

test('legacy import parity is a one-time pre-activation proof while runtime checks only the sealed marker', async (t) => {
  const fixture = campaignImportFixture(t, 950);
  const receipt = await importCampaignDirectory({
    databasePath: fixture.databasePath,
    sourceDirectory: fixture.sourceDirectory,
  });
  const databaseBytesBeforeVerification = fs.readFileSync(fixture.databasePath);
  const databaseBeforeVerification = fs.lstatSync(fixture.databasePath, { bigint: true });
  const directoryBeforeVerification = fs.readdirSync(fixture.directory).toSorted();
  assert.deepEqual(verifyLegacyCampaignImportPreActivation(fixture.databasePath, receipt), receipt);
  const databaseAfterVerification = fs.lstatSync(fixture.databasePath, { bigint: true });
  assert.deepEqual(fs.readFileSync(fixture.databasePath), databaseBytesBeforeVerification);
  assert.deepEqual(fs.readdirSync(fixture.directory).toSorted(), directoryBeforeVerification);
  assert.equal(databaseAfterVerification.ino, databaseBeforeVerification.ino);
  assert.equal(databaseAfterVerification.mode, databaseBeforeVerification.mode);
  assert.equal(databaseAfterVerification.size, databaseBeforeVerification.size);
  assert.equal(databaseAfterVerification.mtimeNs, databaseBeforeVerification.mtimeNs);
  assert.equal(databaseAfterVerification.ctimeNs, databaseBeforeVerification.ctimeNs);

  let startupReceipt: ReturnType<typeof verifyLegacyCampaignRuntimeMarker> | undefined;
  const persistence = createFaunapoolenPersistence({
    databasePath: fixture.databasePath,
    operationalRoot: fixture.directory,
    requireExisting: true,
    verifyBeforeWrite(database) {
      startupReceipt = verifyLegacyCampaignRuntimeMarker(database);
    },
  });
  try {
    assert.deepEqual(startupReceipt, receipt);
    const created = persistence.campaigns.create(record(951, 'strategy'));
    assert.deepEqual(verifyLegacyCampaignRuntimeMarker(persistence.database.sqlite), receipt);
    assert.throws(
      () => verifyLegacyCampaignImportPreActivation(fixture.databasePath, receipt),
      /SQLite sidecars make the database mutable/iu,
    );
    assert.equal(persistence.campaigns.delete(created.record.id, created.revision), true);
    assert.deepEqual(verifyLegacyCampaignRuntimeMarker(persistence.database.sqlite), receipt);
    const importedId = path.basename(fixture.filePath, '.json');
    const imported = persistence.campaigns.get(importedId);
    assert.ok(imported);
    persistence.campaigns.updateCopy({
      campaignId: importedId,
      expectedRevision: imported.revision,
      field: 'headline',
      language: 'en',
      value: 'A legitimate post-cutover owner edit',
    });
    assert.deepEqual(verifyLegacyCampaignRuntimeMarker(persistence.database.sqlite), receipt);
    assert.throws(
      () => verifyLegacyCampaignImportPreActivation(fixture.databasePath, receipt),
      /SQLite sidecars make the database mutable/iu,
    );
  } finally {
    persistence.close();
  }
  assert.throws(
    () => verifyLegacyCampaignImportPreActivation(fixture.databasePath, receipt),
    /aggregate parity/iu,
  );
});

test('sealed runtime open neither materializes a missing target nor crosses a marker-to-write swap', async (t) => {
  const root = privateTempDirectory('faunapoolen-sealed-open-test-');
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));
  const missingPath = path.join(root, 'missing', 'faunapoolen.db');
  assert.throws(
    () =>
      openFaunapoolenDatabase({
        databasePath: missingPath,
        operationalRoot: root,
        requireExisting: true,
        verifyBeforeWrite: verifyLegacyCampaignRuntimeMarker,
      }),
    /must already exist/iu,
  );
  assert.equal(fs.existsSync(path.dirname(missingPath)), false);
  assert.equal(fs.existsSync(missingPath), false);

  const sourceDirectory = path.join(root, 'campaign-history');
  fs.mkdirSync(sourceDirectory, { mode: 0o700 });
  const campaign = record(952);
  fs.writeFileSync(
    path.join(sourceDirectory, `${campaign.id}.json`),
    `${JSON.stringify(campaign)}\n`,
    {
      mode: 0o600,
    },
  );
  const selected = path.join(root, 'selected.db');
  await importCampaignDirectory({ databasePath: selected, sourceDirectory });
  const replacement = path.join(root, 'replacement.db');
  const markerless = createFaunapoolenPersistence({
    databasePath: replacement,
    operationalRoot: root,
  });
  markerless.close();
  const replacementProof = sourceFileProof(replacement);
  let authorityVerified = false;
  assert.throws(
    () =>
      createFaunapoolenPersistence({
        databasePath: selected,
        operationalRoot: root,
        requireExisting: true,
        verifyBeforeWrite(database) {
          verifyLegacyCampaignRuntimeMarker(database);
          authorityVerified = true;
          fs.renameSync(selected, path.join(root, 'verified-authority.db'));
          fs.renameSync(replacement, selected);
        },
      }),
    (error: unknown) => errorTreeMatches(error, /(?:identity|path) changed|ENOENT|no such file/iu),
  );
  assert.equal(authorityVerified, true);
  assertSourceFileProof(selected, replacementProof);
  for (const suffix of ['-journal', '-shm', '-wal']) {
    const sidecarPath = `${selected}${suffix}`;
    if (!fs.existsSync(sidecarPath)) continue;
    const sidecar = fs.lstatSync(sidecarPath);
    assert.equal(sidecar.isFile(), true);
    assert.equal(sidecar.isSymbolicLink(), false);
    assert.equal(sidecar.uid, process.geteuid?.());
    assert.equal(sidecar.nlink, 1);
    assert.equal(sidecar.mode & 0o777, 0o600);
  }
});
