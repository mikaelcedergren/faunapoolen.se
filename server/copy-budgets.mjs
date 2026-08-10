// One character budget per copy field, resolved as the strictest limit across every placement the
// campaign will run in.
//
// The network names below exist so the numbers stay auditable when a network changes its rules.
// They never leave this file: the API exposes only the resolved budget and a neutral `reason`, and
// no admin screen ever names a network. A campaign written to the strictest limit is never
// truncated anywhere, which is the whole point.
//
// VERIFIED 2026-08-08 against the sources noted per row. Two things are worth knowing before
// changing these:
//
//   1. Meta publishes *recommendations per placement*, not hard maximums, and they differ by
//      format — a feed image ad and a carousel do not share a headline recommendation. Each row
//      below therefore records the strictest published figure across the formats this studio
//      writes for, which is the rule the product promises.
//   2. Only the four rows in NETWORK_LIMITS come from a published network figure. Everything in
//      HOUSE_LIMITS is our own editorial choice and must never be described to the user as a
//      network requirement.
export const LIMITS_VERIFIED_ON = '2026-08-08';

const NETWORK_LIMITS = Object.freeze({
  // Meta Ads Guide, feed image ad: 27. Carousel is looser (45), so the image ad governs.
  headline: { feedNetwork: 27, visualNetwork: 27 },
  // Meta Ads Guide, carousel link description: 18. Feed image ads do not publish one, and most
  // placements never render a description at all.
  description: { feedNetwork: 18, visualNetwork: 18 },
  // The point where the feed collapses the caption behind "more". Documented for the visual
  // network at 125; the feed network's published range is 50–150, so 125 is the safe floor.
  primaryText: { feedNetwork: 125, visualNetwork: 125 },
  // Hard caption ceilings. The visual network's 2 200 is a real maximum, not a recommendation.
  fullCaption: { feedNetwork: 63_206, visualNetwork: 2_200 },
});

// Our own editorial limits. The networks impose nothing here — ad placements choose their action
// button from a fixed list rather than free text, and a hashtag has no published length cap.
const HOUSE_LIMITS = Object.freeze({
  callToAction: 25,
  hashtag: 40,
});

function strictest(limits) {
  return Object.fromEntries(
    Object.entries(limits).map(([field, networks]) => [
      field,
      Math.min(...Object.values(networks)),
    ]),
  );
}

export const COPY_BUDGETS = Object.freeze({
  ...strictest(NETWORK_LIMITS),
  ...HOUSE_LIMITS,
});

// A quality ceiling, not a network limit — the networks allow 30 tags, but a wall of them reads as
// spam. See the `earn-the-hashtag` rule.
export const MIN_HASHTAGS = 3;
export const MAX_HASHTAGS = 5;

// Field order here is the order the admin screen renders them in.
export const COPY_FIELDS = Object.freeze(
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
  ].map(Object.freeze),
);

export const COPY_FIELD_IDS = Object.freeze(COPY_FIELDS.map((field) => field.id));

// Code points, not UTF-16 units, so an emoji costs one character everywhere: in this validation,
// in the schema the model writes against, and in the meter the admin sees.
export function copyLength(value) {
  return typeof value === 'string' ? [...value].length : 0;
}

// The budget block the model writes against, composed from the same table.
export function copyBudgetsPromptBlock() {
  return COPY_FIELDS.filter((field) => field.id !== 'hashtags')
    .map((field) => `- ${field.id}: at most ${field.budget} characters. ${field.guidance}`)
    .join('\n');
}
