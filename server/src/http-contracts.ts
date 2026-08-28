import type { JsonValue } from '@mikaelcedergren/cx-framework/server/errors';

export type CampaignStage = 'strategy' | 'copy' | 'complete';
export type GenerationStage = 'strategy' | 'copy' | 'prompts';
export type CampaignLanguage = 'sv' | 'en';

export interface CampaignSummary {
  readonly createdAt: string;
  readonly id: string;
  readonly name: string;
  readonly revision: number;
  readonly stage: CampaignStage;
  readonly updatedAt: string;
}

export interface CampaignRecord {
  readonly createdAt: string;
  readonly id: string;
  readonly name: string;
  readonly revision: number;
  readonly stage: CampaignStage;
  readonly updatedAt: string;
  readonly [key: string]: JsonValue;
}

export type CampaignConfiguration = Readonly<Record<string, JsonValue>>;

export interface CampaignCopyUpdate {
  readonly campaignId: string;
  readonly expectedRevision: number;
  readonly field: string;
  readonly language: CampaignLanguage;
  readonly value: string | readonly string[];
}

export interface CampaignCopyUpdateResult {
  readonly revision: number;
  readonly status: 'updated';
  readonly updatedAt: string;
}

export type CampaignMutationResult<T> =
  | T
  | { readonly status: 'not_found' }
  | { readonly currentRevision: number; readonly status: 'revision_conflict' };

export interface CampaignService {
  configuration(): Promise<CampaignConfiguration>;
  deleteCampaign(input: {
    readonly expectedRevision: number;
    readonly id: string;
  }): Promise<CampaignMutationResult<{ readonly status: 'deleted' }>>;
  getCampaign(id: string): Promise<CampaignRecord | null>;
  listCampaigns(): Promise<readonly CampaignSummary[]>;
  updateCopy(input: CampaignCopyUpdate): Promise<CampaignMutationResult<CampaignCopyUpdateResult>>;
}

export type GenerationState = 'queued' | 'running' | 'succeeded' | 'failed' | 'ambiguous';

export interface GenerationAcceptance {
  /** Zero means the durable run exists but strategy has not atomically created a campaign yet. */
  readonly campaignRevision: number;
  readonly campaignId: string;
  readonly jobId: string;
  readonly state: 'queued';
}

export interface GenerationStatus {
  /** Zero is valid only before the strategy stage has produced a campaign record. */
  readonly campaignRevision: number;
  readonly campaignId: string;
  readonly jobId: string;
  readonly stage: GenerationStage;
  readonly state: GenerationState;
  readonly updatedAt: string;
  readonly error?: {
    readonly code: string;
    readonly message: string;
  };
}

export interface GenerationService {
  createCampaign(input: {
    readonly idea: string;
    readonly ownerSessionIdHash: string;
  }): Promise<GenerationAcceptance>;
  getStatus(campaignId: string): Promise<GenerationStatus | null>;
  /** Authenticated single-owner discovery; session hashes are quota metadata, not ownership. */
  listRecoverableStatuses(): Promise<readonly GenerationStatus[]>;
  retryCampaign(input: {
    readonly campaignId: string;
    readonly expectedRevision: number;
    readonly ownerSessionIdHash: string;
    readonly stage: GenerationStage;
  }): Promise<CampaignMutationResult<GenerationAcceptance>>;
}

/** A synchronous SQLite readiness view. It must never perform migrations or external effects. */
export interface DatabaseReadiness {
  isReady(): boolean;
}
