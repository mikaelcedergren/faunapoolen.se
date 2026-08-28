import {
  DURABLE_JOB_SCHEMA_MIGRATIONS,
  type DurableJobStore,
} from '@mikaelcedergren/cx-framework/server/jobs';
import {
  SQLITE_MIGRATION_LEDGER_TABLE,
  applySqliteMigrations,
  openOwnedSqliteDatabase,
  verifySqliteIntegrity,
  type ReadonlySyncSqliteDatabase,
  type SqliteMigration,
  type SqliteRow,
  type SyncSqliteDatabase,
} from '@mikaelcedergren/cx-framework/server/sqlite';

import { CAMPAIGN_MAX_RECORDS, sha256Hex } from './campaign-schema.js';
import { MAX_IDEA_CHARACTERS, MIN_IDEA_CHARACTERS } from './generation-content.js';

export const MAX_GENERATION_RUNS = 2_000;
export const MAX_RETAINED_GENERATION_JOBS = 2_000;
export const MAX_PROVIDER_EFFECTS = 8_000;
export const MAX_PROVIDER_EFFECTS_PER_RUN = 8;
export const MAX_PROVIDER_RESPONSE_BYTES = 1024 * 1024;
export const MAX_PROVIDER_RESPONSE_BYTES_PER_RUN = 1024 * 1024;
export const MAX_PROVIDER_RESPONSE_TOTAL_BYTES = 512 * 1024 * 1024;

const SQLITE_BUSY_TIMEOUT_MS = 5_000;
const PRODUCT_MIGRATION_COUNT = 4;

const CAMPAIGN_TABLE_SQL = `CREATE TABLE campaigns (
  campaign_sequence INTEGER PRIMARY KEY AUTOINCREMENT
    CHECK(campaign_sequence BETWEEN 1 AND 9007199254740991),
  id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL CHECK(created_at_ms >= 0),
  updated_at TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL CHECK(updated_at_ms >= created_at_ms),
  name TEXT NOT NULL,
  stage TEXT NOT NULL CHECK(stage IN ('strategy', 'copy', 'complete')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1),
  source_filename TEXT UNIQUE,
  source_bytes INTEGER CHECK(source_bytes IS NULL OR source_bytes >= 0),
  source_sha256 TEXT CHECK(
    source_sha256 IS NULL
    OR (length(source_sha256) = 64 AND source_sha256 NOT GLOB '*[^0-9a-f]*')
  ),
  record_sha256 TEXT NOT NULL
    CHECK(length(record_sha256) = 64 AND record_sha256 NOT GLOB '*[^0-9a-f]*'),
  record_json BLOB NOT NULL CHECK(typeof(record_json) = 'blob'),
  CHECK(
    (source_filename IS NULL AND source_bytes IS NULL AND source_sha256 IS NULL)
    OR
    (source_filename IS NOT NULL AND source_bytes IS NOT NULL AND source_sha256 IS NOT NULL)
  )
) STRICT`;

const CAMPAIGN_RECEIPT_TABLE_SQL = `CREATE TABLE campaign_import_receipts (
  receipt_key TEXT PRIMARY KEY CHECK(receipt_key = 'legacy_campaign_directory_v1'),
  format_version INTEGER NOT NULL CHECK(format_version = 1),
  source_bytes INTEGER NOT NULL CHECK(source_bytes >= 0),
  source_sha256 TEXT NOT NULL
    CHECK(length(source_sha256) = 64 AND source_sha256 NOT GLOB '*[^0-9a-f]*'),
  campaign_count INTEGER NOT NULL CHECK(campaign_count BETWEEN 0 AND ${String(CAMPAIGN_MAX_RECORDS)}),
  ordered_campaigns_sha256 TEXT NOT NULL
    CHECK(length(ordered_campaigns_sha256) = 64
      AND ordered_campaigns_sha256 NOT GLOB '*[^0-9a-f]*')
) STRICT`;

const CAMPAIGN_RECEIPT_SEALED_INSERT_TRIGGER_SQL = `CREATE TRIGGER campaign_import_receipts_sealed_insert
  BEFORE INSERT ON campaign_import_receipts
  WHEN NEW.receipt_key <> 'legacy_campaign_directory_v1'
    OR EXISTS (SELECT 1 FROM campaign_import_receipts)
  BEGIN
    SELECT RAISE(ABORT, 'campaign import receipt is sealed and immutable');
  END`;

const CAMPAIGN_RECEIPT_SEALED_UPDATE_TRIGGER_SQL = `CREATE TRIGGER campaign_import_receipts_sealed_update
  BEFORE UPDATE ON campaign_import_receipts
  BEGIN
    SELECT RAISE(ABORT, 'campaign import receipt is sealed and immutable');
  END`;

const CAMPAIGN_RECEIPT_SEALED_DELETE_TRIGGER_SQL = `CREATE TRIGGER campaign_import_receipts_sealed_delete
  BEFORE DELETE ON campaign_import_receipts
  BEGIN
    SELECT RAISE(ABORT, 'campaign import receipt is sealed and immutable');
  END`;

const MIGRATION_LEDGER_TABLE_SQL = `CREATE TABLE cx_schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  fingerprint TEXT NOT NULL,
  applied_at TEXT NOT NULL
) STRICT`;

const CAMPAIGN_RECEIPT_FOUNDATION_OBJECTS = Object.freeze([
  SQLITE_MIGRATION_LEDGER_TABLE,
  'campaign_import_receipts',
  'campaign_import_receipts_sealed_delete',
  'campaign_import_receipts_sealed_insert',
  'campaign_import_receipts_sealed_update',
] as const);

const OWNER_SESSION_TABLE_SQL = `CREATE TABLE owner_sessions (
  session_id_hash TEXT PRIMARY KEY
    CHECK(length(session_id_hash) = 64 AND session_id_hash NOT GLOB '*[^0-9a-f]*'),
  subject TEXT NOT NULL,
  issued_at INTEGER NOT NULL CHECK(issued_at >= 0),
  last_seen_at INTEGER NOT NULL CHECK(last_seen_at >= issued_at),
  expires_at INTEGER NOT NULL CHECK(expires_at >= last_seen_at),
  absolute_expires_at INTEGER NOT NULL CHECK(absolute_expires_at >= expires_at),
  revoked_at INTEGER CHECK(revoked_at IS NULL OR revoked_at >= issued_at),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1)
) STRICT`;

const LOGIN_FAILURE_TABLE_SQL = `CREATE TABLE login_failure_windows (
  client_key_hash TEXT PRIMARY KEY
    CHECK(length(client_key_hash) = 64 AND client_key_hash NOT GLOB '*[^0-9a-f]*'),
  window_started_at INTEGER NOT NULL CHECK(window_started_at >= 0),
  failure_count INTEGER NOT NULL CHECK(failure_count >= 1),
  blocked_until INTEGER CHECK(blocked_until IS NULL OR blocked_until >= window_started_at),
  updated_at INTEGER NOT NULL CHECK(updated_at >= window_started_at)
) STRICT`;

const GENERATION_WINDOW_TABLE_SQL = `CREATE TABLE generation_windows (
  owner_scope TEXT PRIMARY KEY CHECK(owner_scope = 'global-owner'),
  window_started_at INTEGER NOT NULL CHECK(window_started_at >= 0),
  window_duration_ms INTEGER NOT NULL CHECK(window_duration_ms >= 1),
  generation_count INTEGER NOT NULL CHECK(generation_count >= 1),
  updated_at INTEGER NOT NULL CHECK(updated_at >= window_started_at)
) STRICT`;

const GENERATION_RUN_TABLE_SQL = `CREATE TABLE generation_runs (
  run_sequence INTEGER PRIMARY KEY AUTOINCREMENT
    CHECK(run_sequence BETWEEN 1 AND 9007199254740991),
  run_id TEXT NOT NULL UNIQUE,
  campaign_id TEXT NOT NULL,
  owner_session_id_hash TEXT NOT NULL
    CHECK(length(owner_session_id_hash) = 64
      AND owner_session_id_hash NOT GLOB '*[^0-9a-f]*'),
  stage TEXT NOT NULL CHECK(stage IN ('strategy', 'copy', 'prompts')),
  strategy_idea TEXT,
  state TEXT NOT NULL CHECK(state IN ('queued', 'running', 'succeeded', 'failed', 'ambiguous')),
  expected_campaign_revision INTEGER NOT NULL CHECK(expected_campaign_revision >= 0),
  job_id TEXT NOT NULL UNIQUE,
  attempt INTEGER NOT NULL DEFAULT 1 CHECK(attempt >= 1),
  error_code TEXT,
  error_message TEXT,
  created_at INTEGER NOT NULL CHECK(created_at >= 0),
  updated_at INTEGER NOT NULL CHECK(updated_at >= created_at),
  finished_at INTEGER CHECK(finished_at IS NULL OR finished_at >= created_at),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1),
  CHECK(
    (stage = 'strategy' AND strategy_idea IS NOT NULL
      AND length(strategy_idea) BETWEEN ${String(MIN_IDEA_CHARACTERS)} AND ${String(MAX_IDEA_CHARACTERS)})
    OR (stage IN ('copy', 'prompts') AND strategy_idea IS NULL)
  ),
  CHECK(
    (state IN ('queued', 'running') AND finished_at IS NULL)
    OR
    (state IN ('succeeded', 'failed', 'ambiguous') AND finished_at IS NOT NULL)
  ),
  CHECK(
    (state IN ('failed', 'ambiguous') AND error_code IS NOT NULL AND error_message IS NOT NULL)
    OR
    (state IN ('queued', 'running', 'succeeded') AND error_code IS NULL AND error_message IS NULL)
  )
) STRICT`;

const GENERATION_RECEIPT_RECOVERY_TABLE_SQL = `CREATE TABLE generation_receipt_recoveries (
  run_id TEXT PRIMARY KEY REFERENCES generation_runs(run_id) ON DELETE CASCADE,
  original_job_id TEXT NOT NULL UNIQUE,
  recovery_job_id TEXT NOT NULL UNIQUE,
  recovered_at INTEGER NOT NULL CHECK(recovered_at >= 0),
  CHECK(original_job_id <> recovery_job_id)
) STRICT`;

const PROVIDER_EFFECT_TABLE_SQL = `CREATE TABLE provider_effects (
  effect_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES generation_runs(run_id) ON DELETE CASCADE,
  effect_key TEXT NOT NULL,
  operation TEXT NOT NULL,
  request_sha256 TEXT NOT NULL
    CHECK(length(request_sha256) = 64 AND request_sha256 NOT GLOB '*[^0-9a-f]*'),
  state TEXT NOT NULL
    CHECK(state IN ('prepared', 'creating', 'submitted', 'polling', 'succeeded', 'rejected', 'ambiguous')),
  provider_response_id TEXT,
  response_sha256 TEXT
    CHECK(response_sha256 IS NULL
      OR (length(response_sha256) = 64 AND response_sha256 NOT GLOB '*[^0-9a-f]*')),
  response_json BLOB CHECK(
    response_json IS NULL
    OR (typeof(response_json) = 'blob' AND length(response_json) <= ${String(MAX_PROVIDER_RESPONSE_BYTES)})
  ),
  error_code TEXT,
  error_message TEXT,
  created_at INTEGER NOT NULL CHECK(created_at >= 0),
  updated_at INTEGER NOT NULL CHECK(updated_at >= created_at),
  finished_at INTEGER CHECK(finished_at IS NULL OR finished_at >= created_at),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1),
  UNIQUE(run_id, effect_key),
  CHECK(
    (state IN ('submitted', 'polling', 'succeeded') AND provider_response_id IS NOT NULL)
    OR
    (state IN ('prepared', 'creating', 'rejected', 'ambiguous'))
  ),
  CHECK(
    (state = 'succeeded' AND response_sha256 IS NOT NULL AND response_json IS NOT NULL)
    OR
    (state <> 'succeeded' AND response_sha256 IS NULL AND response_json IS NULL)
  ),
  CHECK(
    (state IN ('rejected', 'ambiguous') AND error_code IS NOT NULL AND error_message IS NOT NULL)
    OR
    (state NOT IN ('rejected', 'ambiguous') AND error_code IS NULL AND error_message IS NULL)
  ),
  CHECK(
    (state IN ('succeeded', 'rejected', 'ambiguous') AND finished_at IS NOT NULL)
    OR
    (state IN ('prepared', 'creating', 'submitted', 'polling') AND finished_at IS NULL)
  )
) STRICT`;

const PRODUCT_MIGRATIONS = Object.freeze([
  Object.freeze({
    version: 1,
    name: 'campaigns_and_sealed_legacy_receipt',
    statements: Object.freeze([
      CAMPAIGN_TABLE_SQL,
      `CREATE INDEX campaigns_updated_idx ON campaigns(updated_at_ms DESC, campaign_sequence DESC)`,
      CAMPAIGN_RECEIPT_TABLE_SQL,
      `CREATE TRIGGER campaigns_capacity_guard
       BEFORE INSERT ON campaigns
       WHEN (SELECT COUNT(*) FROM campaigns) >= ${String(CAMPAIGN_MAX_RECORDS)}
       BEGIN
         SELECT RAISE(ABORT, 'campaign capacity reached');
       END`,
      CAMPAIGN_RECEIPT_SEALED_INSERT_TRIGGER_SQL,
      CAMPAIGN_RECEIPT_SEALED_UPDATE_TRIGGER_SQL,
      CAMPAIGN_RECEIPT_SEALED_DELETE_TRIGGER_SQL,
    ] as const),
  }),
  Object.freeze({
    version: 2,
    name: 'persistent_owner_auth_and_generation_windows',
    statements: Object.freeze([
      OWNER_SESSION_TABLE_SQL,
      `CREATE INDEX owner_sessions_expiry_idx ON owner_sessions(expires_at, session_id_hash)`,
      LOGIN_FAILURE_TABLE_SQL,
      `CREATE INDEX login_failure_windows_updated_idx
       ON login_failure_windows(updated_at, client_key_hash)`,
      GENERATION_WINDOW_TABLE_SQL,
      `CREATE INDEX generation_windows_updated_idx
       ON generation_windows(updated_at, owner_scope)`,
      `CREATE TRIGGER owner_sessions_capacity_guard
       BEFORE INSERT ON owner_sessions
       WHEN (SELECT COUNT(*) FROM owner_sessions WHERE revoked_at IS NULL) >= 64
       BEGIN
         SELECT RAISE(ABORT, 'owner session capacity reached');
       END`,
      `CREATE TRIGGER login_failure_windows_capacity_guard
       BEFORE INSERT ON login_failure_windows
       WHEN (SELECT COUNT(*) FROM login_failure_windows) >= 10000
       BEGIN
         SELECT RAISE(ABORT, 'login failure window capacity reached');
       END`,
      `CREATE TRIGGER generation_windows_capacity_guard
       BEFORE INSERT ON generation_windows
       WHEN (SELECT COUNT(*) FROM generation_windows) >= 1000
       BEGIN
         SELECT RAISE(ABORT, 'generation window capacity reached');
       END`,
    ] as const),
  }),
  Object.freeze({
    version: 3,
    name: 'generation_runs_and_provider_effect_receipts',
    statements: Object.freeze([
      GENERATION_RUN_TABLE_SQL,
      `CREATE INDEX generation_runs_campaign_idx
       ON generation_runs(campaign_id, run_sequence DESC)`,
      `CREATE UNIQUE INDEX generation_runs_one_active_campaign
       ON generation_runs(campaign_id)
       WHERE state IN ('queued', 'running')`,
      GENERATION_RECEIPT_RECOVERY_TABLE_SQL,
      PROVIDER_EFFECT_TABLE_SQL,
      `CREATE TABLE generation_retention_guard (
         guard_key INTEGER PRIMARY KEY CHECK(guard_key = 1)
       ) STRICT`,
      `CREATE INDEX provider_effects_run_idx
       ON provider_effects(run_id, created_at, effect_id)`,
      `CREATE TRIGGER generation_runs_capacity_guard
       BEFORE INSERT ON generation_runs
       WHEN (SELECT COUNT(*) FROM generation_runs) >= ${String(MAX_GENERATION_RUNS)}
       BEGIN
         SELECT RAISE(ABORT, 'generation run aggregate capacity reached');
       END`,
      `CREATE TRIGGER provider_effects_capacity_guard
       BEFORE INSERT ON provider_effects
       WHEN (SELECT COUNT(*) FROM provider_effects) >= ${String(MAX_PROVIDER_EFFECTS)}
         OR (SELECT COUNT(*) FROM provider_effects WHERE run_id = NEW.run_id)
            >= ${String(MAX_PROVIDER_EFFECTS_PER_RUN)}
       BEGIN
         SELECT RAISE(ABORT, 'provider effect aggregate capacity reached');
       END`,
      `CREATE TRIGGER provider_effects_response_capacity_guard
       BEFORE UPDATE OF response_json ON provider_effects
       WHEN NEW.response_json IS NOT NULL
         AND OLD.response_json IS NULL
         AND (
           (SELECT COALESCE(SUM(length(response_json)), 0)
            FROM provider_effects WHERE run_id = NEW.run_id)
             + length(NEW.response_json) > ${String(MAX_PROVIDER_RESPONSE_BYTES_PER_RUN)}
           OR
           (SELECT COALESCE(SUM(length(response_json)), 0) FROM provider_effects)
             + length(NEW.response_json) > ${String(MAX_PROVIDER_RESPONSE_TOTAL_BYTES)}
         )
       BEGIN
         SELECT RAISE(ABORT, 'provider response aggregate capacity reached');
       END`,
    ] as const),
  }),
  Object.freeze({
    version: 4,
    name: 'optimistic_revision_and_effect_transition_guards',
    statements: Object.freeze([
      `CREATE TRIGGER campaigns_revision_guard
       BEFORE UPDATE ON campaigns
       WHEN NEW.revision <> OLD.revision + 1
         OR NEW.campaign_sequence IS NOT OLD.campaign_sequence
         OR NEW.id IS NOT OLD.id
         OR NEW.created_at IS NOT OLD.created_at
         OR NEW.created_at_ms IS NOT OLD.created_at_ms
         OR NEW.source_filename IS NOT OLD.source_filename
         OR NEW.source_bytes IS NOT OLD.source_bytes
         OR NEW.source_sha256 IS NOT OLD.source_sha256
       BEGIN
         SELECT RAISE(ABORT, 'campaign update violates immutable identity or revision');
       END`,
      `CREATE TRIGGER campaigns_active_generation_delete_guard
       BEFORE DELETE ON campaigns
       WHEN EXISTS (
         SELECT 1 FROM generation_runs
         WHERE campaign_id = OLD.id AND state IN ('queued', 'running')
       )
       BEGIN
         SELECT RAISE(ABORT, 'campaign has active generation');
       END`,
      `CREATE TRIGGER owner_sessions_revision_guard
       BEFORE UPDATE ON owner_sessions
       WHEN NEW.revision <> OLD.revision + 1
         OR NEW.session_id_hash IS NOT OLD.session_id_hash
         OR NEW.subject IS NOT OLD.subject
         OR NEW.issued_at IS NOT OLD.issued_at
         OR NEW.expires_at IS NOT OLD.expires_at
         OR NEW.absolute_expires_at IS NOT OLD.absolute_expires_at
         OR NEW.last_seen_at < OLD.last_seen_at
       BEGIN
         SELECT RAISE(ABORT, 'owner session update violates immutable identity or revision');
       END`,
      `CREATE TRIGGER generation_runs_revision_guard
       BEFORE UPDATE ON generation_runs
       WHEN NEW.revision <> OLD.revision + 1
         OR NEW.run_id IS NOT OLD.run_id
         OR NEW.run_sequence IS NOT OLD.run_sequence
         OR NEW.campaign_id IS NOT OLD.campaign_id
         OR NEW.owner_session_id_hash IS NOT OLD.owner_session_id_hash
         OR NEW.stage IS NOT OLD.stage
         OR NEW.strategy_idea IS NOT OLD.strategy_idea
         OR NEW.expected_campaign_revision IS NOT OLD.expected_campaign_revision
         OR (
           NEW.job_id IS NOT OLD.job_id
           AND NOT EXISTS (
             SELECT 1 FROM generation_receipt_recoveries AS recovery
             WHERE recovery.run_id = OLD.run_id
               AND recovery.original_job_id = OLD.job_id
               AND recovery.recovery_job_id = NEW.job_id
           )
         )
         OR NEW.attempt IS NOT OLD.attempt
         OR NEW.created_at IS NOT OLD.created_at
         OR NOT (
           (
             NEW.job_id IS OLD.job_id
             AND (
               (OLD.state = 'queued' AND NEW.state = 'running')
               OR (OLD.state = 'queued' AND NEW.state IN ('failed', 'ambiguous'))
               OR (OLD.state = 'running' AND NEW.state IN ('succeeded', 'failed', 'ambiguous'))
             )
           )
           OR (
             OLD.state = 'running' AND NEW.state = 'running'
             AND NEW.job_id IS NOT OLD.job_id
             AND EXISTS (
               SELECT 1 FROM generation_receipt_recoveries AS recovery
               WHERE recovery.run_id = OLD.run_id
                 AND recovery.original_job_id = OLD.job_id
                 AND recovery.recovery_job_id = NEW.job_id
             )
           )
         )
       BEGIN
         SELECT RAISE(ABORT, 'generation run update violates identity, revision, or state');
       END`,
      `CREATE TRIGGER provider_effects_transition_guard
       BEFORE UPDATE ON provider_effects
       WHEN NEW.revision <> OLD.revision + 1
         OR NEW.effect_id IS NOT OLD.effect_id
         OR NEW.run_id IS NOT OLD.run_id
         OR NEW.effect_key IS NOT OLD.effect_key
         OR NEW.operation IS NOT OLD.operation
         OR NEW.request_sha256 IS NOT OLD.request_sha256
         OR NEW.created_at IS NOT OLD.created_at
         OR NOT (
           (OLD.state = 'prepared' AND NEW.state = 'creating')
           OR (OLD.state = 'creating' AND NEW.state IN ('submitted', 'rejected', 'ambiguous'))
           OR (OLD.state = 'submitted' AND NEW.state IN ('polling', 'succeeded', 'rejected', 'ambiguous'))
           OR (OLD.state = 'polling' AND NEW.state IN ('polling', 'succeeded', 'rejected', 'ambiguous'))
         )
       BEGIN
         SELECT RAISE(ABORT, 'provider effect transition is not replay-safe');
       END`,
      `CREATE TRIGGER generation_runs_delete_guard
       BEFORE DELETE ON generation_runs
       WHEN NOT EXISTS (SELECT 1 FROM generation_retention_guard WHERE guard_key = 1)
       BEGIN
         SELECT RAISE(ABORT, 'generation aggregates may only be deleted by retention maintenance');
       END`,
      `CREATE TRIGGER provider_effects_delete_guard
       BEFORE DELETE ON provider_effects
       WHEN NOT EXISTS (SELECT 1 FROM generation_retention_guard WHERE guard_key = 1)
       BEGIN
         SELECT RAISE(ABORT, 'provider effect receipts may only be deleted with their run aggregate');
       END`,
    ] as const),
  }),
] as const satisfies readonly SqliteMigration[]);

const JOB_MIGRATIONS = DURABLE_JOB_SCHEMA_MIGRATIONS.map((migration) =>
  Object.freeze({
    version: PRODUCT_MIGRATION_COUNT + migration.version,
    name: `shared_${migration.name}`,
    statements: migration.statements,
  }),
);

export const FAUNAPOOLEN_MIGRATIONS = Object.freeze([
  ...PRODUCT_MIGRATIONS,
  ...JOB_MIGRATIONS,
] as const satisfies readonly SqliteMigration[]);

const REQUIRED_TABLES = Object.freeze([
  SQLITE_MIGRATION_LEDGER_TABLE,
  'campaigns',
  'campaign_import_receipts',
  'owner_sessions',
  'login_failure_windows',
  'generation_windows',
  'generation_runs',
  'generation_receipt_recoveries',
  'provider_effects',
  'generation_retention_guard',
  'cx_jobs',
]);

interface MigrationIdentityRow extends SqliteRow {
  readonly name: string;
  readonly version: number | bigint;
}

interface MigrationLedgerRow extends MigrationIdentityRow {
  readonly applied_at: string;
  readonly fingerprint: string;
}

interface SchemaRow extends SqliteRow {
  readonly name: string;
  readonly sql: string | null;
  readonly type: string;
}

interface OpenFaunapoolenDatabaseBaseOptions {
  readonly databasePath: string;
  readonly migrate?: boolean;
  readonly now?: () => string;
  readonly operationalRoot: string;
}

export type OpenFaunapoolenDatabaseOptions = OpenFaunapoolenDatabaseBaseOptions &
  (
    | {
        readonly requireExisting?: false;
        readonly verifyBeforeWrite?: never;
      }
    | {
        /**
         * Open an already-sealed authority without creating any missing path component. The
         * verifier runs on the exact connection that remains the writable persistence owner,
         * before journal configuration, migrations, or any other write-capable statement.
         */
        readonly requireExisting: true;
        readonly verifyBeforeWrite: (database: ReadonlySyncSqliteDatabase) => void;
      }
  );

export interface FaunapoolenDatabase {
  readonly databasePath: string;
  readonly sqlite: SyncSqliteDatabase;
  close(): void;
  isReady(): boolean;
}

export interface FaunapoolenPersistenceDatabase extends FaunapoolenDatabase {
  readonly jobs?: DurableJobStore;
}

export function openFaunapoolenDatabase(
  options: OpenFaunapoolenDatabaseOptions,
): FaunapoolenDatabase {
  const {
    databasePath,
    migrate = true,
    now = () => new Date().toISOString(),
    operationalRoot,
  } = options;
  const owned = openOwnedSqliteDatabase({
    configuration: {
      busyTimeoutMs: SQLITE_BUSY_TIMEOUT_MS,
      journalMode: 'wal',
    },
    databasePath,
    operationalRoot,
    ...(options.requireExisting
      ? {
          requireExisting: true as const,
          beforeWrite: options.verifyBeforeWrite,
        }
      : {}),
  });
  const sqlite = owned.database;
  let closed = false;
  try {
    if (migrate) migrateFaunapoolenDatabase(sqlite, now);
    else verifyFaunapoolenDatabase(sqlite);
    owned.verifyStorage();
  } catch (error) {
    try {
      owned.close();
    } catch (closeError) {
      throw new AggregateError(
        [error, closeError],
        'Faunapoolen database opening failed and SQLite could not be closed.',
      );
    }
    throw error;
  }
  return Object.freeze({
    databasePath: owned.databasePath,
    sqlite,
    close() {
      if (closed) return;
      closed = true;
      owned.close();
    },
    isReady() {
      if (closed) return false;
      try {
        owned.verifyStorage();
        verifyFaunapoolenDatabaseReadiness(sqlite);
        return true;
      } catch {
        return false;
      }
    },
  });
}

export function migrateFaunapoolenDatabase(
  database: SyncSqliteDatabase,
  now: () => string = () => new Date().toISOString(),
): void {
  const result = applySqliteMigrations(database, FAUNAPOOLEN_MIGRATIONS, {
    fingerprint: sha256Hex,
    now,
  });
  const expected = FAUNAPOOLEN_MIGRATIONS.at(-1)?.version ?? 0;
  if (result.currentVersion !== expected) {
    throw new Error('Faunapoolen database did not reach the canonical migration version.');
  }
  verifyFaunapoolenDatabase(database);
}

export function verifyFaunapoolenDatabase(database: ReadonlySyncSqliteDatabase): void {
  verifySqliteIntegrity(database);
  verifyFaunapoolenDatabaseReadiness(database);
}

/**
 * Prove only the immutable foundation needed before a sealed runtime authority may migrate. The
 * ledger may be an older exact prefix of the current definitions, but the import receipt table and
 * every trigger that seals it must already match the migration that established that authority.
 */
export function verifyFaunapoolenMigrationFoundation(database: ReadonlySyncSqliteDatabase): void {
  verifySqliteIntegrity(database);
  const ledger = database.all<MigrationLedgerRow>(
    `SELECT version, name, fingerprint, applied_at
     FROM ${SQLITE_MIGRATION_LEDGER_TABLE}
     ORDER BY version`,
  );
  if (ledger.length < 1 || ledger.length > FAUNAPOOLEN_MIGRATIONS.length) {
    throw new Error('Faunapoolen migration foundation is not a known non-empty prefix.');
  }
  for (const [index, row] of ledger.entries()) {
    const migration = FAUNAPOOLEN_MIGRATIONS[index];
    if (
      !migration ||
      sqliteInteger(row.version, 'migration foundation version') !== migration.version ||
      row.name !== migration.name ||
      row.fingerprint !== migrationFingerprint(migration) ||
      !isMigrationTimestamp(row.applied_at)
    ) {
      throw new Error('Faunapoolen migration foundation is not the canonical contiguous prefix.');
    }
  }

  const schemaRows = database.all<SchemaRow>(
    `SELECT type, name, sql
     FROM sqlite_schema
     WHERE name IN (${CAMPAIGN_RECEIPT_FOUNDATION_OBJECTS.map(() => '?').join(', ')})
     ORDER BY name`,
    CAMPAIGN_RECEIPT_FOUNDATION_OBJECTS,
  );
  const schema = new Map(schemaRows.map((row) => [row.name, row]));
  assertSchemaObject(schema, SQLITE_MIGRATION_LEDGER_TABLE, 'table', MIGRATION_LEDGER_TABLE_SQL);
  assertSchemaObject(schema, 'campaign_import_receipts', 'table', CAMPAIGN_RECEIPT_TABLE_SQL);
  assertSchemaObject(
    schema,
    'campaign_import_receipts_sealed_insert',
    'trigger',
    CAMPAIGN_RECEIPT_SEALED_INSERT_TRIGGER_SQL,
  );
  assertSchemaObject(
    schema,
    'campaign_import_receipts_sealed_update',
    'trigger',
    CAMPAIGN_RECEIPT_SEALED_UPDATE_TRIGGER_SQL,
  );
  assertSchemaObject(
    schema,
    'campaign_import_receipts_sealed_delete',
    'trigger',
    CAMPAIGN_RECEIPT_SEALED_DELETE_TRIGGER_SQL,
  );
}

/**
 * Constant-size health probe. Full integrity and foreign-key verification belongs at startup,
 * import, backup, and restore boundaries; a request-time `/healthz` probe must stay fast.
 */
export function verifyFaunapoolenDatabaseReadiness(database: ReadonlySyncSqliteDatabase): void {
  const objects = new Set(
    database
      .all<{ readonly name: string; readonly type: string }>(
        `SELECT name, type FROM sqlite_schema WHERE type IN ('table', 'view')`,
      )
      .filter((row) => row.type === 'table')
      .map((row) => row.name),
  );
  for (const table of REQUIRED_TABLES) {
    if (!objects.has(table)) throw new Error(`Faunapoolen database is missing table ${table}.`);
  }
  const rows = database.all<MigrationIdentityRow>(
    `SELECT version, name FROM ${SQLITE_MIGRATION_LEDGER_TABLE} ORDER BY version`,
  );
  if (rows.length !== FAUNAPOOLEN_MIGRATIONS.length) {
    throw new Error('Faunapoolen migration ledger length is not canonical.');
  }
  for (const [index, migration] of FAUNAPOOLEN_MIGRATIONS.entries()) {
    const row = rows[index];
    if (
      !row ||
      sqliteInteger(row.version, 'migration version') !== migration.version ||
      row.name !== migration.name
    ) {
      throw new Error('Faunapoolen migration ledger is not the canonical contiguous history.');
    }
  }
  const retentionGuard = database.get<{ readonly count: number | bigint }>(
    'SELECT COUNT(*) AS count FROM generation_retention_guard',
  );
  if (!retentionGuard || sqliteInteger(retentionGuard.count, 'retention guard count') !== 0) {
    throw new Error('Faunapoolen generation retention guard is not quiescent.');
  }
}

function assertSchemaObject(
  schema: ReadonlyMap<string, SchemaRow>,
  name: string,
  type: string,
  sql: string,
): void {
  const row = schema.get(name);
  if (
    !row ||
    row.type !== type ||
    typeof row.sql !== 'string' ||
    normalizeSql(row.sql) !== normalizeSql(sql)
  ) {
    throw new Error(`Faunapoolen schema object ${name} does not match its canonical definition.`);
  }
}

function normalizeSql(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

function migrationFingerprint(migration: SqliteMigration): string {
  return sha256Hex(
    JSON.stringify({
      name: migration.name,
      statements: migration.statements,
      version: migration.version,
    }),
  );
}

function isMigrationTimestamp(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 128 &&
    value === value.trim() &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function sqliteInteger(value: number | bigint, label: string): number {
  const number = typeof value === 'bigint' ? Number(value) : value;
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`SQLite ${label} is not a non-negative safe integer.`);
  }
  return number;
}
