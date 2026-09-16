# Swedish search and package enquiries

Implementation of [the SEO growth plan](SEO-SWEDISH-GROWTH-PLAN.md), with the owner's corrections of 17 September 2026.

## Product decisions

- Public page slugs are **English in every language**. Swedish stays at `/`, English at `/en/`, Danish at `/da/`. Existing blog slugs are unchanged; the five new guide slugs use Swedish.
- The offer covers **all Sweden and Denmark**. Skåne, Halland, Blekinge and Småland receive additional search content because they are close to home. EU-wide service is a future ambition.
- The three current starting prices—495,000 / 695,000 / 995,000 SEK including VAT—are owner-confirmed. Their existing shared package source owns numbers, swimming areas and inclusions. Site-specific quotations determine final scope and price.
- Emotional homepage and nature-pool headlines, real Gotland evidence, the three package choices, free first phone consultation and paid/credited site visit terms stay intact.
- No database format, private enquiry data, generation setting or production deployment is changed by this work.

These decisions supersede the corresponding draft assumptions in the plan.

## Routes and content

The shared public catalogue owns 93 canonical paths: fourteen commercial/index page families and seventeen guides in three languages. It also owns fifty one-hop aliases, including the previous Swedish/Danish page paths and inherited legacy routes.

| Purpose                       | Swedish-language canonical                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| Service                       | `/nature-pools/`                                                                                      |
| Prices and the three packages | `/nature-pools/pricing/`                                                                              |
| Regional service detail       | `/nature-pools/skane/`, `/nature-pools/halland/`, `/nature-pools/blekinge/`, `/nature-pools/smaland/` |
| Projects and case             | `/projects/`, `/projects/gotland/`                                                                    |
| Other water features          | `/waterscapes/`                                                                                       |
| Company and questions         | `/about/`, `/faq/`                                                                                    |
| Enquiry                       | `/configure/`                                                                                         |
| Guides                        | `/blog/` and preserved/new literal `.html` article paths                                              |

Prefix the same paths with `/en` or `/da` for the other languages. `/pricing/` and its counterparts go straight to the price hub. Its water-feature quotation section retains the planned `#waterfall` and `#fountains` fragment destinations; fragments cannot be inspected by a server redirect.

All nine original main pages have distinct search titles/descriptions and relevant links. The new price hub explains starting prices, cost drivers, total footprint, scope and ownership. Four regional pages use actual local authority guidance and accurately located Gotland evidence, without invented offices or local projects. The guide index groups planning, water/care and other garden water subjects.

Ten eligible guides have been rewritten in English, Swedish and Danish. Five additional guides cover space, care through the year, the commissioned build process, Swedish safety/permission questions and ownership costs. Numerical operating-cost examples are explicitly hypothetical, with declared assumptions; they are not a promise about installed equipment or running costs.

## Protected articles

The two successful article bodies, titles, translations, URLs, image URLs and metadata remain preserved. Their original stored introductions are restored in the shared renderer after the omission identified in the planning audit. Historical related-reading labels stay stable even though the linked articles are revised.

The historical Swedish/English fixture is retained. A separate pre-change fixture extends the exact localized content protection to Danish. Shared public navigation follows the owner's new English-slug decision; article-owned old links remain untouched and continue through the redirect catalogue. New optional statistics controls are excluded from the protected article presentation.

## Enquiry and measurement

Package actions carry their stable choice into the enquiry. Changes to package/service update the non-personal URL state, so refresh and header/footer/suggested-language navigation preserve it. Canonicals stay clean. The form still accepts a conversation without a package and still confirms a lead only after a durable accepted receipt.

The existing public GA4 property has a **disabled production transport**: its public configuration currently enables automatic history, form and user-provided-data collection, which would bypass the sanitized event boundary. The adapter and opt-in interface can be verified locally; production hides the statistics controls and loads no Google tag. Enable `GOOGLE_COLLECTION_REVIEWED` only after the property settings are corrected and actual payloads verified. See [Google’s page-view guidance](https://developers.google.com/analytics/devguides/collection/ga4/views). There are no analytics requests, analytics cookies or visit-context storage before the visitor allows statistics. Advertising tags are not enabled. Visitors can change the choice in the footer. Development and isolated tests never load Google; the same sanitized event contract can be inspected locally.

| Event                     | Meaning                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| `page_view`               | An eligible public canonical page viewed with permission           |
| `package_comparison_view` | The comparison entered the viewport                                |
| `package_interest`        | A package enquiry action selected                                  |
| `enquiry_start`           | Meaningful form input began                                        |
| `generate_lead`           | A matching accepted enquiry receipt was confirmed                  |
| `enquiry_error`           | Validation, rate limiting or unconfirmed delivery; no input values |

Context is limited to clean public page/landing paths, language, a broad source category and valid package/service values. Raw query strings, referrer URLs, contact data, free-text notes, exact locations and request IDs are not sent. Visit context is held only in browser session storage after opt-in. Declining clears that context and removes applicable GA cookies.

The private inbox remains the sole enquiry authority. Qualification and wins are assessed in the existing business workflow; this implementation does not relabel contacted/closed as qualified/won. Persistent new outcome fields would require separately coordinated shared-storage work. Monthly lead-quality review can use the existing records without adding a parallel operational store.

## Account and publication follow-through

Website implementation does not grant access to private Search Console or analytics accounts, and it does not perform outreach or change a Business Profile.

After a requested production release:

1. Verify actual canonical pages, one-hop redirects, protected output and the sitemap at the published origin.
2. Disable automatic history/form/outbound-click and user-provided-data collection on the existing GA4 property, verify actual payloads, and then enable the reviewed production transport. Check consented events arrive. Configure `generate_lead` as a key event and appropriate custom dimensions if those reports are wanted.
3. Capture Search Console's actual query/page baseline, inspect new URLs and the sitemap, then compare meaningful 28-day and seasonal windows. No search-volume, ranking-growth or conversion-rate estimate is invented here.
4. Review suitable pool enquiries by actual project location. A visit to the Skåne page is not proof the visitor lives there; aggregate organic query data cannot be joined to an individual customer's search.
5. Review current authority guidance and genuine project evidence before changing related claims. Reconcile the new guides' first-publication dates if the first release is later than their prepared date.

The plan's longer-term monitoring, genuine new project collection and authorized account/outreach work remain operational activities after implementation, not fabricated completed results.

## Verification contract

Use the repository's [change-aware verification](../DEVELOPMENT-VERIFICATION.md). Public tests read the exact candidate directory, including staged releases, check all canonical/language identities and verify authored guide translations. Sitemap generation proves exact route-set equality, rejects unintended duplicate canonical claims and requires reciprocal actual language counterparts. Synthetic browser journeys cover page discovery, package choice, language continuity, receipt recovery, consent and protected content.

Tests never submit to the real inbox or read operational data. Production publication remains a separate instruction under the [development and release contract](../../SERVER-STANDARD.md#local-development).

## Verified in development — 17 September 2026

`pnpm verify:change` passed against the integrated source: the full repository gate, 51 isolated browser journeys, Angular hot reload and the rendered development homepage. The public build checks 191 page/content/SEO assertions, including all 93 canonicals and all six protected article variants. The exact staged browser output is also checked during isolated E2E setup. These read-only artifact tests run in the existing guarded process (`--test-isolation=none`) so Node does not drop the hermetic runner's inherited lease when spawning a test worker; the network and temporary-data guard remain active.

Desktop screenshots at 1280 × 720 were reviewed for all fourteen main page families, including all four regional heroes, the package comparison, grouped guide index, a new guide's introduction and reading layout, and the enquiry package menu. Existing emotional hero copy and the shared visual framework remain intact. The guide groups use the existing editorial heading treatment. New article bylines identify Faunapoolen and the substantive revision date; protected articles do not receive that addition.

The original two article source files and historical baseline fixture have no diff. Their original catalogue objects, three-language content fields, and historical related-reading text, order and destinations are protected separately. The original stored introductions are visible again.

This is a verified development implementation, not a production release or evidence of improved Google rankings. Production analytics remains disabled pending the account-side correction above. The simultaneously revised five editorial images and their image-generation record belong to separate owner work; this SEO implementation preserves them.
