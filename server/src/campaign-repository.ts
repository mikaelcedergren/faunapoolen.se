import { randomUUID } from 'node:crypto';

import type { JsonValue } from '@mikaelcedergren/cx-framework/server/errors';
import {
  createDurableJobStore,
  type DurableJobStore,
  type DurableJobTransaction,
  type EnqueueDurableJob,
} from '@mikaelcedergren/cx-framework/server/jobs';
import {
  withImmediateTransaction,
  type SqliteRow,
  type SqliteValue,
  type SyncSqliteDatabase,
} from '@mikaelcedergren/cx-framework/server/sqlite';

import {
  CAMPAIGN_LANGUAGES,
  CAMPAIGN_MAX_RECORDS,
  canonicalCampaign,
  canonicalCampaignBytes,
  isCampaignId,
  normalizeCampaignIdea,
  parseCampaignBytes,
  sha256Hex,
  type CampaignLanguage,
  type CampaignRecord,
} from './campaign-schema.js';
import {
  MAX_GENERATION_RUNS,
  MAX_PROVIDER_EFFECTS,
  MAX_PROVIDER_EFFECTS_PER_RUN,
  MAX_PROVIDER_RESPONSE_BYTES,
  MAX_PROVIDER_RESPONSE_BYTES_PER_RUN,
  MAX_PROVIDER_RESPONSE_TOTAL_BYTES,
  MAX_RETAINED_GENERATION_JOBS,
  openFaunapoolenDatabase,
  type FaunapoolenDatabase,
  type OpenFaunapoolenDatabaseOptions,
} from './database.js';
import type {
  AuthenticationCapacityResult,
  LoginThrottleState as OwnerLoginThrottleState,
  PersistedOwnerSession,
  PersistentOwnerAuthRepository,
} from './auth-service.js';
import { MAX_IDEA_CHARACTERS, MIN_IDEA_CHARACTERS } from './generation-content.js';
import {
  CAMPAIGN_GENERATION_JOB_TYPE,
  CAMPAIGN_GENERATION_MAX_ATTEMPTS,
  campaignGenerationReceiptRecoveryIdempotencyKey,
  parseCampaignGenerationJob,
} from './generation-jobs.js';

export const MAX_RECOVERABLE_GENERATION_RUNS = 100;
export const MAX_GENERATION_RETENTION_BATCH = 100;
export const GENERATION_TERMINAL_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;

const MAX_OWNER_SESSIONS = 64;
const MAX_LOGIN_FAILURE_WINDOWS = 10_000;
const MAX_GENERATION_WINDOWS = 1;
const GLOBAL_OWNER_GENERATION_SCOPE = 'global-owner';
const MAX_CAMPAIGN_SEQUENCE = Number.MAX_SAFE_INTEGER;
const MAX_GENERATION_RUN_SEQUENCE = Number.MAX_SAFE_INTEGER;
const OWNER_LOGIN_MAXIMUM_FAILURES = 5;
const OWNER_LOGIN_WINDOW_SECONDS = 15 * 60;
const OWNER_LOGIN_BLOCK_SECONDS = 15 * 60;
const GENERATION_RUN_RETENTION_TARGET = Math.floor(MAX_GENERATION_RUNS * 0.9);
const PROVIDER_EFFECT_RETENTION_TARGET = Math.floor(MAX_PROVIDER_EFFECTS * 0.9);
const PROVIDER_RESPONSE_RETENTION_TARGET = Math.floor(MAX_PROVIDER_RESPONSE_TOTAL_BYTES * 0.9);
const GENERATION_JOB_RETENTION_TARGET = Math.floor(MAX_RETAINED_GENERATION_JOBS * 0.9);

export interface StoredCampaign {
  readonly sequence: number;
  readonly record: CampaignRecord;
  readonly revision: number;
}

export interface CampaignSummary {
  readonly createdAt: string;
  readonly id: string;
  readonly name: string;
  readonly revision: number;
  readonly stage: CampaignRecord['stage'];
  readonly updatedAt: string;
}

export interface CampaignCopyUpdate {
  readonly campaignId: string;
  readonly expectedRevision: number;
  readonly field:
    | 'callToAction'
    | 'description'
    | 'fullCaption'
    | 'hashtags'
    | 'headline'
    | 'primaryText';
  readonly language: CampaignLanguage;
  readonly value: string | readonly string[];
}

export interface CampaignRepository {
  create(record: CampaignRecord): StoredCampaign;
  delete(id: string, expectedRevision: number): boolean;
  get(id: string): StoredCampaign | null;
  list(): readonly CampaignSummary[];
  replace(record: CampaignRecord, expectedRevision: number): StoredCampaign;
  updateCopy(input: CampaignCopyUpdate): StoredCampaign | null;
}

interface StoredLoginThrottleState {
  readonly blockedUntil: number | null;
  readonly failureCount: number;
  readonly windowStartedAt: number;
}

export interface GenerationWindowPolicy {
  readonly maximumGenerations: number;
  readonly windowMs: number;
}

export interface GenerationAllowance {
  readonly allowed: boolean;
  readonly count: number;
  readonly retryAt: number;
}

export type GenerationStage = 'strategy' | 'copy' | 'prompts';
export type GenerationState = 'queued' | 'running' | 'succeeded' | 'failed' | 'ambiguous';
export type ProviderEffectState =
  | 'prepared'
  | 'creating'
  | 'submitted'
  | 'polling'
  | 'succeeded'
  | 'rejected'
  | 'ambiguous';

export interface GenerationRun {
  readonly attempt: number;
  readonly campaignId: string;
  readonly createdAt: number;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly expectedCampaignRevision: number;
  readonly finishedAt: number | null;
  readonly jobId: string;
  readonly ownerSessionIdHash: string;
  readonly revision: number;
  readonly runId: string;
  readonly runSequence: number;
  readonly stage: GenerationStage;
  readonly state: GenerationState;
  readonly strategyIdea: string | null;
  readonly updatedAt: number;
}

export interface ProviderEffect {
  readonly createdAt: number;
  readonly effectId: string;
  readonly effectKey: string;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly finishedAt: number | null;
  readonly operation: string;
  readonly providerResponseId: string | null;
  readonly requestSha256: string;
  readonly response: JsonValue | null;
  readonly responseSha256: string | null;
  readonly revision: number;
  readonly runId: string;
  readonly state: ProviderEffectState;
  readonly updatedAt: number;
}

export interface CreateGenerationRunInput {
  readonly attempt?: number;
  readonly campaignId: string;
  readonly expectedCampaignRevision: number;
  readonly job: EnqueueDurableJob;
  readonly ownerSessionIdHash: string;
  readonly runId: string;
  readonly stage: GenerationStage;
  readonly strategyIdea: string | null;
}

interface GenerationAdmissionBase {
  readonly now: number;
  readonly policy: GenerationWindowPolicy;
  readonly run: CreateGenerationRunInput;
}

export type GenerationAdmissionInput =
  | (GenerationAdmissionBase & { readonly kind: 'continuation' })
  | (GenerationAdmissionBase & { readonly kind: 'initial' })
  | (GenerationAdmissionBase & {
      readonly kind: 'retry';
      readonly requiredCampaignRevision: number;
    });

export type GenerationAdmissionResult =
  | {
      readonly allowance: GenerationAllowance;
      readonly run: GenerationRun;
      readonly status: 'accepted';
    }
  | {
      readonly allowance: GenerationAllowance;
      readonly status: 'rate_limited';
    };

export interface GenerationAdmissionRepository {
  admit(input: GenerationAdmissionInput): GenerationAdmissionResult;
}

export type CampaignStageMutation =
  | {
      readonly kind: 'create';
      readonly record: CampaignRecord;
    }
  | {
      readonly expectedRevision: number;
      readonly kind: 'replace';
      readonly record: CampaignRecord;
    };

export type GenerationStageOutcome =
  | {
      readonly campaign: CampaignStageMutation;
      readonly nextRun?: CreateGenerationRunInput;
      readonly state: 'succeeded';
    }
  | {
      readonly campaign?: CampaignStageMutation;
      readonly errorCode: string;
      readonly errorMessage: string;
      readonly state: 'ambiguous' | 'failed';
    };

export interface FinalizeGenerationStageInput {
  readonly expectedRunRevision: number;
  readonly outcome: GenerationStageOutcome;
  readonly runId: string;
}

export interface FinalizeGenerationStageResult {
  readonly campaign: StoredCampaign | null;
  readonly finalizedRun: GenerationRun;
  readonly nextRun: GenerationRun | null;
}

export interface GenerationRepository {
  finalizeStage(input: FinalizeGenerationStageInput): FinalizeGenerationStageResult;
  getEffect(effectId: string): ProviderEffect | null;
  getLatestRun(campaignId: string): GenerationRun | null;
  getRun(runId: string): GenerationRun | null;
  getRunByJobId(jobId: string): GenerationRun | null;
  isReceiptRecoveryJob(input: { readonly jobId: string; readonly runId: string }): boolean;
  listLatestRecoverableRuns(input: { readonly limit: number }): readonly GenerationRun[];
  markCreatingEffectsAmbiguous(now: number): number;
  prepareEffect(input: {
    readonly effectId: string;
    readonly effectKey: string;
    readonly operation: string;
    readonly requestSha256: string;
    readonly runId: string;
  }): ProviderEffect;
  transitionEffect(input: {
    readonly effectId: string;
    readonly errorCode?: string;
    readonly errorMessage?: string;
    readonly expectedRevision: number;
    readonly providerResponseId?: string;
    readonly response?: JsonValue;
    readonly state: Exclude<ProviderEffectState, 'prepared'>;
  }): ProviderEffect;
  transitionRun(input: {
    readonly errorCode?: string;
    readonly errorMessage?: string;
    readonly expectedRevision: number;
    readonly runId: string;
    readonly state: Exclude<GenerationState, 'queued'>;
  }): GenerationRun;
}

export interface GenerationRetentionResult {
  readonly effects: number;
  readonly jobs: number;
  readonly responseBytes: number;
  readonly runs: number;
}

export interface GenerationReconciliationResult {
  readonly ambiguous: number;
  readonly failed: number;
  readonly resumed: number;
}

export interface GenerationMaintenanceRepository {
  maintainTerminalStorage(input: {
    readonly limit: number;
    readonly now: number;
  }): GenerationRetentionResult;
  reconcileTerminalJobs(input: {
    readonly limit: number;
    readonly now: number;
  }): GenerationReconciliationResult;
}

export interface DatabaseReadiness {
  isReady(): boolean;
}

export interface FaunapoolenPersistence extends DatabaseReadiness {
  readonly campaigns: CampaignRepository;
  readonly database: FaunapoolenDatabase;
  readonly generationAdmission: GenerationAdmissionRepository;
  readonly generationMaintenance: GenerationMaintenanceRepository;
  readonly generations: GenerationRepository;
  readonly jobs: DurableJobStore;
  readonly ownerAuth: PersistentOwnerAuthRepository;
  close(): void;
}

export class CampaignCapacityError extends Error {
  constructor() {
    super(
      `Campaign storage has reached its explicit ${String(CAMPAIGN_MAX_RECORDS)}-record limit.`,
    );
    this.name = 'CampaignCapacityError';
  }
}

export class CampaignRevisionConflictError extends Error {
  constructor(id: string) {
    super(`Campaign ${id} changed before the requested operation could be applied.`);
    this.name = 'CampaignRevisionConflictError';
  }
}

export class CampaignActiveGenerationError extends Error {
  constructor(id: string) {
    super(`Campaign ${id} has active generation work and cannot be deleted.`);
    this.name = 'CampaignActiveGenerationError';
  }
}

export class GenerationWindowCapacityError extends Error {
  constructor() {
    super(
      `Generation-window storage has reached its explicit ${String(MAX_GENERATION_WINDOWS)}-owner-scope limit.`,
    );
    this.name = 'GenerationWindowCapacityError';
  }
}

export class GenerationRunCapacityError extends Error {
  constructor() {
    super('Generation run sequence has reached its explicit safe-integer ceiling.');
    this.name = 'GenerationRunCapacityError';
  }
}

export class GenerationCompletedReceiptRetryError extends Error {
  constructor() {
    super(
      'Completed provider work is awaiting or has exhausted its one safe application recovery.',
    );
    this.name = 'GenerationCompletedReceiptRetryError';
  }
}

export class GenerationAggregateCapacityError extends Error {
  constructor() {
    super(
      `Generation history reached its ${String(MAX_GENERATION_RUNS)}-run hard bound; terminal aggregate maintenance must reclaim eligible history.`,
    );
    this.name = 'GenerationAggregateCapacityError';
  }
}

export class ProviderEffectCapacityError extends Error {
  constructor() {
    super(
      `Provider effect history reached its global ${String(MAX_PROVIDER_EFFECTS)} or per-run ${String(MAX_PROVIDER_EFFECTS_PER_RUN)} hard bound.`,
    );
    this.name = 'ProviderEffectCapacityError';
  }
}

export class ProviderResponseCapacityError extends Error {
  constructor() {
    super(
      `Provider response history reached its ${String(MAX_PROVIDER_RESPONSE_TOTAL_BYTES)}-byte hard bound.`,
    );
    this.name = 'ProviderResponseCapacityError';
  }
}

export class CampaignSequenceCapacityError extends Error {
  constructor() {
    super('Campaign sequence has reached its explicit safe-integer ceiling.');
    this.name = 'CampaignSequenceCapacityError';
  }
}

export class PersistenceRevisionConflictError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} changed before the requested operation could be applied.`);
    this.name = 'PersistenceRevisionConflictError';
  }
}

export class ProviderEffectReplayBlockedError extends Error {
  constructor(effectId: string) {
    super(`Provider effect ${effectId} is ambiguous and cannot be replayed automatically.`);
    this.name = 'ProviderEffectReplayBlockedError';
  }
}

interface CampaignRow extends SqliteRow {
  readonly campaign_sequence: number | bigint;
  readonly created_at: string;
  readonly id: string;
  readonly name: string;
  readonly record_json: Uint8Array;
  readonly record_sha256: string;
  readonly revision: number | bigint;
  readonly stage: string;
  readonly updated_at: string;
}

interface CountRow extends SqliteRow {
  readonly count: number | bigint;
}

interface SessionRow extends SqliteRow {
  readonly absolute_expires_at: number | bigint;
  readonly expires_at: number | bigint;
  readonly issued_at: number | bigint;
  readonly last_seen_at: number | bigint;
  readonly revision: number | bigint;
  readonly revoked_at: number | bigint | null;
  readonly session_id_hash: string;
  readonly subject: string;
}

interface LoginFailureRow extends SqliteRow {
  readonly blocked_until: number | bigint | null;
  readonly failure_count: number | bigint;
  readonly window_started_at: number | bigint;
}

interface GenerationWindowRow extends SqliteRow {
  readonly generation_count: number | bigint;
  readonly window_duration_ms: number | bigint;
  readonly window_started_at: number | bigint;
}

interface GenerationRunRow extends SqliteRow {
  readonly attempt: number | bigint;
  readonly campaign_id: string;
  readonly created_at: number | bigint;
  readonly error_code: string | null;
  readonly error_message: string | null;
  readonly expected_campaign_revision: number | bigint;
  readonly finished_at: number | bigint | null;
  readonly job_id: string;
  readonly owner_session_id_hash: string;
  readonly revision: number | bigint;
  readonly run_id: string;
  readonly run_sequence: number | bigint;
  readonly stage: string;
  readonly state: string;
  readonly strategy_idea: string | null;
  readonly updated_at: number | bigint;
}

interface GenerationRunTerminalJobRow extends GenerationRunRow {
  readonly job_failure_code: string | null;
  readonly job_failure_message: string | null;
}

interface ProviderEffectRow extends SqliteRow {
  readonly created_at: number | bigint;
  readonly effect_id: string;
  readonly effect_key: string;
  readonly error_code: string | null;
  readonly error_message: string | null;
  readonly finished_at: number | bigint | null;
  readonly operation: string;
  readonly provider_response_id: string | null;
  readonly request_sha256: string;
  readonly response_json: Uint8Array | null;
  readonly response_sha256: string | null;
  readonly revision: number | bigint;
  readonly run_id: string;
  readonly state: string;
  readonly updated_at: number | bigint;
}

export type CreateFaunapoolenPersistenceOptions = OpenFaunapoolenDatabaseOptions & {
  readonly clock?: () => number;
  readonly createJobId?: () => string;
  readonly createLeaseToken?: () => string;
};

export function createFaunapoolenPersistence({
  clock = Date.now,
  createJobId = () => randomUUID(),
  createLeaseToken = () => randomUUID(),
  ...databaseOptions
}: CreateFaunapoolenPersistenceOptions): FaunapoolenPersistence {
  const database = openFaunapoolenDatabase(databaseOptions);
  const jobs = createDurableJobStore({
    createJobId,
    createLeaseToken,
    database: database.sqlite,
    leaseDurationMs: 60_000,
    maxConcurrentJobs: 1,
    maxOutstandingJobs: 1_000,
    maxPayloadBytes: 64 * 1024,
    maxRetainedJobs: MAX_RETAINED_GENERATION_JOBS,
    now: clock,
    recoveryBatchSize: 100,
    retryInitialDelayMs: 1_000,
    retryMaximumDelayMs: 60_000,
  });
  const campaigns = createCampaignRepository(database.sqlite, clock);
  const ownerAuth = createPersistentOwnerAuthRepository(database.sqlite);
  const generationState = createGenerationRepository(database.sqlite, jobs, clock);
  let closed = false;
  return Object.freeze({
    campaigns,
    database,
    generationAdmission: generationState,
    generationMaintenance: generationState,
    generations: generationState,
    jobs,
    ownerAuth,
    close() {
      if (closed) return;
      closed = true;
      database.close();
    },
    isReady() {
      return !closed && database.isReady();
    },
  });
}

/**
 * The exact asynchronous persistence seam consumed by auth-service. The caller supplies only
 * HMAC client-key hashes; this repository never receives or persists a raw network address.
 */
export function createPersistentOwnerAuthRepository(
  database: SyncSqliteDatabase,
): PersistentOwnerAuthRepository {
  const repository: PersistentOwnerAuthRepository = {
    async createSessionAndClearLoginFailures({
      clientKeyHash,
      session,
    }): Promise<AuthenticationCapacityResult> {
      assertHash(clientKeyHash, 'Client key hash');
      validatePersistedOwnerSession(session);
      if (session.revision !== 1) {
        throw new Error('A newly issued owner session must begin at revision 1.');
      }
      return withImmediateTransaction(database, () => {
        database.run(
          `DELETE FROM owner_sessions
           WHERE revoked_at IS NOT NULL OR expires_at <= ? OR absolute_expires_at <= ?`,
          [session.createdAt, session.createdAt],
        );
        const count = database.get<CountRow>('SELECT COUNT(*) AS count FROM owner_sessions');
        if (!count || integer(count.count, 'owner session count') >= MAX_OWNER_SESSIONS) {
          return 'capacity_reached';
        }
        database.run(
          `INSERT INTO owner_sessions (
             session_id_hash, subject, issued_at, last_seen_at, expires_at,
             absolute_expires_at, revoked_at, revision
           ) VALUES (?, 'owner', ?, ?, ?, ?, NULL, 1)`,
          [
            session.sessionIdHash,
            session.createdAt,
            session.lastSeenAt,
            session.expiresAt,
            session.expiresAt,
          ],
        );
        database.run('DELETE FROM login_failure_windows WHERE client_key_hash = ?', [
          clientKeyHash,
        ]);
        return 'created';
      });
    },
    async deleteSession(sessionIdHash): Promise<boolean> {
      assertHash(sessionIdHash, 'Session id hash');
      return (
        database.run('DELETE FROM owner_sessions WHERE session_id_hash = ?', [sessionIdHash])
          .changes === 1
      );
    },
    async findSession(sessionIdHash): Promise<PersistedOwnerSession | null> {
      assertHash(sessionIdHash, 'Session id hash');
      const row = database.get<SessionRow>(
        `SELECT * FROM owner_sessions WHERE session_id_hash = ? AND revoked_at IS NULL`,
        [sessionIdHash],
      );
      return row ? persistedOwnerSession(row) : null;
    },
    async readLoginThrottle(clientKeyHash, now): Promise<OwnerLoginThrottleState> {
      assertHash(clientKeyHash, 'Client key hash');
      assertEpoch(now, 'Login throttle read time');
      const row = database.get<LoginFailureRow>(
        `SELECT window_started_at, failure_count, blocked_until
         FROM login_failure_windows WHERE client_key_hash = ?`,
        [clientKeyHash],
      );
      return ownerLoginThrottleState(row, now);
    },
    async recordLoginFailure(clientKeyHash, now): Promise<OwnerLoginThrottleState> {
      assertHash(clientKeyHash, 'Client key hash');
      assertEpoch(now, 'Login failure time');
      return withImmediateTransaction(database, () => {
        database.run(
          `DELETE FROM login_failure_windows
           WHERE window_started_at + ? <= ?
             AND (blocked_until IS NULL OR blocked_until <= ?)`,
          [OWNER_LOGIN_WINDOW_SECONDS, now, now],
        );
        const row = database.get<LoginFailureRow>(
          `SELECT window_started_at, failure_count, blocked_until
           FROM login_failure_windows WHERE client_key_hash = ?`,
          [clientKeyHash],
        );
        const currentState = ownerLoginThrottleState(row, now);
        if (currentState.status === 'rate_limited') return currentState;

        const existing = row ? parseLoginFailure(row) : null;
        const reset =
          existing === null || now - existing.windowStartedAt >= OWNER_LOGIN_WINDOW_SECONDS;
        if (!existing) {
          const count = database.get<CountRow>(
            'SELECT COUNT(*) AS count FROM login_failure_windows',
          );
          if (
            !count ||
            integer(count.count, 'login failure window count') >= MAX_LOGIN_FAILURE_WINDOWS
          ) {
            return Object.freeze({ status: 'capacity_reached' as const });
          }
        }
        const windowStartedAt = reset ? now : existing.windowStartedAt;
        const failureCount = reset ? 1 : existing.failureCount + 1;
        const blockedUntil =
          failureCount >= OWNER_LOGIN_MAXIMUM_FAILURES
            ? safeAdd(now, OWNER_LOGIN_BLOCK_SECONDS, 'Login block time')
            : null;
        database.run(
          `INSERT INTO login_failure_windows (
             client_key_hash, window_started_at, failure_count, blocked_until, updated_at
           ) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(client_key_hash) DO UPDATE SET
             window_started_at = excluded.window_started_at,
             failure_count = excluded.failure_count,
             blocked_until = excluded.blocked_until,
             updated_at = excluded.updated_at`,
          [clientKeyHash, windowStartedAt, failureCount, blockedUntil, now],
        );
        return blockedUntil === null
          ? Object.freeze({ status: 'allowed' as const })
          : Object.freeze({
              retryAfterSeconds: OWNER_LOGIN_BLOCK_SECONDS,
              status: 'rate_limited' as const,
            });
      });
    },
    async touchSession({
      expectedRevision,
      lastSeenAt,
      sessionIdHash,
    }): Promise<PersistedOwnerSession | null> {
      assertHash(sessionIdHash, 'Session id hash');
      assertPositiveInteger(expectedRevision, 'Expected session revision');
      assertEpoch(lastSeenAt, 'Session last-seen time');
      const row = database.get<SessionRow>(
        `UPDATE owner_sessions
         SET last_seen_at = MAX(last_seen_at, ?), revision = revision + 1
         WHERE session_id_hash = ? AND revision = ? AND revoked_at IS NULL
           AND ? < expires_at
         RETURNING *`,
        [lastSeenAt, sessionIdHash, expectedRevision, lastSeenAt],
      );
      return row ? persistedOwnerSession(row) : null;
    },
  };
  return Object.freeze(repository);
}

export function createCampaignRepository(
  database: SyncSqliteDatabase,
  clock: () => number = Date.now,
): CampaignRepository {
  function replaceCampaign(record: CampaignRecord, expectedRevision: number): StoredCampaign {
    assertPositiveInteger(expectedRevision, 'Expected campaign revision');
    const canonical = canonicalCampaign(monotonicCampaignMutation(database, record));
    const row = database.get<CampaignRow>(
      `UPDATE campaigns
       SET updated_at = ?, updated_at_ms = ?, name = ?, stage = ?,
           record_sha256 = ?, record_json = ?, revision = revision + 1
       WHERE id = ? AND revision = ?
       RETURNING ${campaignColumns()}`,
      [
        canonical.record.updatedAt,
        Date.parse(canonical.record.updatedAt),
        canonical.record.name,
        canonical.record.stage,
        canonical.sha256,
        canonical.bytes,
        canonical.record.id,
        expectedRevision,
      ],
    );
    if (row) return parseCampaignRow(row);
    throw new CampaignRevisionConflictError(canonical.record.id);
  }

  const repository: CampaignRepository = {
    create(record) {
      const canonical = canonicalCampaign(record);
      try {
        return withImmediateTransaction(database, () => {
          assertCampaignCapacity(database);
          assertCampaignSequenceCapacity(database);
          const row = database.get<CampaignRow>(
            `${campaignInsertSql()} RETURNING ${campaignColumns()}`,
            campaignInsertValues(canonical.record, canonical.bytes, canonical.sha256),
          );
          if (!row) throw new Error('Campaign insert returned no row.');
          return parseCampaignRow(row);
        });
      } catch (error) {
        if (sqliteMessage(error).includes('campaign capacity reached')) {
          throw new CampaignCapacityError();
        }
        throw error;
      }
    },
    delete(id, expectedRevision) {
      assertCampaignIdentity(id, expectedRevision);
      try {
        return withImmediateTransaction(database, () => {
          const campaign = database.get<{ readonly revision: number | bigint }>(
            'SELECT revision FROM campaigns WHERE id = ?',
            [id],
          );
          if (!campaign) return false;
          if (positiveInteger(campaign.revision, 'campaign revision') !== expectedRevision) {
            throw new CampaignRevisionConflictError(id);
          }
          const active = database.get(
            `SELECT 1 AS present
             FROM generation_runs AS run
             LEFT JOIN cx_jobs AS job ON job.id = run.job_id
             WHERE run.campaign_id = ?
               AND (
                 run.state IN ('queued', 'running')
                 OR job.status IN ('blocked', 'queued', 'running')
               )
             LIMIT 1`,
            [id],
          );
          if (active) throw new CampaignActiveGenerationError(id);
          beginGenerationRetention(database);
          database.run(
            `DELETE FROM cx_jobs
             WHERE id IN (SELECT job_id FROM generation_runs WHERE campaign_id = ?)
               AND status IN ('succeeded', 'failed')`,
            [id],
          );
          database.run('DELETE FROM generation_runs WHERE campaign_id = ?', [id]);
          endGenerationRetention(database);
          const result = database.run(`DELETE FROM campaigns WHERE id = ? AND revision = ?`, [
            id,
            expectedRevision,
          ]);
          if (result.changes !== 1) throw new CampaignRevisionConflictError(id);
          return true;
        });
      } catch (error) {
        if (sqliteMessage(error).includes('campaign has active generation')) {
          throw new CampaignActiveGenerationError(id);
        }
        throw error;
      }
    },
    get(id) {
      if (!isCampaignId(id)) return null;
      const row = database.get<CampaignRow>(
        `SELECT ${campaignColumns()} FROM campaigns WHERE id = ?`,
        [id],
      );
      return row ? parseCampaignRow(row) : null;
    },
    list() {
      return database
        .all<CampaignRow>(
          `SELECT ${campaignColumns()} FROM campaigns
           ORDER BY updated_at_ms DESC, campaign_sequence DESC`,
        )
        .map((row) => {
          const campaign = parseCampaignRow(row);
          return Object.freeze({
            createdAt: campaign.record.createdAt,
            id: campaign.record.id,
            name: campaign.record.name,
            revision: campaign.revision,
            stage: campaign.record.stage,
            updatedAt: campaign.record.updatedAt,
          });
        });
    },
    replace: replaceCampaign,
    updateCopy(input) {
      assertCampaignIdentity(input.campaignId, input.expectedRevision);
      if (!CAMPAIGN_LANGUAGES.includes(input.language)) {
        throw new Error('Campaign copy language is invalid.');
      }
      return withImmediateTransaction(database, () => {
        const row = database.get<CampaignRow>(
          `SELECT ${campaignColumns()} FROM campaigns WHERE id = ?`,
          [input.campaignId],
        );
        if (!row) return null;
        const stored = parseCampaignRow(row);
        if (stored.revision !== input.expectedRevision) {
          throw new CampaignRevisionConflictError(input.campaignId);
        }
        const copy = stored.record.copy[input.language];
        if (!copy) return null;
        const value = sanitizeCopyUpdate(input.field, input.value);
        const updatedLanguageCopy =
          input.field === 'hashtags'
            ? { ...copy, hashtags: value as string[] }
            : { ...copy, [input.field]: value as string };
        const updatedRecord = {
          ...stored.record,
          copy: { ...stored.record.copy, [input.language]: updatedLanguageCopy },
          updatedAt: canonicalTimestamp(clock()),
        } satisfies CampaignRecord;
        return replaceCampaign(updatedRecord, input.expectedRevision);
      });
    },
  };
  return Object.freeze(repository);
}

function consumeGenerationAllowance(
  database: SyncSqliteDatabase,
  now: number,
  policy: GenerationWindowPolicy,
): GenerationAllowance {
  database.run(
    `DELETE FROM generation_windows
     WHERE window_started_at + window_duration_ms <= ?`,
    [now],
  );
  const row = database.get<GenerationWindowRow>(
    `SELECT window_started_at, window_duration_ms, generation_count FROM generation_windows
     WHERE owner_scope = ?`,
    [GLOBAL_OWNER_GENERATION_SCOPE],
  );
  if (!row) {
    assertRowCapacity(
      database,
      'generation_windows',
      MAX_GENERATION_WINDOWS,
      () => new GenerationWindowCapacityError(),
    );
    const retryAt = safeAdd(now, policy.windowMs, 'Generation retry time');
    database.run(
      `INSERT INTO generation_windows (
         owner_scope, window_started_at, window_duration_ms,
         generation_count, updated_at
       ) VALUES (?, ?, ?, 1, ?)
       ON CONFLICT(owner_scope) DO UPDATE SET
         window_started_at = excluded.window_started_at,
         window_duration_ms = excluded.window_duration_ms,
         generation_count = 1,
         updated_at = excluded.updated_at`,
      [GLOBAL_OWNER_GENERATION_SCOPE, now, policy.windowMs, now],
    );
    return Object.freeze({ allowed: true, count: 1, retryAt });
  }
  const start = integer(row.window_started_at, 'generation window start');
  const duration = positiveInteger(row.window_duration_ms, 'generation window duration');
  if (duration !== policy.windowMs) {
    throw new Error('Generation window policy changed while a persisted window is active.');
  }
  if (now < start) {
    throw new Error('Generation admission time precedes its persisted active window.');
  }
  const count = integer(row.generation_count, 'generation count');
  const retryAt = safeAdd(start, policy.windowMs, 'Generation retry time');
  if (count >= policy.maximumGenerations) {
    return Object.freeze({ allowed: false, count, retryAt });
  }
  database.run(
    `UPDATE generation_windows
     SET generation_count = generation_count + 1, updated_at = ?
     WHERE owner_scope = ?`,
    [now, GLOBAL_OWNER_GENERATION_SCOPE],
  );
  return Object.freeze({ allowed: true, count: count + 1, retryAt });
}

export function createGenerationRepository(
  database: SyncSqliteDatabase,
  jobs: DurableJobStore,
  clock: () => number = Date.now,
): GenerationRepository & GenerationAdmissionRepository & GenerationMaintenanceRepository {
  function insertRun(
    transaction: DurableJobTransaction,
    input: CreateGenerationRunInput,
    now: number,
  ): GenerationRun {
    validateGenerationRunInput(input);
    assertGenerationRunSequenceCapacity(database);
    assertRowCapacity(
      database,
      'generation_runs',
      MAX_GENERATION_RUNS,
      () => new GenerationAggregateCapacityError(),
    );
    if (
      database.get(
        `SELECT 1 AS present FROM generation_runs
         WHERE campaign_id = ? AND state IN ('queued', 'running') LIMIT 1`,
        [input.campaignId],
      )
    ) {
      throw new PersistenceRevisionConflictError('Active generation', input.campaignId);
    }
    const job = transaction.enqueue(input.job).job;
    const row = database.get<GenerationRunRow>(
      `INSERT INTO generation_runs (
         run_id, campaign_id, owner_session_id_hash, stage, strategy_idea, state,
         expected_campaign_revision, job_id, attempt, created_at, updated_at,
         finished_at, revision
       ) VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, NULL, 1)
       RETURNING *`,
      [
        input.runId,
        input.campaignId,
        input.ownerSessionIdHash,
        input.stage,
        input.strategyIdea,
        input.expectedCampaignRevision,
        job.id,
        input.attempt ?? 1,
        now,
        now,
      ],
    );
    if (!row) throw new Error('Generation run insert returned no row.');
    return parseGenerationRun(row);
  }

  function assertAdmissionState(input: GenerationAdmissionInput): void {
    const run = input.run;
    if (input.kind === 'initial') {
      if (run.expectedCampaignRevision !== 0 || run.stage !== 'strategy') {
        throw new Error(
          'Initial generation must be an absent-campaign strategy run at revision zero.',
        );
      }
      if (
        campaignExists(database, run.campaignId) ||
        generationRunExists(database, run.campaignId)
      ) {
        throw new CampaignRevisionConflictError(run.campaignId);
      }
      return;
    }

    if (input.kind === 'continuation') {
      if (run.expectedCampaignRevision < 1 || run.stage === 'strategy') {
        throw new Error('Campaign continuation requires positive-revision copy or prompt work.');
      }
      const campaignRow = database.get<CampaignRow>(
        `SELECT ${campaignColumns()} FROM campaigns WHERE id = ?`,
        [run.campaignId],
      );
      if (!campaignRow) throw new CampaignRevisionConflictError(run.campaignId);
      const campaign = parseCampaignRow(campaignRow);
      if (
        campaign.revision !== run.expectedCampaignRevision ||
        generationRunExists(database, run.campaignId)
      ) {
        throw new CampaignRevisionConflictError(run.campaignId);
      }
      const expectedStage = classifyCampaignContinuation(campaign.record);
      if (expectedStage === null || run.stage !== expectedStage || (run.attempt ?? 1) !== 1) {
        throw new Error('Campaign continuation does not match its persisted stage.');
      }
      return;
    }

    if (run.expectedCampaignRevision !== input.requiredCampaignRevision) {
      throw new CampaignRevisionConflictError(run.campaignId);
    }
    if (input.requiredCampaignRevision === 0) {
      if (run.stage !== 'strategy' || campaignExists(database, run.campaignId)) {
        throw new CampaignRevisionConflictError(run.campaignId);
      }
    } else {
      assertCampaignRevision(database, run.campaignId, input.requiredCampaignRevision);
    }
    const previousRow = database.get<GenerationRunRow>(
      `SELECT * FROM generation_runs
       WHERE campaign_id = ? AND stage = ?
       ORDER BY run_sequence DESC LIMIT 1`,
      [run.campaignId, run.stage],
    );
    if (!previousRow) {
      throw new Error('Generation retry requires a failed or ambiguous prior run.');
    }
    const previous = parseGenerationRun(previousRow);
    if (
      !['failed', 'ambiguous'].includes(previous.state) ||
      (input.requiredCampaignRevision === 0 && previous.expectedCampaignRevision !== 0) ||
      run.strategyIdea !== previous.strategyIdea ||
      run.attempt !== previous.attempt + 1
    ) {
      throw new Error(
        'Generation retry requires the next attempt after a failed or ambiguous prior run.',
      );
    }
    if (
      database.get(
        `SELECT 1 AS present FROM provider_effects
         WHERE run_id = ? AND state = 'succeeded' LIMIT 1`,
        [previous.runId],
      )
    ) {
      throw new GenerationCompletedReceiptRetryError();
    }
  }

  function admit(input: GenerationAdmissionInput): GenerationAdmissionResult {
    validateGenerationRunInput(input.run);
    assertEpoch(input.now, 'Generation admission time');
    assertWindowPolicy(input.policy.maximumGenerations, input.policy.windowMs, 'Generation');
    return jobs.withTransaction((transaction) => {
      // Admission state is checked before charging the bounded window. Every later mutation is in
      // this same immediate transaction, so job/run capacity or insertion failure rolls it back.
      assertAdmissionState(input);
      const allowance = consumeGenerationAllowance(database, input.now, input.policy);
      if (!allowance.allowed) {
        return Object.freeze({ allowance, status: 'rate_limited' as const });
      }
      return Object.freeze({
        allowance,
        run: insertRun(transaction, input.run, input.now),
        status: 'accepted' as const,
      });
    });
  }

  function persistCampaignMutation(
    mutation: CampaignStageMutation,
    expectedCampaignId: string,
  ): StoredCampaign {
    if (mutation.record.id !== expectedCampaignId) {
      throw new Error('Generation campaign mutation id does not match its run.');
    }
    if (mutation.kind === 'create') {
      const canonical = canonicalCampaign(mutation.record);
      assertCampaignCapacity(database);
      assertCampaignSequenceCapacity(database);
      const row = database.get<CampaignRow>(
        `${campaignInsertSql()} RETURNING ${campaignColumns()}`,
        campaignInsertValues(canonical.record, canonical.bytes, canonical.sha256),
      );
      if (!row) throw new Error('Generation campaign insert returned no row.');
      return parseCampaignRow(row);
    }
    assertPositiveInteger(mutation.expectedRevision, 'Expected campaign revision');
    const canonical = canonicalCampaign(monotonicCampaignMutation(database, mutation.record));
    const row = database.get<CampaignRow>(
      `UPDATE campaigns
       SET updated_at = ?, updated_at_ms = ?, name = ?, stage = ?,
           record_sha256 = ?, record_json = ?, revision = revision + 1
       WHERE id = ? AND revision = ?
       RETURNING ${campaignColumns()}`,
      [
        canonical.record.updatedAt,
        Date.parse(canonical.record.updatedAt),
        canonical.record.name,
        canonical.record.stage,
        canonical.sha256,
        canonical.bytes,
        canonical.record.id,
        mutation.expectedRevision,
      ],
    );
    if (!row) throw new CampaignRevisionConflictError(canonical.record.id);
    return parseCampaignRow(row);
  }

  function finalizeRun(
    current: GenerationRun,
    expectedRevision: number,
    now: number,
    state: 'ambiguous' | 'failed' | 'succeeded',
    errorCode: string | null,
    errorMessage: string | null,
  ): GenerationRun {
    const row = database.get<GenerationRunRow>(
      `UPDATE generation_runs
       SET state = ?, error_code = ?, error_message = ?, finished_at = ?,
           updated_at = ?, revision = revision + 1
       WHERE run_id = ? AND revision = ? AND state = 'running'
       RETURNING *`,
      [state, errorCode, errorMessage, now, now, current.runId, expectedRevision],
    );
    if (!row) throw new PersistenceRevisionConflictError('Generation run', current.runId);
    return parseGenerationRun(row);
  }

  const repository: GenerationRepository &
    GenerationAdmissionRepository &
    GenerationMaintenanceRepository = {
    admit,
    finalizeStage(input) {
      assertIdentifier(input.runId, 'Generation run id');
      assertPositiveInteger(input.expectedRunRevision, 'Expected generation revision');
      const now = checkedClock(clock);
      return jobs.withTransaction((transaction) => {
        const row = database.get<GenerationRunRow>(
          'SELECT * FROM generation_runs WHERE run_id = ?',
          [input.runId],
        );
        if (!row) throw new PersistenceRevisionConflictError('Generation run', input.runId);
        const current = parseGenerationRun(row);
        if (current.revision !== input.expectedRunRevision || current.state !== 'running') {
          throw new PersistenceRevisionConflictError('Generation run', input.runId);
        }

        if (input.outcome.state !== 'succeeded') {
          const errorCode = requiredFailure(input.outcome.errorCode, 'Generation error code');
          const errorMessage = requiredFailure(
            input.outcome.errorMessage,
            'Generation error message',
          );
          let campaign: StoredCampaign | null = null;
          if (input.outcome.campaign) {
            if (
              current.stage !== 'copy' ||
              input.outcome.campaign.kind !== 'replace' ||
              input.outcome.campaign.expectedRevision !== current.expectedCampaignRevision ||
              input.outcome.campaign.record.stage !== 'copy'
            ) {
              throw new Error(
                'Only copy-stage failure or ambiguity may atomically preserve partial copy.',
              );
            }
            campaign = persistCampaignMutation(input.outcome.campaign, current.campaignId);
          }
          return Object.freeze({
            campaign,
            finalizedRun: finalizeRun(
              current,
              input.expectedRunRevision,
              now,
              input.outcome.state,
              errorCode,
              errorMessage,
            ),
            nextRun: null,
          });
        }

        const { campaign: mutation, nextRun: nextInput } = input.outcome;
        const expectedNextStage = successfulNextStage(current, mutation);
        const campaign = persistCampaignMutation(mutation, current.campaignId);
        const finalizedRun = finalizeRun(
          current,
          input.expectedRunRevision,
          now,
          'succeeded',
          null,
          null,
        );
        if (expectedNextStage === null) {
          if (nextInput !== undefined) {
            throw new Error('Prompt completion cannot enqueue another generation stage.');
          }
          return Object.freeze({ campaign, finalizedRun, nextRun: null });
        }
        if (!nextInput) {
          throw new Error(
            'Successful non-final generation must atomically enqueue its next stage.',
          );
        }
        if (
          nextInput.campaignId !== current.campaignId ||
          nextInput.ownerSessionIdHash !== current.ownerSessionIdHash ||
          nextInput.stage !== expectedNextStage ||
          nextInput.expectedCampaignRevision !== campaign.revision
        ) {
          throw new Error('Next generation run does not match the finalized campaign transition.');
        }
        const nextRun = insertRun(transaction, nextInput, now);
        return Object.freeze({ campaign, finalizedRun, nextRun });
      });
    },
    getEffect(effectId) {
      const row = database.get<ProviderEffectRow>(
        'SELECT * FROM provider_effects WHERE effect_id = ?',
        [effectId],
      );
      return row ? parseProviderEffect(row) : null;
    },
    getLatestRun(campaignId) {
      if (!isCampaignId(campaignId)) return null;
      const row = database.get<GenerationRunRow>(
        `SELECT * FROM generation_runs
         WHERE campaign_id = ? ORDER BY run_sequence DESC LIMIT 1`,
        [campaignId],
      );
      return row ? parseGenerationRun(row) : null;
    },
    getRun(runId) {
      const row = database.get<GenerationRunRow>('SELECT * FROM generation_runs WHERE run_id = ?', [
        runId,
      ]);
      return row ? parseGenerationRun(row) : null;
    },
    getRunByJobId(jobId) {
      assertIdentifier(jobId, 'Durable job id');
      const row = database.get<GenerationRunRow>('SELECT * FROM generation_runs WHERE job_id = ?', [
        jobId,
      ]);
      return row ? parseGenerationRun(row) : null;
    },
    isReceiptRecoveryJob({ jobId, runId }) {
      assertIdentifier(jobId, 'Durable recovery job id');
      assertIdentifier(runId, 'Generation recovery run id');
      return (
        database.get(
          `SELECT 1 AS present
           FROM generation_receipt_recoveries
           WHERE run_id = ? AND recovery_job_id = ?`,
          [runId, jobId],
        ) !== undefined
      );
    },
    listLatestRecoverableRuns({ limit }) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_RECOVERABLE_GENERATION_RUNS) {
        throw new Error(
          `Recoverable generation limit must be between 1 and ${String(MAX_RECOVERABLE_GENERATION_RUNS)}.`,
        );
      }
      return database
        .all<GenerationRunRow>(
          `SELECT latest_run.*
           FROM generation_runs AS latest_run
           WHERE latest_run.run_sequence IN (
             SELECT MAX(candidate.run_sequence)
             FROM generation_runs AS candidate
             GROUP BY candidate.campaign_id
           )
             AND latest_run.state IN ('queued', 'running', 'failed', 'ambiguous')
           ORDER BY latest_run.run_sequence DESC
           LIMIT ?`,
          [limit],
        )
        .map(parseGenerationRun);
    },
    markCreatingEffectsAmbiguous(now) {
      assertEpoch(now, 'Provider recovery time');
      return database.run(
        `UPDATE provider_effects
         SET state = 'ambiguous',
             error_code = 'create_response_id_missing',
             error_message = 'Provider create may have crossed the network without returning a response id.',
             finished_at = ?, updated_at = ?, revision = revision + 1
         WHERE state = 'creating' AND provider_response_id IS NULL
           AND NOT EXISTS (
             SELECT 1
             FROM generation_runs AS run
             JOIN cx_jobs AS job ON job.id = run.job_id
             WHERE run.run_id = provider_effects.run_id
               AND job.status = 'running'
               AND job.lease_expires_at > ?
           )`,
        [now, now, now],
      ).changes;
    },
    prepareEffect(input) {
      assertIdentifier(input.effectId, 'Effect id');
      assertIdentifier(input.runId, 'Generation run id');
      assertIdentifier(input.effectKey, 'Effect key');
      assertSafeText(input.operation, 128, 'Provider operation');
      assertHash(input.requestSha256, 'Provider request hash');
      const existingRow = database.get<ProviderEffectRow>(
        `SELECT * FROM provider_effects
         WHERE effect_id = ? OR (run_id = ? AND effect_key = ?)
         ORDER BY effect_id = ? DESC LIMIT 1`,
        [input.effectId, input.runId, input.effectKey, input.effectId],
      );
      if (existingRow) {
        const existing = parseProviderEffect(existingRow);
        if (
          existing.effectId === input.effectId &&
          existing.runId === input.runId &&
          existing.effectKey === input.effectKey &&
          existing.operation === input.operation &&
          existing.requestSha256 === input.requestSha256
        ) {
          return existing;
        }
        throw new PersistenceRevisionConflictError('Provider effect', input.effectId);
      }
      assertRowCapacity(
        database,
        'provider_effects',
        MAX_PROVIDER_EFFECTS,
        () => new ProviderEffectCapacityError(),
      );
      const perRunCount = database.get<CountRow>(
        'SELECT COUNT(*) AS count FROM provider_effects WHERE run_id = ?',
        [input.runId],
      );
      if (
        !perRunCount ||
        integer(perRunCount.count, 'provider effects per run') >= MAX_PROVIDER_EFFECTS_PER_RUN
      ) {
        throw new ProviderEffectCapacityError();
      }
      const now = checkedClock(clock);
      const row = database.get<ProviderEffectRow>(
        `INSERT INTO provider_effects (
           effect_id, run_id, effect_key, operation, request_sha256, state,
           created_at, updated_at, revision
         ) VALUES (?, ?, ?, ?, ?, 'prepared', ?, ?, 1)
         RETURNING *`,
        [
          input.effectId,
          input.runId,
          input.effectKey,
          input.operation,
          input.requestSha256,
          now,
          now,
        ],
      );
      if (!row) throw new Error('Provider effect insert returned no row.');
      return parseProviderEffect(row);
    },
    transitionEffect(input) {
      assertIdentifier(input.effectId, 'Effect id');
      assertPositiveInteger(input.expectedRevision, 'Expected effect revision');
      const existing = database.get<ProviderEffectRow>(
        'SELECT * FROM provider_effects WHERE effect_id = ?',
        [input.effectId],
      );
      if (!existing) throw new PersistenceRevisionConflictError('Provider effect', input.effectId);
      const current = parseProviderEffect(existing);
      const terminal = ['succeeded', 'rejected', 'ambiguous'].includes(input.state);
      let responseBytes: Buffer | null = null;
      let responseSha256: string | null = null;
      if (input.state === 'succeeded') {
        if (input.response === undefined)
          throw new Error('Succeeded provider effect needs a response.');
        responseBytes = Buffer.from(canonicalJsonValue(input.response), 'utf8');
        if (responseBytes.byteLength > MAX_PROVIDER_RESPONSE_BYTES) {
          throw new ProviderResponseCapacityError();
        }
        responseSha256 = sha256Hex(responseBytes);
      } else if (input.response !== undefined) {
        throw new Error('Only a succeeded provider effect may persist a response.');
      }
      const errorRequired = input.state === 'rejected' || input.state === 'ambiguous';
      const errorCode = errorRequired
        ? requiredFailure(input.errorCode, 'Provider error code')
        : null;
      const errorMessage = errorRequired
        ? requiredFailure(input.errorMessage, 'Provider error message')
        : null;
      const providerResponseId =
        input.providerResponseId === undefined
          ? current.providerResponseId
          : requiredFailure(input.providerResponseId, 'Provider response id');
      if (current.revision !== input.expectedRevision) {
        if (
          current.revision === input.expectedRevision + 1 &&
          sameProviderEffectResult(
            current,
            input.state,
            providerResponseId,
            responseSha256,
            errorCode,
            errorMessage,
          )
        ) {
          return current;
        }
        throw new PersistenceRevisionConflictError('Provider effect', input.effectId);
      }
      if (current.state === 'ambiguous') throw new ProviderEffectReplayBlockedError(input.effectId);
      if (responseBytes !== null && current.response === null) {
        const total = database.get<{
          readonly bytes: number | bigint;
          readonly run_bytes: number | bigint;
        }>(
          `SELECT
             (SELECT COALESCE(SUM(length(response_json)), 0) FROM provider_effects) AS bytes,
             (SELECT COALESCE(SUM(length(response_json)), 0) FROM provider_effects
              WHERE run_id = ?) AS run_bytes`,
          [current.runId],
        );
        if (
          !total ||
          safeAdd(
            integer(total.run_bytes, 'provider response run bytes'),
            responseBytes.byteLength,
            'Provider response run bytes',
          ) > MAX_PROVIDER_RESPONSE_BYTES_PER_RUN ||
          safeAdd(
            integer(total.bytes, 'provider response aggregate bytes'),
            responseBytes.byteLength,
            'Provider response aggregate bytes',
          ) > MAX_PROVIDER_RESPONSE_TOTAL_BYTES
        ) {
          throw new ProviderResponseCapacityError();
        }
      }
      const now = checkedClock(clock);
      const row = database.get<ProviderEffectRow>(
        `UPDATE provider_effects
         SET state = ?, provider_response_id = ?, response_sha256 = ?, response_json = ?,
             error_code = ?, error_message = ?, finished_at = ?, updated_at = ?,
             revision = revision + 1
         WHERE effect_id = ? AND revision = ?
         RETURNING *`,
        [
          input.state,
          providerResponseId,
          responseSha256,
          responseBytes,
          errorCode,
          errorMessage,
          terminal ? now : null,
          now,
          input.effectId,
          input.expectedRevision,
        ],
      );
      if (!row) throw new PersistenceRevisionConflictError('Provider effect', input.effectId);
      return parseProviderEffect(row);
    },
    transitionRun(input) {
      assertIdentifier(input.runId, 'Generation run id');
      assertPositiveInteger(input.expectedRevision, 'Expected generation revision');
      const now = checkedClock(clock);
      const terminal = ['succeeded', 'failed', 'ambiguous'].includes(input.state);
      const errorRequired = input.state === 'failed' || input.state === 'ambiguous';
      const row = database.get<GenerationRunRow>(
        `UPDATE generation_runs
         SET state = ?, error_code = ?, error_message = ?, finished_at = ?,
             updated_at = ?, revision = revision + 1
         WHERE run_id = ? AND revision = ?
         RETURNING *`,
        [
          input.state,
          errorRequired ? requiredFailure(input.errorCode, 'Generation error code') : null,
          errorRequired ? requiredFailure(input.errorMessage, 'Generation error message') : null,
          terminal ? now : null,
          now,
          input.runId,
          input.expectedRevision,
        ],
      );
      if (row) return parseGenerationRun(row);
      throw new PersistenceRevisionConflictError('Generation run', input.runId);
    },
    reconcileTerminalJobs({ now, limit }) {
      assertEpoch(now, 'Generation reconciliation time');
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_GENERATION_RETENTION_BATCH) {
        throw new Error(
          `Generation reconciliation limit must be between 1 and ${String(MAX_GENERATION_RETENTION_BATCH)}.`,
        );
      }
      return jobs.withTransaction((transaction) => {
        const rows = database.all<GenerationRunTerminalJobRow>(
          `SELECT run.*,
                  job.failure_code AS job_failure_code,
                  job.failure_message AS job_failure_message
           FROM generation_runs AS run
           JOIN cx_jobs AS job ON job.id = run.job_id
           WHERE run.state IN ('queued', 'running') AND job.status = 'failed'
           ORDER BY run.run_sequence
           LIMIT ?`,
          [limit],
        );
        let ambiguous = 0;
        let failed = 0;
        let resumed = 0;
        for (const row of rows) {
          const succeededReceipt =
            database.get(
              `SELECT 1 AS present FROM provider_effects
               WHERE run_id = ? AND state = 'succeeded' LIMIT 1`,
              [row.run_id],
            ) !== undefined;
          if (succeededReceipt) {
            const unsafeUnresolvedEffect =
              database.get(
                `SELECT 1 AS present FROM provider_effects
                 WHERE run_id = ?
                   AND state IN ('creating', 'submitted', 'polling', 'ambiguous')
                 LIMIT 1`,
                [row.run_id],
              ) !== undefined;
            const recoveryUsed =
              database.get(
                `SELECT 1 AS present FROM generation_receipt_recoveries
                 WHERE run_id = ? LIMIT 1`,
                [row.run_id],
              ) !== undefined;
            if (row.state === 'running' && !unsafeUnresolvedEffect && !recoveryUsed) {
              const failedJob = jobs.get(row.job_id);
              if (!failedJob || failedJob.status !== 'failed') {
                throw new Error('Completed provider receipt recovery lost its failed durable job.');
              }
              const parsedJob = parseCampaignGenerationJob(failedJob.payload);
              if (
                failedJob.type !== CAMPAIGN_GENERATION_JOB_TYPE ||
                parsedJob.runId !== row.run_id ||
                parsedJob.campaignId !== row.campaign_id ||
                parsedJob.stage !== row.stage
              ) {
                throw new Error('Completed provider receipt recovery found mismatched job input.');
              }
              const replacement = transaction.enqueue({
                availableAt: now,
                executionClass: failedJob.executionClass,
                idempotencyKey: campaignGenerationReceiptRecoveryIdempotencyKey(row.run_id),
                maxAttempts: failedJob.maxAttempts,
                payload: failedJob.payload,
                type: failedJob.type,
              }).job;
              const marked = database.run(
                `INSERT INTO generation_receipt_recoveries (
                   run_id, original_job_id, recovery_job_id, recovered_at
                 ) VALUES (?, ?, ?, ?)`,
                [row.run_id, row.job_id, replacement.id, now],
              );
              if (marked.changes !== 1) {
                throw new Error('Completed provider receipt recovery could not be sealed.');
              }
              const relinked = database.run(
                `UPDATE generation_runs
                 SET job_id = ?, updated_at = MAX(updated_at, ?), revision = revision + 1
                 WHERE run_id = ? AND job_id = ? AND revision = ? AND state = 'running'`,
                [replacement.id, now, row.run_id, row.job_id, row.revision],
              );
              if (relinked.changes !== 1) {
                throw new Error(
                  'Completed provider receipt run could not be relinked exactly once.',
                );
              }
              resumed += 1;
              continue;
            }
          }
          const uncertain =
            database.get(
              `SELECT 1 AS present FROM provider_effects
               WHERE run_id = ?
                 AND state IN ('creating', 'submitted', 'polling', 'ambiguous')
               LIMIT 1`,
              [row.run_id],
            ) !== undefined;
          if (uncertain) {
            database.run(
              `UPDATE provider_effects
               SET state = 'ambiguous',
                   error_code = 'provider_effect_incomplete_at_job_failure',
                   error_message = 'Provider work remained incomplete when its durable job failed.',
                   finished_at = ?, updated_at = ?, revision = revision + 1
               WHERE run_id = ? AND state IN ('creating', 'submitted', 'polling')`,
              [now, now, row.run_id],
            );
          }
          const state = uncertain ? 'ambiguous' : 'failed';
          const errorCode = uncertain
            ? 'provider_effect_ambiguous'
            : safePersistedFailure(row.job_failure_code, 'durable_job_failed');
          const errorMessage = uncertain
            ? 'Provider work may have crossed the network before its durable job failed.'
            : safePersistedFailure(
                row.job_failure_message,
                'The durable generation job failed without a safe persisted description.',
              );
          const result = database.run(
            `UPDATE generation_runs
             SET state = ?, error_code = ?, error_message = ?, finished_at = ?,
                 updated_at = ?, revision = revision + 1
             WHERE run_id = ? AND revision = ? AND state IN ('queued', 'running')`,
            [state, errorCode, errorMessage, now, now, row.run_id, row.revision],
          );
          if (result.changes !== 1) {
            throw new Error('Generation reconciliation lost its pinned run revision.');
          }
          if (uncertain) ambiguous += 1;
          else failed += 1;
        }
        return Object.freeze({ ambiguous, failed, resumed });
      });
    },
    maintainTerminalStorage({ now, limit }) {
      assertEpoch(now, 'Generation retention time');
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_GENERATION_RETENTION_BATCH) {
        throw new Error(
          `Generation retention limit must be between 1 and ${String(MAX_GENERATION_RETENTION_BATCH)}.`,
        );
      }
      return withImmediateTransaction(database, () => {
        const before = Math.max(0, now - GENERATION_TERMINAL_RETENTION_MS);
        const totals = database.get<{
          readonly effects: number | bigint;
          readonly jobs: number | bigint;
          readonly response_bytes: number | bigint;
          readonly runs: number | bigint;
        }>(
          `SELECT
             (SELECT COUNT(*) FROM generation_runs) AS runs,
             (SELECT COUNT(*) FROM provider_effects) AS effects,
             (SELECT COUNT(*) FROM cx_jobs) AS jobs,
             (SELECT COALESCE(SUM(length(response_json)), 0) FROM provider_effects)
               AS response_bytes`,
        );
        if (!totals) throw new Error('Generation retention totals are unavailable.');
        const storagePressure =
          integer(totals.runs, 'generation retention run count') >=
            GENERATION_RUN_RETENTION_TARGET ||
          integer(totals.effects, 'generation retention effect count') >=
            PROVIDER_EFFECT_RETENTION_TARGET ||
          integer(totals.response_bytes, 'generation retention response bytes') >=
            PROVIDER_RESPONSE_RETENTION_TARGET;
        const jobStoragePressure =
          integer(totals.jobs, 'generation retention job count') >= GENERATION_JOB_RETENTION_TARGET;
        const candidates = database.all<{
          readonly effect_count: number | bigint;
          readonly job_id: string;
          readonly response_bytes: number | bigint;
          readonly run_id: string;
        }>(
          `SELECT run.run_id, run.job_id,
                  COUNT(effect.effect_id) AS effect_count,
                  COALESCE(SUM(length(effect.response_json)), 0) AS response_bytes
           FROM generation_runs AS run
           LEFT JOIN provider_effects AS effect ON effect.run_id = run.run_id
           WHERE run.state IN ('succeeded', 'failed', 'ambiguous')
             AND (run.finished_at <= ? OR ? = 1)
             AND NOT (
               run.state IN ('failed', 'ambiguous')
               AND run.run_sequence = (
                 SELECT MAX(latest.run_sequence)
                 FROM generation_runs AS latest
                 WHERE latest.campaign_id = run.campaign_id
               )
               AND (
                 EXISTS (SELECT 1 FROM campaigns WHERE id = run.campaign_id)
                 OR (
                   run.expected_campaign_revision = 0
                   AND run.finished_at > ?
                   AND run.run_sequence IN (
                     SELECT recoverable.run_sequence
                     FROM generation_runs AS recoverable
                     WHERE recoverable.expected_campaign_revision = 0
                       AND recoverable.state IN ('failed', 'ambiguous')
                       AND NOT EXISTS (
                         SELECT 1 FROM campaigns
                         WHERE campaigns.id = recoverable.campaign_id
                       )
                       AND recoverable.run_sequence = (
                         SELECT MAX(latest_absent.run_sequence)
                         FROM generation_runs AS latest_absent
                         WHERE latest_absent.campaign_id = recoverable.campaign_id
                       )
                     ORDER BY recoverable.run_sequence DESC
                     LIMIT ${String(MAX_RECOVERABLE_GENERATION_RUNS)}
                   )
                 )
               )
             )
             AND NOT EXISTS (
               SELECT 1 FROM cx_jobs AS active_job
               WHERE active_job.id = run.job_id
                 AND active_job.status IN ('blocked', 'queued', 'running')
             )
           GROUP BY run.run_id, run.job_id, run.finished_at, run.run_sequence
           ORDER BY run.finished_at, run.run_sequence
           LIMIT ?`,
          [before, storagePressure ? 1 : 0, before, limit],
        );
        let coordinatedJobs = 0;
        if (candidates.length > 0) {
          beginGenerationRetention(database);
          for (const candidate of candidates) {
            const result = database.run(
              `DELETE FROM generation_runs
               WHERE run_id = ? AND state IN ('succeeded', 'failed', 'ambiguous')`,
              [candidate.run_id],
            );
            if (result.changes !== 1) {
              throw new Error('Generation retention candidate changed during its transaction.');
            }
          }
          endGenerationRetention(database);
          for (const candidate of candidates) {
            coordinatedJobs += database.run(
              `DELETE FROM cx_jobs WHERE id = ? AND status IN ('succeeded', 'failed')`,
              [candidate.job_id],
            ).changes;
          }
        }
        const remainingJobLimit = Math.max(0, limit - coordinatedJobs);
        const otherJobs = database.run(
          `DELETE FROM cx_jobs
           WHERE id IN (
             SELECT id FROM cx_jobs
             WHERE status IN ('succeeded', 'failed')
               AND (finished_at < ? OR ? = 1)
               AND NOT EXISTS (
                 SELECT 1 FROM generation_runs AS active_run
                 WHERE active_run.job_id = cx_jobs.id
                   AND active_run.state IN ('queued', 'running')
               )
             ORDER BY finished_at, id
             LIMIT ?
           )`,
          [before, jobStoragePressure ? 1 : 0, remainingJobLimit],
        ).changes;
        return Object.freeze({
          effects: candidates.reduce(
            (total, candidate) =>
              safeAdd(
                total,
                integer(candidate.effect_count, 'retained effect count'),
                'Retained effect count',
              ),
            0,
          ),
          jobs: safeAdd(coordinatedJobs, otherJobs, 'Retained job count'),
          responseBytes: candidates.reduce(
            (total, candidate) =>
              safeAdd(
                total,
                integer(candidate.response_bytes, 'retained response bytes'),
                'Retained response bytes',
              ),
            0,
          ),
          runs: candidates.length,
        });
      });
    },
  };
  return Object.freeze(repository);
}

function campaignInsertSql(): string {
  return `INSERT INTO campaigns (
    id, created_at, created_at_ms, updated_at, updated_at_ms, name, stage,
    revision, record_sha256, record_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`;
}

function campaignInsertValues(
  record: CampaignRecord,
  canonicalBytes: Uint8Array,
  recordHash: string,
): readonly SqliteValue[] {
  return [
    record.id,
    record.createdAt,
    Date.parse(record.createdAt),
    record.updatedAt,
    Date.parse(record.updatedAt),
    record.name,
    record.stage,
    recordHash,
    canonicalBytes,
  ];
}

function campaignColumns(): string {
  return `campaign_sequence, id, created_at, updated_at, name, stage, revision,
          record_sha256, record_json`;
}

function parseCampaignRow(row: CampaignRow): StoredCampaign {
  if (!(row.record_json instanceof Uint8Array))
    throw new Error('Campaign record JSON must be a BLOB.');
  const recordBytes = Buffer.from(row.record_json);
  const record = parseCampaignBytes(recordBytes);
  if (!recordBytes.equals(canonicalCampaignBytes(record))) {
    throw new Error('Campaign record JSON is not canonical.');
  }
  if (sha256Hex(recordBytes) !== row.record_sha256) {
    throw new Error('Campaign record hash does not match its canonical BLOB.');
  }
  if (
    row.id !== record.id ||
    row.created_at !== record.createdAt ||
    row.updated_at !== record.updatedAt ||
    row.name !== record.name ||
    row.stage !== record.stage
  ) {
    throw new Error('Campaign relational projections do not match the canonical record.');
  }
  return Object.freeze({
    sequence: positiveInteger(row.campaign_sequence, 'campaign sequence'),
    record,
    revision: positiveInteger(row.revision, 'campaign revision'),
  });
}

function persistedOwnerSession(row: SessionRow): PersistedOwnerSession {
  const session = Object.freeze({
    createdAt: integer(row.issued_at, 'session creation time'),
    expiresAt: integer(row.expires_at, 'session expiry'),
    lastSeenAt: integer(row.last_seen_at, 'session last-seen time'),
    revision: positiveInteger(row.revision, 'session revision'),
    sessionIdHash: requiredHash(row.session_id_hash, 'Session id hash'),
  });
  validatePersistedOwnerSession(session);
  return session;
}

function validatePersistedOwnerSession(session: PersistedOwnerSession): void {
  assertHash(session.sessionIdHash, 'Session id hash');
  assertEpoch(session.createdAt, 'Session creation time');
  assertEpoch(session.expiresAt, 'Session expiry time');
  assertEpoch(session.lastSeenAt, 'Session last-seen time');
  assertPositiveInteger(session.revision, 'Session revision');
  if (
    session.lastSeenAt < session.createdAt ||
    session.lastSeenAt >= session.expiresAt ||
    session.createdAt >= session.expiresAt
  ) {
    throw new Error('Persisted owner session timestamps are inconsistent.');
  }
}

function ownerLoginThrottleState(
  row: LoginFailureRow | undefined,
  now: number,
): OwnerLoginThrottleState {
  if (!row) return Object.freeze({ status: 'allowed' });
  const state = parseLoginFailure(row);
  if (state.blockedUntil !== null && state.blockedUntil > now) {
    return Object.freeze({
      retryAfterSeconds: state.blockedUntil - now,
      status: 'rate_limited',
    });
  }
  return Object.freeze({ status: 'allowed' });
}

function parseLoginFailure(row: LoginFailureRow): StoredLoginThrottleState {
  return Object.freeze({
    blockedUntil:
      row.blocked_until === null ? null : integer(row.blocked_until, 'login blocked-until time'),
    failureCount: positiveInteger(row.failure_count, 'login failure count'),
    windowStartedAt: integer(row.window_started_at, 'login window start'),
  });
}

function parseGenerationRun(row: GenerationRunRow): GenerationRun {
  if (!['strategy', 'copy', 'prompts'].includes(row.stage)) {
    throw new Error('Generation stage is invalid.');
  }
  if (!['queued', 'running', 'succeeded', 'failed', 'ambiguous'].includes(row.state)) {
    throw new Error('Generation state is invalid.');
  }
  return Object.freeze({
    attempt: positiveInteger(row.attempt, 'generation attempt'),
    campaignId: row.campaign_id,
    createdAt: integer(row.created_at, 'generation created time'),
    errorCode: row.error_code,
    errorMessage: row.error_message,
    expectedCampaignRevision: integer(row.expected_campaign_revision, 'expected campaign revision'),
    finishedAt:
      row.finished_at === null ? null : integer(row.finished_at, 'generation finished time'),
    jobId: row.job_id,
    ownerSessionIdHash: requiredHash(row.owner_session_id_hash, 'Generation owner hash'),
    revision: positiveInteger(row.revision, 'generation revision'),
    runId: row.run_id,
    runSequence: positiveInteger(row.run_sequence, 'generation run sequence'),
    stage: row.stage as GenerationStage,
    state: row.state as GenerationState,
    strategyIdea: strategyIdea(row.stage, row.strategy_idea),
    updatedAt: integer(row.updated_at, 'generation updated time'),
  });
}

function parseProviderEffect(row: ProviderEffectRow): ProviderEffect {
  if (
    ![
      'prepared',
      'creating',
      'submitted',
      'polling',
      'succeeded',
      'rejected',
      'ambiguous',
    ].includes(row.state)
  ) {
    throw new Error('Provider effect state is invalid.');
  }
  let response: JsonValue | null = null;
  if (row.response_json !== null) {
    const bytes = Buffer.from(row.response_json);
    if (sha256Hex(bytes) !== row.response_sha256) {
      throw new Error('Provider response receipt hash does not match its BLOB.');
    }
    response = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as JsonValue;
    if (Buffer.from(canonicalJsonValue(response), 'utf8').compare(bytes) !== 0) {
      throw new Error('Provider response receipt is not canonical JSON.');
    }
  }
  return Object.freeze({
    createdAt: integer(row.created_at, 'effect created time'),
    effectId: row.effect_id,
    effectKey: row.effect_key,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    finishedAt: row.finished_at === null ? null : integer(row.finished_at, 'effect finished time'),
    operation: row.operation,
    providerResponseId: row.provider_response_id,
    requestSha256: requiredHash(row.request_sha256, 'Provider request hash'),
    response,
    responseSha256:
      row.response_sha256 === null
        ? null
        : requiredHash(row.response_sha256, 'Provider response hash'),
    revision: positiveInteger(row.revision, 'effect revision'),
    runId: row.run_id,
    state: row.state as ProviderEffectState,
    updatedAt: integer(row.updated_at, 'effect updated time'),
  });
}

function successfulNextStage(
  current: GenerationRun,
  mutation: CampaignStageMutation,
): Exclude<GenerationStage, 'strategy'> | null {
  if (current.stage === 'strategy') {
    if (
      current.expectedCampaignRevision !== 0 ||
      mutation.kind !== 'create' ||
      mutation.record.stage !== 'strategy'
    ) {
      throw new Error('Strategy completion must create the first strategy-stage campaign.');
    }
    return 'copy';
  }
  if (
    mutation.kind !== 'replace' ||
    mutation.expectedRevision !== current.expectedCampaignRevision ||
    current.expectedCampaignRevision < 1
  ) {
    throw new CampaignRevisionConflictError(current.campaignId);
  }
  if (current.stage === 'copy') {
    if (mutation.record.imagePrompts.length === 0 && mutation.record.stage === 'copy') {
      return 'prompts';
    }
    if (mutation.record.imagePrompts.length === 3 && mutation.record.stage === 'complete') {
      return null;
    }
    throw new Error(
      'Copy completion must either request prompts or preserve completed prompts and finish.',
    );
  }
  if (mutation.record.stage !== 'complete') {
    throw new Error('Prompt completion must persist a complete campaign.');
  }
  return null;
}

export function classifyCampaignContinuation(record: CampaignRecord): 'copy' | 'prompts' | null {
  const copyCount = CAMPAIGN_LANGUAGES.filter(
    (language) => record.copy[language] !== undefined,
  ).length;
  if (record.stage === 'strategy') return 'copy';
  if (record.imagePrompts.length === 0 && copyCount > 0) return 'prompts';
  if (record.imagePrompts.length === 3 && copyCount < CAMPAIGN_LANGUAGES.length) return 'copy';
  return null;
}

function sameProviderEffectResult(
  current: ProviderEffect,
  state: Exclude<ProviderEffectState, 'prepared'>,
  providerResponseId: string | null,
  responseSha256: string | null,
  errorCode: string | null,
  errorMessage: string | null,
): boolean {
  return (
    current.state === state &&
    current.providerResponseId === providerResponseId &&
    current.responseSha256 === responseSha256 &&
    current.errorCode === errorCode &&
    current.errorMessage === errorMessage
  );
}

function validateGenerationRunInput(input: CreateGenerationRunInput): void {
  assertIdentifier(input.runId, 'Generation run id');
  if (!isCampaignId(input.campaignId)) throw new Error('Generation campaign id is invalid.');
  assertHash(input.ownerSessionIdHash, 'Generation owner hash');
  if (!['strategy', 'copy', 'prompts'].includes(input.stage)) {
    throw new Error('Generation stage is invalid.');
  }
  assertNonNegativeInteger(input.expectedCampaignRevision, 'Expected campaign revision');
  if (input.expectedCampaignRevision === 0 && input.stage !== 'strategy') {
    throw new Error('Only absent-campaign strategy generation may use revision zero.');
  }
  strategyIdea(input.stage, input.strategyIdea);
  if (input.attempt !== undefined) assertPositiveInteger(input.attempt, 'Generation attempt');
  const jobKeys = Object.keys(input.job).toSorted();
  if (
    jobKeys.join('\0') !== ['idempotencyKey', 'maxAttempts', 'payload', 'type'].join('\0') ||
    input.job.type !== CAMPAIGN_GENERATION_JOB_TYPE ||
    input.job.idempotencyKey !== `campaign-generation:${input.runId}` ||
    input.job.maxAttempts !== CAMPAIGN_GENERATION_MAX_ATTEMPTS
  ) {
    throw new Error('Generation run job envelope is not canonical.');
  }
  const payload = parseCampaignGenerationJob(input.job.payload);
  if (
    payload.campaignId !== input.campaignId ||
    payload.expectedCampaignRevision !== input.expectedCampaignRevision ||
    payload.runId !== input.runId ||
    payload.stage !== input.stage ||
    (payload.idea ?? null) !== input.strategyIdea
  ) {
    throw new Error('Generation run and durable job payload do not have identical lineage.');
  }
}

function strategyIdea(stage: unknown, value: unknown): string | null {
  if (stage !== 'strategy') {
    if (value !== null) throw new Error('Only strategy generation may retain the durable idea.');
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error('Strategy generation requires its normalized durable idea.');
  }
  const normalized = normalizeCampaignIdea(value);
  const length = [...normalized].length;
  if (normalized !== value || length < MIN_IDEA_CHARACTERS || length > MAX_IDEA_CHARACTERS) {
    throw new Error('Strategy generation durable idea is invalid.');
  }
  return normalized;
}

function sanitizeCopyUpdate(
  field: CampaignCopyUpdate['field'],
  value: CampaignCopyUpdate['value'],
): string | string[] {
  if (field === 'hashtags') {
    if (!Array.isArray(value) || value.length > 30) throw new Error('Stored hashtags are invalid.');
    const tags = value.map((entry) => {
      const tag = typeof entry === 'string' ? entry.trim() : '';
      if (!tag || [...tag].length > 100) throw new Error('Stored hashtag is invalid.');
      return tag;
    });
    return tags;
  }
  if (typeof value !== 'string') throw new Error('Stored copy field must be text.');
  const trimmed = value.trim();
  if (!trimmed || [...trimmed].length > 4_000) throw new Error('Stored copy field is invalid.');
  return trimmed;
}

function assertCampaignCapacity(database: SyncSqliteDatabase): void {
  const count = database.get<CountRow>('SELECT COUNT(*) AS count FROM campaigns');
  if (!count || integer(count.count, 'campaign count') >= CAMPAIGN_MAX_RECORDS) {
    throw new CampaignCapacityError();
  }
}

function assertCampaignIdentity(id: string, expectedRevision: number): void {
  if (!isCampaignId(id)) throw new Error('Campaign id is invalid.');
  assertPositiveInteger(expectedRevision, 'Expected campaign revision');
}

function assertCampaignRevision(
  database: SyncSqliteDatabase,
  id: string,
  expectedRevision: number,
): void {
  assertCampaignIdentity(id, expectedRevision);
  const row = database.get<{ readonly revision: number | bigint }>(
    'SELECT revision FROM campaigns WHERE id = ?',
    [id],
  );
  if (!row || integer(row.revision, 'campaign revision') !== expectedRevision) {
    throw new CampaignRevisionConflictError(id);
  }
}

function campaignExists(database: SyncSqliteDatabase, id: string): boolean {
  return database.get('SELECT 1 AS present FROM campaigns WHERE id = ?', [id]) !== undefined;
}

function generationRunExists(database: SyncSqliteDatabase, campaignId: string): boolean {
  return (
    database.get('SELECT 1 AS present FROM generation_runs WHERE campaign_id = ? LIMIT 1', [
      campaignId,
    ]) !== undefined
  );
}

function assertCampaignSequenceCapacity(database: SyncSqliteDatabase): void {
  const row = database.get<{ readonly sequence: number | bigint }>(
    `SELECT seq AS sequence FROM sqlite_sequence WHERE name = 'campaigns'`,
  );
  if (row && integer(row.sequence, 'campaign sequence') >= MAX_CAMPAIGN_SEQUENCE) {
    throw new CampaignSequenceCapacityError();
  }
}

function assertGenerationRunSequenceCapacity(database: SyncSqliteDatabase): void {
  const row = database.get<{ readonly sequence: number | bigint }>(
    `SELECT seq AS sequence FROM sqlite_sequence WHERE name = 'generation_runs'`,
  );
  if (row && integer(row.sequence, 'generation run sequence') >= MAX_GENERATION_RUN_SEQUENCE) {
    throw new GenerationRunCapacityError();
  }
}

function assertRowCapacity(
  database: SyncSqliteDatabase,
  table: string,
  maximum: number,
  error: () => Error,
): void {
  const row = database.get<CountRow>(`SELECT COUNT(*) AS count FROM ${table}`);
  if (!row || integer(row.count, `${table} count`) >= maximum) throw error();
}

function beginGenerationRetention(database: SyncSqliteDatabase): void {
  const result = database.run('INSERT INTO generation_retention_guard(guard_key) VALUES (1)');
  if (result.changes !== 1) throw new Error('Generation retention ownership was not acquired.');
}

function endGenerationRetention(database: SyncSqliteDatabase): void {
  const result = database.run('DELETE FROM generation_retention_guard WHERE guard_key = 1');
  if (result.changes !== 1) throw new Error('Generation retention ownership was not released.');
}

function assertWindowPolicy(maximum: number, windowMs: number, label: string): void {
  assertPositiveInteger(maximum, `${label} maximum`);
  assertPositiveInteger(windowMs, `${label} window`);
}

function assertHash(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/u.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  }
}

function requiredHash(value: unknown, label: string): string {
  assertHash(value, label);
  return value;
}

function assertIdentifier(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u.test(value)) {
    throw new Error(`${label} must contain 8-128 safe identifier characters.`);
  }
}

function requiredFailure(value: unknown, label: string): string {
  assertSafeText(value, 1_000, label);
  return value;
}

function safePersistedFailure(value: unknown, fallback: string): string {
  if (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 1_000 &&
    value === value.trim() &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  ) {
    return value;
  }
  return fallback;
}

function assertSafeText(value: unknown, maximum: number, label: string): asserts value is string {
  if (
    typeof value !== 'string' ||
    !value ||
    value !== value.trim() ||
    value.length > maximum ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new Error(`${label} must contain bounded safe text.`);
  }
}

function canonicalTimestamp(epochMs: number): string {
  assertEpoch(epochMs, 'Campaign update time');
  return new Date(epochMs).toISOString();
}

function monotonicCampaignMutation(
  database: SyncSqliteDatabase,
  record: CampaignRecord,
): CampaignRecord {
  const proposedEpochMs = Date.parse(record.updatedAt);
  if (!Number.isSafeInteger(proposedEpochMs) || proposedEpochMs < 0) {
    throw new Error('Proposed campaign update time is invalid.');
  }
  const row = database.get<{ readonly maximum: number | bigint | null }>(
    'SELECT MAX(updated_at_ms) AS maximum FROM campaigns',
  );
  if (!row) throw new Error('SQLite did not return the latest campaign update time.');
  const globalMaximum = row.maximum === null ? -1 : integer(row.maximum, 'campaign update time');
  const next = proposedEpochMs > globalMaximum ? proposedEpochMs : globalMaximum + 1;
  if (!Number.isSafeInteger(next) || next > 8_640_000_000_000_000) {
    throw new Error('Campaign update timestamp capacity has been reached.');
  }
  return Object.freeze({ ...record, updatedAt: canonicalTimestamp(next) });
}

function checkedClock(clock: () => number): number {
  const now = clock();
  assertEpoch(now, 'Persistence clock');
  return now;
}

function assertEpoch(value: number, label: string): void {
  assertNonNegativeInteger(value, label);
}

function assertPositiveInteger(value: unknown, label: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new Error(`${label} must be a positive safe integer.`);
  }
}

function assertNonNegativeInteger(value: unknown, label: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a non-negative safe integer.`);
  }
}

function integer(value: number | bigint | null, label: string): number {
  if (value === null) throw new Error(`${label} is unexpectedly null.`);
  const normalized = typeof value === 'bigint' ? Number(value) : value;
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new Error(`${label} is not a non-negative safe integer.`);
  }
  return normalized;
}

function positiveInteger(value: number | bigint, label: string): number {
  const normalized = integer(value, label);
  if (normalized < 1) throw new Error(`${label} is not positive.`);
  return normalized;
}

function safeAdd(value: number, amount: number, label: string): number {
  const result = value + amount;
  if (!Number.isSafeInteger(result) || result < 0) throw new Error(`${label} overflowed.`);
  return result;
}

function sqliteMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function canonicalJsonValue(value: JsonValue): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Provider response contains a non-finite number.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJsonValue).join(',')}]`;
  const object = value as Readonly<Record<string, JsonValue>>;
  return `{${Object.keys(object)
    .toSorted()
    .map((key) => `${JSON.stringify(key)}:${canonicalJsonValue(object[key] as JsonValue)}`)
    .join(',')}}`;
}
