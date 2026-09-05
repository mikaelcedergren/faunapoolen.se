import { createHash } from 'node:crypto';

import type { CopyRefinementReceipt } from './copy-refinement.js';
import { COPY_FIELD_IDS, type CopyFieldId } from './copy-budgets.js';
import { IMAGE_CONCEPTS, IMAGE_CONCEPT_IDS, type ImageConceptId } from './image-style.js';
import { isMarketingRuleId } from './marketing-rules.js';

export const CAMPAIGN_MAX_RECORDS = 200;

export const CAMPAIGN_ROOT_FIELDS = Object.freeze([
  'id',
  'createdAt',
  'updatedAt',
  'idea',
  'name',
  'stage',
  'strategy',
  'copy',
  'imagePrompts',
] as const);

export const CAMPAIGN_STAGES = Object.freeze(['strategy', 'copy', 'complete'] as const);
export const CAMPAIGN_LANGUAGES = Object.freeze(['en', 'sv'] as const);

const CAMPAIGN_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const CANONICAL_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

const STRATEGY_FIELDS = Object.freeze([
  'name',
  'audience',
  'desiredOutcome',
  'singleMessage',
  'externalProblem',
  'internalProblem',
  'plan',
  'assumptions',
  'rationale',
] as const);
const STRATEGY_TOPICS = Object.freeze([
  'audience',
  'desiredOutcome',
  'singleMessage',
  'problem',
  'plan',
] as const);
const STRATEGY_RATIONALE_FIELDS = Object.freeze(['topic', 'ruleIds', 'why'] as const);

const COPY_OBJECT_FIELDS = Object.freeze([
  'headline',
  'description',
  'primaryText',
  'fullCaption',
  'callToAction',
  'hashtags',
  'variations',
  'rationale',
] as const);
const COPY_VARIATION_FIELDS = Object.freeze(['headline', 'primaryText'] as const);
const COPY_RATIONALE_FIELDS = Object.freeze(['field', 'ruleIds', 'guidance'] as const);

const IMAGE_PROMPT_FIELDS = Object.freeze([
  'concept',
  'label',
  'prompt',
  'altText',
  'ruleIds',
  'why',
] as const);
const IMAGE_PROMPT_MAXIMUM_CHARACTERS: Readonly<Record<ImageConceptId, number>> = Object.freeze({
  photograph: 3_095,
  composite: 3_623,
  detail: 3_109,
});

type CampaignStage = (typeof CAMPAIGN_STAGES)[number];
export type CampaignLanguage = (typeof CAMPAIGN_LANGUAGES)[number];
type StrategyTopic = (typeof STRATEGY_TOPICS)[number];

export interface CampaignStrategyRationale {
  readonly topic: StrategyTopic;
  readonly ruleIds: readonly string[];
  readonly why: string;
}

export interface CampaignStrategy {
  readonly name: string;
  readonly audience: string;
  readonly desiredOutcome: string;
  readonly singleMessage: string;
  readonly externalProblem: string;
  readonly internalProblem: string;
  readonly plan: readonly [string, string, string];
  readonly assumptions: readonly string[];
  readonly rationale: readonly CampaignStrategyRationale[];
}

export interface CampaignCopyRationale {
  readonly field: CopyFieldId;
  readonly ruleIds: readonly string[];
  readonly guidance: string;
}

export interface CampaignCopy {
  readonly headline: string;
  readonly description: string;
  readonly primaryText: string;
  readonly fullCaption: string;
  readonly callToAction: string;
  readonly hashtags: readonly string[];
  readonly variations: Readonly<{
    headline: readonly [string, string, string];
    primaryText: readonly [string, string, string];
  }>;
  readonly rationale: readonly CampaignCopyRationale[];
}

export interface CampaignImagePrompt {
  readonly concept: ImageConceptId;
  readonly label: string;
  readonly prompt: string;
  readonly altText: string;
  readonly ruleIds: readonly string[];
  readonly why: string;
}

export interface CampaignRecord {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly idea: string;
  readonly name: string;
  readonly stage: CampaignStage;
  readonly strategy: CampaignStrategy;
  readonly copy: Readonly<Partial<Record<CampaignLanguage, CampaignCopy>>>;
  readonly imagePrompts: readonly CampaignImagePrompt[];
  readonly refinement?: CopyRefinementReceipt;
}

export interface CanonicalCampaign {
  readonly bytes: Buffer;
  readonly record: CampaignRecord;
  readonly sha256: string;
}

export class CampaignValidationError extends Error {
  readonly field: string;

  constructor(field: string, message: string, options: ErrorOptions = {}) {
    super(message, options);
    this.name = 'CampaignValidationError';
    this.field = field;
  }
}

export class CampaignJsonSyntaxError extends Error {
  readonly duplicateField: string | undefined;

  constructor(message: string, duplicateField?: string, options: ErrorOptions = {}) {
    super(message, options);
    this.name = 'CampaignJsonSyntaxError';
    this.duplicateField = duplicateField;
  }
}

export function isCampaignId(value: unknown): value is string {
  return typeof value === 'string' && CAMPAIGN_ID_PATTERN.test(value);
}

export function normalizeCampaignIdea(value: string): string {
  return value
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .map((line) => line.replace(/[\t ]+/gu, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

export function parseCampaignJson(source: string): CampaignRecord {
  let value: unknown;
  try {
    value = new DuplicateSafeJsonParser(source).parse();
  } catch (error) {
    if (error instanceof CampaignJsonSyntaxError) throw error;
    throw new CampaignJsonSyntaxError('Campaign JSON is malformed.', undefined, { cause: error });
  }
  return validateCampaignRecord(value);
}

export function parseCampaignBytes(bytes: Uint8Array): CampaignRecord {
  let source: string;
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    throw new CampaignJsonSyntaxError('Campaign bytes are not valid UTF-8.', undefined, {
      cause: error,
    });
  }
  return parseCampaignJson(source);
}

export function validateCampaignRecord(value: unknown): CampaignRecord {
  const hasRefinement =
    value !== null && typeof value === 'object' && Object.hasOwn(value, 'refinement');
  const root = exactObject(
    value,
    [...CAMPAIGN_ROOT_FIELDS, ...(hasRefinement ? ['refinement'] : [])],
    '',
  );
  const id = campaignId(root.id, 'id');
  const createdAt = timestamp(root.createdAt, 'createdAt');
  const updatedAt = timestamp(root.updatedAt, 'updatedAt');
  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    invalid('updatedAt', 'Campaign updatedAt cannot precede createdAt.');
  }
  const idea = text(root.idea, 8, 3_000, 'idea');
  if (normalizeCampaignIdea(idea) !== idea) {
    invalid('idea', 'Campaign idea is not in the writer-normalized form.');
  }
  const strategy = strategyValue(root.strategy);
  const name = text(root.name, 1, 72, 'name');
  if (name !== strategy.name) {
    invalid('name', 'Campaign name must exactly match strategy.name.');
  }
  const stage = enumValue(root.stage, CAMPAIGN_STAGES, 'stage');
  const copy = copyValue(root.copy);
  const imagePrompts = imagePromptValue(root.imagePrompts);
  if (stage === 'complete' && imagePrompts.length === 0) {
    invalid('imagePrompts', 'Complete campaigns require all three image prompts.');
  }
  assertReachableState(stage, copy, imagePrompts);
  return {
    id,
    createdAt,
    updatedAt,
    idea,
    name,
    stage,
    strategy,
    copy,
    imagePrompts,
    ...(hasRefinement ? { refinement: refinementReceipt(root.refinement) } : {}),
  };
}

function refinementReceipt(value: unknown): CopyRefinementReceipt {
  const receipt = exactObject(value, ['runId', 'language', 'summary'], 'refinement');
  return {
    runId: campaignId(receipt.runId, 'refinement.runId'),
    language: enumValue(receipt.language, CAMPAIGN_LANGUAGES, 'refinement.language'),
    summary: text(receipt.summary, 1, 700, 'refinement.summary'),
  };
}

export function canonicalCampaignBytes(record: CampaignRecord): Buffer {
  const valid = validateCampaignRecord(record);
  return Buffer.from(canonicalJson(valid), 'utf8');
}

export function canonicalCampaign(record: CampaignRecord): CanonicalCampaign {
  const valid = validateCampaignRecord(record);
  const bytes = Buffer.from(canonicalJson(valid), 'utf8');
  return Object.freeze({ bytes, record: valid, sha256: sha256Hex(bytes) });
}

export function sha256Hex(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function strategyValue(value: unknown): CampaignStrategy {
  const object = exactObject(value, STRATEGY_FIELDS, 'strategy');
  const rationaleValue = array(object.rationale, 'strategy.rationale');
  if (rationaleValue.length !== 3) {
    invalid('strategy.rationale', 'Campaign strategy requires exactly three rationale entries.');
  }
  const seenTopics = new Set<string>();
  const rationale = rationaleValue.map((entry, index): CampaignStrategyRationale => {
    const field = `strategy.rationale[${String(index)}]`;
    const rationaleObject = exactObject(entry, STRATEGY_RATIONALE_FIELDS, field);
    const topic = enumValue(rationaleObject.topic, STRATEGY_TOPICS, `${field}.topic`);
    if (seenTopics.has(topic))
      invalid(`${field}.topic`, 'Strategy rationale topics must be unique.');
    seenTopics.add(topic);
    return {
      topic,
      ruleIds: ruleIds(rationaleObject.ruleIds, `${field}.ruleIds`),
      why: text(rationaleObject.why, 1, 320, `${field}.why`),
    };
  });
  const plan = fixedTextTuple(object.plan, 3, 110, 'strategy.plan');
  const assumptions = array(object.assumptions, 'strategy.assumptions');
  if (assumptions.length > 3) {
    invalid('strategy.assumptions', 'Campaign strategy accepts at most three assumptions.');
  }
  return {
    name: text(object.name, 1, 72, 'strategy.name'),
    audience: text(object.audience, 1, 180, 'strategy.audience'),
    desiredOutcome: text(object.desiredOutcome, 1, 200, 'strategy.desiredOutcome'),
    singleMessage: text(object.singleMessage, 1, 220, 'strategy.singleMessage'),
    externalProblem: text(object.externalProblem, 1, 240, 'strategy.externalProblem'),
    internalProblem: text(object.internalProblem, 1, 240, 'strategy.internalProblem'),
    plan,
    assumptions: assumptions.map((entry, index) =>
      text(entry, 1, 220, `strategy.assumptions[${String(index)}]`),
    ),
    rationale,
  };
}

function copyValue(value: unknown): Readonly<Partial<Record<CampaignLanguage, CampaignCopy>>> {
  const object = plainObject(value, 'copy');
  for (const key of Object.keys(object)) {
    if (!CAMPAIGN_LANGUAGES.includes(key as CampaignLanguage)) {
      invalid(`copy.${key}`, 'Campaign copy contains an unknown language.');
    }
  }
  const result: Partial<Record<CampaignLanguage, CampaignCopy>> = {};
  for (const language of CAMPAIGN_LANGUAGES) {
    const copy = object[language];
    if (copy !== undefined) result[language] = campaignCopy(copy, language);
  }
  return result;
}

function campaignCopy(value: unknown, language: CampaignLanguage): CampaignCopy {
  const field = `copy.${language}`;
  const object = exactObject(value, COPY_OBJECT_FIELDS, field);
  const hashtags = array(object.hashtags, `${field}.hashtags`);
  if (hashtags.length > 30)
    invalid(`${field}.hashtags`, 'Stored copy accepts at most 30 hashtags.');
  const variations = exactObject(object.variations, COPY_VARIATION_FIELDS, `${field}.variations`);
  const rationaleValue = array(object.rationale, `${field}.rationale`);
  if (rationaleValue.length !== COPY_FIELD_IDS.length) {
    invalid(`${field}.rationale`, 'Stored copy requires one rationale for every copy field.');
  }
  const seenFields = new Set<string>();
  const rationale = rationaleValue.map((entry, index): CampaignCopyRationale => {
    const rationaleField = `${field}.rationale[${String(index)}]`;
    const rationaleObject = exactObject(entry, COPY_RATIONALE_FIELDS, rationaleField);
    const copyField = enumValue(rationaleObject.field, COPY_FIELD_IDS, `${rationaleField}.field`);
    if (seenFields.has(copyField)) {
      invalid(`${rationaleField}.field`, 'Copy rationale fields must be unique.');
    }
    seenFields.add(copyField);
    return {
      field: copyField,
      ruleIds: ruleIds(rationaleObject.ruleIds, `${rationaleField}.ruleIds`),
      guidance: text(rationaleObject.guidance, 1, 110, `${rationaleField}.guidance`),
    };
  });
  return {
    headline: text(object.headline, 1, 4_000, `${field}.headline`),
    description: text(object.description, 1, 4_000, `${field}.description`),
    primaryText: text(object.primaryText, 1, 4_000, `${field}.primaryText`),
    fullCaption: text(object.fullCaption, 1, 4_000, `${field}.fullCaption`),
    callToAction: text(object.callToAction, 1, 4_000, `${field}.callToAction`),
    hashtags: hashtags.map((entry, index) =>
      text(entry, 1, 100, `${field}.hashtags[${String(index)}]`),
    ),
    variations: {
      headline: fixedTextTuple(variations.headline, 3, 27, `${field}.variations.headline`),
      primaryText: fixedTextTuple(
        variations.primaryText,
        3,
        125,
        `${field}.variations.primaryText`,
      ),
    },
    rationale,
  };
}

function imagePromptValue(value: unknown): readonly CampaignImagePrompt[] {
  const prompts = array(value, 'imagePrompts');
  if (prompts.length !== 0 && prompts.length !== IMAGE_CONCEPT_IDS.length) {
    invalid('imagePrompts', 'Campaign image prompts must be empty or contain all three concepts.');
  }
  return prompts.map((entry, index): CampaignImagePrompt => {
    const field = `imagePrompts[${String(index)}]`;
    const object = exactObject(entry, IMAGE_PROMPT_FIELDS, field);
    const concept = IMAGE_CONCEPTS[index];
    if (!concept || object.concept !== concept.id) {
      invalid('imagePrompts', 'Campaign image prompt concepts must use writer order.');
    }
    if (object.label !== concept.label) {
      invalid(`${field}.label`, 'Campaign image prompt label does not match its concept.');
    }
    return {
      concept: concept.id,
      label: concept.label,
      prompt: text(
        object.prompt,
        1,
        IMAGE_PROMPT_MAXIMUM_CHARACTERS[concept.id],
        `${field}.prompt`,
      ),
      altText: text(object.altText, 1, 240, `${field}.altText`),
      ruleIds: ruleIds(object.ruleIds, `${field}.ruleIds`),
      why: text(object.why, 1, 320, `${field}.why`),
    };
  });
}

function assertReachableState(
  stage: CampaignStage,
  copy: Readonly<Partial<Record<CampaignLanguage, CampaignCopy>>>,
  prompts: readonly CampaignImagePrompt[],
): void {
  const copyCount = CAMPAIGN_LANGUAGES.filter((language) => copy[language] !== undefined).length;
  if (stage === 'strategy' && (copyCount !== 0 || prompts.length !== 0)) {
    invalid('stage', 'Strategy-stage campaigns cannot contain copy or prompts.');
  }
  if (stage === 'copy' && copyCount === 0) {
    invalid('stage', 'Copy-stage campaigns require at least one completed language.');
  }
  if (stage === 'copy' && prompts.length !== 0 && prompts.length !== 3) {
    invalid('stage', 'Copy retries can retain only the complete prompt set.');
  }
  if (stage === 'complete' && prompts.length !== 3) {
    invalid('stage', 'Complete campaigns require all three image prompts.');
  }
}

function campaignId(value: unknown, field: string): string {
  if (!isCampaignId(value)) invalid(field, 'Campaign id is not a lowercase RFC 4122 UUID.');
  return value;
}

function timestamp(value: unknown, field: string): string {
  if (
    typeof value !== 'string' ||
    !CANONICAL_TIMESTAMP_PATTERN.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    invalid(field, 'Campaign timestamp must be canonical UTC ISO-8601 with milliseconds.');
  }
  return value;
}

function ruleIds(value: unknown, field: string): readonly string[] {
  const values = array(value, field);
  if (values.length < 1 || values.length > 3) {
    invalid(field, 'Campaign rationale requires between one and three rule ids.');
  }
  const result = values.map((entry, index) => {
    if (!isMarketingRuleId(entry)) {
      invalid(field, `Campaign rationale contains an unknown rule id at index ${String(index)}.`);
    }
    return entry;
  });
  if (new Set(result).size !== result.length) {
    invalid(field, 'Campaign rationale rule ids must be unique.');
  }
  return result;
}

function fixedTextTuple(
  value: unknown,
  length: 3,
  maximum: number,
  field: string,
): readonly [string, string, string] {
  const values = array(value, field);
  if (values.length !== length) invalid(field, `${field} requires exactly three entries.`);
  return [
    text(values[0], 1, maximum, `${field}[0]`),
    text(values[1], 1, maximum, `${field}[1]`),
    text(values[2], 1, maximum, `${field}[2]`),
  ];
}

function text(
  value: unknown,
  minimum: number,
  maximum: number,
  field: string,
  unit: 'code-points' | 'code-units' = 'code-points',
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    invalid(field, `${field} must be non-empty text.`);
  }
  const length = unit === 'code-units' ? value.length : [...value].length;
  if (length < minimum || length > maximum) {
    invalid(
      field,
      `${field} must contain between ${String(minimum)} and ${String(maximum)} ${unit}.`,
    );
  }
  return value;
}

function exactObject<const Fields extends readonly string[]>(
  value: unknown,
  fields: Fields,
  field: string,
): Record<Fields[number], unknown> {
  const label = field || 'campaign';
  const object = plainObject(value, label);
  const actual = Object.keys(object).toSorted();
  const expected = [...fields].toSorted();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    const unexpected = actual.find((key) => !expected.includes(key));
    const missing = expected.find((key) => !actual.includes(key));
    const child = unexpected ?? String(missing);
    invalid(field ? `${field}.${child}` : child, `${label} fields do not match the writer schema.`);
  }
  return object as Record<Fields[number], unknown>;
}

function plainObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    invalid(field, `${field} must be a JSON object.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    invalid(field, `${field} must be a plain JSON object.`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value)) invalid(field, `${field} must be a JSON array.`);
  return value;
}

function enumValue<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  field: string,
): Values[number] {
  if (typeof value !== 'string' || !values.includes(value)) {
    invalid(field, `${field} is outside the writer contract.`);
  }
  return value as Values[number];
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Campaign JSON forbids non-finite numbers.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const object = plainObject(value, 'campaign');
  return `{${Object.keys(object)
    .toSorted()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(',')}}`;
}

function invalid(field: string, message: string): never {
  throw new CampaignValidationError(field, message);
}

class DuplicateSafeJsonParser {
  private index = 0;

  constructor(private readonly source: string) {}

  parse(): unknown {
    this.skipWhitespace();
    const value = this.value();
    this.skipWhitespace();
    if (this.index !== this.source.length) this.syntax('Campaign JSON has trailing content.');
    return value;
  }

  private value(): unknown {
    const character = this.source[this.index];
    if (character === '{') return this.object();
    if (character === '[') return this.arrayValue();
    if (character === '"') return this.string();
    if (character === 't') return this.literal('true', true);
    if (character === 'f') return this.literal('false', false);
    if (character === 'n') return this.literal('null', null);
    if (character === '-' || (character !== undefined && /[0-9]/u.test(character))) {
      return this.number();
    }
    return this.syntax('Campaign JSON contains an invalid value.');
  }

  private object(): Record<string, unknown> {
    this.index += 1;
    this.skipWhitespace();
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    const keys = new Set<string>();
    if (this.consume('}')) return result;
    while (true) {
      if (this.source[this.index] !== '"') this.syntax('Campaign JSON object key is invalid.');
      const key = this.string();
      if (keys.has(key)) {
        throw new CampaignJsonSyntaxError(`Campaign JSON contains duplicate key ${key}.`, key);
      }
      keys.add(key);
      this.skipWhitespace();
      if (!this.consume(':')) this.syntax('Campaign JSON object is missing a colon.');
      this.skipWhitespace();
      Object.defineProperty(result, key, {
        configurable: true,
        enumerable: true,
        value: this.value(),
        writable: true,
      });
      this.skipWhitespace();
      if (this.consume('}')) return result;
      if (!this.consume(',')) this.syntax('Campaign JSON object is missing a comma.');
      this.skipWhitespace();
    }
  }

  private arrayValue(): unknown[] {
    this.index += 1;
    this.skipWhitespace();
    const result: unknown[] = [];
    if (this.consume(']')) return result;
    while (true) {
      result.push(this.value());
      this.skipWhitespace();
      if (this.consume(']')) return result;
      if (!this.consume(',')) this.syntax('Campaign JSON array is missing a comma.');
      this.skipWhitespace();
    }
  }

  private string(): string {
    const start = this.index;
    this.index += 1;
    while (this.index < this.source.length) {
      const code = this.source.charCodeAt(this.index);
      if (code === 0x22) {
        this.index += 1;
        try {
          return JSON.parse(this.source.slice(start, this.index)) as string;
        } catch (error) {
          return this.syntax('Campaign JSON string is malformed.', error);
        }
      }
      if (code < 0x20) this.syntax('Campaign JSON string contains a control character.');
      if (code === 0x5c) {
        this.index += 1;
        const escape = this.source[this.index];
        if (escape === 'u') {
          const digits = this.source.slice(this.index + 1, this.index + 5);
          if (!/^[0-9a-fA-F]{4}$/u.test(digits)) {
            this.syntax('Campaign JSON string contains an invalid Unicode escape.');
          }
          this.index += 5;
          continue;
        }
        if (escape === undefined || !'"\\/bfnrt'.includes(escape)) {
          this.syntax('Campaign JSON string contains an invalid escape.');
        }
      }
      this.index += 1;
    }
    return this.syntax('Campaign JSON string is unterminated.');
  }

  private number(): number {
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u.exec(
      this.source.slice(this.index),
    );
    if (!match) return this.syntax('Campaign JSON number is malformed.');
    this.index += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) return this.syntax('Campaign JSON number is not finite.');
    return value;
  }

  private literal<Value>(source: string, value: Value): Value {
    if (!this.source.startsWith(source, this.index)) {
      return this.syntax('Campaign JSON literal is malformed.');
    }
    this.index += source.length;
    return value;
  }

  private consume(character: string): boolean {
    if (this.source[this.index] !== character) return false;
    this.index += 1;
    return true;
  }

  private skipWhitespace(): void {
    while (/^[\u0009\u000a\u000d\u0020]$/u.test(this.source[this.index] ?? '')) {
      this.index += 1;
    }
  }

  private syntax(message: string, cause?: unknown): never {
    throw new CampaignJsonSyntaxError(
      `${message} (offset ${String(this.index)})`,
      undefined,
      cause === undefined ? {} : { cause },
    );
  }
}
