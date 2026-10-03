# New website release plan

Updated: 3 October 2026. Working branch: `codex/redesign`.

**Technical status: release preparation remains open.** Local checks pass, but the final release
candidate, production database compatibility, email configuration and live measurement still need
verification. This document tracks technical delivery only.

Check items when evidence is recorded. Creating this plan does not execute a release or authorize
operational changes. Codex/operator owns technical execution; publication and any shared-data
maintenance use the existing authorization boundaries.

## 1. Verify the final candidate

- [ ] Run the required source checks and isolated browser suite against the final release source.
      Verify package selection, language switching, enquiry validation, successful receipt and
      interrupted-request retries on desktop and mobile.
- [ ] Check keyboard operation, form readiness, image loading, links and all four Gotland films in
      the intended desktop and mobile browsers. Earlier playback review covered only the first film.
- [ ] Verify private customer/admin routes require authentication, preserve data correctly and stay
      non-indexable. Exercise automated mutation checks only against synthetic temporary records.
- [ ] Record final-candidate test and rendered-review evidence. Fix technical failures before
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
- [ ] Recover the shared-data implementation record referenced by `AGENTS.md`, or reconcile its
      missing evidence with the operator. `../SHARED-DATA-DEVELOPMENT-PLAN.md` was absent from this
      checkout during this review. Local source readiness is not proof of production adoption.
- [ ] If an upgrade is needed, agree a maintenance window covering every development and
      production writer. Prepare a verified backup with an isolated restore check; stop all
      writers, run the registered offline migration and verification, and start only compatible
      web and worker versions.
- [ ] Record a recovery plan before switching: retained compatible browser/server pair, backup
      reference, operator and failure criteria. A code rollback must never put an incompatible
      old runtime against an upgraded database. Data recovery is a separate controlled operation.
- [ ] Confirm the production notification recipient, sender setup and worker configuration.
      The customer-notification document still calls for changing the recipient to
      `info@faunapoolen.se`; the installed private settings have not been checked in this review.
      Decide whether notification email is enabled at launch or the inbox is monitored manually.

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
- [ ] Verify all 108 currently expected canonical URLs, language alternates, structured data,
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

- [x] Sitemap and robots audit: 108 canonical URLs; 66 use recorded article update dates, while
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

| Date       | Item         | Decision or evidence                                                           | Owner |
| ---------- | ------------ | ------------------------------------------------------------------------------ | ----- |
| 2026-10-03 | Release plan | Created from current source and repository records; publication not authorized | Codex |

Add decisions and evidence here as items close. Technical release sign-off requires sections 1–3
to be completed or a specific optional limitation to be accepted and recorded. Section 4 is
follow-up. Record the final commit, release IDs, backup reference, launch time and evidence paths;
never put secrets or customer records in this document.
