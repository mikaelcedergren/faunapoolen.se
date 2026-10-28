import { expect, test } from './test';

// Chromium headless hides native scrollbars. This geometry regression needs a real gutter.
test.use({ headless: false });

test('cookie notice keeps equal narrow-screen margins beside a persistent scrollbar and after resizing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 380, height: 640 });
  await page.goto('/en/cookies/');
  const notice = page.getByRole('region', { name: 'Cookie settings', exact: true });
  await expect(notice).toBeVisible();
  // Reproduce a browser with a reserved scrollbar instead of an overlay scrollbar.
  await page.addStyleTag({
    content: `
    html { scrollbar-gutter: stable; overflow-y: scroll; scrollbar-width: auto; }
    html::-webkit-scrollbar { width: 16px; }
  `,
  });
  expect(
    await page.evaluate(() => window.innerWidth - document.documentElement.clientWidth),
  ).toBeGreaterThan(0);
  const marginDifference = () =>
    notice.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return Math.abs(box.left - (document.documentElement.clientWidth - box.right));
    });
  await expect.poll(marginDifference).toBeLessThan(1);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect.poll(async () => (await notice.boundingBox())!.width).toBe(360);
  await page.setViewportSize({ width: 320, height: 640 });
  await expect.poll(marginDifference).toBeLessThan(1);
});
