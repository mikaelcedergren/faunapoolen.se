import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test, expect } from '@playwright/test';

test('social posts prepare media, retain edits and move between Pending and Published', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  const capture = async (name: string) => {
    const bytes = await page.screenshot({ path: testInfo.outputPath(name), fullPage: true });
    const directory = resolve(import.meta.dirname, '../.run/verification/social-posts');
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(resolve(directory, name), bytes, { mode: 0o600 });
  };
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  const response = await page.goto('/en/admin/social-posts');
  expect(response?.headers()['x-robots-tag']).toBe('noindex, nofollow');
  await page.getByRole('textbox', { name: 'Username', exact: true }).fill('faunapoolen-e2e-owner');
  await page.locator('input[name="password"]').fill('faunapoolen-e2e-owner-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add a post', exact: true })).toBeVisible();
  await capture('social-empty.png');
  await page.getByRole('button', { name: 'Add a post', exact: true }).click();
  const name = 'A pond full of life';
  await page
    .getByRole('textbox', { name: 'Post content', exact: true })
    .fill(
      'A quiet corner, a few native plants and room for wildlife.\n\nA natural pond brings the garden to life.',
    );
  await page.getByRole('textbox', { name: 'Post name', exact: true }).fill(name);
  await page.getByRole('checkbox', { name: 'LinkedIn', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Instagram', exact: true }).check();
  const data = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 640;
    c.height = 360;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#426958';
    ctx.fillRect(0, 0, 640, 360);
    ctx.fillStyle = '#5d95a2';
    ctx.beginPath();
    ctx.ellipse(320, 220, 250, 110, 0, 0, Math.PI * 2);
    ctx.fill();
    return c.toDataURL('image/png').split(',')[1]!;
  });
  await page.locator('input[type=file]').setInputFiles({
    name: 'synthetic-pond.png',
    mimeType: 'image/png',
    buffer: Buffer.from(data, 'base64'),
  });
  await capture('social-create.png');
  await page.getByRole('button', { name: 'Prepare versions', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Instagram', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Instagram', exact: true }).click();
  await expect(page.locator('.social-preview img')).toBeVisible();
  await page.getByRole('button', { name: 'Adjust framing', exact: true }).click();
  await page.getByRole('button', { name: 'Crop', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Post text', exact: true })
    .fill(
      'Native plants, clear water and space for wildlife. A natural pond brings the garden to life.',
    );
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await capture('social-editor.png');
  expect(
    await page
      .locator('.social-preview')
      .evaluate((el) => ({ width: el.clientWidth, overflow: el.scrollWidth - el.clientWidth })),
  ).toMatchObject({ overflow: 0 });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download media', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/^instagram-.*\.jpg$/);
  await page.getByRole('checkbox', { name: 'Published', exact: true }).check();
  await expect(page.getByRole('tab', { name: 'Instagram ✓', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'All posts', exact: true }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await capture('social-pending.png');
  await page.reload();
  await page.getByText(name, { exact: true }).click();
  await page.getByRole('tab', { name: 'Instagram ✓', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Post text', exact: true })).toHaveValue(
    'Native plants, clear water and space for wildlife. A natural pond brings the garden to life.',
  );
  await expect(page.getByRole('checkbox', { name: 'Published', exact: true })).toBeChecked();
  for (const platform of ['Facebook', 'LinkedIn']) {
    const tab = page.getByRole('tab', { name: platform, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('checkbox', { name: 'Published', exact: true }).check();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'All posts', exact: true }).click();
  await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Published', exact: true }).click();
  await page.getByText(name, { exact: true }).click();
  await page.getByRole('checkbox', { name: 'Published', exact: true }).uncheck();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('textbox', { name: 'Post text', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await capture('social-mobile.png');
  expect(errors).toEqual([]);
});
