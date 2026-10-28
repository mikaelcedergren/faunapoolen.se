import { expect, test, type Page } from './test';
import { readFileSync } from 'node:fs';

const locales = [
  { language: 'sv', prefix: '' },
  { language: 'en', prefix: '/en' },
  { language: 'da', prefix: '/da' },
] as const;

// These expectations describe the public address contract, independently of the route generator.
const publicSlugs = [
  '',
  'nature-pools',
  'nature-pools/pricing',
  'nature-pools/skane',
  'nature-pools/halland',
  'nature-pools/blekinge',
  'nature-pools/smaland',
  'projects/gotland',
  'waterscapes',
  'about',
  'faq',
  'configure',
  'blog',
];

function canonicalOf(html: string): string | undefined {
  const tag = (html.match(/<link\b[^>]*>/g) ?? []).find((link) =>
    /\brel=["']canonical["']/.test(link),
  );
  return tag?.match(/\bhref=["']([^"']+)["']/)?.[1];
}

for (const { language, prefix } of locales) {
  test(`${language} public pages use English slugs and render their own canonical content`, async ({
    request,
  }) => {
    for (const slug of publicSlugs) {
      const path = `${prefix}/${slug}${slug ? '/' : ''}`;
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(200);
      const html = await response.text();
      expect(html.match(/<html\b[^>]*\blang=["']([^"']+)/)?.[1], path).toBe(language);
      expect(canonicalOf(html), path).toBe(`https://faunapoolen.se${path}`);
      expect(html.match(/<h1\b/g), path).toHaveLength(1);
    }
  });
}

test('old translated page addresses and price links redirect once to the matching English slug', async ({
  request,
}) => {
  const redirects = [
    ['/naturpooler/', '/nature-pools/'],
    ['/projekt/', '/projects/gotland/'],
    ['/projects/', '/projects/gotland/'],
    ['/en/projects/', '/en/projects/gotland/'],
    ['/projekt/gotland/', '/projects/gotland/'],
    ['/vattenmiljoer/', '/waterscapes/'],
    ['/om/', '/about/'],
    ['/vanliga-fragor/', '/faq/'],
    ['/konfigurera/', '/configure/'],
    ['/da/naturpooler/', '/da/nature-pools/'],
    ['/da/projekter/', '/da/projects/gotland/'],
    ['/da/projects/', '/da/projects/gotland/'],
    ['/da/projekter/gotland/', '/da/projects/gotland/'],
    ['/da/vandmiljoer/', '/da/waterscapes/'],
    ['/da/om/', '/da/about/'],
    ['/da/spoergsmaal/', '/da/faq/'],
    ['/da/konfigurer/', '/da/configure/'],
    ['/pricing/', '/nature-pools/pricing/'],
    ['/en/pricing/', '/en/nature-pools/pricing/'],
    ['/da/pricing/', '/da/nature-pools/pricing/'],
  ];
  for (const [oldPath, destination] of redirects) {
    const response = await request.get(oldPath, { maxRedirects: 0 });
    expect([301, 308], oldPath).toContain(response.status());
    expect(response.headers()['location'], oldPath).toBe(destination);
    const target = await request.get(destination, { maxRedirects: 0 });
    expect(target.status(), `${oldPath} must not start a redirect chain`).toBe(200);
    expect(canonicalOf(await target.text())).toBe(`https://faunapoolen.se${destination}`);
  }
});

test('legacy price URLs retain their redirect without promoting unrelated offers', async ({
  page,
}) => {
  for (const fragment of ['waterfall', 'fountains']) {
    await page.goto(`/pricing/#${fragment}`);
    await expect(page).toHaveURL(new RegExp(`/nature-pools/pricing/?#${fragment}$`));
    await expect(page.locator('section[aria-labelledby="water-feature-price-title"]')).toHaveCount(
      0,
    );
    await expect(page.locator('cx-hero a[href$="#consultation"]').first()).toBeVisible();
  }
});

for (const pool of [
  {
    id: 'glade',
    name: 'Dagliga dopp',
    price: /430\s*000/,
    area: 'Från 2 m × 2,5 m (5 m²)',
    index: 0,
  },
  {
    id: 'summer',
    name: 'Bada tillsammans',
    price: /1\s*100\s*000/,
    area: 'Från 4 m × 4 m (16 m²)',
    index: 1,
  },
  {
    id: 'horizon',
    name: 'Mer plats',
    price: /4\s*400\s*000/,
    area: 'Från 10 m × 10 m (100 m²)',
    index: 2,
  },
]) {
  test(`Swedish price comparison carries ${pool.name} and its price into the enquiry`, async ({
    page,
  }) => {
    await page.goto('/nature-pools/pricing/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vad kostar en naturpool?');
    const cards = page.locator('#packages article');
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(pool.index)).toContainText(pool.name);
    await expect(cards.nth(pool.index)).toContainText(pool.price);
    await expect(cards.nth(pool.index)).toContainText(pool.area);
    await expect(cards.nth(pool.index)).toContainText('exkl. moms och frakt');
    await cards
      .nth(pool.index)
      .getByRole('link', { name: 'Fråga om den här poolen', exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/nature-pools/pricing/?\\?package=${pool.id}#consultation$`),
    );
    await expect(page.locator('form cx-dropdown')).toHaveCount(1);
    await expect(page.locator('form cx-dropdown').first().getByRole('combobox')).toContainText(
      pool.name,
    );
    const poolChoice = page.locator('form cx-dropdown').first().getByRole('combobox');
    await poolChoice.click();
    const poolOption = page.getByRole('option').filter({ hasText: pool.name });
    await expect(poolOption).toContainText(pool.price);
    await expect(poolOption).toContainText('exkl. moms och frakt');
    await poolChoice.press('Escape');
    await expect(page.locator('form textarea')).toBeEnabled();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://faunapoolen.se/nature-pools/pricing/',
    );
  });
}

test('a changed package survives refresh and both footer language changes', async ({ page }) => {
  await page.goto('/configure/?package=glade');
  const packageChoice = page.locator('form cx-dropdown').first().getByRole('combobox');
  await expect(packageChoice).not.toHaveAttribute('aria-disabled', 'true');
  await packageChoice.click();
  await page.getByRole('option', { name: /Bada tillsammans/ }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('package')).toBe('summer');
  await page.reload();
  await expect(page.locator('form cx-dropdown').first().getByRole('combobox')).toContainText(
    'Bada tillsammans',
  );
  await page.locator('footer').getByRole('button', { name: 'Språk: Svenska', exact: true }).click();
  await page.getByRole('option', { name: /English/ }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/en/configure/');
  await expect.poll(() => new URL(page.url()).searchParams.get('package')).toBe('summer');
  await expect(page.locator('form cx-dropdown').first().getByRole('combobox')).toContainText(
    'Swim together',
  );
  await page
    .locator('footer')
    .getByRole('button', { name: 'Language: English', exact: true })
    .click();
  await page.getByRole('option', { name: /Dansk/ }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/da/configure/');
  await expect.poll(() => new URL(page.url()).searchParams.get('package')).toBe('summer');
  await expect(page.locator('form cx-dropdown').first().getByRole('combobox')).toContainText(
    'Bad sammen',
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://faunapoolen.se/da/configure/',
  );
});

for (const [slug, name] of [
  ['skane', 'Skåne'],
  ['halland', 'Halland'],
  ['blekinge', 'Blekinge'],
  ['smaland', 'Småland'],
]) {
  test(`${name} visitors can find local guidance and continue to the shared packages`, async ({
    page,
  }) => {
    await page.goto(`/nature-pools/${slug}/`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(name);
    const planning = page.locator('section[aria-labelledby="region-planning-title"]');
    await expect(planning.getByRole('heading', { level: 3 })).toHaveCount(2);
    // Public guidance keeps visitors on the site; research links live in editorial docs.
    await expect(planning.locator('a[href^="https://"]')).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: 'Se naturpoolen på Gotland', exact: true }),
    ).toHaveAttribute('href', '/projects/gotland/');
    await page
      .locator('cx-hero')
      .getByRole('link', { name: 'Jämför våra naturpoolspaket', exact: true })
      .click();
    await expect(page).toHaveURL(/\/nature-pools\/pricing\/?$/);
    await expect(page.locator('#packages article')).toHaveCount(3);
  });
}

for (const { language, prefix } of locales) {
  test(`${language} edited and new guides link directly to their locale's useful commercial pages`, async ({
    page,
    request,
  }) => {
    for (const slug of [
      '5-common-problems-installing-a-nature-pool',
      'hur-mycket-plats-behover-en-naturpool',
      'naturpool-fran-forsta-samtal-till-bad',
    ]) {
      await page.goto(`${prefix}/blog/posts/${slug}.html`);
      await expect(page.locator('#guide-intro')).toBeVisible();
      const links = await page
        .locator('#guide-body a[href^="/"]')
        .evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute('href')!));
      expect(links, `${language}/${slug} needs a contextual commercial next step`).toContain(
        `${prefix}/nature-pools/pricing/`,
      );
      for (const href of [...new Set(links)]) {
        expect(href).not.toMatch(
          /\/(?:naturpooler|konfigurera|konfigurer|projekt|projekter|om|vanliga-fragor|spoergsmaal|vattenmiljoer|vandmiljoer)(?:\/|$)/,
        );
        if (prefix) expect(href).toMatch(new RegExp(`^${prefix}/`));
        else expect(href).not.toMatch(/^\/(?:en|da)\//);
        const target = await request.get(href.split('#')[0], { maxRedirects: 0 });
        expect(target.status(), `${language}/${slug} → ${href}`).toBe(200);
      }
    }
    await page.locator(`#guide-body a[href="${prefix}/nature-pools/pricing/"]`).first().click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(`${prefix}/nature-pools/pricing/`);
    await expect(page.locator('#packages article')).toHaveCount(3);
  });
}

const guideCopy = Object.fromEntries(
  locales.map(({ language }) => [
    language,
    JSON.parse(
      readFileSync(new URL(`../src/locale/messages.${language}.json`, import.meta.url), 'utf8'),
    ).translations,
  ]),
) as Record<string, Record<string, string>>;

for (const { language, prefix } of locales) {
  test(`${language} established articles render the current authored intro, body, links and title`, async ({
    page,
  }) => {
    for (const [id, slug] of [
      ['build', 'build-your-own-nature-pool'],
      ['difference', 'difference-between-normal-pool-and-natural-pool'],
    ]) {
      const expected = guideCopy[language];
      await page.goto(`${prefix}/blog/posts/${slug}.html`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        expected[`blog.${id}.title`],
      );
      await expect(page.locator('#guide-intro')).toHaveText(expected[`blog.${id}.intro`]);
      await expect(page).toHaveTitle(expected[`blog.${id}.seo.title`]);
      const body = await page.locator('#guide-body').evaluate((element, original) => {
        const template = document.createElement('template');
        template.innerHTML = original;
        const normalize = (text: string | null) => (text ?? '').replace(/\s+/g, ' ').trim();
        const readLinks = (root: ParentNode) =>
          Array.from(root.querySelectorAll('a')).map((anchor) => ({
            text: normalize(anchor.textContent),
            href: anchor.getAttribute('href'),
          }));
        const readImages = (root: ParentNode) =>
          Array.from(root.querySelectorAll('img')).map((image) => image.getAttribute('src'));
        return {
          actualText: normalize(element.textContent),
          originalText: normalize(template.content.textContent),
          actualLinks: readLinks(element),
          originalLinks: readLinks(template.content),
          actualImages: readImages(element),
          originalImages: readImages(template.content),
        };
      }, expected[`blog.${id}.bodyHtml`]);
      expect(body.actualText).toBe(body.originalText);
      expect(body.actualLinks).toEqual(body.originalLinks);
      expect(body.actualImages).toEqual(body.originalImages);
      await expect(page.locator('#guide-body cx-card')).toHaveCount(0);
    }
  });
}

type MeasurementEvent = { name: string; [key: string]: unknown };

async function captureMeasurement(page: Page): Promise<MeasurementEvent[]> {
  const events: MeasurementEvent[] = [];
  await page.exposeFunction('recordFaunapoolenMeasurement', (detail: MeasurementEvent) => {
    events.push(detail);
  });
  await page.addInitScript(() => {
    window.addEventListener('faunapoolen:measurement', (event) => {
      void (
        window as Window & {
          recordFaunapoolenMeasurement: (detail: unknown) => Promise<void>;
        }
      ).recordFaunapoolenMeasurement((event as CustomEvent).detail);
    });
  });
  return events;
}

test('disabled statistics stays off even when marketing is accepted', async ({ page }) => {
  const events = await captureMeasurement(page);
  const marketing = await captureMarketing(page);
  const googleRequests: string[] = [];
  page.on('request', (request) => {
    if (/google-analytics\.com|googletagmanager\.com/.test(request.url()))
      googleRequests.push(request.url());
  });
  await page.goto('/en/configure/?package=glade&gclid=synthetic-private-click');
  await expect(page.locator('form textarea')).toBeEnabled();
  const panel = page.getByRole('region', { name: 'Cookie settings' });
  await expect(panel.getByRole('checkbox')).toHaveCount(0);
  await expect(panel.getByRole('button')).toHaveCount(2);
  expect(marketing).toEqual([]);
  await panel.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect.poll(() => marketing.length).toBe(1);
  await page.locator('form textarea').fill('Synthetic private enquiry text');
  await page.goto('/da/configure/');
  await expect(page.locator('form textarea')).toBeEnabled();
  await expect.poll(() => marketing.length).toBe(2);
  expect(events).toEqual([]);
  expect(googleRequests).toEqual([]);
  expect(await page.evaluate(() => sessionStorage.getItem('fp-analytics-visit'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('fp-analytics-consent-v1'))).toBe('denied');
});

test('a lead is measured once after the confirmed retry and never includes contact data', async ({
  page,
}) => {
  const events = await captureMeasurement(page);
  const marketing = await captureMarketing(page);
  await page.goto('/en/configure/?package=summer&private=synthetic-query-marker');
  await expect(page.locator('form textarea')).toBeEnabled();
  await page
    .getByRole('region', { name: 'Cookie settings' })
    .getByRole('button', { name: 'Accept', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Name', exact: true })
    .fill('Synthetic private name marker');
  await page
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill('synthetic-private-marker@example.test');
  await page.locator('input[name="postal-code"]').fill('Synthetic private location marker');
  await page.locator('input[name="tel"]').fill('+460001234567');
  await page.locator('form textarea').fill('Synthetic private message marker');
  const references: string[] = [];
  await page.route('**/api/enquiries', async (route) => {
    references.push(route.request().postDataJSON().requestId);
    if (references.length === 1) {
      // The hermetic server persists the synthetic lead, but the browser loses its receipt.
      expect((await route.fetch()).status()).toBe(201);
      await route.abort('failed');
    } else {
      await route.continue();
    }
  });
  await page.getByRole('button', { name: 'Send enquiry', exact: true }).click();
  await expect(page.getByText(/We couldn’t confirm receipt/)).toBeVisible();
  expect(events.filter((event) => event.name === 'generate_lead')).toEqual([]);
  expect(marketing.filter((event) => event.name === 'Lead')).toEqual([]);
  await page.getByRole('button', { name: 'Send enquiry', exact: true }).click();
  await expect(page.getByText('Your enquiry has been received', { exact: true })).toBeVisible();
  await expect.poll(() => marketing.filter((event) => event.name === 'Lead').length).toBe(1);
  expect(marketing.find((event) => event.name === 'Lead')).toEqual({
    name: 'Lead',
    path: '/en/configure/',
  });
  expect(references).toHaveLength(2);
  expect(references[1]).toBe(references[0]);
  expect(events).toEqual([]);
  const serialized = JSON.stringify(marketing);
  for (const value of [
    'Synthetic private name marker',
    'synthetic-private-marker@example.test',
    'Synthetic private location marker',
    '+460001234567',
    'Synthetic private message marker',
    'synthetic-query-marker',
    references[0],
  ])
    expect(serialized).not.toContain(value);
});

for (const [path, settings, reject, details] of [
  ['/en/', 'Cookie settings', 'Reject', 'Cookie details'],
  ['/', 'Inställningar för kakor', 'Avvisa', 'Om kakor'],
  ['/da/', 'Cookieindstillinger', 'Afvis', 'Om cookies'],
]) {
  test(`compact cookie notice supports rejection and details at ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(path);
    const notice = page.getByRole('region', { name: settings, exact: true });
    await expect(notice).toBeVisible();
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BODY');
    const box = await notice.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
    expect(box!.y + box!.height).toBeLessThanOrEqual(640);
    await notice.getByRole('link', { name: details, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}cookies/?$`));
    await page
      .getByRole('region', { name: settings, exact: true })
      .getByRole('button', { name: reject, exact: true })
      .click();
    await expect(notice).toHaveCount(0);
    await page.reload();
    await expect(
      page.locator('footer').getByRole('link', { name: settings, exact: true }),
    ).toBeVisible();
    await expect(notice).toHaveCount(0);
    // Withdrawal remains reachable at the top of the details page.
    const settingsButton = page
      .locator('main')
      .getByRole('button', { name: settings, exact: true });
    await settingsButton.click();
    await expect(notice.getByRole('button', { name: reject, exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(notice).toHaveCount(0);
    await expect(settingsButton).toBeFocused();
  });
}

test('cookie choices persist between locales and remain reachable on established articles', async ({
  page,
}) => {
  await page.goto('/en/');
  await page
    .getByRole('region', { name: 'Cookie settings' })
    .getByRole('button', { name: 'Accept', exact: true })
    .click();
  await page.goto('/blog/posts/build-your-own-nature-pool.html');
  const settings = page
    .locator('footer')
    .getByRole('link', { name: 'Inställningar för kakor', exact: true });
  await expect(settings).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Inställningar för kakor', exact: true }),
  ).toHaveCount(0);
  await settings.click();
  await page
    .getByRole('region', { name: 'Inställningar för kakor', exact: true })
    .getByRole('button', { name: 'Avvisa', exact: true })
    .click();
  await expect(settings).toBeFocused();
  await page.goto('/da/');
  await expect(page.getByRole('region', { name: 'Cookieindstillinger', exact: true })).toHaveCount(
    0,
  );
});

async function captureMarketing(page: Page): Promise<MeasurementEvent[]> {
  const events: MeasurementEvent[] = [];
  await page.exposeFunction('recordFaunapoolenMarketing', (detail: MeasurementEvent) =>
    events.push(detail),
  );
  await page.addInitScript(() => {
    window.addEventListener('faunapoolen:marketing', (event) => {
      void (
        window as Window & { recordFaunapoolenMarketing: (detail: unknown) => Promise<void> }
      ).recordFaunapoolenMarketing((event as CustomEvent).detail);
    });
  });
  return events;
}

test('marketing has independent consent, persists across locales, and stops after withdrawal', async ({
  page,
}) => {
  const marketing = await captureMarketing(page);
  const statistics = await captureMeasurement(page);
  const external: string[] = [];
  page.on('request', (request) => {
    if (/facebook\.(net|com)|google-analytics\.com|googletagmanager\.com/.test(request.url()))
      external.push(request.url());
  });
  // Existing statistics consent does not grant the new marketing purpose.
  await page.addInitScript(() => {
    if (localStorage.getItem('fp-analytics-consent-v1') === null)
      localStorage.setItem('fp-analytics-consent-v1', 'allowed');
  });
  await page.goto('/en/cookies/');
  const panel = page.getByRole('region', { name: 'Cookie settings' });
  await expect(panel.getByRole('checkbox')).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Choose cookies', exact: true })).toHaveCount(0);
  expect(marketing).toEqual([]);
  await panel.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect.poll(() => marketing.length).toBe(1);
  const statisticsCount = statistics.length;
  await page.goto('/da/configure/?private=synthetic-marker');
  await expect(page.locator('form textarea')).toBeEnabled();
  await expect.poll(() => marketing.length).toBe(2);
  expect(marketing.at(-1)).toEqual({ name: 'PageView', path: '/da/configure/' });
  expect(statistics).toHaveLength(statisticsCount);
  await page.goto('/en/cookies/');
  await page.locator('footer').getByRole('link', { name: 'Cookie settings', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Reject', exact: true })).toBeFocused();
  await page.context().addCookies([
    { name: '_fbp', value: 'synthetic-browser', url: new URL('/', page.url()).href },
    { name: '_fbc', value: 'synthetic-click', url: new URL('/', page.url()).href },
  ]);
  await panel.getByRole('button', { name: 'Reject', exact: true }).click();
  expect(
    (await page.context().cookies()).filter((cookie) => /^_fb[pc]$/.test(cookie.name)),
  ).toEqual([]);
  const count = marketing.length;
  await page.goto('/en/configure/');
  await expect(page.locator('form textarea')).toBeEnabled();
  await page.locator('form textarea').fill('Synthetic private form value');
  expect(marketing).toHaveLength(count);
  expect(JSON.stringify(marketing)).not.toContain('synthetic-marker');
  expect(external).toEqual([]);
  expect(statisticsCount).toBe(0);
});

test('rejection never grants marketing and private routes never emit Meta events', async ({
  page,
}) => {
  const marketing = await captureMarketing(page);
  await page.goto('/en/cookies/');
  const panel = page.getByRole('region', { name: 'Cookie settings' });
  await panel.getByRole('button', { name: 'Reject', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('fp-marketing-consent-v1'))).toBe('denied');
  expect(marketing).toEqual([]);
  await page.locator('footer').getByRole('link', { name: 'Cookie settings', exact: true }).click();
  await panel.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect.poll(() => marketing.length).toBe(1);
  await page.goto('/en/admin/');
  await expect(page.getByRole('form', { name: 'Sign in', exact: true })).toBeVisible();
  expect(marketing).toHaveLength(1);
  expect(await page.locator('script[src*="facebook"]').count()).toBe(0);
});

test('withdrawal in another tab stops marketing in the current page', async ({ page, context }) => {
  const marketing = await captureMarketing(page);
  await page.goto('/en/configure/');
  await page
    .getByRole('region', { name: 'Cookie settings' })
    .getByRole('button', { name: 'Accept', exact: true })
    .click();
  await expect.poll(() => marketing.length).toBe(1);
  const second = await context.newPage();
  await second.goto('/en/cookies/');
  await second
    .locator('footer')
    .getByRole('link', { name: 'Cookie settings', exact: true })
    .click();
  await second
    .getByRole('region', { name: 'Cookie settings' })
    .getByRole('button', { name: 'Reject', exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('fp-marketing-consent-v1')))
    .toBe('denied');
  await page.locator('footer').getByRole('link', { name: 'Cookie settings', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Cookie settings' })).toBeVisible();
  await page.goto('/en/nature-pools/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(marketing).toHaveLength(1);
  await second.close();
});

test('closing reopened cookie settings preserves the saved choice', async ({ page }) => {
  await page.goto('/en/cookies/');
  const panel = page.getByRole('region', { name: 'Cookie settings' });
  await panel.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(panel).toHaveCount(0);
  const settings = page
    .locator('footer')
    .getByRole('link', { name: 'Cookie settings', exact: true });
  await settings.click();
  await expect(panel.getByRole('button', { name: 'Reject', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(settings).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('fp-marketing-consent-v1'))).toBe(
    'allowed',
  );
  await settings.click();
  await panel.getByRole('button', { name: 'Reject', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('fp-marketing-consent-v1'))).toBe('denied');
});
