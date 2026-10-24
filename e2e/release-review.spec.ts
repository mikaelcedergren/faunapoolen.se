import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test, expect } from './test';
import { PUBLIC_LANGUAGES, PUBLIC_PAGES } from '../server/src/public-routes';

// The release gate needs current rendered evidence as well as behavioural assertions.
const evidenceDirectory = resolve(import.meta.dirname, '../.run/verification/release-review');
const pages = [
  'home',
  'nature-pools',
  'pricing',
  'waterscapes',
  'gotland',
  'guides',
  'about',
  'faq',
  'cookies',
  'configure',
  'skane',
] as const;

for (const language of PUBLIC_LANGUAGES) {
  test(`${language} release pages render without browser errors or horizontal overflow`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await mkdir(evidenceDirectory, { recursive: true, mode: 0o700 });
    const reviewedPages =
      language === 'en' || language === 'sv' ? pages : (['home', 'pricing', 'configure'] as const);
    const routes: { name: string; path: string }[] = reviewedPages.map((name) => ({
      name,
      path: PUBLIC_PAGES[language][name],
    }));
    if (language === 'en' || language === 'sv') {
      for (const slug of [
        'build-your-own-nature-pool',
        'difference-between-normal-pool-and-natural-pool',
      ]) {
        routes.push({
          name: slug,
          path: `${language === 'sv' ? '' : '/en'}/blog/posts/${slug}.html`,
        });
      }
    }
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      for (const { name, path } of routes) {
        const response = await page.goto(path);
        expect(response?.status()).toBe(200);
        await expect(page.locator('h1')).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('lang', language);
        if (name === 'pricing') {
          await expect(page.locator('.fp-package')).toHaveCount(3);
          await expect(page.locator('.fp-package').first()).toContainText('430');
        }
        await page.evaluate(() => document.fonts.ready);
        // Exercise native lazy loading before reviewing the complete page.
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
        await page.evaluate(() => scrollTo(0, 0));
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width + 1,
        );
        const viewport = await page.screenshot({ animations: 'disabled' });
        await writeFile(
          resolve(evidenceDirectory, `${language}-${name}-${width}-viewport.png`),
          viewport,
          { mode: 0o600 },
        );
        const screenshot = await page.screenshot({ fullPage: true, animations: 'disabled' });
        await writeFile(
          resolve(evidenceDirectory, `${language}-${name}-${width}.png`),
          screenshot,
          { mode: 0o600 },
        );
      }
    }
    expect(errors).toEqual([]);
  });
}
