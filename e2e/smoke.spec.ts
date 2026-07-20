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

test('admin signs in and builds five explained ad suggestions', async ({ page }) => {
  const ads = Array.from({ length: 5 }, (_, index) => ({
    headline: `Customer outcome ${index + 1}`,
    text: 'A focused problem, a simple solution, and a clear next step for the customer.',
    callToAction: 'Book a consultation',
    whyItWorks: 'The customer leads the story and the brand acts as a helpful guide.',
  }));
  await page.route('**/admin-auth/ad-builder', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        source: {
          url: 'https://example.com/',
          finalUrl: 'https://example.com/',
          title: 'Example offer',
          language: 'en',
        },
        limits: { headline: 40, text: 180, callToAction: 24, whyItWorks: 320 },
        ads,
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

  await expect(page.getByRole('heading', { name: 'Ad builder' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ad builder' })).toBeVisible();

  await page.getByLabel('Web address').fill('https://example.com/offer');
  await page.getByRole('button', { name: 'Generate ads' }).click();

  await expect(page.getByRole('heading', { name: 'Five ad directions' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy ad' })).toHaveCount(5);
  await expect(page.getByText('Why this works', { exact: true })).toHaveCount(5);

  await page.getByRole('button', { name: 'Account actions for Admin' }).click();
  await page.getByText('Log out', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});

test('unknown route returns 404', async ({ page }) => {
  const res = await page.goto('/nope');
  expect(res?.status()).toBe(404);
});
