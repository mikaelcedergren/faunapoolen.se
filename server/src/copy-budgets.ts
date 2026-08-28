export const LIMITS_VERIFIED_ON = '2026-08-08';

/**
 * Published placement figures. Each resolved value uses the strictest placement the studio serves.
 */
const NETWORK_LIMITS = Object.freeze({
  headline: { feedNetwork: 27, visualNetwork: 27 },
  description: { feedNetwork: 18, visualNetwork: 18 },
  primaryText: { feedNetwork: 125, visualNetwork: 125 },
  fullCaption: { feedNetwork: 63_206, visualNetwork: 2_200 },
} as const);

/** Product-owned editorial limits; these are not network requirements. */
const HOUSE_LIMITS = Object.freeze({
  callToAction: 25,
  hashtag: 40,
} as const);

function strictest<const Limits extends Readonly<Record<string, Readonly<Record<string, number>>>>>(
  limits: Limits,
): { readonly [Key in keyof Limits]: number } {
  return Object.fromEntries(
    Object.entries(limits).map(([field, placements]) => [
      field,
      Math.min(...Object.values(placements)),
    ]),
  ) as { readonly [Key in keyof Limits]: number };
}

export const COPY_BUDGETS = Object.freeze({
  ...strictest(NETWORK_LIMITS),
  ...HOUSE_LIMITS,
});

export const MIN_HASHTAGS = 3;
export const MAX_HASHTAGS = 5;

export type CopyField = Readonly<{
  id: 'headline' | 'description' | 'primaryText' | 'fullCaption' | 'callToAction' | 'hashtags';
  label: string;
  budget: number;
  reason: string;
  guidance: string;
  multiline: boolean;
}>;

/** Field order is the admin rendering order. */
export const COPY_FIELDS: readonly CopyField[] = Object.freeze(
  [
    {
      id: 'headline',
      label: 'Headline',
      budget: COPY_BUDGETS.headline,
      reason: 'The shortest published headline recommendation across the feeds this runs in.',
      guidance: 'The single clearest statement of what the reader gets.',
      multiline: false,
    },
    {
      id: 'description',
      label: 'Short description',
      budget: COPY_BUDGETS.description,
      reason: 'The shortest published description slot. Most placements never show it at all.',
      guidance: 'One supporting line. It must still make sense if it is never shown.',
      multiline: false,
    },
    {
      id: 'primaryText',
      label: 'Primary text',
      budget: COPY_BUDGETS.primaryText,
      reason: 'Where the feed stops showing text and hides the rest behind “more”.',
      guidance: 'Everything that has to be understood, before anyone taps to expand.',
      multiline: true,
    },
    {
      id: 'fullCaption',
      label: 'Full caption',
      budget: COPY_BUDGETS.fullCaption,
      reason: 'The hard caption ceiling on the strictest network.',
      guidance: 'The expanded version, opening with the primary text word for word.',
      multiline: true,
    },
    {
      id: 'callToAction',
      label: 'Call to action',
      budget: COPY_BUDGETS.callToAction,
      reason:
        'A house limit, not a network one. Paid placements pick their button label from a fixed list, so this is the line you write at the end of the copy.',
      guidance: 'One specific next move. Not “learn more”.',
      multiline: false,
    },
    {
      id: 'hashtags',
      label: 'Hashtags',
      budget: COPY_BUDGETS.hashtag,
      reason: `Per tag, and ${MIN_HASHTAGS}–${MAX_HASHTAGS} tags. Both are house limits; the networks allow 30.`,
      guidance: 'Specific enough that someone searching the tag wants this exact thing.',
      multiline: false,
    },
  ].map((field) => Object.freeze(field)) as readonly CopyField[],
);

export type CopyFieldId = CopyField['id'];

export const COPY_FIELD_IDS: readonly CopyFieldId[] = Object.freeze(
  COPY_FIELDS.map((field) => field.id),
);

/** Code points, not UTF-16 units, so browser and server meters agree for emoji. */
export function copyLength(value: unknown): number {
  return typeof value === 'string' ? [...value].length : 0;
}

export function copyBudgetsPromptBlock(): string {
  return COPY_FIELDS.filter((field) => field.id !== 'hashtags')
    .map((field) => `- ${field.id}: at most ${field.budget} characters. ${field.guidance}`)
    .join('\n');
}
