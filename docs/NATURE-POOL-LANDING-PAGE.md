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

The homepage is the introduction; the nature-pool page answers the buying questions in depth.
It must also make sense to someone arriving directly from an advertisement. The accepted
composition, updated on 2 October 2026, follows this order:

1. The existing evening hero, with a short explanation, free pool consultation action and reassurance.
2. A new water-circuit illustration and three explanations: debris collection, biological filtration,
   and circulation. This replaces the repeated homepage benefits grid.
3. A new garden-layout illustration distinguishing swimming space from the complete footprint,
   with guidance about filtration, entry, depth, seating and construction access.
4. The shared Gotland preview with a detailed presentation: three additional real photographs
   explain its connection to the garden, natural stone and evening lighting. The existing customer
   quote and certification remain. The homepage retains its shorter presentation.
5. Shared starting prices, package differences and scope qualifications.
6. The shared three-step plan, with the existing landing-page explanation of assessment,
   quotation, approval and handover.
7. Everyday care, seasonal preparation and separately arranged support, paired with a new
   illustrative photograph of leaf collection.
8. Remaining practical questions and the existing inline enquiry form.

All new text and image alternatives have English, Swedish and Danish counterparts. The homepage
nature-pool link now promises information about how a pool could fit the visitor's garden.
The two architectural concept illustrations blend fine drafting lines with rendered water, stone
and planting, following the homepage visual direction without repeating its composition. The
filtration cutaway and garden plan are distinct transparent assets with localized alternative text;
they are not construction plans and carry no dimensions or baked-in labels. Page structure uses
the existing grid, stack, inline, button and list components. Captions explicitly distinguish illustrative
layouts and care imagery from completed-project evidence.

Image reuse is limited to reused sections: the Gotland presentation and the process background.
The nature-pool hero remains distinct from the homepage hero. See the
[image record](EDITORIAL-IMAGE-GENERATION.md#nature-pool-ownership-image-2-october-2026).

Filtration explanations were checked against Aquascape's
[recreational pond system](https://www.aquascapeinc.com/recreational-ponds),
[wetland filtration](https://www.aquascapeinc.com/wetland-filtration) and
[skimmer explanation](https://www.aquascapeinc.com/pond-skimmers).
Care and paid seasonal support use the established site service scope. The page does not promise
fixed running costs, maintenance intervals, build durations or suitability before assessment.

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
unchanged. The homepage benefits, process presentation and package source remain reusable. Package details are
shown in the ad landing context. The homepage's accepted composition is preserved.

## Verification

Use synthetic isolated E2E for submission, package-context changes, invalid inputs and recovery;
never submit a real enquiry during local browser review. Review the served English, Swedish and
Danish pages and the standalone form, including mobile layout. Protected article URLs, contents,
canonicals and redirects remain unchanged.

## Enquiry measurement follow-through

The owner authorized pre-launch consented enquiry measurement on 3 October 2026, superseding
the earlier deferral. Current account settings, event definitions, privacy boundaries and the
remaining live activation check are owned by [the SEO implementation record](SEO-IMPLEMENTATION.md#enquiry-and-measurement).

Advertising integrations and changes to bidding or campaign conversions are outside that work.
Qualified enquiries and sales remain distinct from raw confirmed submissions; review their
quality through the existing enquiry workflow.
