// Synthetic records for the closed legacy campaign-directory import contract.
//
// These values describe only states reachable through the committed legacy writers in
// server/admin-ad-builder.mjs and server/campaign-store.mjs. They contain no operational data.

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
]);

export const STRATEGY_FIELDS = Object.freeze([
  'name',
  'audience',
  'desiredOutcome',
  'singleMessage',
  'externalProblem',
  'internalProblem',
  'plan',
  'assumptions',
  'rationale',
]);

export const COPY_FIELDS = Object.freeze([
  'headline',
  'description',
  'primaryText',
  'fullCaption',
  'callToAction',
  'hashtags',
  'variations',
  'rationale',
]);

export const COPY_FIELD_IDS = Object.freeze([
  'headline',
  'description',
  'primaryText',
  'fullCaption',
  'callToAction',
  'hashtags',
]);

export const IMAGE_PROMPT_FIELDS = Object.freeze([
  'concept',
  'label',
  'prompt',
  'altText',
  'ruleIds',
  'why',
]);

export const CAMPAIGN_STAGES = Object.freeze(['strategy', 'copy', 'complete']);
export const IMAGE_CONCEPTS = Object.freeze([
  Object.freeze({ id: 'photograph', label: 'Straight photograph', maxPromptCharacters: 3_095 }),
  Object.freeze({
    id: 'composite',
    label: 'Photograph with a graphic element',
    maxPromptCharacters: 3_623,
  }),
  Object.freeze({ id: 'detail', label: 'Material detail', maxPromptCharacters: 3_109 }),
]);

export const MARKETING_RULE_IDS = Object.freeze([
  'hero-is-customer',
  'outcome-first',
  'one-promise',
  'clarity-over-cleverness',
  'empathy-before-authority',
  'three-step-plan',
  'cost-of-inaction',
  'concrete-success',
  'front-load-the-hook',
  'strictest-common-limit',
  'native-not-translated',
  'earn-the-hashtag',
  'photo-not-poster',
  'brand-colour-in-scene',
]);

export const WRITER_LIMITS = Object.freeze({
  ideaCodeUnits: 3_000,
  storedCopyCharacters: 4_000,
  storedHashtags: 30,
  storedHashtagCharacters: 100,
  strategy: Object.freeze({
    name: 72,
    audience: 180,
    desiredOutcome: 200,
    singleMessage: 220,
    problem: 240,
    planStep: 110,
    assumption: 220,
    why: 320,
  }),
  generatedCopy: Object.freeze({
    headline: 27,
    description: 18,
    primaryText: 125,
    fullCaption: 2_200,
    callToAction: 25,
    hashtag: 40,
    guidance: 110,
  }),
  image: Object.freeze({ altText: 240, why: 320 }),
});

const RULES = Object.freeze([
  'clarity-over-cleverness',
  'strictest-common-limit',
  'brand-colour-in-scene',
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

export function cloneRecord(record) {
  return structuredClone(record);
}

export function campaignId(index) {
  if (!Number.isSafeInteger(index) || index < 1 || index > 0xffffffffffff) {
    throw new TypeError('campaign fixture index must fit the UUID tail.');
  }
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
}

export function writerBytes(record) {
  return Buffer.from(JSON.stringify(record, undefined, 2), 'utf8');
}

export function validStrategy(name = 'A garden that holds water naturally') {
  return {
    name,
    audience: 'Homeowners who want a calm water feature that belongs in a Swedish garden.',
    desiredOutcome: 'A considered water environment that feels native to the place.',
    singleMessage: 'Begin with the garden and let the right water solution follow from it.',
    externalProblem: 'They do not know which kind of water environment suits the site.',
    internalProblem: 'They worry that the wrong first decision will make the project feel forced.',
    plan: [
      'Describe the garden',
      'Review what the place supports',
      'Choose one practical first step',
    ],
    assumptions: ['The campaign invites a consultation rather than promising a finished design.'],
    rationale: [
      {
        topic: 'audience',
        ruleIds: ['hero-is-customer'],
        why: 'It identifies one recognisable owner and keeps Faunapoolen in the guide role.',
      },
      {
        topic: 'desiredOutcome',
        ruleIds: ['outcome-first'],
        why: 'It starts with the changed garden rather than a list of products.',
      },
      {
        topic: 'plan',
        ruleIds: ['three-step-plan'],
        why: 'Three concrete steps make the first conversation feel manageable.',
      },
    ],
  };
}

export function validCopy(language = 'en') {
  const swedish = language === 'sv';
  const primaryText = swedish
    ? 'Låt platsen visa vilken vattenmiljö som hör hemma där.'
    : 'Let the place show which water environment belongs there.';
  return {
    headline: swedish ? 'Vatten som hör hemma' : 'Water that belongs',
    description: swedish ? 'Börja med platsen' : 'Start with site',
    primaryText,
    fullCaption: `${primaryText} We begin with the garden, its materials and the outcome you want.`,
    callToAction: swedish ? 'Boka ett första samtal' : 'Book a conversation',
    hashtags: swedish
      ? ['#vattenmiljö', '#svenskträdgård', '#faunapoolen']
      : ['#watergarden', '#swedishgarden', '#faunapoolen'],
    variations: {
      headline: swedish
        ? ['Börja med trädgården', 'Rätt vatten på rätt plats', 'En lugnare vattenmiljö']
        : ['Begin with the garden', 'Right water for the site', 'A calmer water garden'],
      primaryText: swedish
        ? [
            'Utgå från trädgården innan du väljer lösning.',
            'Vattenmiljön blir bättre när platsen får styra.',
            'Ta reda på vad platsen klarar som första steg.',
          ]
        : [
            'Start with the garden before choosing the solution.',
            'A water environment works better when the place leads.',
            'Make the first step finding out what the site supports.',
          ],
    },
    rationale: COPY_FIELD_IDS.map((field) => ({
      field,
      ruleIds: ['clarity-over-cleverness'],
      guidance: `Keep the ${field} clear after an owner edit.`,
    })),
  };
}

export function ownerEditedCopy(language = 'en') {
  const copy = validCopy(language);
  copy.headline =
    'An intentionally owner-edited headline that exceeds the generated headline budget';
  copy.primaryText = 'Owner wording may knowingly exceed the generated placement advice.';
  copy.fullCaption = 'This owner-edited caption no longer has to begin with primary text.';
  copy.hashtags = Array.from({ length: 30 }, (_, index) => `#owner-edit-${index + 1}`);
  return copy;
}

export function validImagePrompts() {
  return IMAGE_CONCEPTS.map((concept) => ({
    concept: concept.id,
    label: concept.label,
    prompt: `A synthetic ${concept.id} prompt for a credible Swedish water garden.`,
    altText: `A synthetic ${concept.id} view of a Swedish water garden.`,
    ruleIds: ['photo-not-poster', 'brand-colour-in-scene'],
    why: 'The picture carries the outcome through a believable place rather than a poster.',
  }));
}

export function campaignRecord({
  copy = {},
  createdAt = '2026-08-01T09:10:11.123Z',
  id = campaignId(1),
  imagePrompts = [],
  idea = 'A calm water garden that begins with the existing place.',
  stage = 'strategy',
  updatedAt = createdAt,
} = {}) {
  const strategy = validStrategy();
  return {
    id,
    createdAt,
    updatedAt,
    idea,
    name: strategy.name,
    stage,
    strategy,
    copy,
    imagePrompts,
  };
}

export const REACHABLE_CAMPAIGNS = deepFreeze([
  campaignRecord({ id: campaignId(1) }),
  campaignRecord({
    id: campaignId(2),
    stage: 'copy',
    copy: { sv: validCopy('sv') },
    updatedAt: '2026-08-01T09:11:00.000Z',
  }),
  campaignRecord({
    id: campaignId(3),
    stage: 'copy',
    copy: { en: validCopy('en') },
    updatedAt: '2026-08-01T09:12:00.000Z',
  }),
  campaignRecord({
    id: campaignId(4),
    stage: 'copy',
    copy: { sv: ownerEditedCopy('sv'), en: validCopy('en') },
    updatedAt: '2026-08-01T09:13:00.000Z',
  }),
  campaignRecord({
    id: campaignId(5),
    stage: 'complete',
    imagePrompts: validImagePrompts(),
    updatedAt: '2026-08-01T09:14:00.000Z',
  }),
  campaignRecord({
    id: campaignId(6),
    stage: 'complete',
    copy: { en: validCopy('en') },
    imagePrompts: validImagePrompts(),
    updatedAt: '2026-08-01T09:15:00.000Z',
  }),
  campaignRecord({
    id: campaignId(7),
    stage: 'complete',
    copy: { sv: validCopy('sv'), en: validCopy('en') },
    imagePrompts: validImagePrompts(),
    updatedAt: '2026-08-01T09:16:00.000Z',
  }),
  // A copy retry is legal after prompts. The writer sets stage back to copy but keeps prompts.
  campaignRecord({
    id: campaignId(8),
    stage: 'copy',
    copy: { sv: validCopy('sv') },
    imagePrompts: validImagePrompts(),
    updatedAt: '2026-08-01T09:17:00.000Z',
  }),
]);

function maximalStrategy() {
  const limits = WRITER_LIMITS.strategy;
  return {
    name: '\0'.repeat(limits.name),
    audience: '\0'.repeat(limits.audience),
    desiredOutcome: '\0'.repeat(limits.desiredOutcome),
    singleMessage: '\0'.repeat(limits.singleMessage),
    externalProblem: '\0'.repeat(limits.problem),
    internalProblem: '\0'.repeat(limits.problem),
    plan: Array.from({ length: 3 }, () => '\0'.repeat(limits.planStep)),
    assumptions: Array.from({ length: 3 }, () => '\0'.repeat(limits.assumption)),
    rationale: ['audience', 'desiredOutcome', 'singleMessage'].map((topic) => ({
      topic,
      ruleIds: [...RULES],
      why: '\0'.repeat(limits.why),
    })),
  };
}

function maximalCopy() {
  const generated = WRITER_LIMITS.generatedCopy;
  return {
    headline: '\0'.repeat(WRITER_LIMITS.storedCopyCharacters),
    description: '\0'.repeat(WRITER_LIMITS.storedCopyCharacters),
    primaryText: '\0'.repeat(WRITER_LIMITS.storedCopyCharacters),
    fullCaption: '\0'.repeat(WRITER_LIMITS.storedCopyCharacters),
    callToAction: '\0'.repeat(WRITER_LIMITS.storedCopyCharacters),
    hashtags: Array.from({ length: WRITER_LIMITS.storedHashtags }, () =>
      '\0'.repeat(WRITER_LIMITS.storedHashtagCharacters),
    ),
    variations: {
      headline: Array.from({ length: 3 }, () => '\0'.repeat(generated.headline)),
      primaryText: Array.from({ length: 3 }, () => '\0'.repeat(generated.primaryText)),
    },
    rationale: COPY_FIELD_IDS.map((field) => ({
      field,
      ruleIds: [...RULES],
      guidance: '\0'.repeat(generated.guidance),
    })),
  };
}

export function maximalCampaignRecord(id = campaignId(200)) {
  const strategy = maximalStrategy();
  return {
    id,
    createdAt: '2026-08-01T09:10:11.123Z',
    updatedAt: '2026-08-01T09:10:11.123Z',
    idea: '\0'.repeat(WRITER_LIMITS.ideaCodeUnits),
    name: strategy.name,
    stage: 'copy',
    strategy,
    copy: { sv: maximalCopy(), en: maximalCopy() },
    imagePrompts: IMAGE_CONCEPTS.map((concept) => ({
      concept: concept.id,
      label: concept.label,
      // Filling the complete derived prompt ceiling with the most expensive JSON escape is a
      // conservative superset of every prompt composeImagePrompt could persist.
      prompt: '\0'.repeat(concept.maxPromptCharacters),
      altText: '\0'.repeat(WRITER_LIMITS.image.altText),
      ruleIds: [...RULES],
      why: '\0'.repeat(WRITER_LIMITS.image.why),
    })),
  };
}

export const PERMISSIVE_READER_ONLY_CASES = deepFreeze([
  {
    name: 'minimal object accepted by the old id-only reader',
    fileName: `${campaignId(20)}.json`,
    record: { id: campaignId(20) },
  },
  {
    name: 'filename and content id disagree',
    fileName: `${campaignId(21)}.json`,
    record: campaignRecord({ id: campaignId(22) }),
  },
  {
    name: 'unknown root field survives the permissive reader',
    fileName: `${campaignId(23)}.json`,
    record: { ...campaignRecord({ id: campaignId(23) }), legacyExtra: true },
  },
  {
    name: 'unreachable stage and partial shape survive the permissive reader',
    fileName: `${campaignId(24)}.json`,
    record: { ...campaignRecord({ id: campaignId(24) }), stage: 'writing' },
  },
]);
