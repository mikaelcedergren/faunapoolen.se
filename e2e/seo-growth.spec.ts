import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { expectedGuideBody } from '../tests/guide-content-expectations.mjs';

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

test('inherited price fragments reach actual water-feature pricing guidance', async ({ page }) => {
  for (const fragment of ['waterfall', 'fountains']) {
    await page.goto(`/pricing/#${fragment}`);
    await expect(page).toHaveURL(new RegExp(`/nature-pools/pricing/?#${fragment}$`));
    await expect(page.locator(`#${fragment}`)).toBeInViewport();
    await expect(page.locator(`#${fragment} h3`)).toBeVisible();
    await expect(
      page.locator('section[aria-labelledby="water-feature-price-title"] a[href="/waterscapes/"]'),
    ).toBeVisible();
  }
});

for (const pool of [
  { id: 'glade', name: 'Dagliga dopp', price: /495\s*000/, index: 0 },
  { id: 'summer', name: 'Bada tillsammans', price: /695\s*000/, index: 1 },
  { id: 'horizon', name: 'Mer plats', price: /995\s*000/, index: 2 },
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
    await expect(cards.nth(pool.index)).toContainText('inkl. moms');
    await cards
      .nth(pool.index)
      .getByRole('link', { name: 'Fråga om den här poolen', exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/configure/\\?package=${pool.id}$`));
    await expect(page.locator('form cx-dropdown')).toHaveCount(2);
    await expect(page.locator('form cx-dropdown').first().getByRole('combobox')).toContainText(
      'Naturpool',
    );
    await expect(page.locator('form cx-dropdown').nth(1).getByRole('combobox')).toContainText(
      pool.name,
    );
    await expect(page.locator('form')).toContainText(pool.price);
    await expect(page.locator('form textarea')).toBeEnabled();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://faunapoolen.se/configure/',
    );
  });
}

test('a changed package survives refresh and both footer language changes', async ({ page }) => {
  await page.goto('/configure/?package=glade');
  const packageChoice = page.locator('form cx-dropdown').nth(1).getByRole('combobox');
  await expect(packageChoice).not.toHaveAttribute('aria-disabled', 'true');
  await packageChoice.click();
  await page.getByRole('option', { name: /Bada tillsammans/ }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('package')).toBe('summer');
  await page.reload();
  await expect(page.locator('form cx-dropdown').nth(1).getByRole('combobox')).toContainText(
    'Bada tillsammans',
  );
  await page.locator('footer').getByRole('button', { name: 'Språk: Svenska', exact: true }).click();
  await page.getByRole('option', { name: /English/ }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/en/configure/');
  await expect.poll(() => new URL(page.url()).searchParams.get('package')).toBe('summer');
  await expect(page.locator('form cx-dropdown').nth(1).getByRole('combobox')).toContainText(
    'Swim together',
  );
  await page
    .locator('footer')
    .getByRole('button', { name: 'Language: English', exact: true })
    .click();
  await page.getByRole('option', { name: /Dansk/ }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/da/configure/');
  await expect.poll(() => new URL(page.url()).searchParams.get('package')).toBe('summer');
  await expect(page.locator('form cx-dropdown').nth(1).getByRole('combobox')).toContainText(
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
    const sources = await planning
      .locator('a[href^="https://"]')
      .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).hostname));
    const approvedSources: Record<string, string[]> = {
      skane: ['malmo.se'],
      halland: ['www.halmstad.se', 'www.lbva.se'],
      blekinge: ['www.karlskrona.se'],
      smaland: ['www.vaxjo.se'],
    };
    expect(sources).toHaveLength(2);
    for (const source of sources) expect(approvedSources[slug]).toContain(source);
    await expect(
      page.getByRole('link', { name: 'Se naturpoolen på Gotland', exact: true }),
    ).toHaveAttribute('href', '/projects/gotland/');
    await page
      .locator('cx-hero')
      .getByRole('link', { name: 'Jämför våra naturpoolspaket', exact: true })
      .click();
    await expect(page).toHaveURL(/\/nature-pools\/pricing\/$/);
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

const protectedCopy = JSON.parse(
  readFileSync(new URL('../tests/fixtures/protected-guide-locales.json', import.meta.url), 'utf8'),
) as Record<string, Record<string, Record<string, string>>>;

for (const { language, prefix } of locales) {
  test(`${language} successful articles retain the original intro, body, links and title`, async ({
    page,
  }) => {
    for (const [id, slug] of [
      ['build', 'build-your-own-nature-pool'],
      ['difference', 'difference-between-normal-pool-and-natural-pool'],
    ]) {
      const expected = protectedCopy[language][id];
      await page.goto(`${prefix}/blog/posts/${slug}.html`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        expected[`blog.${id}.title`],
      );
      await expect(page.locator('#guide-intro')).toHaveText(expected[`blog.${id}.intro`]);
      await expect(page).toHaveTitle(expected[`blog.${id}.seo.title`]);
      const body = await page.locator('#guide-body').evaluate(
        (element, original) => {
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
        },
        expectedGuideBody(expected[`blog.${id}.bodyHtml`], language, id),
      );
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

test('statistics require opt-in and stop after the visitor withdraws it', async ({ page }) => {
  const events = await captureMeasurement(page);
  const googleRequests: string[] = [];
  page.on('request', (request) => {
    if (/google-analytics\.com|googletagmanager\.com/.test(request.url()))
      googleRequests.push(request.url());
  });
  await page.goto('/en/configure/?package=glade');
  await expect(page.locator('form textarea')).toBeEnabled();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Synthetic consent check');
  expect(events).toEqual([]);
  expect(googleRequests).toEqual([]);

  await page
    .getByRole('region', { name: 'Cookie settings' })
    .getByRole('button', { name: 'Accept', exact: true })
    .click();
  await expect.poll(() => events.filter((event) => event.name === 'page_view').length).toBe(1);
  // GA uses site-wide cookies, independent of the page where consent is given.
  const cookieUrl = new URL('/', page.url()).href;
  await page.context().addCookies([
    { name: '_ga', value: 'synthetic-browser', url: cookieUrl },
    { name: '_ga_E1BFSP43WZ', value: 'synthetic-session', url: cookieUrl },
  ]);
  await page.locator('footer').getByRole('link', { name: 'Cookie settings', exact: true }).click();
  await page
    .getByRole('region', { name: 'Cookie settings' })
    .getByRole('button', { name: 'Reject', exact: true })
    .click();
  expect(
    (await page.context().cookies()).filter((cookie) => /^_ga(?:_|$)/.test(cookie.name)),
  ).toEqual([]);
  const countAfterWithdrawal = events.length;
  await page.goto('/en/nature-pools/pricing/');
  await expect(
    page.locator('footer').getByRole('link', { name: 'Cookie settings', exact: true }),
  ).toBeVisible();
  await page
    .locator('#packages')
    .getByRole('link', { name: 'Enquire about this pool', exact: true })
    .first()
    .click();
  await expect(page.locator('form textarea')).toBeEnabled();
  await page
    .getByRole('textbox', { name: 'Name', exact: true })
    .fill('Synthetic withdrawn consent');
  expect(events).toHaveLength(countAfterWithdrawal);
  expect(googleRequests).toEqual([]);
});

test('a lead is measured once after the confirmed retry and never includes contact data', async ({
  page,
}) => {
  const events = await captureMeasurement(page);
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
  await expect.poll(() => events.filter((event) => event.name === 'enquiry_error').length).toBe(1);
  expect(events.filter((event) => event.name === 'generate_lead')).toEqual([]);
  await page.getByRole('button', { name: 'Send enquiry', exact: true }).click();
  await expect(page.getByText('Your enquiry has been received', { exact: true })).toBeVisible();
  await expect.poll(() => events.filter((event) => event.name === 'generate_lead').length).toBe(1);
  expect(references).toHaveLength(2);
  expect(references[1]).toBe(references[0]);
  const lead = events.find((event) => event.name === 'generate_lead');
  expect(lead).toMatchObject({
    package_id: 'summer',
    service: 'pool',
    language: 'en',
    page_location: 'https://faunapoolen.se/en/configure/',
    landing_path: '/en/configure/',
  });
  const serialized = JSON.stringify(events);
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

test('cookie choices persist between locales and remain reachable on protected articles', async ({
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
