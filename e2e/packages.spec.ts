import { test, expect } from './test';

test.beforeEach(async ({ page }) => {
  await page.goto('/en/admin/packages/');
  await page.getByRole('textbox', { name: 'Username', exact: true }).fill('faunapoolen-e2e-owner');
  await page.locator('input[name="password"]').fill('faunapoolen-e2e-owner-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeVisible();
});

test('price edits preserve translated titles, update public cards and protect unsaved work', async ({
  page,
}) => {
  let catalogue = {
    revision: 1,
    packages: [
      {
        id: 'glade',
        titles: {
          en: 'Daily dips',
          sv: 'Dagliga dopp',
          da: 'Daglige dukkerter',
          it: 'Bagni quotidiani',
          es: 'Chapuzones diarios',
          pt: 'Mergulhos diários',
          de: 'Täglich eintauchen',
          pl: 'Codzienne kąpiele',
        },
        price: 430000,
      },
      {
        id: 'summer',
        titles: {
          en: 'Swim together',
          sv: 'Bada tillsammans',
          da: 'Bad sammen',
          it: 'Nuotare insieme',
          es: 'Nadar juntos',
          pt: 'Nadar em conjunto',
          de: 'Gemeinsam schwimmen',
          pl: 'Wspólne pływanie',
        },
        price: 1100000,
      },
      {
        id: 'horizon',
        titles: {
          en: 'More room',
          sv: 'Mer plats',
          da: 'Mere plads',
          it: 'Più spazio',
          es: 'Más espacio',
          pt: 'Mais espaço',
          de: 'Mehr Platz',
          pl: 'Więcej miejsca',
        },
        price: 4400000,
      },
    ],
  };
  const originalTitles = catalogue.packages.map((item) => ({ ...item.titles }));
  await page.route('**/api/admin/packages', async (route) => {
    if (route.request().method() === 'PATCH') {
      const update = route.request().postDataJSON();
      expect(update.packages.map((item: { titles: unknown }) => item.titles)).toEqual(
        originalTitles,
      );
      catalogue = { ...update, revision: catalogue.revision + 1 };
    }
    await route.fulfill({ json: catalogue });
  });
  await page.route('**/api/packages', (route) => route.fulfill({ json: catalogue }));
  await page.goto('/en/admin/packages/');
  const first = page.getByRole('region', { name: 'Daily dips', exact: true });
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(first.getByRole('spinbutton', { name: 'From price', exact: true })).toHaveValue(
    '430000',
  );
  await page.screenshot({
    animations: 'disabled',
    path: '/tmp/fauna-packages-before.png',
    fullPage: true,
  });
  await first.getByRole('spinbutton', { name: 'From price', exact: true }).fill('450000');
  await page.getByRole('link', { name: 'Customers', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await expect(page.getByRole('alertdialog')).toHaveCSS('opacity', '1');
  await page.screenshot({
    animations: 'disabled',
    path: '/tmp/fauna-packages-discard.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByText('Changes saved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByRole('region', { name: 'Daily dips', exact: true })
      .getByRole('spinbutton', { name: 'From price', exact: true }),
  ).toHaveValue('450000');
  await page.screenshot({
    animations: 'disabled',
    path: '/tmp/fauna-packages-after.png',
    fullPage: true,
  });
  for (const [url, title] of [
    ['/en/', 'Daily dips'],
    ['/en/nature-pools/', 'Daily dips'],
    ['/en/nature-pools/pricing/', 'Daily dips'],
    ['/', 'Dagliga dopp'],
    ['/da/', 'Daglige dukkerter'],
    ['/it/', 'Bagni quotidiani'],
    ['/es/', 'Chapuzones diarios'],
    ['/pt/', 'Mergulhos diários'],
    ['/de/', 'Täglich eintauchen'],
    ['/pl/', 'Codzienne kąpiele'],
  ]) {
    await page.goto(url!);
    const card = page
      .locator('.fp-package')
      .filter({ has: page.getByRole('heading', { name: title!, exact: true }) });
    await expect(card).toContainText(/450[\s,.]?000/);
    await expect(card.getByRole('link')).toHaveAttribute('href', /package=glade/);
  }
  await page.goto('/en/configure/?package=glade');
  await expect(page.locator('cx-dropdown').filter({ hasText: 'Daily dips' })).toBeVisible();
});

test('failed saves keep edits and public read failures never show stale prices', async ({
  page,
}) => {
  await page.goto('/en/admin/packages/');
  const price = page.getByRole('spinbutton', { name: 'From price', exact: true }).first();
  await price.fill('470000');
  await page.route('**/api/admin/packages', async (route) => {
    if (route.request().method() === 'PATCH') await route.fulfill({ status: 503, json: {} });
    else await route.continue();
  });
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(
    page.getByText('Changes could not be saved. Your edits are still here. Try again.', {
      exact: true,
    }),
  ).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeInViewport();
  await expect(price).toHaveValue('470000');
  await page.screenshot({
    animations: 'disabled',
    path: '/tmp/fauna-packages-save-error.png',
    fullPage: true,
  });
  await page.getByRole('link', { name: 'Customers', exact: true }).click();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await page.route('**/api/packages', (route) => route.fulfill({ status: 503, json: {} }));
  await page.goto('/en/nature-pools/pricing/');
  await expect(
    page.getByText('Packages could not be loaded. Try again or contact us about your pool.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator('.fp-package')).toHaveCount(0);
  await page
    .locator('fp-package-comparison')
    .screenshot({ path: '/tmp/fauna-packages-unavailable.png' });
  await page.goto('/en/configure/?package=glade');
  await expect(page.locator('fp-enquiry-form button[type="submit"]')).toBeDisabled();
  await expect(
    page.getByText('Packages could not be loaded. Try again or contact us about your pool.', {
      exact: true,
    }),
  ).toBeVisible();
});
