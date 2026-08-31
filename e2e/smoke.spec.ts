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
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
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
    fullCaption: `${primaryText} We walk the site with you and plan the first step.`,
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
      guidance: `Lead the ${field} with the outcome, not the product.`,
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
  let saved: unknown;

  const completedCampaign = {
    ...campaign,
    stage: 'complete' as const,
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
    ],
  };

  await page.route('**/api/admin/campaigns', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
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
    if (url.pathname.endsWith('/status')) {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          status: {
            campaignId: campaign.id,
            campaignRevision: completedCampaign.revision,
            jobId: 'synthetic-browser-job',
            stage: 'prompts',
            state: 'succeeded',
            updatedAt: completedCampaign.updatedAt,
          },
        },
      });
      return;
    }
    if (url.pathname.endsWith('/copy') && route.request().method() === 'PATCH') {
      saved = route.request().postDataJSON();
      await route.fulfill({
        contentType: 'application/json',
        json: { ok: true, revision: 4, updatedAt: '2026-08-08T09:01:00.000Z' },
      });
      return;
    }
    await route.fallback();
  });

  await page.route(`**/api/admin/campaigns/${campaign.id}`, async (route) => {
    await route.fulfill({ contentType: 'application/json', json: { campaign: completedCampaign } });
  });

  await page.goto('/admin');

  await expect(page.locator('html')).toHaveClass(/theme-night/);
  await expect(page.locator('nav.navigation')).toHaveCount(0);
  await expect(page.getByText('Sign in to open your tools.')).toBeVisible();

  await page.getByRole('textbox', { name: 'Username' }).fill('faunapoolen-e2e-owner');
  await page.getByRole('textbox', { name: 'Password' }).fill('faunapoolen-e2e-owner-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Campaigns' })).toBeVisible();

  // Creating a campaign is a dialog over the list, not a separate page.
  await page.getByRole('button', { name: 'Create campaign' }).click();
  const dialog = page.locator('.cx-dialog').filter({ hasText: 'Write the idea exactly' });
  await expect(dialog).toBeVisible();
  await page.getByRole('textbox', { name: 'Your rough idea' }).fill(roughIdea);
  await dialog.getByRole('button', { name: 'Create campaign' }).click();
  await expect(dialog).toBeHidden();

  expect(createPayload).toEqual({ idea: roughIdea });

  // The campaign name is the page heading — there is no second h1 below it.
  await expect(page.getByRole('heading', { name: 'A natural place to swim' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

  // Two language tabs, never a platform tab. English leads and is the default.
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(2);
  await expect(tabs.first()).toHaveText('English');
  await expect(page.getByRole('tab', { selected: true })).toHaveText('English');

  // Six prefilled, editable fields — not a read-only table.
  const headline = page.getByRole('textbox', { name: 'Headline' });
  await expect(headline).toHaveValue('A garden you can swim in');
  await expect(page.getByRole('textbox', { name: 'Primary text' })).toHaveValue(
    'Swim at home without turning the garden into a building site.',
  );

  // Guidance sits under the field, with the count on the same discreet line and no meter.
  await expect(
    page.getByText('Lead the headline with the outcome, not the product. · 24/27'),
  ).toBeVisible();
  await expect(page.locator('cx-budget')).toHaveCount(0);

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

  // Going past the budget replaces the guidance with a correction rather than stacking both.
  const tooLong = 'A garden you can swim in every single summer';
  await headline.fill(tooLong);
  await expect(
    page.getByText(`${tooLong.length} characters. This campaign is written to 27.`),
  ).toBeVisible();
  await expect(
    page.getByText('Lead the headline with the outcome, not the product. · 24/27'),
  ).toHaveCount(0);

  // The Swedish tab swaps only the copy.
  await page.getByRole('tab', { name: 'Svenska' }).click();
  await expect(page.getByRole('textbox', { name: 'Headline' })).toHaveValue(
    'En badplats som hör hemma',
  );

  // Image prompts are copy-only rows: the prompt is machine input, so the row shows its concept
  // and alt text and the whole prompt goes to the clipboard.
  const promptRow = page.locator('cx-item-card').filter({ hasText: 'Straight photograph' });
  await expect(promptRow).toHaveCount(1);
  await expect(promptRow).toContainText('A natural swimming pond in a Swedish garden.');
  await expect(page.getByText('No HDR tone mapping')).toHaveCount(0);
  await promptRow.getByRole('button', { name: /Copy the Straight photograph prompt/ }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    'No HDR tone mapping',
  );

  await page.getByRole('button', { name: 'Account actions for Admin' }).click();
  await page.getByText('Log out', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('a fresh browser session recovers failed work before its campaign row exists', async ({
  page,
}) => {
  const campaignId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
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
          state: 'failed',
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
  await page.getByRole('button', { name: 'Retry this stage' }).click();
  await expect.poll(() => retryPayload).toEqual({ expectedRevision: 0, stage: 'strategy' });
});

test('unknown route returns 404', async ({ page }) => {
  const res = await page.goto('/nope');
  expect(res?.status()).toBe(404);
});
