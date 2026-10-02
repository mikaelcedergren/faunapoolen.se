# Nature-pool lead journey

The owner designated `/nature-pools/` and its localized equivalents as paid-traffic landing
pages on 2 October 2026. The primary outcome is a nature-pool enquiry. This work prepares the
page and form locally; it does not publish the redesign or enable advertising or measurement.

## Story and layout

The customer wants a place to swim at home, but may be unsure about suitability, budget and
how to begin. Faunapoolen is the guide: a completed customer project, certified expertise,
a three-step plan and a free initial phone consultation. The message applies
[StoryBrand's customer-as-hero framework](https://storybrand.com/downloads/your-brand-is-not-the-hero.pdf).
Do not invent urgency, guarantees, customer quotes, build durations or measured conversion gains.

The nature-pool page follows this order:

1. The existing evening hero, with a free pool consultation action and reassurance.
2. Shared natural-pool benefits, with an introduction addressing the buyer's uncertainty.
3. Real Gotland photography, Brita's existing customer quote and concise Aquascape certification.
4. A customer-facing three-step plan in the shared process presentation.
5. Shared starting prices, with the features that distinguish the packages and scope qualifications.
6. Practical answers about space, care, site visits, timing, disruption, budget and location.
7. An inline enquiry form. No competing closing invitation follows it.

The shared masthead remains visually identical, including navigation, language selector and accent
Contact us button. On this landing page Contact us and the page's consultation actions lead to its
own form. The package actions carry the chosen pool to the same form without discarding contact
information already entered. Language changes preserve package and fragment context.

No guide, supplier, social-video, separate case-study or unrelated water-feature links appear in
the landing-page body. The masthead is the intentional exception. The existing real Gotland photos
remain untouched. Concept imagery is not evidence of a customer installation.

## Proof and commercial facts

The testimonial comes from `FAUNAPOOLEN_TESTIMONIALS`, whose Swedish customer wording was
preserved from the original site. The landing presentation uses Brita's statement about enjoying
the pool with her grandchildren, with her name and project context. It is not a new testimonial.

The package facts were checked against the owner's
[published package page](https://faunapoolen.se/pond-packages-landing.html) on 2 October 2026:

- Daily dips corresponds to the compact Plunge series, with BioFalls filtration and water plants.
- Swim together corresponds to the Swim series: 1.5 m depth, wetland filtration and separate intake,
  natural stone, lighting and water jets.
- More room corresponds to the Waterfront series, with waterfalls, boulders, garden and aquatic
  planting, and lighting.

Starting prices remain 430,000 / 1,100,000 / 4,400,000 SEK, excluding VAT and shipping. Swim areas
remain 17.5 / 24 / 100 square metres. These are shared source values, not page-specific copies.
The quotation clarifies groundwork, soil removal, electrical work, filling, transport and the
agreed finish; the page does not imply that every site's work is covered by its starting price.
No universal build duration or response deadline is promised without owner confirmation.

## Form and reuse

The existing enquiry implementation is extracted into one shared form component, used by the
standalone configure page and the inline landing form. Validation, disabled/pending states,
request identity, ambiguous-receipt recovery and the server contract keep one owner.

The inline form asks for name, email and town/postcode, with optional phone and notes. It fixes the
service to nature pool. Package choice is optional and only appears after a package is selected.
Choosing Not decided yet removes the preference, without losing contact details. Standalone pool
forms also omit the unrelated service choice and retain their optional package dropdown. General
contact forms retain their service choices. No new enquiry fields or database changes are needed.

The Gotland preview supports the focused proof presentation; its homepage presentation remains
unchanged. Benefits, process presentation and package source remain reusable. Package details are
shown in the ad landing context. The homepage's accepted composition is preserved.

## Verification

Use synthetic isolated E2E for submission, package-context changes, invalid inputs and recovery;
never submit a real enquiry during local browser review. Review the served English, Swedish and
Danish pages and the standalone form, including mobile layout. Protected article URLs, contents,
canonicals and redirects remain unchanged.

## Deferred follow-up: ad-to-lead measurement

The owner explicitly deferred audit point 7 on 2 October 2026. Keep measurement disabled as it is;
no tags, consent changes or ad integrations are activated by this work.

Before judging campaign performance, review and enable appropriate production measurement,
connect campaign source to landing visits, form starts and confirmed receipts, and agree how
qualified enquiries are distinguished from raw submissions. Validate actual payloads and consent
behaviour before activation. Compare cost per qualified lead, not only button clicks or form volume.
This is follow-up work, not evidence of the page's current conversion performance.
