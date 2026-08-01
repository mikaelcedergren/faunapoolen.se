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

test('admin signs in and builds an explained multi-platform campaign', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });

  const roughIdea =
    'Help homeowners see that a natural pool can feel like a calm part of the garden.';
  const platforms = [
    { id: 'facebook', label: 'Facebook', placement: 'Facebook feed', imageVariant: 'feed' },
    { id: 'instagram', label: 'Instagram', placement: 'Instagram feed', imageVariant: 'feed' },
    { id: 'linkedin', label: 'LinkedIn', placement: 'LinkedIn feed', imageVariant: 'feed' },
    {
      id: 'reels',
      label: 'Reels & TikTok',
      placement: 'Reels & TikTok · vertical',
      imageVariant: 'vertical',
    },
  ].map(({ id, label, placement, imageVariant }) => ({
    id,
    placement,
    hook: `${label}: create a natural place to swim`,
    body: 'Turn an uncertain garden idea into a calm, practical plan with Faunapoolen as your guide.',
    callToAction: 'Book a consultation',
    hashtags: id === 'instagram' ? ['#naturalpool', '#garden'] : [],
    imageVariant,
    platformFit: `The message is adapted to how customers use ${label}.`,
    coachNotes: [
      {
        principle: 'Character',
        appliedText: 'create a natural place to swim',
        explanation: 'The customer and their desired outcome lead the message.',
      },
      {
        principle: 'Guide',
        appliedText: 'with Faunapoolen as your guide',
        explanation: 'Faunapoolen helps without taking the customer’s place in the story.',
      },
    ],
  }));
  const visualDataUrl =
    'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22%3E%3Crect width=%22120%22 height=%22120%22 fill=%22%232f6f63%22/%3E%3C/svg%3E';
  let requestPayload: unknown;

  await page.route('**/admin-auth/ad-builder', async (route) => {
    requestPayload = route.request().postDataJSON();
    await route.fulfill({
      contentType: 'application/json',
      json: {
        idea: roughIdea,
        campaign: {
          name: 'A natural place to swim',
          coreIdea: 'Make a natural pool feel calm, useful and possible to begin.',
          audience: 'Homeowners who want swimming water that belongs in their garden.',
          desiredOutcome: 'A beautiful place to swim without a conventional pool expression.',
          singleMessage: 'Create a place to swim that feels like part of the garden.',
          assumptions: ['The next step is an initial consultation, not a direct purchase.'],
          story: {
            hero: 'The homeowner who wants a natural place to swim.',
            externalProblem: 'A conventional pool can feel separate from the garden.',
            internalProblem: 'The project feels difficult to begin without expert guidance.',
            guide: 'Faunapoolen makes the route from idea to plan understandable.',
            plan: ['Share the idea', 'Explore the site', 'Plan the next step'],
            callToAction: 'Book a consultation',
            failure: 'The idea remains uncertain and is postponed.',
            success: 'The garden gains a calm place for swimming and time together.',
          },
          visual: {
            concept: 'A natural swimming pond integrated into a green Swedish garden.',
            imagePrompt: 'A believable natural swimming pond in a Swedish garden.',
            altText: 'A natural swimming pond surrounded by a green garden.',
          },
          platforms,
        },
        visuals: [
          {
            id: 'feed',
            label: 'Feed image',
            aspectRatio: '1:1',
            mimeType: 'image/svg+xml',
            dataUrl: visualDataUrl,
            altText: 'A square natural-pool campaign visual.',
          },
          {
            id: 'vertical',
            label: 'Vertical image',
            aspectRatio: '9:16',
            mimeType: 'image/svg+xml',
            dataUrl: visualDataUrl,
            altText: 'A vertical natural-pool campaign visual.',
          },
        ],
      },
    });
  });

  await page.goto('/admin');

  await expect(page.locator('html')).toHaveClass(/theme-night/);
  await expect(page.locator('nav.navigation')).toHaveCount(0);
  await expect(page.getByText('Sign in to open your tools.')).toBeVisible();

  await page.getByLabel('Username').fill('dev');
  await page.getByLabel('Password', { exact: true }).fill('dev');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Campaign studio' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Campaign studio' })).toBeVisible();

  await page.getByRole('textbox', { name: 'Your rough campaign idea' }).fill(roughIdea);
  await page.getByRole('button', { name: 'Create my campaign' }).click();

  expect(requestPayload).toEqual({ idea: roughIdea });
  await expect(page.getByRole('heading', { name: 'A natural place to swim' })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(4);
  await expect(page.getByRole('article', { name: 'Facebook ad preview' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Why this version is written this way' }),
  ).toBeVisible();

  const reelsTab = page.getByRole('tab', { name: 'Reels / TikTok' });
  await reelsTab.click();
  await expect(page.getByRole('article', { name: 'Reels & TikTok ad preview' })).toBeVisible();
  await expect(page.getByText('Why it fits Reels & TikTok', { exact: true })).toBeVisible();

  const platformPanel = page.getByRole('tabpanel');
  await platformPanel.getByRole('button', { name: 'Copy ad' }).click();
  await expect(platformPanel.getByRole('button', { name: 'Copied' })).toBeVisible();
  await expect(platformPanel.getByRole('button', { name: 'Download image' })).toBeEnabled();

  await page.evaluate(() => window.dispatchEvent(new Event('scroll')));

  await page.getByRole('button', { name: 'Account actions for Admin' }).click();
  await page.getByText('Log out', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('unknown route returns 404', async ({ page }) => {
  const res = await page.goto('/nope');
  expect(res?.status()).toBe(404);
});
