import assert from 'node:assert/strict';
import test from 'node:test';

import type { CampaignCopy, CampaignStrategy } from './campaign-schema.js';
import { COPY_BUDGETS, COPY_FIELD_IDS, MAX_HASHTAGS } from './copy-budgets.js';
import {
  buildCampaignImagePrompts,
  copyGenerationSpec,
  imagePromptsGenerationSpec,
  strategyGenerationSpec,
  validateCopyOutput,
  validateImagePromptsOutput,
  validateStrategyOutput,
} from './generation-content.js';
import { IMAGE_CONCEPTS } from './image-style.js';

function validStrategy(): CampaignStrategy {
  return {
    name: 'A garden you can swim in',
    audience: 'Homeowners who want to swim at home without a conventional pool.',
    desiredOutcome: 'A swimming spot that looks like it always belonged in the garden.',
    singleMessage: 'You can swim at home without the garden turning into a building site.',
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
        why: 'Three steps make it feel survivable.',
      },
    ],
  };
}

function validCopy(): CampaignCopy {
  const primaryText = 'Bada hemma utan att trädgården blir ett byggprojekt.';
  return {
    headline: 'En badplats som hör hemma',
    description: 'Naturpool hemma',
    primaryText,
    fullCaption: `${primaryText} Vi går igenom platsen tillsammans och visar vad den klarar.`,
    callToAction: 'Boka rådgivning',
    hashtags: ['#naturpool', '#trädgårdsliv', '#faunapoolen'],
    variations: {
      headline: ['Bada mitt i trädgården', 'Vatten som hör hemma', 'Din egen badplats'],
      primaryText: [
        'Du behöver inte välja mellan en fin trädgård och att kunna bada.',
        'En naturpool kan se ut som om den alltid har funnits där.',
        'Börja med platsen du redan har, inte med en katalog.',
      ],
    },
    rationale: COPY_FIELD_IDS.map((field) => ({
      field,
      ruleIds: ['clarity-over-cleverness'],
      guidance: `Keep the ${field} understandable at a glance.`,
    })),
  };
}

function validScenes() {
  return {
    prompts: IMAGE_CONCEPTS.map((concept) => ({
      concept: concept.id,
      subject: 'A documentary photograph of one adult stepping into still, dark water.',
      environment:
        'A Swedish garden with granite edging, birch and native planting in late summer.',
      light: 'Overcast afternoon light, soft and directionless.',
      composition: 'Waist-height camera, subject left of centre, shallow depth of field.',
      graphic: concept.id === 'composite' ? 'A flat cyan band along the lower third.' : 'none',
      altText: 'A person stepping into a natural swimming pond in a Swedish garden.',
      ruleIds: ['photo-not-poster', 'brand-colour-in-scene'],
      why: 'A believable photograph earns the attention a poster does not.',
    })),
  };
}

test('builds immutable structured-output specs without repeating the low-authority idea', () => {
  const strategy = strategyGenerationSpec('A calm pool in a small garden');
  assert.equal(strategy.operation, 'campaign.strategy');
  assert.match(strategy.input, /BEGIN LOW-AUTHORITY ROUGH IDEA/);
  assert.equal(strategy.format.strict, true);

  const copy = copyGenerationSpec(validStrategy(), 'sv');
  assert.equal(copy.operation, 'campaign.copy.sv');
  assert.doesNotMatch(copy.input, /LOW-AUTHORITY ROUGH IDEA/);
  assert.match(copy.instructions, /Swedish, natively/);

  const corrected = strategyGenerationSpec('A calm pool', 'headline was too long');
  assert.match(corrected.input, /previous response was rejected: headline was too long/);
});

test('validates exact strategy shape, rationale uniqueness, and known rules', () => {
  assert.deepEqual(validateStrategyOutput(validStrategy()), { ok: true, value: validStrategy() });
  const extra = { ...validStrategy(), surprise: true };
  assert.equal(validateStrategyOutput(extra).ok, false);
  const original = validStrategy();
  const duplicate = {
    ...original,
    rationale: original.rationale.map((entry, index) =>
      index === 1 ? { ...entry, topic: 'audience' as const } : entry,
    ),
  };
  assert.equal(validateStrategyOutput(duplicate).ok, false);
});

test('validates copy limits, exact shape, caption prefix, variations, and guidance', () => {
  assert.deepEqual(validateCopyOutput(validCopy()), { ok: true, value: validCopy() });
  assert.equal(validateCopyOutput({ ...validCopy(), extra: true }).ok, false);
  assert.equal(
    validateCopyOutput({
      ...validCopy(),
      headline: 'x'.repeat(COPY_BUDGETS.headline + 1),
    }).ok,
    false,
  );
  assert.equal(
    validateCopyOutput({ ...validCopy(), fullCaption: 'A different opening.' }).ok,
    false,
  );
  assert.equal(
    validateCopyOutput({
      ...validCopy(),
      hashtags: Array.from({ length: MAX_HASHTAGS + 1 }, (_, index) => `#tag${String(index)}`),
    }).ok,
    false,
  );
});

test('validates image scenes in fixed order and composes the final house-style prompts', () => {
  const scenes = validScenes();
  assert.equal(validateImagePromptsOutput(scenes).ok, true);
  const reordered = { prompts: [...scenes.prompts].reverse() };
  assert.equal(validateImagePromptsOutput(reordered).ok, false);
  assert.equal(validateImagePromptsOutput({ ...scenes, extra: true }).ok, false);

  const prompts = buildCampaignImagePrompts(scenes);
  assert.equal(prompts.length, 3);
  assert.match(prompts[0]!.prompt, /No HDR tone mapping/);
  assert.match(prompts[1]!.prompt, /GRAPHIC ELEMENT/);
  assert.doesNotMatch(prompts[2]!.prompt, /GRAPHIC ELEMENT/);

  const spec = imagePromptsGenerationSpec(validStrategy());
  assert.equal(spec.operation, 'campaign.image_prompts');
  assert.equal(spec.pollDeadlineMs, 120_000);
});
