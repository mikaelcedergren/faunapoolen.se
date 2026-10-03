import { expect, test } from '@playwright/test';

test('hero navigation starts at the final crop and scrolling never changes its scale', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args: Parameters<typeof animate>) {
      if (this.matches('.cx-hero__media')) {
        // Capture the image before motion starts, when a delayed zoom would flash.
        this.setAttribute('data-crop-before-motion', getComputedStyle(this).transform);
      }
      return animate.apply(this, args);
    };
  });
  await page.goto('/en/');
  const media = page.locator('cx-hero .cx-hero__media');
  const crop = 'matrix(1.14, 0, 0, 1.14, 0, 0)';
  await expect(media).toHaveAttribute('data-crop-before-motion', crop);
  const reject = page.getByRole('button', { name: 'Reject', exact: true });
  if (await reject.isVisible()) await reject.click();

  for (const name of ['Nature pools', 'Prices', 'Waterscapes', 'About', 'Start', 'Nature pools']) {
    const previousHeading = await page.locator('cx-hero h1').textContent();
    await page.locator('cx-masthead').getByRole('link', { name, exact: true }).click();
    await expect(page.locator('cx-hero h1')).not.toHaveText(previousHeading!);
    await expect(media).toHaveAttribute('data-crop-before-motion', crop);
    await expect(media).toHaveCSS('transform', crop);
    await expect(media).not.toHaveCSS('translate', 'none');
  }

  const translation = await media.evaluate((element) => getComputedStyle(element).translate);
  await page.evaluate(() => window.scrollBy(0, 180));
  await expect
    .poll(() => media.evaluate((element) => getComputedStyle(element).translate))
    .not.toBe(translation);
  await expect(media).toHaveCSS('transform', crop);
  const coverage = await media.evaluate((element) => {
    const image = element.getBoundingClientRect();
    const frame = element.parentElement!.getBoundingClientRect();
    return image.top <= frame.top && image.bottom >= frame.bottom;
  });
  expect(coverage).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(media).toHaveCSS('translate', 'none');
  await expect(media).toHaveCSS('transform', crop);
});
