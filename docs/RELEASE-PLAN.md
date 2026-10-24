# New website release plan

Updated: 24 October 2026. Working branch: `main`.

**Technical status: the approved redesign is integrated for release.** Reconciliation and isolated release testing are complete. Production database maintenance,
final release artifacts, notification configuration and live delivery remain separate launch gates. This document tracks technical delivery only.

Check items when evidence is recorded. Creating this plan does not execute a release or authorize
operational changes. Codex/operator owns technical execution; publication and any shared-data
maintenance use the existing authorization boundaries.

## Reconciliation for the release candidate

The 24 October preparation compares redesign `47d2a1a` with main `53f325b`. Both remote tips
were refreshed before review. Main has six commits outside the redesign history. Their intent
is reconciled as follows; the Aqua/editorial design and its newer product choices remain authoritative.

| Main change                                         | Resolution in the redesign                                                                                                                                                                                                                                      |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Simplified forms and Formspree delivery (`9d92e62`) | Preserve the newer inline consultation forms and durable customer/enquiry inbox. The old Formspree implementation and tests target retired pages and must not return. Existing browser journeys prove submission, persistence and interrupted-receipt recovery. |
| Starting prices (`240d3b5`)                         | Already represented by the editable catalogue: 430,000 / 1,100,000 / 4,400,000 SEK, excluding VAT and shipping.                                                                                                                                                 |
| Pool dimensions (`b2e3b8e`)                         | Starting areas and depths already match the newer three-package offer: 2 × 2.5 × 0.9 m, 4 × 4 × 1.5 m and 10 × 10 × 1.8 m. Retired S/M/L pages remain retired.                                                                                                  |
| Framework and logout (`b9b58cf`)                    | Keep the redesign's newer frozen framework dependency. Port logout failure recovery and its HTTP/network regressions, adapting the error to the shared admin shell so it is visible in campaigns, customers, packages and social posts.                         |
| Aquascape certification (`83fde2a`)                 | Keep the redesigned certification components and approved emblem. Retain the original PNG at its existing public URL without inserting the retired page markup or CSS.                                                                                          |
| Stylesheet cache refresh (`53f325b`)                | Superseded by the Angular-built redesign assets. Keep the redesigned document entrypoints.                                                                                                                                                                      |

A non-mutating merge preview found 18 conflicted paths: the lockfile, two HTML entrypoints,
and 15 retired stylesheet/template/component paths. At the eventual merge, resolve these paths
individually with the reviewed redesign versions (including the deliberate deletions), preserve
its locked dependency graph, and use the reconciled admin implementation/tests. Do not use a
blanket keep-our-tree strategy. The preview also adds the retained certification PNG cleanly.
The obsolete Formspree tests that Git merges automatically must be omitted because they target
removed implementations. Recheck the merged tree against this verified candidate before release.

The owner authorized release on 24 October. Preparation commit `3adf91c` preserves the reviewed
candidate. The main merge resolves the named paths individually and its application tree is
identical to that candidate. Only branch guidance and this release record change after the
review. No live-data migration or activation has occurred at this checkpoint.

The installed web and worker both prove release `cac-20261017-83fde2a`. The shared-data record at
`../SHARED-DATA-DEVELOPMENT-PLAN.md` is present on this host and records the earlier successful
Faunapoolen upgrade to schema 12. This release needs schema 18. The writer inventory is the
production web/jobs family and registered development stack; no additional scheduled writer is
registered for this product. Keep all writers stopped during the fresh backup/restore proof and
offline quiesce/migrate/verify sequence. After migration, only the prepared schema-18 pair may
start. The old pair is usable only before migration; data restoration is a separately controlled
recovery operation, never an automatic code rollback.

The first inactive browser build exposed per-locale copying of the entire image directory,
exceeding the operator's 512 MiB artifact ceiling before post-processing. Production now leaves
asset copying out of Angular localization and publishes the canonical public assets and framework
fonts once in post-processing. Every original public asset URL remains available. A regression
compares published bytes with the source and rejects duplicate locale asset directories. The
failed, unsealed build was removed only after proving its exact private manifest and inactivity;
the manifest remains with the release evidence.

Angular's generated redirect documents also receive the canonical `cx-build-id` source marker
during post-processing because they do not use the main index template. A rendered-output
regression requires exactly one marker directly in the head of every HTML document, including
redirects, before the operator seals the build identity.

The owner also requested an image-size audit and phone-focused release QA. Public raster images
have a 750,000-byte ceiling, with smaller WebP delivery images and existing responsive variants.
Compression preserves image URLs and aspect ratios. The release suite exercises 360 px and
430 px touch phones at 2× density in Chromium and WebKit, including navigation, image transfers,
overflow and a synthetic enquiry. Final image counts, transfer measurements and rendered review
are recorded privately with the release evidence.

The final image pass reduces 52 files from 76,640,529 to 27,547,626 bytes. The largest retained
public image is 737,083 bytes. PNG photographs retain full colour; existing responsive WebP
variants remain the normal delivery path. The WebKit phone journeys pass at both widths, with
the largest downloaded image at 398,202 bytes. Their success receipts were visually reviewed.
Use `pnpm e2e --engine=webkit mobile-release.spec.ts` through the registered hermetic runner;
the canonical framework test adapter owns WebKit network containment. Browser selection must
not be overridden in Playwright configuration.

Sitemap verification proves all 288 canonical URLs, complete reciprocal eight-language alternates,
authored modification dates and exclusion of private/redirect routes. The five guides absent
from the old site use 24 October 2026 for their first publication and initial modification dates;
historical article dates remain unchanged. The generated live sitemap will be
`https://faunapoolen.se/sitemap.xml`. Public-origin URL verification remains a post-cutover gate.

Final source verification passes 122 Chromium tests, two focused WebKit phone journeys,
613 rendered-content checks and 25 verification/sitemap checks. Formatting, platform, app/server
types and the full style audit also pass. The existing 185 server tests and HMR proof from
preparation remain applicable to the unchanged server and development implementation. The
distinct Custodian review of current desktop/mobile captures, phone success receipts and
optimized photographs is **Pass for the prepared release source**. Production activation,
external email delivery and real Vimeo playback still require their operational evidence.

Notification preparation uses the existing private Brevo key and the verified active sender
`Faunapoolen <michael@wargr.com>`. The owner selected `info@faunapoolen.se` as the recipient and
required email before launch. The prepared configuration stays private and inactive until the
coordinated cutover; a real test enquiry/email requires its separate explicit authorization.

## Preparation evidence — 24 October 2026

The public design, content, package choices, pricing and language structure are unchanged by this
reconciliation. Release review found one additional local issue: the package-save error was above
the eight-language form and outside the viewport after pressing Save. The existing error and
conflict recovery now sit beside the save action. The browser regression requires both the failure
message and retry action to remain in view. No framework code or styling was changed.

Verification completed during preparation:

- Full `pnpm check`: formatting, favicon, platform, token audit, all 781 translation keys across
  seven translated catalogues, application/server types, 25 verification/sitemap tests,
  185 server tests, seven launcher tests, production build and 610 rendered-content tests.
- The build produces 288 public canonical URLs across eight languages; canonical/hreflang,
  sitemap, private noindex and established `.html` paths are checked from rendered output.
- The offline migration regression now covers both version 10 and the installed version 12
  through version 18 with synthetic records. It proves preserved job scope, repeatable migration
  and read-only verification without changing database bytes. Existing package migration tests
  prove preservation of edited titles/prices and separation of execution scopes.
- The final isolated Chromium suite passed all **120 tests**. It covers public enquiry persistence and interrupted receipts,
  customer history, package editing, session failures/retry in all four admin sections,
  language switching, keyboard interactions, mobile overflow and private-route protection.
- `pnpm e2e:hmr`: the isolated template/TypeScript/styles hot-update and reload regression passed.
- After the package feedback-only template correction, application types, formatting, token
  checks and the complete browser suite (including its fresh server/browser builds and rendered
  content checks) were rerun. The earlier full server verification remains applicable.

Public visual evidence uses 1440 × 1000 and 390 × 844 viewports, with full-page and viewport
captures. It includes the English/Swedish home, pool, pricing, waterscape, Gotland, guide index,
about, FAQ, cookies, consultation and regional pages, both established guide URLs, and the home,
pricing and consultation pages in each other language. All visible images are checked after
native lazy loading. Admin evidence covers 1280 × 720 and 1440 × 1000 desktop layouts, saved and
unsaved packages, failure/retry, customer history/email recovery and social editor states.

Evidence is retained privately under `.run/verification/release-review/`, including command logs,
source hashes, public screenshots and the package-save before/after comparison. Social-editor
screenshots remain in `.run/verification/social-posts/`. Screenshots are evidence, not golden
pixel expectations; the accepted Aqua/editorial composition remains the design authority.

### Custodian verdict for the prepared source

**Pass — reconciliation and local merge-readiness gate.** The reviewed artifact is redesign
`47d2a1a` plus the uncommitted preparation changes, identified by the source hashes in the private
receipt. The separate reviewer pass inspected the public composition and representative localized
screens, mobile layouts, admin tables/forms, failure/retry, discard confirmation and enquiry
receipt. The package-save feedback finding was corrected and re-reviewed against the same
1280 × 720 before/after viewport. The final capture proves both the error and retry remain visible;
receipt evidence waits until scrolling clears the masthead, and dialog evidence waits for full
opacity. No remaining observed finding prevents the reviewed source from being merged.

This verdict does not certify operational launch readiness, actual email/Vimeo delivery,
non-Chromium browsers, or a deployed development/production identity. Those remain explicit gates
below. A merge resolution that materially changes the reviewed tree requires the affected proof
again.

### Remaining launch gates

- Integrate and commit the reviewed candidate on `main`, resolving the recorded conflicts, and
  verify that the resulting source is exactly the intended candidate before sealing artifacts.
- Prepare the paired release and a concrete recovery plan. Stop every writer, verify a fresh
  backup/restore, migrate the real database from 12 to 18 and start only compatible versions.
  Ordinary development stays stopped until storage compatibility is established.
- Confirm the actual notification recipient/sender and worker configuration before enabling
  delivery; prove inbox arrival with an explicitly authorized launch enquiry. Synthetic tests do
  not prove external mail delivery.
- Check actual playback of all four Vimeo films and the intended non-Chromium browsers. The
  isolated tests verify all four embed activations/focus transfers using fixture players, not
  playback from Vimeo.
- Complete the live HTTPS, release-identity, enquiry and SEO checks after the authorized cutover.
  Analytics transport remains intentionally disabled until its separate production checks pass.

The compiler reports one non-blocking redundant-nullish-fallback warning in the existing enquiry
inbox template. This does not affect compilation or the tested language display. No paid provider,
email service, production data, production selection or real shared-schema mutation was used by
the preparation checks.

## 1. Verify the final candidate

- [x] Run the required source checks and isolated browser suite against the prepared source.
      Verify package selection, language switching, enquiry validation, successful receipt and
      interrupted-request retries on desktop and mobile.
- [ ] Check keyboard operation, form readiness, image loading, links and all four Gotland films in
      the intended desktop and mobile browsers. Earlier playback review covered only the first film.
- [x] Verify private customer/admin routes require authentication, preserve data correctly and stay
      non-indexable. Exercise automated mutation checks only against synthetic temporary records.
- [x] Record prepared-candidate test and rendered-review evidence. Fix technical failures before
      preparing the release artifacts.

## 2. Prepare a recoverable release

Owner: Codex/operator; Wolfie authorizes branch integration, publication and any shared-data work.

- [ ] Review the complete outstanding diff and resolve unfinished concurrent work. Record exactly
      which source is included in the release.
- [ ] Refresh remote branch information and reconcile current-site fixes into the redesign.
      Follow [the branch workflow](../BRANCH-WORKFLOW.md); integrate the approved redesign into
      `main` only when authorized. Record the final clean release commit and remote alignment.
- [ ] Run the required verification against that final source and prepare matching inactive
      browser and server candidates. This redesign requires a **paired release**.
- [ ] On the publishing host, inspect the selected/running releases and the installed database
      schema using the registered operators. Establish exactly which upgrade, if any, remains.
- [x] Recover the shared-data implementation record referenced by `AGENTS.md`. It is present on
      the publishing host and records successful schema-12 adoption. Live web/jobs identity was
      independently verified; local source readiness is not proof of production adoption.
- [ ] If an upgrade is needed, agree a maintenance window covering every development and
      production writer. Prepare a verified backup with an isolated restore check; stop all
      writers, run the registered offline migration and verification, and start only compatible
      web and worker versions.
- [ ] Record a recovery plan before switching: retained compatible browser/server pair, backup
      reference, operator and failure criteria. A code rollback must never put an incompatible
      old runtime against an upgraded database. Data recovery is a separate controlled operation.
- [x] Confirm the production notification recipient and sender setup. The owner selected
      `info@faunapoolen.se`; the existing Brevo key successfully verified the configured sender.
      Private activation settings are prepared. Activation and actual inbox arrival remain open.

Use the registered [paired-release and storage procedures](../../SERVER-STANDARD.md),
[operator maintenance guide](../../server-ops/README.md#shared-data-development-and-maintenance)
and [customer-notification contract](CUSTOMER-ENQUIRIES.md). Keep paid campaign generation disabled;
it is not needed to launch the public website or receive enquiries.

## 3. Publish and verify the real website

Owner: Codex/operator, after explicit launch authorization.

- [ ] Execute the approved paired cutover. Prove the browser, server and worker belong to the
      selected release and that development also serves the final intended source.
- [ ] Verify public HTTPS, redirects, health and asset delivery. Confirm old article URLs and
      retired commercial URLs reach the intended destinations without redirect chains.
- [ ] With owner authorization, submit one clearly identified launch enquiry and confirm it is
      saved once in the private customer history. If email is enabled, confirm actual inbox
      arrival; provider acceptance alone is insufficient. Use no real customer data for this check.
- [ ] Complete analytics activation as a controlled launch step: recheck saved Google collection
      restrictions, enable the reviewed production transport through a verified release, and
      inspect actual requests with consent. Confirm one `generate_lead` per accepted enquiry,
      useful reporting context and no submitted contact details, messages or raw query strings.
      Confirm rejection sends nothing and withdrawal stops collection. Keep or return transport
      to disabled if this check fails; the enquiry form must still work.
- [ ] Verify every canonical URL in the current route catalogue, language alternates, structured data,
      sitemap dates and robots policy at the public origin. Keep private routes non-indexable.
      Reconcile first-publication dates for new guides with their actual first release; retain
      genuine content-revision dates rather than refreshing every date on launch.
- [ ] Recheck Search Console's sitemap state, then submit the current sitemap if needed and
      inspect the main service, pricing and established guide URLs. Request indexing for the
      important new canonical pages as appropriate. Earlier observations concern the old site;
      they are not evidence of the new release's current indexing state.
- [ ] Record launch time, release identities, verification evidence and any accepted limitations.

The source still has `GOOGLE_COLLECTION_REVIEWED = false`. Account setup and local consent tests
are preparation; they do not prove production enquiry tracking. Full measurement sign-off remains
open until the real transport passes the launch check. Google indexing itself can happen later
and is not a condition for the website to serve customers.

## 4. Follow up after launch

Owner: Wolfie/Codex when requested; no monitoring automation is scheduled by this plan.

- [ ] Within 24–48 hours, check enquiry receipt, email failures, public errors and analytics events.
- [ ] During the first week, check sitemap processing, indexing and unexpected old-URL errors.
- [ ] Check database backup/restore evidence, worker readiness and bounded log capture after the
      new runtime is active.
- [ ] Check inbox capacity before its 1,000-enquiry limit is near; closing enquiries does not free
      that capacity. Any retention tooling is a separate scoped task.

## Existing evidence

These items are complete locally; recheck them if their inputs change or at the public origin
where required above.

- [x] Historical 3 October sitemap and robots audit: 108 canonical URLs; 66 use recorded article update dates, while
      42 pages with unknown dates omit them. Rebuilding does not refresh dates.
- [x] Local consented enquiry measurement and source-category tests implemented. Google account
      preparation is recorded in [SEO implementation](SEO-IMPLEMENTATION.md#enquiry-and-measurement).
- [x] Full local repository proof and rendered homepage check passed on 3 October 2026 in 35.4s.
      The earlier enquiry browser suite passed separately; this was not a fresh browser-suite run.

Evidence: `.run/verification/change-receipt.json`, `.run/verification/sitemap-lastmod-review.md`,
[SEO implementation](SEO-IMPLEMENTATION.md) and [customer notifications](CUSTOMER-ENQUIRIES.md).
Older records contain superseded route counts and email descriptions; use current source and the
newer scoped records. Production runtime, database and private mail configuration were not verified
during this planning task.

## Decision and completion log

| Date       | Item                       | Decision or evidence                                                                                                   | Owner |
| ---------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----- |
| 2026-10-03 | Release plan               | Created from current source and repository records; publication not authorized                                         | Codex |
| 2026-10-24 | Reconciliation and testing | Prepared source passes the local merge-readiness gate; commit, merge, push, maintenance and publication remain pending | Codex |

Add decisions and evidence here as items close. Technical release sign-off requires sections 1–3
to be completed or a specific optional limitation to be accepted and recorded. Section 4 is
follow-up. Record the final commit, release IDs, backup reference, launch time and evidence paths;
never put secrets or customer records in this document.
