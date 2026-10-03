import type { EnquirySubmission } from './enquiry-contracts.js';

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character]!;
  });

/** Email-safe HTML and a matching plain-text alternative from the saved form snapshot. */
export function enquiryEmailContent(
  input: Pick<EnquirySubmission, 'name' | 'email' | 'language' | 'fields'>,
  customerUrl: string,
): { subject: string; htmlContent: string; textContent: string } {
  const name = input.name?.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
  const heading = name ? `New enquiry from ${name}` : 'New website enquiry';
  const language = { en: 'English', sv: 'Swedish', da: 'Danish' }[input.language ?? 'en'];
  const fields = input.fields.filter((field) => field.value.trim());
  const isMessage = (field: (typeof fields)[number]) => ['notes', 'message'].includes(field.id);
  const messages = fields.filter(isMessage);
  const details = fields.filter((field) => !isMessage(field));
  const multiline = (value: string) => escapeHtml(value).replace(/\r\n|\r|\n/g, '<br>');
  const fieldHtml = (field: (typeof fields)[number]) =>
    `<p><strong>${escapeHtml(field.label)}</strong><br>${multiline(field.value)}</p>`;
  const fieldText = (field: (typeof fields)[number]) => `${field.label}\n${field.value}`;

  return {
    subject: name ? `New Faunapoolen enquiry — ${name}` : 'New Faunapoolen enquiry',
    htmlContent: [
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>New Faunapoolen enquiry</title></head><body>',
      `<h2>${escapeHtml(heading)}</h2>`,
      `<p>${escapeHtml(input.email)}<br>Language: ${language}</p>`,
      ...messages.map(fieldHtml),
      ...(details.length ? ['<h3>Enquiry details</h3>', ...details.map(fieldHtml)] : []),
      `<p><a href="${escapeHtml(customerUrl)}">View customer</a></p>`,
      '</body></html>',
    ].join('\n'),
    textContent: [
      heading,
      `${input.email}\nLanguage: ${language}`,
      ...messages.map(fieldText),
      ...(details.length ? ['Enquiry details', ...details.map(fieldText)] : []),
      `View customer: ${customerUrl}`,
    ].join('\n\n'),
  };
}
