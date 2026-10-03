import { expect, test } from '@playwright/test';

test('hero navigation starts at the final crop and scrolling never changes its scale', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    const recorded = new WeakSet<Element>();
    const observeHeroes = () => {
      for (const image of document.querySelectorAll<HTMLElement>('cx-hero .cx-hero__media')) {
        if (recorded.has(image)) continue;
        recorded.add(image);
        const samples: { scale: string; shift: number }[] = [];
        const sample = () => {
          if (!image.isConnected) return;
          const frame = image.parentElement!.getBoundingClientRect();
          const media = image.getBoundingClientRect();
          samples.push({
            scale: getComputedStyle(image).transform,
            // Remove the fixed centred enlargement; only startup movement remains.
            shift: media.top - frame.top + (media.height - frame.height) / 2,
          });
          if (samples.length < 30) requestAnimationFrame(sample);
          else image.setAttribute('data-startup-frames', JSON.stringify(samples));
        };
        requestAnimationFrame(sample);
      }
    };
    new MutationObserver(observeHeroes).observe(document, { childList: true, subtree: true });
    observeHeroes();
  });
  await page.goto('/en/');
  const media = page.locator('cx-hero .cx-hero__media');
  const crop = 'matrix(1.14, 0, 0, 1.14, 0, 0)';
  const expectStableStartup = async () => {
    await expect(media).toHaveAttribute('data-startup-frames', /.+/);
    const frames = JSON.parse((await media.getAttribute('data-startup-frames'))!) as {
      scale: string;
      shift: number;
    }[];
    expect(frames).toHaveLength(30);
    expect(frames.every((frame) => frame.scale === crop)).toBe(true);
    expect(Math.max(...frames.map((frame) => Math.abs(frame.shift)))).toBeLessThan(0.01);
    await expect(media).toHaveCSS('translate', '0px 0%');
  };
  await expectStableStartup();
  const reject = page.getByRole('button', { name: 'Reject', exact: true });
  if (await reject.isVisible()) await reject.click();

  for (const name of ['Nature pools', 'Prices', 'Waterscapes', 'About', 'Start', 'Nature pools']) {
    const previousHeading = await page.locator('cx-hero h1').textContent();
    // Navigation also needs to start cleanly after the outgoing hero has moved.
    await page.evaluate(() => window.scrollTo(0, 180));
    await page.locator('cx-masthead').getByRole('link', { name, exact: true }).click();
    await expect(page.locator('cx-hero h1')).not.toHaveText(previousHeading!);
    await expectStableStartup();
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

test.describe('prerendered hero', () => {
  test.use({ javaScriptEnabled: false });

  test('parallax starts at rest and scrolls before application JavaScript runs', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/en/');
    const media = page.locator('cx-hero .cx-hero__media');
    await expect(media).toHaveCSS('transform', 'matrix(1.14, 0, 0, 1.14, 0, 0)');
    await expect(media).toHaveCSS('translate', '0px 0%');
    await page.evaluate(() => window.scrollBy(0, 180));
    await expect(media).not.toHaveCSS('translate', '0px 0%');
    await expect(media).not.toHaveCSS('translate', 'none');
  });
});
