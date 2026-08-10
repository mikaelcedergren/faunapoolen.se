import { expect, test } from '@playwright/test';

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

  for (const path of ['/admin/', '/en/admin/', '/admin-auth/session']) {
    const res = await request.fetch(path, { method: path.endsWith('session') ? 'POST' : 'GET' });
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
    idea: roughIdea,
    name: strategy.name,
    stage: 'strategy',
    strategy,
    copy: {},
    imagePrompts: [],
  };

  let createPayload: unknown;

  await page.route('**/admin-auth/campaigns/create', async (route) => {
    createPayload = route.request().postDataJSON();
    await route.fulfill({ contentType: 'application/json', json: { campaign } });
  });

  await page.route('**/admin-auth/campaigns/copy', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        campaign: {
          ...campaign,
          stage: 'copy',
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
        },
      },
    });
  });

  await page.route('**/admin-auth/campaigns/prompts', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        campaign: {
          ...campaign,
          stage: 'complete',
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
        },
      },
    });
  });

  await page.goto('/admin');

  await expect(page.locator('html')).toHaveClass(/theme-night/);
  await expect(page.locator('nav.navigation')).toHaveCount(0);
  await expect(page.getByText('Sign in to open your tools.')).toBeVisible();

  await page.getByRole('textbox', { name: 'Username' }).fill('dev');
  await page.getByRole('textbox', { name: 'Password' }).fill('dev');
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
  let saved: unknown;
  await page.route('**/admin-auth/campaigns/copy/save', async (route) => {
    saved = route.request().postDataJSON();
    await route.fulfill({ contentType: 'application/json', json: { ok: true } });
  });
  await headline.fill('A garden to swim in');
  await headline.blur();
  await expect
    .poll(() => saved)
    .toEqual({
      id: campaign.id,
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

test('unknown route returns 404', async ({ page }) => {
  const res = await page.goto('/nope');
  expect(res?.status()).toBe(404);
});
