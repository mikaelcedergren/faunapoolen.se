export const CURRENT_CAMPAIGN_IDS = Object.freeze({
  strategy: '11111111-1111-4111-8111-111111111111',
  copy: '22222222-2222-4222-8222-222222222222',
  complete: '33333333-3333-4333-8333-333333333333',
  partial: '44444444-4444-4444-8444-444444444444',
  mismatchFile: '55555555-5555-4555-8555-555555555555',
  mismatchRecord: '66666666-6666-4666-8666-666666666666',
  duplicateFile: '77777777-7777-4777-8777-777777777777',
});

export function currentStrategy(overrides = {}) {
  return {
    name: 'A garden you can swim in',
    audience: 'Homeowners who want to swim at home without a conventional pool.',
    desiredOutcome: 'A swimming spot that looks like it always belonged in the garden.',
    singleMessage: 'You can swim at home without the garden becoming a building site.',
    externalProblem: 'A conventional pool is hard to fit into an existing garden.',
    internalProblem: 'They are afraid of starting a project they cannot finish.',
    plan: ['Tell us about the site', 'See what suits it', 'Plan the first step'],
    assumptions: ['The campaign leads to a consultation rather than a direct sale.'],
    rationale: [
      {
        topic: 'audience',
        ruleIds: ['hero-is-customer'],
        why: 'It names one recognisable person.',
      },
      {
        topic: 'desiredOutcome',
        ruleIds: ['outcome-first'],
        why: 'It leads with the result.',
      },
      {
        topic: 'plan',
        ruleIds: ['three-step-plan'],
        why: 'Three steps make the path feel manageable.',
      },
    ],
    ...overrides,
  };
}

export function currentCopy(language = 'en', overrides = {}) {
  const primaryText =
    language === 'sv'
      ? 'Bada hemma utan att trädgården blir ett byggprojekt.'
      : 'Swim at home without turning the garden into a building site.';
  return {
    headline: language === 'sv' ? 'En badplats som hör hemma' : 'A swimming garden at home',
    description: language === 'sv' ? 'Naturpool hemma' : 'Natural home swim',
    primaryText,
    fullCaption: `${primaryText} We begin with the place and choose a calm first step.`,
    callToAction: language === 'sv' ? 'Boka rådgivning' : 'Book a consultation',
    hashtags:
      language === 'sv'
        ? ['#naturpool', '#trädgårdsliv', '#faunapoolen']
        : ['#naturalpool', '#gardenlife', '#faunapoolen'],
    variations: {
      headline: [
        'Swim inside your garden',
        'Water that belongs here',
        'Your garden swimming place',
      ],
      primaryText: [
        'Start with the garden you already have and a swimming place that belongs there.',
        'A natural pool can feel as though it has always been part of your garden.',
        'Plan one calm first step towards swimming at home among stone and planting.',
      ],
    },
    rationale: [
      'headline',
      'description',
      'primaryText',
      'fullCaption',
      'callToAction',
      'hashtags',
    ].map((field) => ({
      field,
      ruleIds: ['clarity-over-cleverness'],
      guidance: `Keep the ${field} clear and useful.`,
    })),
    ...overrides,
  };
}

export function currentImagePromptResponse() {
  return {
    prompts: ['photograph', 'composite', 'detail'].map((concept) => ({
      concept,
      subject: 'A documentary photograph of one adult stepping into still, dark water.',
      environment: 'A Swedish garden with granite edging, birch and native late-summer planting.',
      light: 'Soft overcast afternoon light from the left.',
      composition: 'Waist-height framing with the subject slightly left of centre.',
      graphic: concept === 'composite' ? 'A flat cyan band along the lower third.' : 'none',
      altText: 'A person entering a natural swimming pond in a Swedish garden.',
      ruleIds: ['photo-not-poster', 'brand-colour-in-scene'],
      why: 'The believable scene carries the campaign promise without looking like a poster.',
    })),
  };
}

export function currentCampaign({
  id = CURRENT_CAMPAIGN_IDS.strategy,
  stage = 'strategy',
  createdAt = '2026-08-01T10:00:00.000Z',
  updatedAt = createdAt,
  copy,
  imagePrompts,
  ...overrides
} = {}) {
  const resolvedCopy =
    copy ??
    (stage === 'strategy'
      ? {}
      : {
          sv: currentCopy('sv'),
          en: currentCopy('en'),
        });
  const resolvedPrompts =
    imagePrompts ??
    (stage === 'complete'
      ? currentImagePromptResponse().prompts.map((scene, index) => ({
          concept: scene.concept,
          label: ['Straight photograph', 'Photograph with a graphic element', 'Material detail'][
            index
          ],
          prompt: `Synthetic composed prompt ${index + 1}`,
          altText: scene.altText,
          ruleIds: scene.ruleIds,
          why: scene.why,
        }))
      : []);
  return {
    id,
    createdAt,
    updatedAt,
    idea: 'A synthetic current-behaviour campaign idea.',
    name: 'Synthetic current campaign',
    stage,
    strategy: currentStrategy(),
    copy: resolvedCopy,
    imagePrompts: resolvedPrompts,
    ...overrides,
  };
}

export function openAiSuccess(output) {
  return {
    id: 'resp_current_contract',
    object: 'response',
    created_at: 1_787_636_400,
    status: 'completed',
    error: null,
    incomplete_details: null,
    instructions: null,
    max_output_tokens: null,
    model: 'gpt-5.6-terra',
    output: [
      {
        id: 'msg_current_contract',
        type: 'message',
        role: 'assistant',
        status: 'completed',
        content: [
          {
            type: 'output_text',
            annotations: [],
            logprobs: [],
            text: JSON.stringify(output),
          },
        ],
      },
    ],
    parallel_tool_calls: true,
    previous_response_id: null,
    reasoning: { effort: null, summary: null },
    store: true,
    temperature: 1,
    text: { format: { type: 'text' }, verbosity: 'medium' },
    tool_choice: 'auto',
    tools: [],
    top_p: 1,
    truncation: 'disabled',
    usage: {
      input_tokens: 1,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens: 1,
      output_tokens_details: { reasoning_tokens: 0 },
      total_tokens: 2,
    },
    user: null,
    metadata: {},
  };
}
