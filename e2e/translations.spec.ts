import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import {
  PUBLIC_LANGUAGES,
  LANGUAGE_NAMES,
  LANGUAGE_ENGLISH_NAMES,
} from '../server/src/public-routes';

for (const language of ['it', 'es', 'pt', 'de', 'pl'] as const) {
  const copy = JSON.parse(
    readFileSync(new URL(`../src/locale/messages.${language}.json`, import.meta.url), 'utf8'),
  ).translations;
  test(`${language}: translated waterscape choice survives language switching and reaches the inbox`, async ({
    page,
  }) => {
    await page.goto('/en/waterscapes/');
    await page.locator('cx-masthead cx-language-selector button').first().click();
    await page.getByText(LANGUAGE_NAMES[language], { exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${language}/waterscapes/?$`));
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    await expect(page.locator('head link[rel="alternate"][hreflang]')).toHaveCount(
      PUBLIC_LANGUAGES.length + 1,
    );
    await expect(page.locator('h1')).toHaveText(copy['site.copy.waterscapes.title']);
    await page.locator('section[aria-labelledby="water-types-title"] a').last().click();
    await expect(page.getByRole('combobox')).toContainText(copy['site.services.rainwater.name']);
    await page.reload();
    await expect(page.getByRole('combobox')).toContainText(copy['site.services.rainwater.name']);
    await page.locator('input[name="name"]').fill('Synthetic translated enquiry');
    await page.locator('input[type="email"]').fill(`language-${language}@example.test`);
    await page.locator('input[name="postal-code"]').fill('Synthetic garden');
    const received = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/enquiries') && response.request().method() === 'POST',
    );
    await page.locator('form button[type="submit"]').click();
    const response = await received;
    expect(response.status()).toBe(201);
    const submitted = response.request().postDataJSON();
    expect(submitted.language).toBe(language);
    expect(submitted.fields).toContainEqual(
      expect.objectContaining({ id: 'service', value: copy['site.services.rainwater.name'] }),
    );
    await expect(page.getByText(copy['enquiry.received'], { exact: true })).toBeVisible();
    await page.goto('/en/admin/customers/');
    await page
      .getByRole('textbox', { name: 'Username', exact: true })
      .fill('faunapoolen-e2e-owner');
    await page.locator('input[name="password"]').fill('faunapoolen-e2e-owner-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page
      .getByRole('textbox', { name: 'Find a customer', exact: true })
      .fill(`language-${language}@example.test`);
    await page.getByText('Synthetic translated enquiry', { exact: true }).click();
    await expect(
      page.getByText(
        `Submitted by Synthetic translated enquiry · ${LANGUAGE_ENGLISH_NAMES[language]}`,
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByText(copy['site.services.rainwater.name'], { exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: `/tmp/language-${language}-inbox.png`, fullPage: true });
  });
}

test('translated package enquiry buttons fit their cards at tablet width', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 1000 });
  for (const language of ['it', 'es', 'pt', 'de', 'pl']) {
    await page.goto(`/${language}/nature-pools/pricing/`);
    const cards = page.locator('.fp-package');
    await expect(cards).toHaveCount(3);
    await page.evaluate(() => document.fonts.ready);
    for (const card of await cards.all()) {
      const bounds = await card.boundingBox();
      const action = await card.getByRole('link').boundingBox();
      expect(bounds).not.toBeNull();
      expect(action).not.toBeNull();
      expect(action!.x).toBeGreaterThanOrEqual(bounds!.x - 1);
      expect(action!.x + action!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      1025,
    );
  }
});
