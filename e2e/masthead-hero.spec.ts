import { expect, test } from '@playwright/test';

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`public hero and scroll frost at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/en/');
    const header = page.locator('cx-masthead > header');
    const hero = page.locator('cx-hero > header');
    await expect(header).toHaveClass(/cx-masthead--transparent/);
    await expect(hero).toHaveClass(/cx-hero--under-masthead/);
    await expect
      .poll(async () => {
        const navigation = await header.boundingBox();
        const introduction = await hero.boundingBox();
        return Math.abs(navigation!.y - introduction!.y);
      })
      .toBeLessThan(2);
    const brand = await page.locator('cx-masthead [brand]').boundingBox();
    const language = await page.locator('cx-masthead cx-language-selector').boundingBox();
    expect(brand!.x + brand!.width).toBeLessThan(language!.x);
    await expect(page.locator('cx-masthead .fp-logo')).toHaveCSS('width', '40px');
    const heading = await page.locator('h1').boundingBox();
    const navigation = await header.boundingBox();
    expect(heading!.y).toBeGreaterThan(navigation!.y + navigation!.height);
    await page.evaluate(() => window.scrollTo(0, 400));
    await expect(header).toHaveClass(/cx-masthead--frosted/);
    await expect
      .poll(() => header.evaluate((element) => element.getBoundingClientRect().top))
      .toBe(0);
    await expect(header).toHaveCSS('backdrop-filter', 'blur(24px)');
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(header).toHaveClass(/cx-masthead--transparent/);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
      .toBeLessThanOrEqual(0);
  });
}

test('all public introductions reserve navigation clearance', async ({ page }) => {
  for (const route of [
    '/',
    '/da/',
    '/en/nature-pools/',
    '/en/waterscapes/',
    '/en/nature-pools/pricing/',
    '/en/projects/gotland/',
    '/en/blog/',
    '/en/about/',
    '/en/faq/',
    '/en/configure/',
  ]) {
    await page.goto(route);
    await expect(page.locator('cx-hero .cx-hero--under-masthead')).toBeVisible();
    await expect(page.locator('cx-masthead > header')).toHaveClass(/cx-masthead--transparent/);
  }
});

test.describe('language suggestion', () => {
  test.use({ locale: 'fr-FR' });
  test('stays below the hero and articles retain normal header clearance', async ({ page }) => {
    await page.goto('/');
    const alert = page.locator('cx-alert');
    await expect(alert).toBeVisible();
    const hero = await page.locator('cx-hero').boundingBox();
    const suggestion = await alert.boundingBox();
    expect(suggestion!.y).toBeGreaterThanOrEqual(hero!.y + hero!.height);
    await page.goto('/blog/posts/build-your-own-nature-pool.html');
    await expect(page.locator('cx-hero')).toHaveCount(0);
    await expect(page.locator('h1')).toBeVisible();
    const header = await page.locator('cx-masthead > header').boundingBox();
    const title = await page.locator('h1').boundingBox();
    expect(title!.y).toBeGreaterThanOrEqual(header!.height);
  });
});
