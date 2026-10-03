import { expect, test } from '@playwright/test';

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`public hero and scroll frost at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/en/');
    const header = page.locator('cx-masthead > header');
    const hero = page.locator('.fp-home-opening');
    await expect(header).toHaveClass(/cx-masthead--transparent/);
    await expect(hero).toBeVisible();
    await expect
      .poll(async () => {
        const navigation = await header.boundingBox();
        const introduction = await hero.boundingBox();
        return introduction!.y - navigation!.y;
      })
      .toBeCloseTo(0, 0);
    const brand = await page.locator('cx-masthead [brand]').boundingBox();
    const language = page.locator('cx-masthead cx-language-selector');
    if (viewport.width > 719) {
      const languageBox = await language.boundingBox();
      expect(brand!.x + brand!.width).toBeLessThan(languageBox!.x);
    } else {
      await expect(language).toBeHidden();
      const menu = await header
        .getByRole('button', { name: 'Faunapoolen menu', exact: true })
        .boundingBox();
      expect(brand!.x + brand!.width).toBeLessThan(menu!.x);
    }
    await expect(page.locator('cx-masthead [brand] img')).toBeVisible();
    await expect(page.locator('cx-masthead [brand]')).toHaveText('Faunapoolen');
    const photograph = await hero.locator('img[media]').boundingBox();
    const heading = await page.locator('h1').boundingBox();
    const navigation = await header.boundingBox();
    expect(photograph!.y).toBeLessThanOrEqual(navigation!.y);
    expect(photograph!.y + photograph!.height).toBeGreaterThan(heading!.y + heading!.height);
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

  test(`guide section navigation at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/en/blog/posts/build-your-own-nature-pool.html');
    await page.getByRole('button', { name: 'Reject', exact: true }).click();
    await page.evaluate(() => document.fonts.ready);
    const contents = page.getByRole('navigation', { name: 'In this guide' });
    await expect(page.locator('#guide-body')).toBeVisible();
    if (viewport.width > 719) {
      await expect(contents).toBeVisible();
      await expect(contents.getByText('In this guide', { exact: true })).toHaveCount(0);
      const navigation = await contents.boundingBox();
      const body = await page.locator('#guide-body').boundingBox();
      expect(navigation!.x).toBeGreaterThanOrEqual(body!.x + body!.width);
      for (const index of [4, 0]) {
        await contents.getByRole('link').nth(index).click();
        const section = page.locator(`#guide-section-${index + 1}`);
        await expect
          .poll(() => section.evaluate((element) => element.getBoundingClientRect().top))
          .toBeCloseTo(80, 0);
        await expect
          .poll(() => contents.evaluate((element) => element.getBoundingClientRect().top))
          .toBeCloseTo(80, 0);
      }
    } else {
      await expect(contents).toBeHidden();
    }
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
      .toBeLessThanOrEqual(0);
  });

  test(`direct article section links clear the header at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/en/blog/posts/build-your-own-nature-pool.html#guide-section-1');
    await page.getByRole('button', { name: 'Reject', exact: true }).click();
    await page.evaluate(() => document.fonts.ready);
    const section = page.locator('#guide-section-1');
    await expect(page).toHaveURL(/build-your-own-nature-pool\.html#guide-section-1$/);
    await expect(section).toBeInViewport();
    await expect
      .poll(async () => {
        const heading = await section.boundingBox();
        const header = await page.locator('cx-masthead > header').boundingBox();
        return heading!.y - (header!.y + header!.height);
      })
      .toBeGreaterThanOrEqual(0);
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
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const navigation = await page.locator('cx-masthead > header').boundingBox();
    const title = await page.getByRole('heading', { level: 1 }).boundingBox();
    expect(title!.y, route).toBeGreaterThanOrEqual(navigation!.y + navigation!.height);
    await expect(page.locator('cx-masthead > header')).toHaveClass(/cx-masthead--transparent/);
  }
});

test.describe('language suggestion', () => {
  test.use({ locale: 'fr-FR' });
  test('stays below the hero while guide images extend behind navigation', async ({ page }) => {
    await page.goto('/');
    const alert = page.locator('cx-alert');
    await expect(alert).toBeVisible();
    const hero = await page.locator('.fp-home-opening').boundingBox();
    const suggestion = await alert.boundingBox();
    expect(suggestion!.y).toBeGreaterThanOrEqual(hero!.y + hero!.height);
    await page.goto('/blog/posts/build-your-own-nature-pool.html');
    await expect(page.locator('cx-hero[data-variant="cover"]')).toBeVisible();
    await expect(page.locator('h1')).toBeVisible();
    const header = await page.locator('cx-masthead > header').boundingBox();
    const guideHero = await page.locator('cx-hero').boundingBox();
    const guideSuggestion = await alert.boundingBox();
    const title = await page.locator('h1').boundingBox();
    expect(guideHero!.y).toBe(header!.y);
    expect(guideSuggestion!.y).toBeGreaterThanOrEqual(guideHero!.y + guideHero!.height);
    expect(title!.y).toBeGreaterThanOrEqual(header!.height);
  });
});
