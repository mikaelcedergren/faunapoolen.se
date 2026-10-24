import { expect, test } from './test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

for (const width of [360, 430]) {
  test.describe(`touch phone at ${width}px`, () => {
    test.use({
      viewport: { width, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });

    test('public journeys load bounded images and keep enquiry controls usable', async ({
      page,
    }) => {
      test.setTimeout(120_000);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const imageTransfers: { url: string; bytes: number }[] = [];
      page.on('response', (response) => {
        if (response.request().resourceType() === 'image' && response.status() === 200) {
          imageTransfers.push({
            url: response.url(),
            bytes: Number(response.headers()['content-length']),
          });
        }
      });
      const evidence = resolve(import.meta.dirname, '../.run/verification/release-review');
      await mkdir(evidence, { recursive: true, mode: 0o700 });
      for (const path of [
        '/',
        '/en/',
        '/en/nature-pools/pricing/',
        '/en/waterscapes/',
        '/en/projects/gotland/',
        '/en/about/',
      ]) {
        expect((await page.goto(path))?.status()).toBe(200);
        await expect(page.locator('h1')).toBeVisible();
        for (const image of await page.locator('img').all()) {
          if (!(await image.isVisible())) continue;
          await image.scrollIntoViewIfNeeded();
          await expect
            .poll(() =>
              image.evaluate(
                (element: HTMLImageElement) => element.complete && element.naturalWidth > 0,
              ),
            )
            .toBe(true);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width + 1,
        );
      }
      await page.goto('/en/');
      await page.getByRole('button', { name: 'Reject', exact: true }).tap();
      await page.getByRole('button', { name: 'Faunapoolen menu', exact: true }).tap();
      await page
        .getByRole('dialog', { name: 'Menu', exact: true })
        .getByRole('link', { name: 'Prices', exact: true })
        .tap();
      await expect(page).toHaveURL(/\/en\/nature-pools\/pricing\/?$/);
      await page.getByRole('link', { name: 'Enquire about this pool', exact: true }).nth(1).tap();
      const name = page.getByRole('textbox', { name: 'Name', exact: true });
      await expect(name).toBeInViewport();
      await name.fill(`Synthetic mobile ${process.env['CX_E2E_ENGINE']} ${width}`);
      await page
        .getByRole('textbox', { name: 'Email', exact: true })
        .fill('mobile-release@example.test');
      await page
        .getByRole('textbox', { name: 'Town or postcode', exact: true })
        .fill('Synthetic garden');
      const submit = page.getByRole('button', { name: 'Send enquiry', exact: true });
      await submit.scrollIntoViewIfNeeded();
      await expect(submit).toBeInViewport();
      const received = page.waitForResponse(
        (r) => r.url().endsWith('/api/enquiries') && r.request().method() === 'POST',
      );
      await submit.tap();
      expect((await received).status()).toBe(201);
      await expect(
        page.getByText('Your enquiry has been received', { exact: true }),
      ).toBeInViewport();
      const transfers = imageTransfers;
      for (const image of transfers) {
        expect(image.bytes, image.url).toBeGreaterThan(0);
        expect(image.bytes, image.url).toBeLessThanOrEqual(450_000);
      }
      expect(errors).toEqual([]);
      await writeFile(
        resolve(evidence, `${process.env['CX_E2E_ENGINE']}-mobile-${width}-images.json`),
        JSON.stringify(transfers, null, 2),
        { mode: 0o600 },
      );
      await page.screenshot({
        path: resolve(evidence, `${process.env['CX_E2E_ENGINE']}-mobile-${width}-receipt.png`),
        animations: 'disabled',
      });
    });
  });
}
