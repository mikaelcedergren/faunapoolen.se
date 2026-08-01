import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CAMPAIGN_LIMITS,
  createGenerationStateStore,
  imageDataUrl,
  MAX_GENERATION_STATES,
  MAX_IDEA_CHARACTERS,
  normalizeIdea,
  validateCampaignOutput,
} from './admin-ad-builder.mjs';

function validCampaign() {
  const platform = (id, imageVariant) => ({
    id,
    placement: id === 'reels' ? 'Reels & TikTok · vertical' : `${id} feed`,
    hook: 'Få en badplats som känns som en del av trädgården',
    body: 'Du vill kunna bada hemma utan att trädgården känns som ett teknikprojekt. Faunapoolen hjälper dig att hitta en lugn väg från idé till naturpool.',
    callToAction: 'Boka rådgivning',
    hashtags: id === 'instagram' ? ['#naturpool', '#trädgårdsliv', '#faunapoolen'] : [],
    imageVariant,
    platformFit: 'Ett tydligt kundresultat följs av ett lugnt och konkret nästa steg.',
    coachNotes: [
      {
        principle: 'Character',
        appliedText: 'Få en badplats',
        explanation:
          'Annonsen börjar med vad kunden vill uppnå, så kunden blir berättelsens hjälte.',
      },
      {
        principle: 'Guide',
        appliedText: 'hjälper dig',
        explanation: 'Faunapoolen får rollen som trygg guide i stället för att stå i centrum.',
      },
      {
        principle: 'Call to action',
        appliedText: 'Boka rådgivning',
        explanation: 'Ett enda tydligt nästa steg gör det lättare att agera direkt.',
      },
    ],
  });

  return {
    campaign: {
      name: 'En naturlig plats att bada på',
      coreIdea: 'Hjälp villaägare att se en naturpool som en lugn del av trädgården.',
      audience: 'Villaägare som vill kunna bada hemma utan ett traditionellt pooluttryck.',
      desiredOutcome: 'En vacker badplats som känns självklar i trädgården.',
      singleMessage: 'Skapa en badplats som känns som en del av naturen.',
      assumptions: ['Kampanjen ska leda till en första rådgivning, inte ett direkt köp.'],
      story: {
        hero: 'Villaägaren som vill få in bad och avkoppling i sin trädgård.',
        externalProblem: 'En traditionell pool kan kännas svår att passa in i miljön.',
        internalProblem: 'Kunden vill inte välja fel eller starta ett övermäktigt projekt.',
        guide: 'Faunapoolen visar en trygg och begriplig väg från idé till lösning.',
        plan: ['Berätta om platsen', 'Utforska rätt lösning', 'Planera nästa steg'],
        callToAction: 'Boka rådgivning',
        failure: 'Idén fortsätter att kännas för stor och skjuts på framtiden.',
        success: 'Trädgården får en badplats som bjuder in till lugn och gemenskap.',
      },
      visual: {
        concept: 'En familj vid en naturpool som smälter in i en svensk trädgård.',
        imagePrompt:
          'A believable Swedish garden with a natural swimming pond, one relaxed adult at the water edge, warm late-summer daylight and restrained premium photography.',
        altText: 'En person sitter vid kanten av en naturpool i en grönskande svensk trädgård.',
      },
      platforms: [
        platform('facebook', 'feed'),
        platform('instagram', 'feed'),
        platform('linkedin', 'feed'),
        platform('reels', 'vertical'),
      ],
    },
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

test('accepts a complete StoryBrand campaign with four platform adaptations', () => {
  assert.deepEqual(validateCampaignOutput(validCampaign()), { ok: true });
});

test('rejects missing platforms, wrong visual formats, and copy beyond limits', () => {
  const missingPlatform = validCampaign();
  missingPlatform.campaign.platforms.pop();
  assert.equal(validateCampaignOutput(missingPlatform).ok, false);

  const wrongVisual = validCampaign();
  wrongVisual.campaign.platforms[3].imageVariant = 'feed';
  assert.equal(validateCampaignOutput(wrongVisual).ok, false);

  const tooLong = validCampaign();
  tooLong.campaign.platforms[0].body = 'x'.repeat(CAMPAIGN_LIMITS.body + 1);
  assert.equal(validateCampaignOutput(tooLong).ok, false);
});

test('builds private in-memory image data URLs for admin downloads', () => {
  assert.equal(imageDataUrl('YWJj\n', 'image/webp'), 'data:image/webp;base64,YWJj');
  assert.equal(imageDataUrl(''), '');
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
