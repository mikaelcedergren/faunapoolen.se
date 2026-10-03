import assert from 'node:assert/strict';
import test from 'node:test';
import { enquiryEmailContent } from './enquiry-email-content.js';

test('notifications separate the message, retain experimental fields and omit empty answers', () => {
  const email = enquiryEmailContent(
    {
      name: 'Anna Svensson',
      email: 'anna@example.test',
      language: 'sv',
      fields: [
        { id: 'location', label: 'Town or postcode', value: 'Lund' },
        { id: 'phone', label: 'Phone', value: ' ' },
        {
          id: 'notes',
          label: 'Your ideas or questions',
          value: 'A garden pool.\nRoom for swimming.',
        },
        { id: 'future-field', label: 'Preferred start', value: 'Next spring' },
      ],
    },
    'https://example.test/en/admin/customers/?customer=synthetic',
  );
  assert.equal(email.subject, 'New Faunapoolen enquiry — Anna Svensson');
  assert.match(email.htmlContent, /Language: Swedish/);
  assert.match(email.htmlContent, /A garden pool\.<br>Room for swimming\./);
  assert.ok(email.htmlContent.indexOf('Your ideas') < email.htmlContent.indexOf('Enquiry details'));
  assert.match(email.htmlContent, /Preferred start/);
  assert.doesNotMatch(email.htmlContent, /Phone|Not provided|Reference:|Form:/);
  assert.match(
    email.htmlContent,
    /<a href="https:\/\/example.test\/en\/admin\/customers\/\?customer=synthetic">View customer<\/a>/,
  );
  assert.match(email.textContent, /Your ideas or questions\nA garden pool\.\nRoom for swimming\./);
  assert.match(email.textContent, /View customer: https:\/\/example.test/);
});

test('visitor text cannot inject HTML or subject headers', () => {
  const email = enquiryEmailContent(
    {
      name: '<img src=x>\r\nBcc: someone@example.test',
      email: 'a&b@example.test',
      fields: [
        {
          id: 'message',
          label: '<script>label</script>',
          value: '<a href="evil">Click</a> & text',
        },
      ],
    },
    'https://example.test/?customer=synthetic&view=history',
  );
  assert.doesNotMatch(email.subject, /[\r\n]/);
  assert.doesNotMatch(email.htmlContent, /<img|<script>|href="evil"/);
  assert.match(email.htmlContent, /&lt;script&gt;label/);
  assert.match(email.htmlContent, /a&amp;b@example.test/);
  assert.match(email.htmlContent, /customer=synthetic&amp;view=history/);
  assert.match(email.textContent, /<a href="evil">Click<\/a> & text/);
});

test('email-only enquiries have no invented name or empty sections', () => {
  const email = enquiryEmailContent(
    { email: 'visitor@example.test', fields: [] },
    'https://example.test/customer',
  );
  assert.equal(email.subject, 'New Faunapoolen enquiry');
  assert.match(email.htmlContent, /New website enquiry/);
  assert.doesNotMatch(email.htmlContent, /Enquiry details|Not provided/);
});
