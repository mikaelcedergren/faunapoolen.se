import assert from 'node:assert/strict';
import test from 'node:test';

import { BRAND_PALETTE } from './brand-palette.js';
import {
  COPY_BUDGETS,
  COPY_FIELDS,
  COPY_FIELD_IDS,
  copyBudgetsPromptBlock,
  copyLength,
} from './copy-budgets.js';
import {
  composeImagePrompt,
  IMAGE_CONCEPTS,
  IMAGE_CONCEPT_IDS,
  imageStylePromptBlock,
} from './image-style.js';
import {
  isMarketingRuleId,
  MARKETING_RULES,
  MARKETING_RULE_IDS,
  marketingRule,
  marketingRulesPromptBlock,
} from './marketing-rules.js';

test('preserves every campaign copy budget and field in rendering order', () => {
  assert.deepEqual(COPY_BUDGETS, {
    headline: 27,
    description: 18,
    primaryText: 125,
    fullCaption: 2_200,
    callToAction: 25,
    hashtag: 40,
  });
  assert.deepEqual(COPY_FIELD_IDS, [
    'headline',
    'description',
    'primaryText',
    'fullCaption',
    'callToAction',
    'hashtags',
  ]);
  assert.equal(COPY_FIELDS.length, 6);
  assert.match(copyBudgetsPromptBlock(), /headline: at most 27 characters/);
  assert.doesNotMatch(copyBudgetsPromptBlock(), /hashtags:/);
});

test('counts copy by Unicode code point', () => {
  assert.equal(copyLength('Boka nu 🌿'), 9);
  assert.equal(copyLength(''), 0);
  assert.equal(copyLength(undefined), 0);
});

test('keeps the marketing-rule registry unique and addressable', () => {
  assert.equal(MARKETING_RULES.length, 14);
  assert.equal(new Set(MARKETING_RULE_IDS).size, MARKETING_RULE_IDS.length);
  assert.equal(marketingRule('outcome-first')?.name, 'Lead with the outcome');
  assert.equal(marketingRule('invented'), undefined);
  assert.equal(isMarketingRuleId('photo-not-poster'), true);
  assert.equal(isMarketingRuleId('invented'), false);
  assert.match(marketingRulesPromptBlock(), /hero-is-customer — The customer is the hero/);
});

test('composes the three fixed image concepts with the product palette and safety rules', () => {
  assert.deepEqual(IMAGE_CONCEPT_IDS, ['photograph', 'composite', 'detail']);
  assert.equal(IMAGE_CONCEPTS.length, 3);
  assert.match(imageStylePromptBlock(), /detail \(Material detail\)/);

  const scene = {
    subject: 'One adult steps into still, dark water.',
    environment: 'A Swedish garden with granite and birch.',
    light: 'Soft overcast afternoon light.',
    composition: 'Waist-height camera, subject left of centre.',
    graphic: 'none',
  };
  const plain = composeImagePrompt(IMAGE_CONCEPTS[0]!, scene);
  assert.match(plain, /No HDR tone mapping/);
  assert.match(plain, /No text, letters, numbers/);
  assert.match(plain, new RegExp(BRAND_PALETTE.primary, 'i'));
  assert.doesNotMatch(plain, /GRAPHIC ELEMENT/);

  const composite = composeImagePrompt(IMAGE_CONCEPTS[1]!, {
    ...scene,
    graphic: 'A flat cyan band along the lower third.',
  });
  assert.match(composite, /GRAPHIC ELEMENT/);
  assert.match(composite, /stays completely unfiltered/);
});
