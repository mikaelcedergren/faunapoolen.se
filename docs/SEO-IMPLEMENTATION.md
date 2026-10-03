# Swedish search and package enquiries

Implementation of [the SEO growth plan](SEO-SWEDISH-GROWTH-PLAN.md), with the owner's corrections of 17 September 2026.

## Product decisions

- Public page slugs are **English in every language**. Swedish stays at `/`, English at `/en/`, Danish at `/da/`. Existing blog slugs are unchanged; the five new guide slugs use Swedish.
- The offer covers **all Sweden and Denmark**. Skåne, Halland, Blekinge and Småland receive additional search content because they are close to home. EU-wide service is a future ambition.
- The three current starting prices—430,000 / 1,100,000 / 4,400,000 SEK excluding VAT and shipping—were confirmed by the owner on 2 October 2026 to match the [live package overview](https://faunapoolen.se/pond-packages-landing.html). Starting swimming areas use the same listed dimensions: 3.5 × 5 = 17.5 m², 6 × 4 = 24 m², and 10 × 10 = 100 m². Their existing shared package source owns numbers, swimming areas and inclusions. Site-specific quotations determine final scope and price.
- Emotional homepage and nature-pool headlines, real Gotland evidence, the three package choices, free first phone consultation and paid/credited site visit terms stay intact.
- No database format, private enquiry data, generation setting or production deployment is changed by this work.

These decisions supersede the corresponding draft assumptions in the plan.

## Routes and content

The shared public catalogue owns 93 canonical paths: fourteen commercial/index page families and seventeen guides in three languages. It also owns fifty-three one-hop aliases, including the previous Swedish/Danish page paths and inherited legacy routes.

| Purpose                        | Swedish-language canonical                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Service                        | `/nature-pools/`                                                                                      |
| Prices and the three packages  | `/nature-pools/pricing/`                                                                              |
| Regional service detail        | `/nature-pools/skane/`, `/nature-pools/halland/`, `/nature-pools/blekinge/`, `/nature-pools/smaland/` |
| Gotland case                   | `/projects/gotland/`                                                                                  |
| Other water features           | `/waterscapes/`                                                                                       |
| Company, questions and cookies | `/about/`, `/faq/`, `/cookies/`                                                                       |
| Enquiry                        | `/configure/`                                                                                         |
| Guides                         | `/blog/` and preserved/new literal `.html` article paths                                              |

The Projects overview has been removed. Its former addresses redirect directly to the localized Gotland case, which remains linked from the start page. Header and footer share one navigation list, including Prices. The footer uses the shared language selector, a logo without a wordmark, email and a Cookie settings link on the alternate surface. The water-image invitation above it links to localized prices.

Prefix the same paths with `/en` or `/da` for the other languages. `/pricing/` and its counterparts go straight to the price hub. Its water-feature quotation section retains the planned `#waterfall` and `#fountains` fragment destinations; fragments cannot be inspected by a server redirect.

All retained main pages have distinct search titles/descriptions and relevant links. The new price hub explains starting prices, cost drivers, total footprint, scope and ownership. Four regional pages use actual local authority guidance and accurately located Gotland evidence, without invented offices or local projects. The guide index groups planning, water/care and other garden water subjects.

Ten eligible guides have been rewritten in English, Swedish and Danish. Five additional guides cover space, care through the year, the commissioned build process, Swedish safety/permission questions and ownership costs. Numerical operating-cost examples are explicitly hypothetical, with declared assumptions; they are not a promise about installed equipment or running costs.

## Article editing policy — 3 October 2026

The owner removed the special protection for the DIY and comparison articles. Their bodies,
headings, introductions, titles, descriptions, imagery and related reading may now be improved
in all three locales under the ordinary editorial workflow. No separate protection-rule approval
is required. Their established URLs, language relationships and indexability retain the same
continuity checks as other articles.

Historical fixtures remain reference material; current authored translations and metadata own
rendering expectations. The public and browser checks no longer enforce frozen prose or a list
of narrow exceptions. This policy supersedes earlier preservation instructions and exception
records in the SEO growth plan and guide reviews. This change does not itself rewrite articles.

## Enquiry and measurement

Package actions carry their stable choice into the enquiry. Changes to package/service update the non-personal URL state, so refresh and header/footer/suggested-language navigation preserve it. Canonicals stay clean. The form still accepts a conversation without a package and still confirms a lead only after a durable accepted receipt.

The existing public GA4 property (`G-E1BFSP43WZ`, property `465257705`, stream `9884717759`)
has a **disabled production transport pending the launch payload check**. On 3 October 2026,
the owner authorized the pre-launch measurement work. Google tag user-provided data capabilities
and automatic history, scroll, outbound-click, form, video and download detection were disabled;
GA4 enhanced measurement was also switched off. These account settings take effect on the existing
live tag too. Ordinary page views remain available on the old site.

The same account review registered `generate_lead` as a key event (once per event, no default
monetary value) and added four event-scoped custom dimensions: Enquiry landing page
(`landing_path`), Enquiry source group (`source_group`), Enquiry package (`package_id`) and
Enquiry service (`service`). The saved key-event list shows no received `generate_lead` data yet,
as expected before launch. Existing advertising conversion definitions were left unchanged.

The adapter and opt-in interface are tested locally without loading Google. Enable
`GOOGLE_COLLECTION_REVIEWED` only after actual payloads from the candidate have been checked at
the published origin during the separately authorized release. Account settings alone do not
prove the live transport. See [Google’s page-view guidance](https://developers.google.com/analytics/devguides/collection/ga4/views).

There are no analytics requests, analytics cookies or visit-context storage before the visitor
allows statistics. Advertising tags are not enabled. A compact, non-modal framework popover offers
equally styled Reject and Accept actions. The choice persists across public pages and locales;
visitors can reopen it through Cookie settings in every public footer. Localized `/cookies/` pages
explain purpose, storage, lifetimes and withdrawal. Enquiries work when statistics are declined.

| Event                     | Meaning                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| `page_view`               | An eligible public canonical page viewed with permission           |
| `package_comparison_view` | The comparison entered the viewport                                |
| `package_interest`        | A package enquiry action selected                                  |
| `enquiry_start`           | Meaningful form input began                                        |
| `generate_lead`           | A matching accepted enquiry receipt was confirmed                  |
| `enquiry_error`           | Validation, rate limiting or unconfirmed delivery; no input values |

Context is limited to clean public page/landing paths, language, a broad source category (`search`, `paid`, `referral`, `direct` or `internal`) and valid package/service values. Paid click markers and recognized paid campaign media are classified only after consent; their values are never retained or sent. The category describes the consented visit context, not proof of an individual search query or complete attribution. Raw query strings, referrer URLs, contact data, free-text notes, exact locations and request IDs are not sent. Visit context is held only in browser session storage after opt-in. Declining clears that context and removes applicable GA cookies.

The private inbox remains the sole enquiry authority. Qualification and wins are assessed in the existing business workflow; this implementation does not relabel contacted/closed as qualified/won. Persistent new outcome fields would require separately coordinated shared-storage work. Monthly lead-quality review can use the existing records without adding a parallel operational store.

## Account and publication follow-through

Website implementation does not grant access to private Search Console or analytics accounts, and it does not perform outreach or change a Business Profile.

After a requested production release:

1. Verify actual canonical pages, one-hop redirects, article URL continuity and the sitemap at the published origin.
2. Recheck the saved account restrictions, verify actual Google request payloads at the published origin, and then enable the reviewed production transport. Confirm a successful enquiry arrives once as `generate_lead`, that rejection sends nothing, and that withdrawal stops collection. `generate_lead` is the confirmed-receipt event, never a contact-page visit. No arbitrary monetary lead value is assigned. Event-scoped reporting uses `landing_path`, `source_group`, `package_id` and `service`; launch verification must confirm these arrive in Analytics.
3. Capture Search Console's actual query/page baseline, inspect new URLs and the sitemap, then compare meaningful 28-day and seasonal windows. No search-volume, ranking-growth or conversion-rate estimate is invented here.
4. Review suitable pool enquiries by actual project location. A visit to the Skåne page is not proof the visitor lives there; aggregate organic query data cannot be joined to an individual customer's search.
5. Review current authority guidance and genuine project evidence before changing related claims. Reconcile the new guides' first-publication dates if the first release is later than their prepared date.

The plan's longer-term monitoring, genuine new project collection and authorized account/outreach work remain operational activities after implementation, not fabricated completed results.

## Verification contract

### Content modification dates

The sitemap generator reads `dateModified` from each canonical page's own structured-data node.
The source is `PageSeo.dateModified`; update it only for a significant content change, using a
known `YYYY-MM-DD` date. Articles with a recorded publication date may use that date until their
first revision. Unknown dates are omitted. Builds, file timestamps and repository-wide commits
never refresh sitemap dates. Invalid, future or conflicting dates fail generation.

The DIY and comparison guides record 3 October 2026 for their approved metadata, content and
contextual-link revisions in all three locales. No original publication date is invented.

### Checks

Use the repository's [change-aware verification](../DEVELOPMENT-VERIFICATION.md). Public tests read the exact candidate directory, including staged releases, check all canonical/language identities and verify authored guide translations. Sitemap generation proves exact route-set equality, rejects unintended duplicate canonical claims and requires reciprocal actual language counterparts. Synthetic browser journeys cover page discovery, package choice, language continuity, receipt recovery, consent and authored article content.

Tests never submit to the real inbox or read operational data. Production publication remains a separate instruction under the [development and release contract](../../SERVER-STANDARD.md#local-development).

## Historical verification — 17 September 2026

The following records the earlier preservation gate; it does not impose current editing restrictions.

`pnpm verify:change` passed against the integrated source: the full repository gate, 51 isolated browser journeys, Angular hot reload and the rendered development homepage. The public build checks 191 page/content/SEO assertions, including all 93 canonicals and all six protected article variants. The exact staged browser output is also checked during isolated E2E setup. These read-only artifact tests run in the existing guarded process (`--test-isolation=none`) so Node does not drop the hermetic runner's inherited lease when spawning a test worker; the network and temporary-data guard remain active.

Desktop screenshots at 1280 × 720 were reviewed for all fourteen main page families, including all four regional heroes, the package comparison, grouped guide index, a new guide's introduction and reading layout, and the enquiry package menu. Existing emotional hero copy and the shared visual framework remain intact. The guide groups use the existing editorial heading treatment. New article bylines identify Faunapoolen and the substantive revision date; protected articles do not receive that addition.

The original two article source files and historical baseline fixture have no diff. Their original catalogue objects, three-language content fields, and historical related-reading order and destinations are protected separately; current card wording follows the 3 October presentation decision. The original stored introductions are visible again.

This is a verified development implementation, not a production release or evidence of improved Google rankings. Production analytics remains disabled pending the live payload and consent check above; the account-side collection restrictions have been corrected. The simultaneously revised five editorial images and their image-generation record belong to separate owner work; this SEO implementation preserves them.

## Historical guide inline-image exception — 3 October 2026

The owner requested relevant, stylistically consistent photographs inside every guide. Nine new guide-only assets replace the original in-article photographs; supplier and case-study originals remain unchanged. In the protected DIY guide, only the English and Swedish image tags change, from the unrelated mood photograph to construction materials. The Danish guide has no image and keeps that structure. Historical fixtures remain untouched; `approved-guide-inline-image-replacement.json` permits only these exact tags. Existing protected-copy exceptions continue to apply independently.

## Swedish language review — 3 October 2026

The [plain-Swedish review](SWEDISH-COPY-REVIEW.md) preserves every SEO metadata field and
both protected article bodies. Its only additional protected-content exception removes one
duplicated final full stop from the Swedish DIY introduction. The historical fixtures remain
unchanged, and the protected-content checks allow only that exact punctuation correction.

## Comparison guide revision — 3 October 2026

The owner approved distinct search titles and descriptions for the DIY and comparison guides,
and a balanced comparison covering natural-pool space, care, nutrient management and seasonal
character. The comparison no longer promises universally lower running costs or self-maintenance.
All three locales use the revised claims. This pass adds no links from main pages into the blog
and updates contextual links inside both guides to the current localized package prices,
price guide, installation process and aftercare checklist. Main-page content and navigation
remain unchanged.

Editorial references, checked 3 October 2026:

- [Aquascape recreational ponds](https://www.aquascapeinc.com/recreational-ponds): filtration space, nutrient processing and maintenance access.
- [Aquascape filtration](https://www.aquascapeinc.com/professionals/blog/contractor-articles/the-most-effective-way-to-filter-pond-water): mechanical debris collection and biological treatment.
- [Aquascape ecosystem balance](https://www.aquascapeinc.com/water-gardening/how-to/your-pond-a-balanced-ecosystem): circulation, leaf collection and nutrient sources.

These references support the biological-system and maintenance explanation, not a quantified
comparison of costs, health outcomes or environmental impact. No external source blocks were
added to the public articles.
