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
  await page.goto(NEW + path, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `/tmp/ui-new-${slug}.png` });
  await page.goto(OLD + '/' + file, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `/tmp/ui-old-${slug}.png` });
}
console.log('SHOTS=' + slugs.join(','));

// Interactivity (proves hydration keeps scripts.js alive on the live DOM).
await page.goto(NEW + '/koi-pond-series.html', { waitUntil: 'load' });
await page.waitForTimeout(2500); // Angular hydrate + deferred scripts.js
const items = page.locator('.accordion-item');
const n = await items.count();
let accordion = false;
if (n > 0) {
  const first = items.first();
  await first.locator('.accordion-header').click();
  await page.waitForTimeout(300);
  accordion = await first.evaluate((el) => el.classList.contains('open'));
}
console.log(`ACCORDION_OPENS=${accordion} items=${n}`);

await page.setViewportSize({ width: 480, height: 900 });
await page.goto(NEW + '/', { waitUntil: 'load' });
await page.waitForTimeout(2500);
let menu = false;
const label = page.locator('label[for="menu-state"]').first();
if (await label.count()) {
  await label.click();
  await page.waitForTimeout(200);
  menu = await page.locator('#menu-state').first().isChecked();
}
console.log(`MENU_TOGGLES=${menu}`);

await browser.close();
