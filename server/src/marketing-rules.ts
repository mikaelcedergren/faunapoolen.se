export type MarketingRule = Readonly<{
  id: string;
  name: string;
  teaches: string;
}>;

/**
 * The single registry used by generation prompts, output validation, and the admin teaching UI.
 * `teaches` is product-authored; generated content never rewrites these lessons.
 */
export const MARKETING_RULES = Object.freeze([
  {
    id: 'hero-is-customer',
    name: 'The customer is the hero',
    teaches:
      'An ad that opens with the company gets scrolled past. Open inside the reader’s own situation and let the business be the guide who knows the way — never the star of the story.',
  },
  {
    id: 'outcome-first',
    name: 'Lead with the outcome',
    teaches:
      'People buy a changed situation, not a product. Put the result in the first line, before any feature, material or method.',
  },
  {
    id: 'one-promise',
    name: 'One problem, one promise, one action',
    teaches:
      'Every extra idea in an ad halves the response to the others. Say one thing, and ask for one thing.',
  },
  {
    id: 'clarity-over-cleverness',
    name: 'Clarity beats cleverness',
    teaches:
      'A clever line the reader has to decode costs more attention than it earns. Plain words understood at a glance win, every time.',
  },
  {
    id: 'empathy-before-authority',
    name: 'Show understanding before expertise',
    teaches:
      'Competence only lands once the reader believes you understand their problem. Name the frustration first, then show you can solve it.',
  },
  {
    id: 'three-step-plan',
    name: 'Reduce the path to three steps',
    teaches:
      'Not knowing what happens next is the most common reason people do nothing. Three named steps make a large decision feel survivable.',
  },
  {
    id: 'cost-of-inaction',
    name: 'Name what staying stuck costs',
    teaches:
      'A quiet, honest reminder of what doing nothing costs creates movement. Fear-mongering destroys trust — “another summer passes” does not.',
  },
  {
    id: 'concrete-success',
    name: 'Make the better future concrete',
    teaches:
      'Vague promises are forgettable. A specific scene the reader can picture is the part they still remember tomorrow.',
  },
  {
    id: 'front-load-the-hook',
    name: 'Front-load the first line',
    teaches:
      'Feeds cut copy off after a short preview, and most readers never tap to expand it. Whatever has to be understood must survive inside that preview.',
  },
  {
    id: 'strictest-common-limit',
    name: 'Write to the strictest limit',
    teaches:
      'The same copy runs in several places, and each one cuts at a different point. Writing to the shortest limit means it is never truncated anywhere.',
  },
  {
    id: 'native-not-translated',
    name: 'Write each language natively',
    teaches:
      'A translated ad reads like a translated ad. Each language needs its own idiom and rhythm — and Swedish runs longer than English, so it needs its own shorter phrasing rather than a squeezed copy.',
  },
  {
    id: 'earn-the-hashtag',
    name: 'Few, specific hashtags',
    teaches:
      'A wall of generic tags reads as spam and reaches nobody. A handful of specific ones reach people who are already looking.',
  },
  {
    id: 'photo-not-poster',
    name: 'Let the picture be a photograph',
    teaches:
      'Images that look like adverts get treated like adverts. A believable photograph buys the second of attention a poster never gets.',
  },
  {
    id: 'brand-colour-in-scene',
    name: 'Put brand colour in the scene, not on a filter',
    teaches:
      'A colour filter looks cheap and dates quickly. The same palette reached through water, sky, timber and daylight still reads as the brand — and still reads as real.',
  },
] as const);

export type MarketingRuleId = (typeof MARKETING_RULES)[number]['id'];

export const MARKETING_RULE_IDS: readonly MarketingRuleId[] = Object.freeze(
  MARKETING_RULES.map((rule) => rule.id),
);

const RULES_BY_ID: ReadonlyMap<string, (typeof MARKETING_RULES)[number]> = new Map(
  MARKETING_RULES.map((rule) => [rule.id, rule]),
);

export function marketingRule(id: string): (typeof MARKETING_RULES)[number] | undefined {
  return RULES_BY_ID.get(id);
}

export function isMarketingRuleId(value: unknown): value is MarketingRuleId {
  return typeof value === 'string' && RULES_BY_ID.has(value);
}

export function marketingRulesPromptBlock(): string {
  return MARKETING_RULES.map((rule) => `- ${rule.id} — ${rule.name}: ${rule.teaches}`).join('\n');
}
