import { HttpError, type JsonValue } from '@mikaelcedergren/cx-framework/server/errors';

import {
  CampaignActiveGenerationError,
  CampaignRevisionConflictError,
  type CampaignRepository,
  type StoredCampaign,
} from './campaign-repository.js';
import {
  COPY_FIELDS,
  COPY_FIELD_IDS,
  LIMITS_VERIFIED_ON,
  MAX_HASHTAGS,
  MIN_HASHTAGS,
  copyLength,
} from './copy-budgets.js';
import { MAX_IDEA_CHARACTERS } from './generation-content.js';
import type {
  CampaignConfiguration,
  CampaignCopyUpdate,
  CampaignMutationResult,
  CampaignRecord as HttpCampaignRecord,
  CampaignService,
} from './http-contracts.js';
import { IMAGE_CONCEPTS } from './image-style.js';
import { MARKETING_RULES } from './marketing-rules.js';

export interface CreateCampaignServiceOptions {
  readonly campaigns: CampaignRepository;
}

/** Map the typed product registries and repository without leaking persistence shapes into HTTP. */
export function createCampaignService({
  campaigns,
}: CreateCampaignServiceOptions): CampaignService {
  const configuration: CampaignConfiguration = Object.freeze({
    concepts: Object.freeze(IMAGE_CONCEPTS.map(({ id, label }) => Object.freeze({ id, label }))),
    fields: Object.freeze(
      COPY_FIELDS.map((field) =>
        Object.freeze({
          budget: field.budget,
          guidance: field.guidance,
          id: field.id,
          label: field.label,
          multiline: field.multiline,
          reason: field.reason,
        }),
      ),
    ),
    limitsVerifiedOn: LIMITS_VERIFIED_ON,
    maxIdeaCharacters: MAX_IDEA_CHARACTERS,
    rules: Object.freeze(
      MARKETING_RULES.map(({ id, name, teaches }) => Object.freeze({ id, name, teaches })),
    ),
  }) as Readonly<Record<string, JsonValue>>;

  const service: CampaignService = {
    async configuration() {
      return configuration;
    },
    async deleteCampaign({ expectedRevision, id }) {
      try {
        return campaigns.delete(id, expectedRevision)
          ? Object.freeze({ status: 'deleted' as const })
          : Object.freeze({ status: 'not_found' as const });
      } catch (error) {
        if (error instanceof CampaignRevisionConflictError) {
          return currentRevisionResult(campaigns, id);
        }
        if (error instanceof CampaignActiveGenerationError) {
          throw new HttpError({
            code: 'campaign_generation_active',
            message: 'That campaign still has active generation work and cannot be deleted.',
            status: 409,
          });
        }
        throw error;
      }
    },
    async getCampaign(id) {
      const stored = campaigns.get(id);
      return stored ? httpCampaign(stored) : null;
    },
    async listCampaigns() {
      return campaigns.list();
    },
    async updateCopy(input: CampaignCopyUpdate) {
      if (!isCopyFieldId(input.field)) {
        throw new HttpError({
          code: 'campaign_copy_field_invalid',
          message: 'That campaign copy field is not editable.',
          status: 400,
        });
      }
      validateCopyUpdate(input.field, input.value);
      const current = campaigns.get(input.campaignId);
      if (!current) return Object.freeze({ status: 'not_found' as const });
      if (current.revision !== input.expectedRevision) {
        return revisionConflict(current.revision);
      }
      if (!current.record.copy[input.language]) {
        throw new HttpError({
          code: 'campaign_copy_unavailable',
          message: 'That campaign does not yet contain copy in the selected language.',
          status: 409,
        });
      }
      try {
        const updated = campaigns.updateCopy({
          campaignId: input.campaignId,
          expectedRevision: input.expectedRevision,
          field: input.field,
          language: input.language,
          value: input.value,
        });
        if (!updated) {
          const latest = campaigns.get(input.campaignId);
          if (!latest) return Object.freeze({ status: 'not_found' as const });
          if (latest.revision !== input.expectedRevision) {
            return revisionConflict(latest.revision);
          }
          throw new HttpError({
            code: 'campaign_copy_unavailable',
            message: 'That campaign does not yet contain copy in the selected language.',
            status: 409,
          });
        }
        return Object.freeze({
          revision: updated.revision,
          status: 'updated' as const,
          updatedAt: updated.record.updatedAt,
        });
      } catch (error) {
        if (error instanceof CampaignRevisionConflictError) {
          return currentRevisionResult(campaigns, input.campaignId);
        }
        throw error;
      }
    },
  };
  return Object.freeze(service);
}

function httpCampaign(stored: StoredCampaign): HttpCampaignRecord {
  return Object.freeze({
    ...stored.record,
    revision: stored.revision,
  }) as unknown as HttpCampaignRecord;
}

function isCopyFieldId(value: string): value is (typeof COPY_FIELD_IDS)[number] {
  return COPY_FIELD_IDS.includes(value as (typeof COPY_FIELD_IDS)[number]);
}

function validateCopyUpdate(
  fieldId: (typeof COPY_FIELD_IDS)[number],
  value: string | readonly string[],
): void {
  const field = COPY_FIELDS.find(({ id }) => id === fieldId);
  if (!field) throw new Error('The editable copy registry is internally inconsistent.');
  const invalid =
    fieldId === 'hashtags'
      ? !Array.isArray(value) ||
        value.length < MIN_HASHTAGS ||
        value.length > MAX_HASHTAGS ||
        value.some(
          (entry) =>
            typeof entry !== 'string' || !entry.trim() || copyLength(entry.trim()) > field.budget,
        )
      : typeof value !== 'string' || !value.trim() || copyLength(value.trim()) > field.budget;
  if (!invalid) return;
  throw new HttpError({
    code: 'campaign_copy_value_invalid',
    details: {
      field: field.id,
      maximumCharacters: field.budget,
      ...(fieldId === 'hashtags' ? { maximumItems: MAX_HASHTAGS, minimumItems: MIN_HASHTAGS } : {}),
    },
    message: `That value does not meet the published ${field.label.toLowerCase()} limits.`,
    status: 400,
  });
}

function currentRevisionResult(
  campaigns: CampaignRepository,
  id: string,
): CampaignMutationResult<never> {
  const current = campaigns.get(id);
  return current
    ? revisionConflict(current.revision)
    : Object.freeze({ status: 'not_found' as const });
}

function revisionConflict(
  currentRevision: number,
): Readonly<{ currentRevision: number; status: 'revision_conflict' }> {
  return Object.freeze({ currentRevision, status: 'revision_conflict' as const });
}
