import { expect, test } from '@playwright/test';

test('an interrupted receipt retries the same enquiry without losing its details', async ({
  page,
}) => {
  await page.goto('/en/configure/');
  await page
    .getByRole('textbox', { name: 'Name', exact: true })
    .fill('Synthetic interrupted enquiry');
  await page
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill('retry-browser@example.test');
  await page.locator('input[name="postal-code"]').fill('Synthetic retry garden');
  const references: string[] = [];
  await page.route('**/api/enquiries', async (route) => {
    references.push(route.request().postDataJSON().requestId);
    if (references.length === 1) {
      expect((await route.fetch()).status()).toBe(201);
      await route.abort('failed');
    } else await route.continue();
  });
  await page.getByRole('button', { name: 'Send enquiry', exact: true }).click();
  await expect(page.getByText(/We couldn’t confirm receipt/)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(
    'Synthetic interrupted enquiry',
  );
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Send enquiry', exact: true }).click();
  await expect(page.getByText('Your enquiry has been received', { exact: true })).toBeVisible();
  expect(references).toHaveLength(2);
  expect(references[0]).toBe(references[1]);
});

test.describe('unsupported browser language', () => {
  test.use({ locale: 'fr-FR' });
  test('suggests English without redirecting the Swedish article', async ({ page }) => {
    await page.goto('/blog/posts/build-your-own-nature-pool.html');
    await expect(
      page.locator('cx-alert').getByRole('link', { name: 'English', exact: true }),
    ).toHaveAttribute('href', '/en/blog/posts/build-your-own-nature-pool.html');
    await expect(page).toHaveURL(/\/blog\/posts\/build-your-own-nature-pool.html$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'sv');
  });
});

test('language links keep the article, never redirect by browser preference, and include Danish', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/blog/posts/build-your-own-nature-pool.html');
  await expect(page).toHaveURL(/\/blog\/posts\/build-your-own-nature-pool.html$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'sv');
  await page
    .getByRole('navigation', { name: 'Språk', exact: true })
    .getByRole('link', { name: 'Dansk' })
    .click();
  await expect(page).toHaveURL(/\/da\/blog\/posts\/build-your-own-nature-pool.html$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'da');
  await page
    .getByRole('navigation', { name: 'Sprog', exact: true })
    .getByRole('link', { name: 'English' })
    .click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#guide-body')).toBeVisible();
  await page.locator('a[href$="#guide-section-1"]').click();
  await expect(page).toHaveURL(
    /\/en\/blog\/posts\/build-your-own-nature-pool.html#guide-section-1$/,
  );
  await expect(page.locator('#guide-section-1')).toBeInViewport();
  await expect
    .poll(() =>
      page.locator('#guide-section-1').evaluate((heading) => heading.getBoundingClientRect().top),
    )
    .toBeGreaterThanOrEqual(64);
  expect(errors).toEqual([]);
});

test('an enquiry reaches the real private inbox and its saved status survives reload', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const name = 'Synthetic browser enquiry ' + Date.now();
  await page.goto('/en/configure/');
  // Exercise validation first; this also proves the SSR form is interactive before editing.
  await page.getByRole('button', { name: 'Send enquiry', exact: true }).click();
  await expect(page.getByText('Please complete this field.', { exact: true })).toHaveCount(3);
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(name);
  await page
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill('browser-inbox@example.test');
  await page.locator('input[name="postal-code"]').fill('Synthetic garden');
  const receipt = page.waitForResponse(
    (r) => r.url().endsWith('/api/enquiries') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Send enquiry', exact: true }).click();
  expect((await receipt).status()).toBe(201);
  expect(new URL(page.url()).search).toBe('');
  expect(errors).toEqual([]);
  await expect(page.getByText('Your enquiry has been received', { exact: true })).toBeVisible();
  await page.goto('/en/admin/enquiries');
  await page.getByRole('textbox', { name: 'Username', exact: true }).fill('faunapoolen-e2e-owner');
  await page.locator('input[name="password"]').fill('faunapoolen-e2e-owner-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('cx-side-nav')).toBeVisible();
  await page.getByText(name, { exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mark contacted', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mark contacted', exact: true })).toHaveCount(0);
  await page.reload();
  await page.getByText(name, { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mark contacted', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close enquiry', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reopen enquiry', exact: true })).toBeVisible();
});

for (const locale of ['en', 'sv', 'da'])
  test(`${locale} public pages fit a phone and return a real localised 404`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const prefix = locale === 'sv' ? '' : `/${locale}`;
    for (const path of [
      prefix + '/',
      prefix + '/blog/',
      prefix + '/blog/posts/difference-between-normal-pool-and-natural-pool.html',
    ]) {
      expect((await page.goto(path))?.status()).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      ).toBe(true);
    }
    expect((await page.goto(prefix + '/missing-page'))?.status()).toBe(404);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
  });
