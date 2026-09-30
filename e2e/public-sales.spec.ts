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
    await expect(page).toHaveURL(new RegExp(contact + '$'));
    await expect(page.locator('form input')).toHaveCount(4);
    await expect(page.locator('form cx-dropdown')).toHaveCount(1);
    await expect(page.locator('form textarea')).toBeEnabled();
    await expect(page.locator('form button[type="submit"]')).toBeEnabled();
  });
}

for (const [entry, linkName, index, service, packageId] of [
  ['/en/nature-pools/', 'Enquire about this pool', 1, 'pool', 'summer'],
  ['/en/waterscapes/', 'Ask us about this', 1, 'stream', 'unsure'],
] as const) {
  test(`${service} interest reaches the inbox without purchase configuration`, async ({ page }) => {
    await page.goto(entry);
    await page.getByRole('link', { name: linkName, exact: true }).nth(index).click();
    await expect(page).toHaveURL(/\/en\/configure\/\?/);
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
    await page.getByRole('button', { name: 'Send enquiry', exact: true }).click();
    const response = await received;
    expect(response.status()).toBe(201);
    expect(response.request().postDataJSON()).toMatchObject({
      service,
      packageId,
      siteId: 'unsure',
      sizeId: 'included',
      featureIds: [],
      annualCare: false,
    });
    await expect(page.getByText('Your enquiry has been received', { exact: true })).toBeVisible();
    await expect(page.getByRole('textbox')).toHaveCount(0);
  });
}
