# Public search and package enquiries

Current implementation of [the SEO growth plan](SEO-SWEDISH-GROWTH-PLAN.md), reconciled with the owner's service-area and language decisions of 24 October 2026 and the site-wide review of 5 November 2026. Dated records below describe the scope verified at the time; they do not override current product decisions.

## Product decisions

- Public page slugs are **English in every language**. Swedish stays at `/`; English, Danish, Italian, Spanish, European Portuguese, German and Polish use `/en/`, `/da/`, `/it/`, `/es/`, `/pt/`, `/de/` and `/pl/`. Existing blog slugs and literal `.html` URLs remain unchanged.
- The offer covers **the whole EU, primarily Sweden and Denmark**. Skåne, Halland, Blekinge and Småland retain regional guidance and remain named in the service-area FAQ. Regional pages do not imply offices or completed projects in those regions.
- The current public package catalogue at `/api/packages` owns editable package titles and starting prices. Prices remain in SEK, excluding VAT and shipping, and are fetched with `no-store`; builds and editorial documents must not freeze an old price into public HTML. The shared package definitions own dimensions, swimming areas and inclusions. Static package specifications are prerendered, while current prices arrive from the API. Site-specific quotations determine final scope and price.
- Emotional homepage and nature-pool headlines, real Gotland evidence, the three package choices, free first phone consultation and paid/credited site visit terms stay intact.
- The owner reconfirmed the existing construction-cost, running-cost and care estimates on 5 November 2026. Their approved values and wording remain unchanged.
- This SEO change does not alter the database format, private enquiry data or paid-generation setting. Production publication remains a separate action.

These decisions supersede the corresponding draft assumptions in the plan.

## Routes and content

The shared public catalogue owns **288 canonical paths**: fourteen commercial/index page families and twenty-two guides in eight languages. It also owns the one-hop aliases for previous translated page paths and inherited legacy routes. `server/src/public-routes.ts` is the route authority; current tests derive completeness from that catalogue.

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

The Projects overview has been removed. Its former addresses redirect directly to the localized Gotland case, which remains linked from the start page. Header and footer include Prices. The footer also links to the localized questions-and-answers and cookie-information pages; Cookie settings remains a separate consent action. The footer retains the shared language selector, logo and contact details. The nature-pool page's location FAQ links to all four regional planning guides in its own language.

Prefix the same paths with the relevant language root for the other seven languages. `/pricing/` and its counterparts go straight to the price hub. Existing fragment destinations are preserved; fragments cannot be inspected by a server redirect.

All retained main pages have distinct search titles/descriptions and relevant links. The new price hub explains starting prices, cost drivers, total footprint, scope and ownership. Four regional pages use actual local authority guidance and accurately located Gotland evidence, without invented offices or local projects. The guide index groups planning, water/care and other garden water subjects.

All twenty-two guides have complete bodies, metadata and localized internal links in all eight languages. Their subjects include planning, prices, filtration, space, seasonal care, heating, the commissioned build process, Swedish safety/permission questions and ownership costs. Legal guidance about Sweden remains explicitly scoped to Sweden in translations. Numerical operating-cost examples are hypothetical, with declared assumptions; they are not a promise about installed equipment or running costs.

## Article editing policy — 3 October 2026

The owner removed the special protection for the DIY and comparison articles. Their bodies,
headings, introductions, titles, descriptions, imagery and related reading may now be improved
in all eight locales under the ordinary editorial workflow. No separate protection-rule approval
is required. Their established URLs, language relationships and indexability retain the same
continuity checks as other articles.

Historical fixtures remain reference material; current authored translations and metadata own
rendering expectations. The public and browser checks no longer enforce frozen prose or a list
of narrow exceptions. This policy supersedes earlier preservation instructions and exception
records in the SEO growth plan and guide reviews. This change does not itself rewrite articles.

## Enquiry and measurement

Package actions carry their stable choice into the enquiry. Changes to package/service update the non-personal URL state, so refresh, header/footer navigation and explicit language selection preserve it. Canonicals stay clean. The form still accepts a conversation without a package and still confirms a lead only after a durable accepted receipt.

The existing public GA4 property (`G-E1BFSP43WZ`, property `465257705`, stream `9884717759`)
has a **disabled production transport pending the launch payload check**. On 3 October 2026,
the owner authorized the pre-launch measurement work. Google tag user-provided data capabilities
and automatic history, scroll, outbound-click, form, video and download detection were disabled;
GA4 enhanced measurement was also switched off. These account settings take effect on the existing
live tag too. This historical account review does not establish that the current transport has been reviewed or enabled; Google collection remains disabled in every environment.

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
allows statistics. Statistics consent never enables advertising. A compact, non-modal framework
popover starts with a compact purpose summary and directly available Reject and Accept
actions. While Google collection is disabled, development and production offer only Meta
marketing consent: a lime Cookies heading, a default Reject button, a lime Accept button, and
Cookie details. No category switches or extra settings step are shown for this single purpose.
If Google collection is enabled after review, the existing separate purpose controls return.
Choices persist across public pages and locales. Cookie settings in every public footer reopens
the notice; Reject withdraws consent immediately. Closing reopened settings preserves the saved
choice. Localized `/cookies/` pages explain the active purpose, storage, lifetimes and withdrawal.
Enquiries work when optional cookies are declined.

| Event                     | Meaning                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| `page_view`               | An eligible public canonical page viewed with permission           |
| `package_comparison_view` | The comparison entered the viewport                                |
| `package_interest`        | A package enquiry action selected                                  |
| `enquiry_start`           | Meaningful form input began                                        |
| `generate_lead`           | A matching accepted enquiry receipt was confirmed                  |
| `enquiry_error`           | Validation, rate limiting or unconfirmed delivery; no input values |

Context is limited to clean public page/landing paths, language, a broad source category (`search`, `paid`, `referral`, `direct` or `internal`) and valid package/service values. Paid click markers and recognized paid campaign media are classified only after consent; their values are never retained or sent. The category describes the consented visit context, not proof of an individual search query or complete attribution. Raw query strings, referrer URLs, contact data, free-text notes, exact locations and request IDs are not sent. Visit context is held only in browser session storage after opt-in. Declining clears that context and removes applicable GA cookies.

### Meta website tracking

On 28 October 2026, the owner requested website tracking with Meta pixel
`1698072815050895`. The separate `SiteMarketing` consent owner feeds the `MetaPixel` transport;
the Google measurement payload restrictions above describe Google, not Meta's browser SDK.
Existing Google consent never grants marketing consent. The public cookie panel and cookie
details describe the active Meta purpose in all eight locales. No tracking is enabled for a new
visitor. Google collection remains disabled in every environment under its existing review gate.

Meta loads only after marketing opt-in on `https://faunapoolen.se`. There is no unconditional
head script or noscript image. Local, preview and isolated test origins dispatch observable
local events but never load the SDK or contact Meta. `PageView` follows public canonical page
visits, with duplicate calls on the same page suppressed. `Lead` follows the existing confirmed
enquiry receipt, including the interrupted-receipt retry path; it is not a button-click event.
No form field values, advanced-matching identifiers, monetary values or custom parameters are
passed to Meta. SDK automatic configuration and automatic history page views are disabled in
code, leaving the two explicit event calls. Private/non-canonical routes do not emit events;
an in-app transition to one revokes the SDK's consent and discards queued events.

Meta's SDK can send page/referring addresses, ad click identifiers, browser/cookie identifiers
and technical information such as IP addresses. Do not put personal information in public
URLs. Cookie details distinguish that processing from the cleaner Google event payload.
Withdrawal revokes SDK consent, removes queued event calls if the SDK is still downloading,
and clears this site's `_fbp` and `_fbc` cookies. Withdrawal in another tab also stops this
document's marketing events. Previously sent data and cookies on Meta's domains cannot be
removed by this website.

Development verification covers independent choices, persistence, withdrawal, private routes,
confirmed leads, download races, and absence of external requests locally. This is not proof of
Meta account ownership or live event receipt. At separately requested publication, confirm the
pixel/account with the campaign owner, review Events Manager automatic events and automatic
advanced matching (keep both off), and inspect actual network payloads and Test events for one
page view and one confirmed lead. Confirm no requests before consent or after withdrawal.
Do not treat a local synthetic event as proof that Meta received it.

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

Every guide uses an `Article` node with its visible H1 as `headline`. Known substantive modification dates are emitted independently of publication dates; an unknown original publication date remains omitted. The DIY and comparison guides record 5 November 2026 for the current substantive revisions. Builds do not manufacture freshness.

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

## Site-wide SEO review and implementation — 5 November 2026

### Observed production baseline

The read-only public crawl covered all 288 canonical URLs. Every URL returned HTTP 200; the crawl checked titles, descriptions, canonical URLs and language alternatives, and found no missing image `alt` attributes. These observations concern the published baseline, not publication of the changes below. A present `alt` attribute is not, by itself, proof of a good image description.

The public link graph identified 48 canonical pages without an incoming link from another public page: the FAQ, cookie-information and four regional page families in eight languages. The sitemap listed them, but the ordinary site navigation did not provide the same discovery paths. A public text fetch also exposed the pricing layout placeholder as a fabricated starting price of 888,888,888 SEK.

### Implemented corrections

- The footer now links to FAQ and cookie information in every locale, independently of the Cookie settings action. The nature-pool location FAQ links to the four regional planning guides. These changes provide public discovery paths for the 48 previously orphaned routes.
- Package sizes, static specifications and inclusion details are present in prerendered content. Editable titles and prices retain the existing `/api/packages` authority and loading/error behavior; the build does not embed stale prices. The fabricated numeric reservation was replaced by truthful VAT/shipping wording.
- Image width and height values now match the measured source assets, including the conversion-guide images. Image URLs and real Gotland photography are preserved.
- All 22 guides emit `Article` structured data with the visible H1 as `headline`. Known modification dates are independent of unknown publication dates; no first-publication date was invented.
- The DIY article now explains planning, coordination, filtration, construction stages, commissioning and a complete budget. It no longer supplies a universal material-cost floor, filter-area ratio, self-cleaning promise or health guarantee. The comparison article adds a practical checklist for comparing actual proposed systems and responsibilities.
- Water-use copy describes recirculation, filling, topping up and possible replacement according to the installation and care plan. It no longer promises that water never needs changing. The owner expressly retained the existing cost and care estimates; their approved values and wording remain unchanged.
- Home/about metadata and service-area wording match EU-wide work, primarily Sweden and Denmark. Regional descriptions reflect the actual planning topic of each page. Danish copy uses the familiar term `svømmesø` alongside `naturpool`, without treating the names as identical technical specifications.
- English source and all seven translated catalogues contain 809 matching message keys. The revised bodies preserve internal language-specific links, image URLs and Swedish legal geography. The remaining external links in the top-ten guide were removed while their research references remain in [the editorial source record](EDITORIAL-SOURCES.md).

### Search Console observations

The authenticated read-only account review found the sitemap in **Success** state with 288 discovered pages and a last-read date of 4 November 2026. The performance window from 4 August through 3 November 2026 showed 797 clicks and 22,182 impressions. These are baseline totals, not results attributable to this implementation.

Sweden supplied 719 clicks and mobile devices 591 clicks. The Swedish DIY URL was the leading page with 314 clicks and 10,085 impressions. An exact-query Pages report for `naturpool` also placed the DIY article first (84 clicks, 4,334 impressions, average position 7.6), ahead of the comparison article (12 clicks, 894 impressions) and homepage (9 clicks, 391 impressions). This supports preserving the established informational pages and their URLs while improving useful onward links; it does not justify redirecting them to the homepage. Query and page totals use different aggregation and should not be added together. Positions are period averages, and impressions are not market search volume.

The indexing overview still reported 176 crawled-but-not-indexed pages. Direct URL inspections of the FAQ and Portuguese guide index, `/pt/blog/`, instead showed both indexed, with their own canonical URLs and a Googlebot smartphone crawl dated 25 October. The aggregate report and the inspected URLs therefore describe different snapshots. Two inspections do not prove that all canonical pages are indexed, and the older aggregate count must not be treated as 176 newly verified current failures.

Both the Manual actions and Security issues reports showed **No issues detected**. The Core Web Vitals report dated 3 November showed no categorized mobile URLs and insufficient desktop usage data. These results do not establish a field-performance pass. A public PageSpeed API request was rate-limited (HTTP 429), so no new Lighthouse score is claimed. Existing synthetic browser checks verify pricing-hero geometry during delayed price success and failure at desktop and mobile widths; they are not substitutes for real-user Core Web Vitals.

Google Analytics collection remains disabled under the existing live-payload review gate. No measurement transport, account setting, Business Profile, outreach or paid-generation setting was enabled by this SEO implementation.

### Final verification

Catalogue coverage, affected-article HTML structure, localized links, image attributes and whitespace checks passed during implementation. A separate peer reading found no meaning-changing defects in the Swedish, Danish, German and Polish DIY translations or any of the seven translated comparison checklists. The Italian, Spanish and European Portuguese DIY drafts received a separate source/target reading. This is not external native-speaker certification.

`pnpm verify:change --visual` passed on 5 November 2026 in 201.5 seconds: the full repository gate, isolated browser journeys and rendered development homepage. This includes 902 public-artifact checks across all 288 canonicals and 124 browser tests. Formatting, platform, type, translation, server and verification tests passed; the style-token check found zero violations across 185 files. The delayed pricing tests retain their original zero-shift geometry assertions at 1440px and 390px, for successful and failed price responses.

The separate final Custodian review returned **Pass** for the revised desktop pricing, DIY, comparison, guide index, regional guidance, nature-pool page, expanded service-area FAQ and footer. Public-release baseline and current-development screenshots used a 1280 × 720 viewport. Settled viewport captures replaced full-page stitching artifacts on the regional page. Pricing loading, success and error states were reviewed at 1440px and 390px; the Swedish DIY article was also inspected at 367 × 767 with no horizontal overflow. This screenshot review does not claim separate assistive-technology testing or visual inspection of every translated page. All translated canonical HTML, metadata and links are covered by the common artifact checks.

Evidence is retained locally in `.run/verification/seo-2026-11-05/`, `.run/verification/release-review/` and the change-verification receipt. The registered development service was confirmed ready and serves the revised source. No production release, commit or push was performed. Search visibility, traffic and qualified enquiries require subsequent observation after publication; no ranking improvement or position is promised.

### Current Google guidance used

- [SEO fundamentals](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) and [helpful, reliable content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content): clear page purpose, useful original information and evidence for claims.
- [Technical requirements](https://developers.google.com/search/docs/essentials/technical), [canonicalization](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) and [localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions): accessible content, consistent canonical signals and reciprocal language relationships.
- [Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article): represent the visible article and its known dates accurately. Structured data does not guarantee a rich result or a higher ranking.
- [Search Console and Analytics](https://developers.google.com/search/docs/monitor-debug/google-analytics-search-console) and [traffic-drop diagnosis](https://developers.google.com/search/docs/monitor-debug/debugging-search-traffic-drops): distinguish search exposure from on-site behavior, account for seasonality, and assess comparable query/page/country/device groups.
- [Generative-AI optimization guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide): conventional SEO foundations and useful, distinctive content remain relevant. [Dedicated generative-AI reports](https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports) and [multimodal reporting](https://developers.google.com/search/blog/2026/09/web-multimodal-in-sc) are available for future measurement; their existence is not evidence that Faunapoolen has received those impressions or conversions.
- [Google's documentation update record](https://developers.google.com/search/updates): FAQ rich results were retired in May 2026. The FAQ page serves readers and internal discovery; this implementation does not promise FAQ rich snippets.
