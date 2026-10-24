import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test('returning visitors have one customer with independent enquiry history', async ({ page }) => {
  await page.goto('/en/admin/customers/');
  const email = `customer-${randomUUID()}@example.test`;
  const ids = [randomUUID(), randomUUID()];
  for (const [index, id] of ids.entries()) {
    const status = await page.evaluate(
      async ({ email, id, index }) => {
        const response = await fetch('/api/enquiries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId: id,
            email: index ? email.toUpperCase() : email,
            name: 'Synthetic returning visitor',
            language: 'en',
            formVersion: `experiment-${index + 1}`,
            fields: [
              {
                id: 'question',
                label: index ? 'New question' : 'Original question',
                value: index ? 'A second garden' : 'A first garden',
              },
            ],
          }),
        });
        return response.status;
      },
      { email, id, index },
    );
    expect(status).toBe(201);
  }
  await page.getByRole('textbox', { name: 'Username', exact: true }).fill('faunapoolen-e2e-owner');
  await page.locator('input[name="password"]').fill('faunapoolen-e2e-owner-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find a customer', exact: true }).fill(email);
  await expect(page.getByText('Synthetic returning visitor', { exact: true })).toHaveCount(1);
  await page.screenshot({ path: '/tmp/fauna-customers-list.png', fullPage: true });
  await page.getByText('Synthetic returning visitor', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Enquiry history' })).toBeVisible();
  await expect(page.getByText('Original question', { exact: true })).toBeVisible();
  await expect(page.getByText('New question', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark contacted', exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: 'Mark contacted', exact: true }).first().click();
  await page.getByRole('button', { name: 'Mark as customer', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Mark as lead', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark contacted', exact: true })).toHaveCount(1);
  await page.screenshot({ path: '/tmp/fauna-customers-history.png', fullPage: true });
  await page.getByRole('button', { name: 'All customers', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find a customer', exact: true }).fill('no-such-person');
  await expect(page.getByText('No matching customers', { exact: true })).toBeVisible();
  await page.screenshot({ path: '/tmp/fauna-customers-empty-search.png', fullPage: true });
});

test('email failure and unconfirmed outcomes offer distinct recovery actions', async ({ page }) => {
  const customerId = randomUUID(),
    enquiryId = randomUUID();
  const customer = {
    id: customerId,
    name: 'Synthetic email recovery',
    email: 'recovery@example.test',
    status: 'lead',
    revision: 1,
    createdAt: '2026-10-03T08:00:00Z',
    updatedAt: '2026-10-03T08:00:00Z',
    enquiries: [
      {
        requestId: enquiryId,
        customerId,
        name: 'Synthetic email recovery',
        email: 'recovery@example.test',
        language: 'en',
        formVersion: 'test-v1',
        fields: [
          { id: 'notes', label: 'Your garden', value: 'A synthetic enquiry for email recovery.' },
        ],
        status: 'new',
        revision: 1,
        createdAt: '2026-10-03T08:00:00Z',
        updatedAt: '2026-10-03T08:00:00Z',
        notification: {
          state: 'failed',
          revision: 1,
          attempts: 1,
          recipient: 'owner@example.test',
          messageId: null,
        },
      },
    ],
  };
  let failLoad = false;
  await page.route('**/api/admin/customers', (route) =>
    route.fulfill({ status: failLoad ? 503 : 200, json: { customers: [customer] } }),
  );
  await page.goto('/en/admin/customers/?customer=' + customerId);
  await page.getByRole('textbox', { name: 'Username', exact: true }).fill('faunapoolen-e2e-owner');
  await page.locator('input[name="password"]').fill('faunapoolen-e2e-owner-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry email', exact: true })).toBeVisible();
  await page.screenshot({ path: '/tmp/fauna-customers-email-failed.png', fullPage: true });
  await page.route('**/retry-email', (route) => {
    expect(route.request().postDataJSON()).toEqual({ expectedRevision: 1 });
    customer.enquiries[0]!.notification.state = 'queued';
    return route.fulfill({ status: 204 });
  });
  await page.getByRole('button', { name: 'Retry email', exact: true }).click();
  await expect(page.getByText('New · Email queued', { exact: true })).toBeVisible();
  customer.enquiries[0]!.notification.state = 'uncertain';
  await page.getByRole('button', { name: 'Reload', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry email', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Review email status', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Not sent — queue again', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: '/tmp/fauna-customers-email-review.png', fullPage: true });
  await page.route('**/resolve-email', (route) => {
    expect(route.request().postDataJSON()).toEqual({ expectedRevision: 1, outcome: 'sent' });
    customer.enquiries[0]!.notification.state = 'sent';
    return route.fulfill({ status: 204 });
  });
  await page.getByRole('button', { name: 'Already sent', exact: true }).click();
  await expect(page.getByText('New · Marked as sent', { exact: true })).toBeVisible();
  failLoad = true;
  await page.getByRole('button', { name: 'Reload', exact: true }).click();
  await expect(
    page.getByText('Customers could not be loaded. Try again.', { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: '/tmp/fauna-customers-load-error.png', fullPage: true });
  failLoad = false;
  await page.getByRole('button', { name: 'Reload', exact: true }).click();
  await expect(
    page.getByText('Customers could not be loaded. Try again.', { exact: true }),
  ).toHaveCount(0);
});
