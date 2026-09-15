# Website rebuild record

## Accepted direction

The owner approved replacing the old public page with the Faunapoolen Playground's Aqua/editorial
direction, structured as an independent product. The campaign studio remains, with a new private
enquiry inbox. There is no CMS, automated email or paid-generation enablement in this scope.

English is the editing language. Angular i18n provides Swedish and Danish. Explicit URLs select
the language; browser preferences only suggest a supported alternative. Unsupported preferences
fall back to an English suggestion. The owner accepted this SEO-first behaviour and the minor
English auxiliary copy in existing framework controls (for example “Optional” and “Clear”).
No framework changes or local replacements were made.

## SEO preservation

All twelve original Swedish and English articles retain their wording, titles, metadata, literal
`.html` addresses, images and body links. The two protected guides lead the blog index. Regression
fixtures were captured from the original source before retiring its templates; hashes preserve
article prose without keeping a second copy of the article. The baseline is not a content editor.

The existing blog index addresses remain. Retired product and section addresses redirect directly
to the closest replacement through the shared product URL catalogue. The sitemap is generated
from rendered canonical pages and includes all three locale alternates. Admin stays private and
non-indexable in all locales; missing pages return localised 404 documents.

## Enquiries and local state

Migration 13 adds the enquiry inbox and persistent bounded admission windows. It appends to the
existing migration history without rewriting any applied migration. The personal dev database
was closed, copied to an owner-private ignored backup, compared byte-for-byte and verified through
the immutable SQLite verifier before the local service was restarted. Only the personal
`data/owner-development/faunapoolen.db` was upgraded. Production and the Mac mini were untouched.

Form fields and submit controls wait for browser readiness, including the private sign-in form.
This prevents early native form submission and contact details appearing in query strings.
Receipt retries retain one immutable enquiry reference. The inbox displays persisted state and
requires revisions for updates. Operational limits and the editing workflow are owned by
[README.md](../README.md); verification ownership is in
[DEVELOPMENT-VERIFICATION.md](../DEVELOPMENT-VERIFICATION.md).

## Before publication

- Confirm Vimeo playback in a normal browser. The original film IDs and links are retained,
  but the in-app visual review showed blank external players, so playback remains unverified.
- Review the Playground's indicative package prices and commercial copy with the owner.
- Review new Danish editorial translations with a native speaker.
- Inherited blog claims, including health claims, attributed project quotations and the old
  L-package wording, remain unchanged for SEO preservation. Retention is not factual verification.
  Any editorial correction needs a deliberate content decision, not a silent rewrite.
- Enquiry closing is not deletion. Agree an operational retention policy before the bounded
  inbox needs pruning; no automatic deletion policy has been invented.
- This is a paired browser/server change with an offline database migration on the publishing
  host. Follow the root release and storage contracts; do not deploy the browser alone.

Nothing has been committed, pushed or published as part of this rebuild. The live website and
its data remain untouched.
