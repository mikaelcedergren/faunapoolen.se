import { expect, test } from '@playwright/test';

const TEST_ORIGIN = process.env['CX_E2E_BASE_URL'];
if (!TEST_ORIGIN) throw new Error('Faunapoolen E2E requires its wrapper-owned origin.');
const OWNED_E2E_PORT = Number(new URL(TEST_ORIGIN).port);
const OTHER_E2E_ORIGIN = `http://127.0.0.1:${OWNED_E2E_PORT === 49_152 ? 49_153 : 49_152}`;
const LOCALLY_FULFILLED_URLS = new Set([
  'https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900&display=swap',
  'https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,200..900;1,7..72,200..900&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,200,0,0',
  'https://www.googletagmanager.com/gtag/js?id=G-E1BFSP43WZ',
]);
const unexpectedExternalRequests = new WeakMap<object, string[]>();

test.beforeEach(async ({ context }) => {
  const unexpected: string[] = [];
  unexpectedExternalRequests.set(context, unexpected);
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === TEST_ORIGIN) {
      await route.continue();
      return;
    }

    if (request.method() === 'GET' && LOCALLY_FULFILLED_URLS.has(url.href)) {
      await route.fulfill({
        status: 200,
        contentType: url.hostname === 'fonts.googleapis.com' ? 'text/css' : 'text/javascript',
        body: '',
      });
      return;
    }

    unexpected.push(`${request.method()} ${url.href}`);
    await route.abort('blockedbyclient');
  });
});

test.afterEach(async ({ context }) => {
  expect(unexpectedExternalRequests.get(context) ?? []).toEqual([]);
});

test('the browser records and blocks every origin except its exact E2E server', async ({
  context,
  page,
}) => {
  const blockedUrls = [
    'http://127.0.0.1:3040/healthz',
    `${OTHER_E2E_ORIGIN}/healthz`,
    'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,200,0,0&unexpected=1',
    'https://cx-network-isolation.invalid/probe',
  ];
  for (const blockedUrl of blockedUrls) {
    const failedRequest = page.waitForEvent(
      'requestfailed',
      (request) => request.url() === blockedUrl,
    );
    await page.goto(blockedUrl).catch(() => undefined);
    expect((await failedRequest).failure()?.errorText).toBe('net::ERR_BLOCKED_BY_CLIENT');
  }
  const recorded = unexpectedExternalRequests.get(context);
  expect(recorded).toEqual(blockedUrls.map((url) => `GET ${url}`));
  recorded?.splice(0);
});

test('browser launch transport sends production through the owned proxy', async ({
  context,
  page,
}) => {
  await context.unroute('**/*');
  const response = await page.goto('http://127.0.0.1:3040/cx-e2e-launch-proxy-proof');
  expect(response?.status()).toBe(403);
  expect(await response?.text()).toContain('E2E proxy denied this origin.');
});

test('API and test-process transports cannot reach another origin', async ({ request }) => {
  for (const url of [
    'http://127.0.0.1:3040/healthz',
    `${OTHER_E2E_ORIGIN}/healthz`,
    'http://cx-network-isolation.invalid/probe',
    'https://cx-network-isolation.invalid/probe',
  ]) {
    const response = await request.get(url, {
      failOnStatusCode: false,
      maxRedirects: 0,
    });
    expect(response.url()).toBe(url);
    expect(response.status()).toBe(403);
  }
  await expect(fetch('http://127.0.0.1:3040/healthz')).rejects.toThrow(
    'E2E network isolation blocked',
  );
});

test('home renders the real Faunapoolen site', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Faunapoolen/i);
  await expect(page.locator('nav.navigation')).toBeVisible();
});

test('a product page (.html) loads', async ({ page }) => {
  const res = await page.goto('/koi-pond-series.html');
  expect(res?.status()).toBe(200);
});

test('a blog post loads', async ({ page }) => {
  const res = await page.goto('/blog/posts/build-your-own-nature-pool.html');
  expect(res?.status()).toBe(200);
});

test('English mirror loads', async ({ page }) => {
  const res = await page.goto('/en/');
  expect(res?.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('lang', /en/);
});

test('the admin is excluded from search and every public page stays indexable', async ({
  request,
}) => {
  const rules = await (await request.get('/robots.txt')).text();
  expect(rules).toContain('Allow: /');
  expect(rules).toContain('Disallow: /admin');
  expect(rules).toContain('Disallow: /en/admin');
  expect(await (await request.get('/sitemap.xml')).text()).not.toContain('/admin');

  for (const path of ['/admin/', '/en/admin/', '/api/admin/session']) {
    const res = await request.get(path);
    expect(res.headers()['x-robots-tag'], path).toBe('noindex, nofollow');
  }

  // The login page carries the directive itself and nothing a crawler could index it by.
  for (const path of ['/admin/', '/en/admin/']) {
    const html = await (await request.get(path)).text();
    expect(html, path).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(html, path).not.toContain('rel="canonical"');
    expect(html, path).not.toContain('hreflang');
    expect(html, path).not.toContain('application/ld+json');
  }

  const publicPage = await request.get('/koi-pond-series.html');
  expect(publicPage.headers()['x-robots-tag']).toBeUndefined();
  const publicHtml = await publicPage.text();
  expect(publicHtml).not.toContain('name="robots"');
  expect(publicHtml).toContain('rel="canonical"');
  expect(publicHtml).toContain('application/ld+json');
});

test('admin signs in and builds one explained bilingual campaign', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/status of (503|409)/.test(message.text()))
      browserErrors.push(message.text());
  });

  const roughIdea =
    'Help homeowners see that a natural pool can feel like a calm part of the garden.';
  const strategy = {
    name: 'A natural place to swim',
    audience: 'Homeowners who want swimming water that belongs in their garden.',
    desiredOutcome: 'A beautiful place to swim without a conventional pool expression.',
    singleMessage: 'Create a place to swim that feels like part of the garden.',
    externalProblem: 'A conventional pool can feel separate from the garden.',
    internalProblem: 'The project feels difficult to begin without guidance.',
    plan: ['Share the idea', 'Explore the site', 'Plan the next step'],
    assumptions: ['The next step is an initial consultation, not a direct purchase.'],
    rationale: [
      {
        topic: 'audience',
        ruleIds: ['hero-is-customer'],
        why: 'The audience is one recognisable person rather than a broad segment.',
      },
      {
        topic: 'singleMessage',
        ruleIds: ['one-promise'],
        why: 'One promise carries the whole campaign.',
      },
      {
        topic: 'plan',
        ruleIds: ['three-step-plan'],
        why: 'Three named steps make a large decision feel survivable.',
      },
    ],
  };

  const languageCopy = (headline: string, primaryText: string, callToAction: string) => ({
    headline,
    description: 'Natural pools',
    primaryText,
    fullCaption: `${primaryText}\n\nA natural swimming pond brings clear water, planting and space to unwind into one part of the garden. It starts with the place you already have: the light, the ground and how your family wants to spend time outside.\n\nWe walk the site with you, explain the possibilities and plan the first step together. You do not need a finished design to begin.`,
    callToAction,
    hashtags: ['#naturalpool', '#gardendesign', '#faunapoolen'],
    variations: {
      headline: ['Swim in your own garden', 'Water that belongs here', 'A pool that looks wild'],
      primaryText: [
        'You do not have to choose between a garden you like and somewhere to swim.',
        'A natural pool can look as though it was always there.',
        'Start with the garden you already have.',
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
      ruleIds: ['outcome-first'],
      guidance:
        field === 'callToAction'
          ? 'Ask for one specific consultation step; stay within 25 characters.'
          : `Lead the ${field} with the outcome, not the product. Stay within the character limit.`,
    })),
  });

  const campaign = {
    id: '11111111-2222-4333-8444-555555555555',
    createdAt: '2026-08-08T09:00:00.000Z',
    updatedAt: '2026-08-08T09:00:00.000Z',
    revision: 3,
    idea: roughIdea,
    name: strategy.name,
    stage: 'strategy',
    strategy,
    copy: {},
    imagePrompts: [],
  };

  let createPayload: unknown;
  type SavedEdit = {
    expectedRevision: number;
    language: 'en' | 'sv';
    field: string;
    value: string | string[];
  };
  let saved: SavedEdit | undefined;
  const saveRequests: SavedEdit[] = [];
  let failSaves = false;
  let saveGate: Promise<void> | undefined;
  let releaseSaves: (() => void) | undefined;
  let generationReady = false;
  let refinementPayload:
    | { expectedRevision: number; language: 'en' | 'sv'; draft: ReturnType<typeof languageCopy> }
    | undefined;
  let refinementState: 'running' | 'succeeded' | 'failed' = 'running';
  let refinementCalls = 0;
  let refinementApplied = false;
  const refinementId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  const refinementSummary =
    'Kept the quiet garden idea, led with its benefit, and shortened the headline. Refreshed the Swedish translation.';

  const completedCampaign = {
    ...campaign,
    stage: 'complete' as const,
    refinement: undefined as { runId: string; language: 'en' | 'sv'; summary: string } | undefined,
    copy: {
      sv: languageCopy(
        'En badplats som hör hemma',
        'Bada hemma utan att trädgården blir ett byggprojekt.',
        'Boka rådgivning',
      ),
      en: languageCopy(
        'A garden you can swim in',
        'Swim at home without turning the garden into a building site.',
        'Book a consultation',
      ),
    },
    imagePrompts: [
      {
        concept: 'photograph',
        label: 'Straight photograph',
        prompt:
          'A documentary photograph of a natural swimming pond.\n\nPHOTOGRAPHIC STYLE\nNo HDR tone mapping.',
        altText: 'A natural swimming pond in a Swedish garden.',
        ruleIds: ['photo-not-poster'],
        why: 'A believable photograph earns the attention a poster does not.',
      },
      {
        concept: 'detail',
        label: 'Water at the garden edge',
        prompt:
          'An intimate photograph of clear water meeting a limestone edge, with native grasses reflected on the surface. Soft morning light, natural colours and no text.',
        altText: 'Clear water, pale stone and grasses in morning light.',
        ruleIds: ['photo-not-poster'],
        why: 'The detail makes the natural materials tangible.',
      },
      {
        concept: 'lifestyle',
        label: 'An afternoon by the pond',
        prompt:
          'A quiet documentary scene of an adult relaxing beside a natural swimming pond in a Swedish garden. Eye-level composition, late afternoon daylight and no text.',
        altText: 'A quiet place to sit beside the water on a summer afternoon.',
        ruleIds: ['photo-not-poster'],
        why: 'Show what the garden makes possible.',
      },
    ],
  };

  completedCampaign.copy.sv.rationale.forEach((entry) => {
    entry.guidance = 'A separate Swedish explanation must not be shown.';
  });
  const refinementStatus = () => {
    if (!refinementPayload) return undefined;
    if (refinementState === 'succeeded' && !refinementApplied) {
      completedCampaign.copy.en.headline = 'A quieter garden to swim in';
      completedCampaign.copy.en.fullCaption = `${completedCampaign.copy.en.primaryText}\n\n${completedCampaign.copy.en.fullCaption.split('\n\n').slice(1).join('\n\n')}`;
      completedCampaign.copy.sv.headline = 'Bada i en lugnare trädgård';
      completedCampaign.refinement = {
        runId: refinementId,
        language: 'en',
        summary: refinementSummary,
      };
      completedCampaign.revision += 1;
      refinementApplied = true;
    }
    return {
      campaignId: campaign.id,
      campaignRevision: completedCampaign.revision,
      jobId: 'synthetic-refinement-job',
      stage: 'copy',
      state: refinementState,
      updatedAt: completedCampaign.updatedAt,
      refinement: {
        runId: refinementId,
        language: refinementPayload.language,
        draft: refinementPayload.draft,
        expectedRevision: refinementPayload.expectedRevision,
      },
      ...(refinementState === 'failed'
        ? {
            error: {
              code: 'provider_generation_failed',
              message: 'Synthetic refinement failed. Your draft is kept.',
            },
          }
        : {}),
    };
  };
  await page.route('**/api/admin/generations', async (route) => {
    const status = refinementStatus();
    await route.fulfill({
      json: { generations: status && status.state !== 'succeeded' ? [status] : [] },
    });
  });

  await page.route('**/api/admin/campaigns', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          campaigns: createPayload
            ? [
                { ...campaign, stage: 'complete' },
                {
                  ...campaign,
                  id: '22222222-2222-4333-8444-555555555555',
                  name: 'Water for a smaller garden',
                  stage: 'copy',
                  updatedAt: '2026-08-07T09:00:00.000Z',
                },
                {
                  ...campaign,
                  id: '33333333-2222-4333-8444-555555555555',
                  name: 'A quieter place to come home to',
                  stage: 'strategy',
                  updatedAt: '2026-08-06T09:00:00.000Z',
                },
                {
                  ...campaign,
                  id: '44444444-2222-4333-8444-555555555555',
                  name: 'Make room for nature by the water',
                  stage: 'complete',
                  updatedAt: '2026-08-05T09:00:00.000Z',
                },
              ]
            : [],
        },
      });
      return;
    }
    createPayload = route.request().postDataJSON();
    await route.fulfill({
      contentType: 'application/json',
      json: {
        generation: {
          campaignId: campaign.id,
          campaignRevision: 0,
          jobId: 'synthetic-browser-job',
          state: 'queued',
        },
      },
      status: 202,
    });
  });

  await page.route(`**/api/admin/campaigns/${campaign.id}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/refine')) {
      refinementPayload = route.request().postDataJSON();
      refinementCalls += 1;
      refinementState = 'running';
      await route.fulfill({
        status: 202,
        json: {
          generation: {
            campaignId: campaign.id,
            campaignRevision: completedCampaign.revision,
            jobId: 'synthetic-refinement-job',
            state: 'queued',
          },
        },
      });
      return;
    }
    if (url.pathname.endsWith('/status') && refinementPayload) {
      await route.fulfill({ json: { status: refinementStatus() } });
      return;
    }
    if (url.pathname.endsWith('/status')) {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          status: {
            campaignId: campaign.id,
            campaignRevision: generationReady ? completedCampaign.revision : 0,
            jobId: 'synthetic-browser-job',
            stage: generationReady ? 'prompts' : 'strategy',
            state: generationReady ? 'succeeded' : 'running',
            updatedAt: completedCampaign.updatedAt,
          },
        },
      });
      return;
    }
    if (url.pathname.endsWith('/copy') && route.request().method() === 'PATCH') {
      const edit = route.request().postDataJSON() as SavedEdit;
      saved = edit;
      saveRequests.push(edit);
      if (saveGate) await saveGate;
      if (failSaves || edit.expectedRevision !== completedCampaign.revision) {
        await route.fulfill({
          status: failSaves ? 503 : 409,
          json: {
            error: {
              message: failSaves
                ? 'This change could not be saved. Try again.'
                : 'The campaign changed elsewhere.',
            },
          },
        });
      } else {
        Object.assign(completedCampaign.copy[edit.language], { [edit.field]: edit.value });
        completedCampaign.revision += 1;
        await route.fulfill({
          json: {
            ok: true,
            revision: completedCampaign.revision,
            updatedAt: '2026-08-08T09:01:00.000Z',
          },
        });
      }
      return;
    }
    await route.fallback();
  });

  await page.route(`**/api/admin/campaigns/${campaign.id}`, async (route) => {
    await route.fulfill({ contentType: 'application/json', json: { campaign: completedCampaign } });
  });

  await page.goto('/admin');

  await expect(page.locator('html')).toHaveClass(/theme-light/);
  await expect(page.locator('nav.navigation')).toHaveCount(0);
  await expect(page.getByText('Sign in to your campaign studio.')).toHaveCount(0);

  const usernameField = page.getByRole('textbox', { name: 'Username' });
  const passwordField = page.locator('input[name="password"]');
  const signInButton = page.getByRole('button', { name: 'Sign in' });

  await expect(page.getByText('Username', { exact: true })).toBeVisible();
  await expect(page.getByText('Password', { exact: true })).toBeVisible();
  await expect(page.locator('.fp-admin-login .cx-text-field__prepend')).toHaveCount(0);
  await expect(signInButton.locator('cx-icon')).toHaveCount(0);

  await usernameField.fill('faunapoolen-e2e-owner');
  await passwordField.fill('faunapoolen-e2e-owner-password');
  await signInButton.click();

  const campaignLocation = page.getByRole('navigation', { name: 'Campaign location' });
  await expect(
    campaignLocation.getByRole('listitem').getByText('Campaign Studio', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('cx-side-nav')).toHaveCount(1);
  await expect(page.getByRole('complementary', { name: 'Main navigation' })).toBeVisible();

  await page.screenshot({ animations: 'disabled', path: '/tmp/fauna-admin-after-list.png' });

  // Creating a campaign is a dialog over the list, not a separate page.
  await page.getByRole('button', { name: 'Create campaign' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Create campaign' });
  await expect(dialog).toBeVisible();
  await page.screenshot({ animations: 'disabled', path: '/tmp/fauna-admin-after-compose.png' });
  await page.getByRole('textbox', { name: 'Your rough idea' }).fill(roughIdea);
  await dialog.getByRole('button', { name: 'Create campaign' }).click();
  await expect(dialog).toBeHidden();

  expect(createPayload).toEqual({ idea: roughIdea });

  // Generation is one quiet blocking state. Editing and unrelated actions stay unavailable.
  await expect(page.getByRole('heading', { name: 'Creating strategy' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Creating strategy' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Headline' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create campaign' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Account actions for Admin' })).toBeDisabled();
  generationReady = true;

  // The framework top bar owns the breadcrumb hierarchy and the page's single h1.
  await expect(
    campaignLocation.getByRole('listitem').getByText('A natural place to swim', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'A natural place to swim' })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Campaigns', exact: true })).toHaveCount(0);

  const campaignTabs = page.getByRole('tablist', { name: 'Campaign sections' });
  const topBarBounds = await page.locator('cx-top-bar').boundingBox();
  const sectionBounds = await campaignTabs.boundingBox();
  expect(topBarBounds).not.toBeNull();
  expect(sectionBounds).not.toBeNull();
  expect(Math.abs(sectionBounds!.y - (topBarBounds!.y + topBarBounds!.height))).toBeLessThan(2);

  const languages = page.getByRole('group', { name: 'Campaign language' });
  await expect(languages.getByRole('button')).toHaveCount(2);
  await expect(languages.getByRole('button').first()).toHaveText('English');
  await expect(languages.getByRole('button', { name: 'English', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Six prefilled fields use the framework's normal input treatment.
  const headline = page.getByRole('textbox', { name: 'Headline' });
  await expect(headline).toHaveValue('A garden you can swim in');
  await expect(page.getByRole('textbox', { name: 'Primary text' })).toHaveValue(
    'Swim at home without turning the garden into a building site.',
  );
  await expect(page.locator('.cx-text-field__field-shell--inline-edit')).toHaveCount(0);
  await expect(page.locator('.cx-text-area__shell--inline-edit')).toHaveCount(0);

  const rationale = page.getByRole('complementary', { name: 'Copy rationale' });
  await expect(rationale.getByText('Why this works', { exact: true })).toBeVisible();
  await page.getByRole('region', { name: 'Headline', exact: true }).hover();
  await expect(rationale.getByRole('heading', { name: 'Headline' })).toBeVisible();
  await expect(
    rationale.getByText('Lead the headline with the outcome, not the product.'),
  ).toBeVisible();
  await expect(rationale.getByText('Lead with the outcome', { exact: true })).toBeVisible();
  await expect(rationale).not.toContainText(/characters?/i);
  const copyLayout = page.locator('cx-sidebar-layout');
  const copyForm = copyLayout.locator('.fp-copy-form');
  const desktopForm = await copyForm.boundingBox();
  const desktopRationale = await rationale.boundingBox();
  expect(desktopForm).not.toBeNull();
  expect(desktopRationale).not.toBeNull();
  expect(desktopRationale!.x).toBeGreaterThanOrEqual(desktopForm!.x + desktopForm!.width);
  expect(desktopRationale!.x - (desktopForm!.x + desktopForm!.width)).toBeLessThan(65);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(async () => (await copyForm.boundingBox())?.width ?? 0).toBeGreaterThan(240);
  await expect(rationale).toBeVisible();
  const mobileForm = await copyForm.boundingBox();
  const mobileRationale = await rationale.boundingBox();
  expect(mobileForm).not.toBeNull();
  expect(mobileRationale).not.toBeNull();
  expect(mobileForm!.y).toBeGreaterThanOrEqual(mobileRationale!.y + mobileRationale!.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ animations: 'disabled', path: '/tmp/fauna-admin-sidebar-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const savesBeforeHover = saveRequests.length;
  await page.getByRole('region', { name: 'Call to action', exact: true }).hover();
  await expect(rationale.getByText('Ask for one specific consultation step.')).toBeVisible();
  await expect(rationale).not.toContainText(/characters?/i);
  await page.getByRole('region', { name: 'Primary text', exact: true }).hover();
  await expect(rationale.getByRole('heading', { name: 'Primary text' })).toBeVisible();
  expect(saveRequests.length).toBe(savesBeforeHover);
  await expect(rationale.getByRole('heading', { name: 'Principles', exact: true })).toBeVisible();

  // Counts stay local; longer writing guidance is disclosed separately.
  await expect(page.getByText('24/27 characters', { exact: true })).toBeVisible();
  await expect(page.locator('cx-budget')).toHaveCount(0);

  await page.screenshot({ animations: 'disabled', path: '/tmp/fauna-admin-after-copy.png' });
  await page.getByRole('tab', { name: 'Strategy', exact: true }).click();
  await expect(page.getByText('Check before publishing', { exact: true })).toBeVisible();
  // Let the framework finish its scheduled tab measurements before visual capture.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
      ),
  );
  await page.screenshot({ animations: 'disabled', path: '/tmp/fauna-admin-after-strategy.png' });
  await page.getByRole('tab', { name: 'Copy', exact: true }).click();
  await page.getByRole('button', { name: 'English', exact: true }).click();

  // Editing saves on blur.
  await headline.fill('A garden to swim in');
  await headline.blur();
  await expect
    .poll(() => saved)
    .toEqual({
      expectedRevision: 3,
      language: 'en',
      field: 'headline',
      value: 'A garden to swim in',
    });

  // Going past the budget explains how to correct it without stacking more guidance.
  const tooLong = 'A garden you can swim in every single summer';
  await headline.fill(tooLong);
  await expect(
    page.getByText(`Remove ${tooLong.length - 27} characters to fit the 27-character limit.`),
  ).toBeVisible();
  await expect(page.getByText('24/27 characters', { exact: true })).toHaveCount(0);

  await headline.fill('A garden to swim in');
  await headline.blur();
  await expect(page.getByText('Changes saved', { exact: true })).toBeVisible();

  // A slow save must keep every queued edit attached to its original language.
  saveGate = new Promise<void>((resolve) => {
    releaseSaves = resolve;
  });
  const requestsBeforeSwitch = saveRequests.length;
  await headline.fill('A place to swim');
  await headline.blur();
  await expect(page.getByText('Saving changes', { exact: true })).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Primary text', exact: true })
    .fill('Swim in a garden that feels like home.');
  // The Swedish option swaps only the copy, using the identical English explanation.
  const sharedExplanation = await rationale.innerText();
  await page.getByRole('button', { name: 'Swedish', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Headline' })).toHaveValue(
    'En badplats som hör hemma',
  );
  await expect(rationale).toHaveText(sharedExplanation, { useInnerText: true });

  releaseSaves?.();
  saveGate = undefined;
  await expect(page.getByText('Changes saved', { exact: true })).toBeVisible();
  expect(
    saveRequests.slice(requestsBeforeSwitch).map((edit) => [edit.language, edit.field, edit.value]),
  ).toEqual([
    ['en', 'headline', 'A place to swim'],
    ['en', 'primaryText', 'Swim in a garden that feels like home.'],
  ]);
  expect(completedCampaign.copy.sv.headline).toBe('En badplats som hör hemma');

  await page.getByRole('button', { name: 'English', exact: true }).click();

  // Failed writes preserve the draft and prevent a silent exit.
  failSaves = true;
  await headline.fill('A calmer garden');
  await headline.blur();
  await expect(page.getByRole('button', { name: 'Retry save', exact: true })).toBeVisible();
  await page.screenshot({ animations: 'disabled', path: '/tmp/fauna-admin-after-save-error.png' });
  await campaignLocation.getByRole('button', { name: 'Campaign Studio', exact: true }).click();
  await expect(page.getByText('Leave without saving?', { exact: true })).toBeVisible();
  await page.screenshot({
    animations: 'disabled',
    path: '/tmp/fauna-admin-after-unsaved-dialog.png',
  });
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(headline).toHaveValue('A calmer garden');
  failSaves = false;
  await page.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect(page.getByText('Changes saved', { exact: true })).toBeVisible();

  // Revision conflicts update the baseline without replacing the user's edit.
  completedCampaign.revision += 1;
  await headline.fill('A garden worth staying in');
  await headline.blur();
  await expect(
    page.getByText(
      'This campaign changed elsewhere. Your edit is kept here. Review it, then retry to save it.',
    ),
  ).toBeVisible();
  await expect(headline).toHaveValue('A garden worth staying in');
  await page.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect(page.getByText('Changes saved', { exact: true })).toBeVisible();
  expect(completedCampaign.copy.en.headline).toBe('A garden worth staying in');

  // Tag creation uses the framework dialog and persists the entered name, never its option ID.
  const tagField = page.locator('cx-tag-field');
  await tagField.getByRole('combobox').click();
  await page.getByText('Create tag', { exact: true }).click();
  const tagDialog = page.getByRole('alertdialog', { name: 'Create tag' });
  await expect(tagDialog).toBeVisible();
  await tagDialog.getByRole('textbox', { name: 'Name', exact: true }).fill('#WaterGarden');
  await page.screenshot({ animations: 'disabled', path: '/tmp/fauna-admin-tag-dialog.png' });
  await tagDialog.getByRole('button', { name: 'Create tag', exact: true }).click();
  await expect(tagDialog).toBeHidden();
  await expect(tagField.getByText('#WaterGarden', { exact: true })).toBeVisible();
  await expect(page.getByText('Changes saved', { exact: true })).toBeVisible();
  expect(completedCampaign.copy.en.hashtags).toContain('#WaterGarden');
  expect(saved?.field).toBe('hashtags');
  expect(saved?.value).toContain('#WaterGarden');

  // Keyboard section navigation follows the framework's tab behavior.
  await page.getByRole('tab', { name: 'Copy', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Image prompts', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByRole('tab', { name: 'Image prompts', exact: true }).click();
  const promptRow = page.getByRole('region', { name: 'Straight photograph', exact: true });
  await expect(promptRow).toHaveCount(1);
  await promptRow
    .getByRole('button', { name: 'Inspect Straight photograph prompt', exact: true })
    .click();
  const promptDialog = page.getByRole('dialog', { name: 'Straight photograph' });
  await expect(promptDialog).toBeVisible();
  await expect(
    promptDialog.getByText('A natural swimming pond in a Swedish garden.'),
  ).toBeVisible();
  await expect(promptDialog.getByText('No HDR tone mapping', { exact: false })).toBeVisible();
  await page.screenshot({ animations: 'disabled', path: '/tmp/fauna-admin-after-prompts.png' });
  await promptDialog.getByRole('button', { name: 'Close', exact: true }).click();
  await promptRow
    .getByRole('button', { name: 'Copy Straight photograph prompt', exact: true })
    .click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    'No HDR tone mapping',
  );

  await campaignLocation.getByRole('button', { name: 'Campaign Studio', exact: true }).click();
  await expect(page.getByText('Water for a smaller garden', { exact: true })).toBeVisible();
  await page.screenshot({
    animations: 'disabled',
    path: '/tmp/fauna-admin-after-list-populated.png',
  });
  await page.getByText('A natural place to swim', { exact: true }).click();
  await expect(headline).toHaveValue('A garden worth staying in');
  await expect(
    page.locator('cx-tag-field').getByText('#WaterGarden', { exact: true }),
  ).toBeVisible();
  // Refinement keeps imperfect edits, recovers its immutable draft after reload, and applies one result.
  const refineButton = page.getByRole('button', { name: 'Refine', exact: true });
  const refineTooltip = page.getByRole('tooltip').filter({
    hasText: 'Improve your edits while preserving their intent',
  });
  await refineButton.hover();
  await expect(refineTooltip).toBeVisible();
  await page.screenshot({ animations: 'disabled', path: '/tmp/fauna-refine-tooltip.png' });
  await page.keyboard.press('Escape');
  await expect(refineTooltip).toHaveCount(0);
  await page.mouse.move(0, 0);
  await refineButton.focus();
  await expect(refineTooltip).toBeVisible();
  await page.keyboard.press('Escape');
  const intentionalDraft =
    'A quiet garden where we can swim together and make room for the whole family';
  failSaves = true;
  await headline.fill(intentionalDraft);
  await page.getByRole('button', { name: 'Refine', exact: true }).click();
  await expect.poll(() => refinementPayload?.draft.headline).toBe(intentionalDraft);
  await expect(page.getByRole('button', { name: 'Refine', exact: true })).toBeDisabled();
  await expect(headline).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Swedish', exact: true })).toBeDisabled();
  expect(refinementCalls).toBe(1);
  refinementState = 'failed';
  await expect(
    page.getByText('Synthetic refinement failed. Your draft is kept.', { exact: true }),
  ).toBeVisible();
  await expect(headline).toHaveValue(intentionalDraft);
  await expect(headline).toBeEnabled();
  failSaves = false;
  await page.getByRole('button', { name: 'Refine', exact: true }).click();
  await expect.poll(() => refinementCalls).toBe(2);
  await page.reload();
  await expect(headline).toHaveValue(intentionalDraft);
  await expect(headline).toBeDisabled();
  refinementState = 'succeeded';
  await expect(headline).toHaveValue('A quieter garden to swim in');
  await expect(headline).toBeEnabled();
  const refinementAlert = page.locator('cx-alert').filter({ hasText: 'Copy refined' });
  await expect(refinementAlert).toContainText(refinementSummary);
  const alertBounds = await refinementAlert.boundingBox();
  const headlineBounds = await headline.boundingBox();
  expect(alertBounds!.y + alertBounds!.height).toBeLessThan(headlineBounds!.y);
  await page.screenshot({ animations: 'disabled', path: '/tmp/fauna-admin-refined.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(refinementAlert).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ animations: 'disabled', path: '/tmp/fauna-admin-refined-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.getByRole('button', { name: 'Swedish', exact: true }).click();
  await expect(headline).toHaveValue('Bada i en lugnare trädgård');
  await expect(
    page.getByText('A separate Swedish explanation must not be shown.', { exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await refinementAlert.getByRole('button', { name: 'Dismiss Copy refined', exact: true }).click();
  await expect(refinementAlert).toHaveCount(0);
  await expect(headline).toHaveValue('A quieter garden to swim in');
  expect(refinementCalls).toBe(2);
  await expect(page.getByRole('button', { name: 'Campaign actions', exact: true })).toHaveCount(0);
  await expect(page.getByText('Delete campaign', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Account actions for Admin' }).click();
  await page.getByText('Log out', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('a fresh browser session recovers failed work before its campaign row exists', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const campaignId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  let retryRunning = true;
  let retryPayload: unknown;

  await page.route('**/api/admin/generations', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        generations: [
          {
            campaignId,
            campaignRevision: 0,
            error: {
              code: 'provider_create_ambiguous',
              message: 'The provider may have received the first request. Review and retry it.',
            },
            jobId: 'recovered-browser-job',
            stage: 'strategy',
            state: 'ambiguous',
            updatedAt: '2026-08-25T11:00:00.000Z',
          },
        ],
      },
    });
  });
  await page.route(`**/api/admin/campaigns/${campaignId}/retry`, async (route) => {
    retryPayload = route.request().postDataJSON();
    await route.fulfill({
      contentType: 'application/json',
      json: {
        generation: {
          campaignId,
          campaignRevision: 0,
          jobId: 'retried-browser-job',
          state: 'queued',
        },
      },
      status: 202,
    });
  });
  await page.route(`**/api/admin/campaigns/${campaignId}/status`, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        status: {
          campaignId,
          campaignRevision: 0,
          error: { code: 'synthetic_retry_failure', message: 'Synthetic retry stopped.' },
          jobId: 'retried-browser-job',
          stage: 'strategy',
          state: retryRunning ? 'running' : 'failed',
          updatedAt: '2026-08-25T11:01:00.000Z',
        },
      },
    });
  });

  await page.goto('/admin');
  await page.getByRole('textbox', { name: 'Username' }).fill('faunapoolen-e2e-owner');
  await page.getByRole('textbox', { name: 'Password' }).fill('faunapoolen-e2e-owner-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(
    page.getByText('The provider may have received the first request. Review and retry it.'),
  ).toBeVisible();
  await page.screenshot({
    animations: 'disabled',
    path: '/tmp/fauna-admin-after-generation-error.png',
  });
  await page.getByRole('button', { name: 'Retry this stage' }).click();
  await expect.poll(() => retryPayload).toEqual({ expectedRevision: 0, stage: 'strategy' });
  await expect(page.getByText('Creating strategy', { exact: true })).toBeVisible();
  await page.screenshot({ animations: 'disabled', path: '/tmp/fauna-admin-after-generating.png' });
  retryRunning = false;
  await expect(page.getByText('Synthetic retry stopped.', { exact: true })).toBeVisible();
});

test('unknown route returns 404', async ({ page }) => {
  const res = await page.goto('/nope');
  expect(res?.status()).toBe(404);
});

test('admin distinguishes loading and failure from an empty collection and preserves a rough idea', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  let releaseList!: () => void;
  const listGate = new Promise<void>((resolve) => {
    releaseList = resolve;
  });
  let listFailed = true;
  await page.route('**/api/admin/campaigns', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 503,
        json: { error: { message: 'Campaign generation is currently disabled.' } },
      });
      return;
    }
    await listGate;
    await route.fulfill(
      listFailed
        ? { status: 503, json: { error: { message: 'Campaigns are unavailable.' } } }
        : { json: { campaigns: [] } },
    );
  });
  await page.goto('/admin');
  await page.screenshot({ animations: 'disabled', path: '/tmp/fauna-admin-after-login.png' });
  await page.getByRole('textbox', { name: 'Username' }).fill('faunapoolen-e2e-owner');
  await page.getByRole('textbox', { name: 'Password' }).fill('faunapoolen-e2e-owner-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Loading campaigns', { exact: true })).toBeVisible();
  await page.screenshot({ animations: 'disabled', path: '/tmp/fauna-admin-after-loading.png' });
  releaseList();
  await expect(page.getByText('Campaigns could not be loaded', { exact: true })).toBeVisible();
  await expect(page.getByText('No campaigns yet', { exact: true })).toHaveCount(0);
  await page.screenshot({ animations: 'disabled', path: '/tmp/fauna-admin-after-list-error.png' });
  listFailed = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByText('No campaigns yet', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create campaign', exact: true }).click();
  const idea = page.getByRole('textbox', { name: 'Your rough idea', exact: true });
  await idea.fill('A garden with room for quiet afternoons by the water.');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Create campaign', exact: true }).click();
  await expect(idea).toHaveValue('A garden with room for quiet afternoons by the water.');
  const compose = page
    .getByRole('alertdialog')
    .filter({ hasText: 'Describe what you want to communicate' });
  await compose.getByRole('button', { name: 'Create campaign', exact: true }).click();
  await expect(
    page.getByText('Campaign generation is currently disabled.', { exact: true }),
  ).toBeVisible();
  await expect(idea).toHaveValue('A garden with room for quiet afternoons by the water.');
  await page.screenshot({
    animations: 'disabled',
    path: '/tmp/fauna-admin-after-create-error.png',
  });
});
