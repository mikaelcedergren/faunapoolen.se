import { expect, test } from '@playwright/test';

test('FAQ answers open by keyboard and language changes keep the FAQ page', async ({ page }) => {
  await page.goto('/en/faq/');
  const first = page.getByRole('button', {
    name: 'Could a nature pool work in my garden?',
    exact: true,
  });
  await first.press('Enter');
  await expect(first).toHaveAttribute('aria-expanded', 'true');
  await expect(
    page.getByText(
      'We assess available space, access for construction, ground conditions and levels. You can start with a conversation about your garden before deciding on a design.',
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'How much space does a nature pool need?', exact: true })
    .click();
  await expect(first).toHaveAttribute('aria-expanded', 'false');
  await page
    .locator('cx-masthead')
    .getByRole('button', { name: 'Language: English', exact: true })
    .click();
  await page.getByRole('option', { name: /Svenska/ }).click();
  await expect(page).toHaveURL(/\/faq\/?$/);
  await expect(
    page.getByRole('heading', { name: 'Vanliga frågor om naturpooler', exact: true }),
  ).toBeVisible();
  await page
    .locator('cx-masthead')
    .getByRole('button', { name: 'Språk: Svenska', exact: true })
    .click();
  await page.getByRole('option', { name: /Dansk/ }).click();
  await expect(page).toHaveURL(/\/da\/faq\/?$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'da');
  await expect(page.locator('cx-list-item')).toHaveCount(15);
});

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

test('mobile footer language selector keeps the article and includes Danish without horizontal overflow', async ({
  page,
}) => {
  const errors: string[] = [];
  await page.setViewportSize({ width: 390, height: 844 });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/blog/posts/build-your-own-nature-pool.html');
  await page.getByRole('button', { name: 'Avvisa', exact: true }).click();
  await expect(page).toHaveURL(/\/blog\/posts\/build-your-own-nature-pool.html$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'sv');
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
    .toBeLessThanOrEqual(0);
  await page.locator('footer').getByRole('button', { name: 'Språk: Svenska', exact: true }).click();
  await page.getByRole('option', { name: /Dansk/ }).click();
  await expect(page).toHaveURL(/\/da\/blog\/posts\/build-your-own-nature-pool.html$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'da');
  await page.locator('footer').getByRole('button', { name: 'Sprog: Dansk', exact: true }).click();
  await page.getByRole('option', { name: /English/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#guide-body')).toBeVisible();
  await expect(page).toHaveURL(/\/en\/blog\/posts\/build-your-own-nature-pool.html$/);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
    .toBeLessThanOrEqual(0);
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
  await expect(page.getByText('Enter your name.', { exact: true })).toBeVisible();
  await expect(page.getByText('Enter your email address.', { exact: true })).toBeVisible();
  await expect(page.getByText('Enter your town or postcode.', { exact: true })).toBeVisible();
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
  await page.goto('/en/admin/customers');
  await page.getByRole('textbox', { name: 'Username', exact: true }).fill('faunapoolen-e2e-owner');
  await page.locator('input[name="password"]').fill('faunapoolen-e2e-owner-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('cx-side-nav')).toBeVisible();
  await page.getByText(name, { exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mark contacted', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mark contacted', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
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

test('Gotland videos load only when their still image is activated', async ({ page }) => {
  const playerRequests: string[] = [];
  await page.route('https://player.vimeo.com/video/**', async (route) => {
    playerRequests.push(route.request().url());
    await route.fulfill({
      contentType: 'text/html',
      body: '<html><body>Video fixture</body></html>',
    });
  });
  await page.goto('/en/projects/gotland/');
  const films = page.locator('fp-gotland-film');
  await expect(films).toHaveCount(4);
  await expect(films.locator('iframe')).toHaveCount(0);
  await expect(films.getByRole('button', { name: /^Play video:/ })).toHaveCount(4);
  expect(playerRequests).toEqual([]);

  for (let index = 0; index < 4; index++) {
    const film = films.nth(index);
    const trigger = film.getByRole('button', { name: /^Play video:/ });
    await trigger.scrollIntoViewIfNeeded();
    await expect(trigger.locator('img')).toHaveJSProperty('naturalWidth', 1280);
    if (index === 0) {
      // Activating the picture away from the central icon still starts this film.
      await trigger.click({ position: { x: 20, y: 100 } });
    } else {
      await trigger.press(index === 1 ? 'Space' : 'Enter');
    }
    await expect(trigger).toHaveCount(0);
    await expect(film.locator('iframe')).toBeVisible();
    // Headless cross-origin frames can make document.hasFocus() false even when
    // focus was correctly handed from the removed poster to the player.
    await expect
      .poll(() =>
        film.locator('iframe').evaluate((frame) => frame.ownerDocument.activeElement === frame),
      )
      .toBe(true);
    await expect.poll(() => playerRequests.length).toBe(index + 1);
    const url = new URL(playerRequests[index]);
    expect(url.searchParams.get('autoplay')).toBe('1');
    for (const key of ['title', 'byline', 'portrait']) {
      expect(url.searchParams.get(key)).toBe('0');
    }
  }
});

test('Gotland keeps landscape films beside their stories and the lightbox limited to photographs', async ({
  page,
}) => {
  await page.goto('/en/projects/gotland/');
  await expect(page.locator('fp-gotland-film')).toHaveCount(4);
  await expect(page.locator('iframe[src*="1226470011"]')).toHaveCount(0);
  await expect(page.locator('cx-masonry iframe')).toHaveCount(0);
  await expect(page.locator('cx-masonry [data-gotland-photo]')).toHaveCount(10);
  await expect(page.locator('main blockquote')).toHaveCount(1);
  await expect(page.locator('.fp-project-quote figcaption')).toHaveText('From Brita');
  await expect(page.getByRole('link', { name: 'Open on Vimeo' })).toHaveCount(0);
  // Before hydration this is deliberately a normal link to the full photograph.
  // Prove the app is interactive before asserting its enhanced lightbox behavior.
  await page
    .locator('cx-masthead')
    .getByRole('button', { name: 'Language: English', exact: true })
    .click();
  await expect(page.getByRole('option', { name: /Svenska/ })).toBeVisible();
  await page.keyboard.press('Escape');
  const photo = page.locator('[data-gotland-photo="1455"]');
  await photo.click();
  const lightbox = page.getByRole('dialog');
  await expect(lightbox).toBeVisible();
  await expect(lightbox.locator('img')).toHaveAttribute('src', /1455\.webp$/);
  await page.getByRole('button', { name: 'Next image', exact: true }).click();
  await expect(lightbox.locator('img')).toHaveAttribute('src', /1496\.webp$/);
  await page.keyboard.press('Escape');
  await expect(lightbox).toBeHidden();
});

test('informational pages do not fetch the pool catalogue', async ({ page }) => {
  const packageRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/packages') packageRequests.push(request.url());
  });
  for (const route of ['/en/about/', '/en/blog/', '/en/cookies/', '/en/projects/gotland/']) {
    await page.goto(route);
    // Opening a real control proves client initialization has completed.
    await page
      .locator('cx-masthead')
      .getByRole('button', { name: 'Language: English', exact: true })
      .click();
    await expect(page.getByRole('option', { name: /Svenska/ })).toBeVisible();
    expect(packageRequests, route).toEqual([]);
  }
  await page.goto('/en/nature-pools/pricing/');
  await expect(page.locator('fp-package-comparison .fp-package')).toHaveCount(3);
  expect(packageRequests).toHaveLength(1);
});
