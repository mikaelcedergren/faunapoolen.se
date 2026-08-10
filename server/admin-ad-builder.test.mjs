import assert from 'node:assert/strict';
import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  createGenerationStateStore,
  sanitizeEditedValue,
  LIMITS,
  MAX_GENERATION_STATES,
  MAX_IDEA_CHARACTERS,
  normalizeIdea,
  validateCopyOutput,
  validateImagePromptsOutput,
  validateStrategyOutput,
} from './admin-ad-builder.mjs';
import { createCampaignId, createCampaignStore, isCampaignId } from './campaign-store.mjs';
import { COPY_BUDGETS, COPY_FIELD_IDS, copyLength, MAX_HASHTAGS } from './copy-budgets.mjs';
import { composeImagePrompt, IMAGE_CONCEPTS } from './image-style.mjs';
import { MARKETING_RULE_IDS } from './marketing-rules.mjs';

function validStrategy() {
  return {
    name: 'A garden you can swim in',
    audience: 'Homeowners who want to swim at home without a conventional pool.',
    desiredOutcome: 'A swimming spot that looks like it always belonged in the garden.',
    singleMessage: 'You can swim at home without the garden turning into a building site.',
    externalProblem: 'A conventional pool is hard to fit into an existing garden.',
    internalProblem: 'They are afraid of starting a project they cannot finish.',
    plan: ['Tell us about the site', 'See what suits it', 'Plan the first step'],
    assumptions: ['The campaign leads to a first consultation rather than a direct sale.'],
    rationale: [
      {
        topic: 'audience',
        ruleIds: ['hero-is-customer'],
        why: 'It names one recognisable person.',
      },
      { topic: 'desiredOutcome', ruleIds: ['outcome-first'], why: 'It leads with the result.' },
      { topic: 'plan', ruleIds: ['three-step-plan'], why: 'Three steps make it feel survivable.' },
    ],
  };
}

function validCopy() {
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

function validImagePrompts() {
  return {
    prompts: IMAGE_CONCEPTS.map((concept) => ({
      concept: concept.id,
      subject: 'A documentary photograph of one adult stepping into still, dark water.',
      environment:
        'A Swedish garden with granite edging, birch and native planting in late summer.',
      light: 'Overcast afternoon light, soft and directionless.',
      composition: 'Waist-height camera, subject slightly left of centre, shallow depth of field.',
      graphic: concept.id === 'composite' ? 'A flat cyan band along the lower third.' : 'none',
      altText: 'A person stepping into a natural swimming pond in a Swedish garden.',
      ruleIds: ['photo-not-poster', 'brand-colour-in-scene'],
      why: 'A believable photograph earns the attention a poster does not.',
    })),
  };
}

test('normalizes a rough idea without turning it into a claim source', () => {
  assert.equal(
    normalizeIdea('  Naturpool   för små trädgårdar\r\n\r\n\r\n kanske enklare start  '),
    'Naturpool för små trädgårdar\n\nkanske enklare start',
  );
  assert.equal(normalizeIdea(undefined), '');
  assert.equal(MAX_IDEA_CHARACTERS, 3_000);
});

test('copy budgets hold the verified strictest published limits', () => {
  // The budget table is the single source the schema, the validator and the admin meter read from.
  // These four come from published network figures (verified 2026-08-08); if one drifts, copy would
  // be truncated on the strictest placement without anything in the studio noticing.
  assert.equal(COPY_BUDGETS.headline, 27);
  assert.equal(COPY_BUDGETS.description, 18);
  assert.equal(COPY_BUDGETS.primaryText, 125);
  assert.equal(COPY_BUDGETS.fullCaption, 2_200);
  for (const [field, budget] of Object.entries(COPY_BUDGETS)) {
    assert.ok(Number.isSafeInteger(budget) && budget > 0, `${field} has no usable budget`);
  }
});

test('every field the model writes has a budget it can be checked against', () => {
  for (const field of COPY_FIELD_IDS) {
    const budget = field === 'hashtags' ? COPY_BUDGETS.hashtag : COPY_BUDGETS[field];
    assert.ok(budget > 0, `${field} has no budget`);
  }
});

test('counts characters by code point so an emoji costs one everywhere', () => {
  assert.equal(copyLength('Boka nu 🌿'), 9);
  assert.equal(copyLength(''), 0);
});

test('accepts a complete strategy and rejects a broken one', () => {
  assert.deepEqual(validateStrategyOutput(validStrategy()), { ok: true });

  const shortPlan = validStrategy();
  shortPlan.plan.pop();
  assert.equal(validateStrategyOutput(shortPlan).ok, false);

  const duplicateTopics = validStrategy();
  duplicateTopics.rationale[1].topic = 'audience';
  assert.equal(validateStrategyOutput(duplicateTopics).ok, false);

  const inventedRule = validStrategy();
  inventedRule.rationale[0].ruleIds = ['sounds-plausible'];
  assert.equal(validateStrategyOutput(inventedRule).ok, false);
});

test('accepts campaign copy inside every budget', () => {
  assert.deepEqual(validateCopyOutput(validCopy()), { ok: true });
});

test('rejects copy that overruns a budget and names the field and length', () => {
  const overrun = validCopy();
  overrun.headline = 'x'.repeat(COPY_BUDGETS.headline + 1);
  const result = validateCopyOutput(overrun);
  assert.equal(result.ok, false);
  assert.match(result.error, /headline was \d+ characters; the limit is \d+/);
});

test('rejects copy whose caption does not open with the primary text', () => {
  const drifted = validCopy();
  drifted.fullCaption = 'Something else entirely.';
  assert.equal(validateCopyOutput(drifted).ok, false);
});

test('rejects missing variations, too many hashtags, and an incomplete rationale', () => {
  const missingVariation = validCopy();
  missingVariation.variations.headline.pop();
  assert.equal(validateCopyOutput(missingVariation).ok, false);

  const tooManyHashtags = validCopy();
  tooManyHashtags.hashtags = Array.from({ length: MAX_HASHTAGS + 1 }, (_, index) => `#tag${index}`);
  assert.equal(validateCopyOutput(tooManyHashtags).ok, false);

  const missingRationale = validCopy();
  missingRationale.rationale.pop();
  assert.equal(validateCopyOutput(missingRationale).ok, false);
});

test('edited copy is bounded before it reaches disk', () => {
  assert.equal(
    sanitizeEditedValue('headline', '  A garden you can swim in  '),
    'A garden you can swim in',
  );
  assert.equal(sanitizeEditedValue('headline', ''), undefined);
  assert.equal(sanitizeEditedValue('headline', 'x'.repeat(4_001)), undefined);
  assert.equal(sanitizeEditedValue('headline', 42), undefined);
  assert.deepEqual(sanitizeEditedValue('hashtags', [' #one ', '#two']), ['#one', '#two']);
  assert.equal(sanitizeEditedValue('hashtags', 'not-an-array'), undefined);
  assert.equal(sanitizeEditedValue('hashtags', Array(31).fill('#tag')), undefined);
});

test('a field may be edited past its budget — the budget is advice, not a wall', () => {
  // The screen shows the overrun; refusing the owner's own wording would lose their work.
  const long = 'x'.repeat(COPY_BUDGETS.headline + 20);
  assert.equal(sanitizeEditedValue('headline', long), long);
});

test('every rule the model may cite exists in the registry', () => {
  assert.ok(MARKETING_RULE_IDS.length > 0);
  assert.equal(new Set(MARKETING_RULE_IDS).size, MARKETING_RULE_IDS.length);
});

test('accepts three image prompts in concept order and rejects any other order', () => {
  assert.deepEqual(validateImagePromptsOutput(validImagePrompts()), { ok: true });

  const reordered = validImagePrompts();
  reordered.prompts.reverse();
  assert.equal(validateImagePromptsOutput(reordered).ok, false);

  const missing = validImagePrompts();
  missing.prompts.pop();
  assert.equal(validateImagePromptsOutput(missing).ok, false);
});

test('composed image prompts carry the house style and never request text', () => {
  const [photograph, composite] = IMAGE_CONCEPTS;
  const scene = validImagePrompts().prompts[0];

  const plain = composeImagePrompt(photograph, { ...scene, graphic: 'none' });
  assert.match(plain, /No HDR tone mapping/);
  assert.match(plain, /No text, letters, numbers/);
  assert.match(plain, /#00A1E4/);
  assert.doesNotMatch(plain, /GRAPHIC ELEMENT/);

  const overlaid = composeImagePrompt(composite, {
    ...scene,
    graphic: 'A flat cyan band along the lower third.',
  });
  assert.match(overlaid, /GRAPHIC ELEMENT/);
  assert.match(overlaid, /stays completely unfiltered/);
});

test('campaign ids are validated before they reach the filesystem', () => {
  assert.ok(isCampaignId(createCampaignId()));
  assert.equal(isCampaignId('../../etc/passwd'), false);
  assert.equal(isCampaignId('not-a-uuid'), false);
  assert.equal(isCampaignId(undefined), false);
});

test('campaign storage round-trips and evicts the oldest beyond its cap', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fp-campaigns-'));
  const store = createCampaignStore({ directory, maxCampaigns: 2 });

  const campaign = (createdAt, name) => ({
    id: createCampaignId(),
    createdAt,
    updatedAt: createdAt,
    idea: 'a rough idea',
    name,
    stage: 'strategy',
    strategy: validStrategy(),
    copy: {},
    imagePrompts: [],
  });

  const oldest = campaign('2026-01-01T00:00:00.000Z', 'Oldest');
  await store.save(oldest);
  await store.save(campaign('2026-02-01T00:00:00.000Z', 'Middle'));

  const reopened = await store.get(oldest.id);
  assert.equal(reopened.name, 'Oldest');

  await store.save(campaign('2026-03-01T00:00:00.000Z', 'Newest'));
  assert.equal(await store.size(), 2);
  assert.equal(await store.get(oldest.id), undefined);
  assert.equal((await readdir(directory)).length, 2);

  const listed = await store.list();
  assert.deepEqual(
    listed.map((entry) => entry.name),
    ['Newest', 'Middle'],
  );
});

test('a corrupt campaign file is skipped instead of taking the studio down', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fp-campaigns-'));
  const { writeFile } = await import('node:fs/promises');
  await writeFile(join(directory, `${createCampaignId()}.json`), '{ not json', 'utf8');

  const store = createCampaignStore({ directory });
  assert.deepEqual(await store.list(), []);
});

test('campaign copy limits stay inside the schema limits the model writes against', () => {
  assert.ok(LIMITS.why > 0);
  assert.ok(LIMITS.scene > LIMITS.altText);
});

test('campaign generation state has a fixed production cardinality ceiling', () => {
  assert.equal(MAX_GENERATION_STATES, 1_000);
});

test('campaign generation state sweeps expired sessions and rejects new state at capacity', () => {
  let currentTime = 1_000;
  const store = createGenerationStateStore({
    windowMs: 100,
    maxEntries: 2,
    sweepIntervalMs: 10,
    now: () => currentTime,
  });

  assert.ok(store.get('session-a'));
  assert.ok(store.get('session-b'));
  assert.equal(store.get('session-c'), undefined);
  assert.equal(store.size(), 2);

  currentTime += 101;
  assert.ok(store.get('session-c'));
  assert.equal(store.size(), 1);
});

test('campaign state keeps in-flight work until it finishes, even after TTL', () => {
  let currentTime = 1_000;
  const store = createGenerationStateStore({
    windowMs: 100,
    maxEntries: 1,
    sweepIntervalMs: 10,
    now: () => currentTime,
  });
  const active = store.get('session-a');
  active.inFlight = true;

  currentTime += 101;
  store.sweep();
  assert.equal(store.size(), 1);
  assert.equal(store.get('session-b'), undefined);

  active.inFlight = false;
  store.sweep();
  assert.equal(store.size(), 0);
  assert.ok(store.get('session-b'));
});

test('scheduled sweeps remove completed campaign state while the server is otherwise idle', async (t) => {
  let currentTime = 1_000;
  const store = createGenerationStateStore({
    windowMs: 10,
    maxEntries: 2,
    sweepIntervalMs: 5,
    now: () => currentTime,
  });
  t.after(store.stopSweep);
  store.get('session-a');
  currentTime += 11;
  store.startSweep();

  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(store.size(), 0);
});
