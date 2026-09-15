# faunapoolen.se

The public [Faunapoolen](https://faunapoolen.se) website, private campaign studio and enquiry inbox.
English is the source editing language under `/en/`; Swedish keeps the root and Danish lives under
`/da/`. Browser preferences suggest a language without redirecting indexed pages.

Operational diagnostics use the [shared logging policy](../SERVER-STANDARD.md#logs-and-bounded-storage).
The web and jobs roles correlate request admission, durable stage handoffs and provider effects
using opaque references. Provider polling emits one bounded summary per effect attempt; health
checks record storage failure and recovery transitions. Campaign content, prompts, credentials
and provider bodies are excluded. The [shared implementation plan](../LOGGING-IMPLEMENTATION-PLAN.md)
tracks host capture activation separately from this producer code. Generation remains disabled
unless explicitly enabled through the existing product configuration.

The private campaign studio defaults to English. Campaign copy is written in English first,
then translated into Swedish from that source. A failed translation preserves the completed
English copy for a targeted retry. Both languages use the English source's sidebar guidance;
translation generates wording only.

**Refine** improves the current edited draft while preserving its intent and campaign strategy.
Drafts may exceed the final ad limits. The immutable draft runs through the existing durable copy
job, quota, provider receipt and revision checks. Refining English also refreshes Swedish;
refining Swedish keeps English and its guidance unchanged. The improved copy and a bounded change
summary are saved atomically. A dismissible info alert above the form explains what changed and
why. Failed work retains the draft for recovery, and a stale result cannot replace newer edits.

The site uses the shared web-product architecture:

- Angular 22 static prerender
- one compiled TypeScript/Express web process
- one listener-free durable campaign worker
- SQLite as the sole product authority
- nginx as the only public gateway
- immutable browser/server release artifacts
- `@mikaelcedergren/cx-framework` for shared runtime behavior and the private admin UI

The owner-approved rebuild uses the Aqua/editorial direction from the Faunapoolen Playground,
composed from the published framework. The admin retains its existing theme choices.

## Work locally

```bash
pnpm install
pnpm dev
pnpm check
pnpm e2e
pnpm e2e:hmr
```

Development runs the browser on `http://127.0.0.1:4240` and its local API on
`http://127.0.0.1:4241`. Production health is `http://127.0.0.1:3040/healthz`.

On the personal Mac, `cx faunapoolen.se` selects `pnpm dev:owner` on the same ports. This mode
creates its own `data/owner-development/faunapoolen.db`, skips private environment files, and
disables paid generation. The Mac mini's `pnpm dev` continues using its existing shared store.

Angular's build dependency carries a tracked pnpm patch that clears stale template-update
metadata when browser JavaScript is rebuilt. Template and stylesheet hot updates remain enabled.
The pinned build version and patch are installed together from the lockfile; an ordinary reinstall
retains the fix. Remove the patch only when an upstream build version passes `pnpm e2e:hmr` without
it. That hermetic regression edits synthetic template, TypeScript, and CSS files, checks hot
updates and page reloads, and runs locally without touching the development campaign data.

Other useful commands:

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm platform:check
pnpm start:web
pnpm start:worker
bin/install-server-daemon --check
```

## Source layout

```text
src/app/site/pages/**        independent public page compositions
src/app/site/articles/**     lazy-loaded English article bodies
src/app/site/content/**      source copy and article metadata
src/app/pages/admin/**       campaign studio and enquiry inbox
src/app/app.routes.ts        public/private route composition
server/src/public-routes.ts  pure shared URL catalogue and retired-page redirects
src/locale/                  Angular i18n English extraction and Swedish/Danish translations
src/styles.scss              published framework foundations and editorial typography
public/assets/**             canonical public images, including preserved article image URLs
scripts/flatten.mjs          preserves stable literal .html routes
server/src/index.ts          compiled web entrypoint
server/src/worker.ts         compiled worker entrypoint
server/src/*-runtime.ts      lifecycle composition
server/src/database.ts       SQLite migrations and complete schema proof
server/src/campaign-repository.ts
                             campaign, auth, generation, and job persistence
data/faunapoolen.db          private operational authority
```

Edit English copy at its source, run `pnpm extract-i18n`, update the Swedish/Danish JSON catalogues,
then run `pnpm i18n:check`. After intentionally removing messages, run
`node scripts/check-i18n.mjs --prune` to remove obsolete translations; missing entries still fail.
Production and the single local dev server use the same catalogues. Locale switching reloads the
document. Minor framework-owned English labels such as “Optional” and “Clear” are an accepted
exception; do not patch them locally.

The blog stays at `/blog/`, `/en/blog/` and `/da/blog/`. All twelve original Swedish/English article
bodies and SEO fields are protected by `tests/fixtures/blog-seo-baseline.json` and the browser-build
test. Never regenerate that baseline to make an unintended content change pass. The sitemap is
generated from rendered canonical pages; retired redirects, admin and 404 pages are excluded.

Enquiries are saved directly to SQLite. `/admin/enquiries` provides new/contacted/closed views,
contact details and the project brief. Status updates use revisions; retries reuse the same
submission reference. Capacity is 1,000 records without automatic deletion; admission is limited to
five submissions per email and 100 overall per hour. Closing is not deletion. Enquiries trigger no
automated email, marketing subscription or paid provider effect.

See [the rebuild record](docs/REBUILD.md) for publication review items.

## Private runtime

The web role loads only `.env.web` and the worker role loads only `.env.worker`. Both files must
be owned mode-`0600`; neither role reads the other's secrets. The production database must already
exist and pass exact migration/schema verification before it can become writable.

Campaign generation is disabled by default. Enabling the provider and paid generation requires a
separate owner decision.

## Publish

Classify the complete releasable diff first:

- browser-only: shared `site-release.mjs`
- server-only: shared `server-release.mjs`
- browser and server, dependency, manifest, or uncertain closure: shared paired cutover

The authoritative flow is [SERVER-STANDARD.md](../SERVER-STANDARD.md). The source consumes the
published GitHub `main` framework package only; never replace it with a local dependency.

See [AGENTS.md](AGENTS.md) for product-specific implementation rules and
[DOMAIN_SETUP.md](DOMAIN_SETUP.md) for the current routing contract.
