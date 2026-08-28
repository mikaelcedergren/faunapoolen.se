import assert from 'node:assert/strict';

import { chromium } from '@playwright/test';

// NEW = Angular build (4398), OLD = legacy static site (4397).
const NEW = 'http://127.0.0.1:4398';
const OLD = 'http://127.0.0.1:4397';
const PAGES = [
  ['/', 'index.html'],
  ['/koi-pond-series.html', 'koi-pond-series.html'],
  ['/services/', 'services/index.html'],
  ['/pricing/', 'pricing/index.html'],
  ['/blog/', 'blog/index.html'],
  [
    '/blog/posts/difference-between-normal-pool-and-natural-pool.html',
    'blog/posts/difference-between-normal-pool-and-natural-pool.html',
  ],
  ['/en/', 'en/index.html'],
  ['/en/koi-pond-series.html', 'en/koi-pond-series.html'],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const slugs = [];
for (const [path, file] of PAGES) {
  const slug = file.replace(/\//g, '_');
  slugs.push(slug);
  const newResponse = await page.goto(NEW + path, { waitUntil: 'load' });
  assert.equal(newResponse?.status(), 200, `Angular UI route ${path} did not return 200.`);
  await page.waitForTimeout(1500);
  const newNavigation = await navigationContract(page);
  await page.screenshot({ path: `/tmp/ui-new-${slug}.png` });
  const oldResponse = await page.goto(OLD + '/' + file, { waitUntil: 'load' });
  assert.equal(oldResponse?.status(), 200, `Legacy UI file ${file} did not return 200.`);
  await page.waitForTimeout(1500);
  const oldNavigation = await navigationContract(page);
  assert.deepEqual(newNavigation, oldNavigation, `Navigation contract changed for ${path}.`);
  await page.screenshot({ path: `/tmp/ui-old-${slug}.png` });
}
console.log('SHOTS=' + slugs.join(','));
console.log(`NAVIGATION_PARITY=${slugs.length}/${slugs.length}`);

// Interactivity (proves hydration keeps scripts.js alive on the live DOM).
await page.goto(NEW + '/koi-pond-series.html', { waitUntil: 'load' });
await page.waitForTimeout(2500); // Angular hydrate + deferred scripts.js
const items = page.locator('.accordion-item');
const n = await items.count();
assert.ok(n > 0, 'Accordion fixture contains no items.');
const first = items.first();
await first.locator('.accordion-header').click();
await page.waitForTimeout(300);
const accordion = await first.evaluate((el) => el.classList.contains('open'));
assert.equal(accordion, true, 'Accordion did not open after interaction.');
console.log(`ACCORDION_OPENS=${accordion} items=${n}`);

await page.setViewportSize({ width: 480, height: 900 });
await page.goto(NEW + '/', { waitUntil: 'load' });
await page.waitForTimeout(2500);
const label = page.locator('label[for="menu-state"]').first();
assert.equal(await label.count(), 1, 'Mobile navigation toggle is missing or duplicated.');
await label.click();
await page.waitForTimeout(200);
const menu = await page.locator('#menu-state').first().isChecked();
assert.equal(menu, true, 'Mobile navigation did not open after interaction.');
console.log(`MENU_TOGGLES=${menu}`);

await browser.close();

async function navigationContract(targetPage) {
  return targetPage.locator('nav.navigation .menu > a').evaluateAll((links) =>
    links.map((link) => ({
      className: link.getAttribute('class') ?? '',
      href: link.getAttribute('href'),
      text: link.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    })),
  );
}
