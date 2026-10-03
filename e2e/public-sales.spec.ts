import { expect, test } from '@playwright/test';

for (const [path, heading, cta, contact] of [
  [
    '/en/',
    'Make your garden the best part of being home.',
    'Request a consultation',
    '/en/configure/',
  ],
  ['/', 'Gör trädgården till hemmets bästa plats.', 'Be om rådgivning', '/configure/'],
  ['/da/', 'Gør haven til hjemmets bedste sted.', 'Bed om rådgivning', '/da/configure/'],
]) {
  test(`the ${path} sales story leads to a consultation without choosing a pool`, async ({
    page,
  }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    await page.locator('.fp-home-opening').getByRole('link', { name: cta, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(contact.replace(/\/$/, '') + '/?$'));
    await expect(page.locator('form input')).toHaveCount(4);
    await expect(page.locator('form cx-dropdown')).toHaveCount(1);
    await expect(page.locator('form textarea')).toBeEnabled();
    await expect(page.locator('form button[type="submit"]')).toBeEnabled();
  });
}

for (const [entry, linkName, index, service, packageId] of [
  ['/en/nature-pools/', 'Enquire about this pool', 1, 'pool', 'summer'],
  ['/en/nature-pools/pricing/', 'Enquire about this pool', 1, 'pool', 'summer'],
  ['/en/waterscapes/', 'Ask us about this', 1, 'stream', 'unsure'],
] as const) {
  test(`${entry} interest reaches the inbox without purchase configuration`, async ({ page }) => {
    await page.goto(entry);
    await page.getByRole('link', { name: linkName, exact: true }).nth(index).click();
    await expect(page).toHaveURL(
      service === 'pool'
        ? new RegExp(entry.replace(/\/$/, '') + '/?\\?package=summer#consultation$')
        : /\/en\/configure\/\?/,
    );
    await page
      .getByRole('textbox', { name: 'Name', exact: true })
      .fill(`Synthetic ${service} consultation`);
    await page.getByRole('textbox', { name: 'Email', exact: true }).fill(`${service}@example.test`);
    await page
      .getByRole('textbox', { name: 'Town or postcode', exact: true })
      .fill('Synthetic garden');
    const received = page.waitForResponse(
      (r) => r.url().endsWith('/api/enquiries') && r.request().method() === 'POST',
    );
    await page
      .getByRole('button', {
        name: 'Send enquiry',
        exact: true,
      })
      .click();
    const response = await received;
    expect(response.status()).toBe(201);
    const payload = response.request().postDataJSON();
    expect(payload.formVersion).toMatch(/^consultation/);
    expect(payload.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'location', value: 'Synthetic garden' }),
        expect.objectContaining({
          id: 'service',
          value: service === 'pool' ? 'Nature pool' : 'Stream or waterfall',
        }),
      ]),
    );
    if (packageId === 'summer')
      expect(payload.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'package', value: 'Swim together' }),
        ]),
      );
    await expect(page.getByText('Your enquiry has been received', { exact: true })).toBeVisible();
    await expect(page.getByRole('textbox')).toHaveCount(0);
  });
}

for (const prefix of ['', '/en', '/da']) {
  test(`${prefix || '/'} homepage project preview leads to the Gotland story`, async ({ page }) => {
    await page.goto(prefix + '/');
    const preview = page.locator('fp-gotland-preview');
    const destination = prefix + '/projects/gotland/';
    await expect(preview.locator('.fp-project-detail')).toHaveCount(3);
    await expect(preview.locator('fp-gotland-gallery')).toHaveCount(0);
    await expect(preview.getByRole('button')).toHaveCount(0);
    for (const link of await preview.getByRole('link').all()) {
      await expect(link).toHaveAttribute('href', destination);
    }
    await preview.locator('.fp-project-detail a').first().click();
    await expect(page).toHaveURL(new RegExp(destination.replace(/\/$/, '') + '/?$'));
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test(`${prefix || '/'} pool gallery opens in place and returns to its trigger`, async ({
    page,
  }) => {
    await page.goto(prefix + '/nature-pools/');
    await expect(page.locator('form textarea')).toBeEnabled();
    const originalUrl = page.url();
    const preview = page.locator('fp-gotland-preview');
    await expect(page.locator('fp-certification-strip')).toHaveCount(1);
    await expect(page.locator('.fp-pool-figure figcaption')).toHaveCount(0);
    await expect(preview.locator('.fp-case-label')).toHaveCount(0);

    const photo = preview.locator('a[href$="1455.webp"]');
    await photo.click();
    const lightbox = page.getByRole('dialog');
    await expect(lightbox).toBeVisible();
    await expect(lightbox.locator('img')).toHaveAttribute('src', /1455\.webp$/);
    await page.keyboard.press('ArrowRight');
    await expect(lightbox.locator('img')).toHaveAttribute('src', /1496\.webp$/);
    await page.keyboard.press('Escape');
    await expect(lightbox).toBeHidden();
    await expect(photo).toBeFocused();
    await expect(page).toHaveURL(originalUrl);

    const galleryButton = preview.locator('cx-card').getByRole('button');
    await galleryButton.click();
    await expect(lightbox.locator('img')).toHaveAttribute('src', /1528\.webp$/);
    await page.keyboard.press('Escape');
    await expect(galleryButton).toBeFocused();
    await expect(page).toHaveURL(originalUrl);
  });

  test(`${prefix || '/'} pool landing pages keep visitors on the enquiry journey`, async ({
    page,
  }) => {
    for (const suffix of ['/nature-pools/', '/nature-pools/pricing/']) {
      await page.goto(prefix + suffix);
      await expect(
        page.locator(
          'main a[href*="/blog/"], main a[href*="/waterscapes/"], main a[href*="/projects/"], main a[href*="aquascapeinc.com"], main a[href*="youtube.com"]',
        ),
      ).toHaveCount(0);
      await expect(
        page.locator('cx-masthead a[href*="/blog/"]').filter({ visible: true }),
      ).toHaveCount(1);
      await expect(page.locator('fp-package-comparison .fp-package')).toHaveCount(3);
      await expect(page.locator('cx-hero a').first()).toBeVisible();
      const question = page.locator('cx-list-item').first().getByRole('button').first();
      await question.click();
      await expect(question).toHaveAttribute('aria-expanded', 'true');
      for (const answer of await page.locator('cx-list-item').first().locator('p').all()) {
        await expect(answer).toBeVisible();
      }
      await page.locator('cx-hero a').first().click();
      if (suffix === '/nature-pools/') {
        await expect(page).toHaveURL(new RegExp(prefix + '/nature-pools/?#consultation$'));
        await expect(page.locator('form cx-dropdown')).toHaveCount(0);
        await expect(page.locator('fp-nature-pool-benefits')).toHaveCount(0);
        await expect(
          page.locator('#how-it-works figure img, #garden-layout figure img'),
        ).toHaveCount(2);
        await expect(page.locator('fp-gotland-preview .fp-project-detail')).toHaveCount(3);
        await expect(page.locator('#pool-care img')).toHaveCount(0);
        await expect(page.locator('fp-gotland-preview blockquote')).toBeVisible();
      } else {
        await expect(page).toHaveURL(new RegExp(prefix + '/nature-pools/pricing/?#consultation$'));
        await expect(page.locator('form cx-dropdown')).toHaveCount(0);
        await expect(page.locator('.fp-package-illustration')).toHaveCount(3);
      }
      await expect(page.locator('form textarea')).toBeEnabled();
    }
  });
}

test('the inline enquiry keeps contact details when changing pool preference', async ({ page }) => {
  await page.goto('/en/nature-pools/');
  await page.locator('cx-hero a').first().click();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Synthetic retained name');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('retained@example.test');
  await page
    .getByRole('textbox', { name: 'Town or postcode', exact: true })
    .fill('Synthetic garden');
  await page.getByRole('link', { name: 'Enquire about this pool', exact: true }).nth(1).click();
  await expect(page).toHaveURL(/nature-pools\/?\?package=summer#consultation$/);
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toBeFocused();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(
    'Synthetic retained name',
  );
  await expect(page.getByRole('combobox')).toHaveCount(1);
  await expect(page.getByRole('combobox')).toContainText('Swim together');
  await page.locator('cx-masthead').getByRole('link', { name: 'Contact us', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toHaveValue(
    'retained@example.test',
  );
  // Wait for the anchor scroll to settle before opening a viewport-positioned menu.
  await expect(page.getByRole('combobox')).toBeInViewport();
  let previousScroll: number | undefined;
  let stableSamples = 0;
  await expect
    .poll(async () => {
      const scroll = await page.evaluate(() => window.scrollY);
      stableSamples = scroll === previousScroll ? stableSamples + 1 : 0;
      previousScroll = scroll;
      return stableSamples;
    })
    .toBeGreaterThanOrEqual(2);
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Not decided yet', exact: true }).click();
  await expect(page.locator('form cx-dropdown')).toHaveCount(0);
  const received = page.waitForResponse(
    (r) => r.url().endsWith('/api/enquiries') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Send enquiry', exact: true }).click();
  const response = await received;
  expect(response.status()).toBe(201);
  expect(response.request().postDataJSON().fields).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: 'package', value: 'Not decided yet' })]),
  );
  await expect(page.getByText('Your enquiry has been received', { exact: true })).toBeVisible();
});

test('an inline enquiry recovers from an interrupted receipt without creating a second request', async ({
  page,
}) => {
  await page.goto('/en/nature-pools/');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Synthetic inline retry');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('retry@example.test');
  await page
    .getByRole('textbox', { name: 'Town or postcode', exact: true })
    .fill('Synthetic garden');
  const requests: string[] = [];
  let releaseDelivery!: () => void;
  const deliveryGate = new Promise<void>((resolve) => {
    releaseDelivery = resolve;
  });
  await page.route('**/api/enquiries', async (route) => {
    requests.push(route.request().postDataJSON().requestId);
    if (requests.length === 1) {
      await deliveryGate;
      await route.fetch();
      await route.abort();
    } else await route.continue();
  });
  const submit = page.getByRole('button', {
    name: 'Send enquiry',
    exact: true,
  });
  await submit.click();
  await expect(page.locator('form button[type="submit"]')).toBeDisabled();
  await page.screenshot({ animations: 'disabled', path: '/tmp/fauna-pool-enquiry-sending.png' });
  releaseDelivery();
  await expect(
    page.getByText(
      'We couldn’t confirm receipt. Your details are still here. Send again to safely retry the same enquiry.',
    ),
  ).toBeInViewport();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(
    'Synthetic inline retry',
  );
  await page.screenshot({ animations: 'disabled', path: '/tmp/fauna-pool-enquiry-retry.png' });
  await submit.click();
  await expect(page.getByText('Your enquiry has been received', { exact: true })).toBeVisible();
  await page.screenshot({ animations: 'disabled', path: '/tmp/fauna-pool-enquiry-received.png' });
  expect(requests).toHaveLength(2);
  expect(requests[1]).toBe(requests[0]);
});

test('pricing keeps the selected pool and VAT-exclusive price through reload', async ({ page }) => {
  await page.goto('/en/nature-pools/pricing/');
  const comparison = page.locator('fp-package-comparison');
  await expect(comparison).toContainText('430,000');
  await expect(comparison).toContainText('1,100,000');
  await expect(comparison).toContainText('4,400,000');
  await expect(comparison).toContainText('excl. VAT and shipping');
  await comparison
    .getByRole('link', { name: 'Enquire about this pool', exact: true })
    .nth(1)
    .click();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toBeFocused();
  await expect(page.locator('form cx-dropdown')).toContainText('Swim together');
  await page.reload();
  await expect(page.locator('form cx-dropdown')).toContainText('Swim together');
  await page.locator('form cx-dropdown').getByRole('combobox').click();
  await expect(page.getByRole('option', { name: /Swim together/ })).toContainText('1,100,000');
  await page.keyboard.press('Escape');
  const call = page.locator('fp-direct-contact a[href^="tel:"]');
  await expect(call).toHaveAttribute('href', 'tel:+46735406757');
  const electricity = page.getByRole('button', {
    name: 'What does the electricity cost?',
    exact: true,
  });
  await electricity.focus();
  await page.keyboard.press('Enter');
  await expect(electricity).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText(/Calculated for 200–400 W/)).toBeVisible();
});
