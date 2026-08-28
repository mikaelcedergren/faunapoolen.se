# faunapoolen.se

The **Faunapoolen** website, rebuilt as an **Angular 22 SSG app** — prerendered to fully static HTML
and served by a strict compiled TypeScript/Express web process, with a separate listener-free jobs
worker for durable campaign generation. It follows the same shared web architecture as
**bitsize.me** / **blinkdrop** while keeping its permanent public visual exception. Swedish is at
the root, English under `/en/`. **CodeKit is retired**; this repo builds and serves the site.

## Run

```bash
pnpm install            # install the immutable graph; cx-framework arrives complete without a lifecycle build
pnpm dev                # target Angular/web/worker development suite on :4240/:4241
pnpm build              # 56-route browser prerender/flatten plus compiled server JavaScript
pnpm build:release      # internal browser-only staged build used by the shared release command
pnpm build:server:release # internal self-contained web/worker server-artifact build
pnpm start:web          # compiled release-aware web process (HOST/PORT env; health: /healthz)
pnpm start:worker       # compiled listener-free durable campaign worker
pnpm import:campaigns -- --source <stopped-dir> --database <new-db>
pnpm quiesce:campaign-database -- --database <stopped-db> --receipt <receipt-json-file>
pnpm verify:campaign-import -- --database <restored-db> --receipt <receipt-json-file>
pnpm typecheck          # strict application and NodeNext server TypeScript verification
pnpm test               # target server suite, importer contract, and isolated runtime contracts
pnpm test:legacy        # frozen characterization of the currently selected legacy runtime
pnpm platform:check     # shared manifest, dependency, script, and entrypoint validation
pnpm check              # canonical format, platform, typecheck, test, and production-build gate
pnpm e2e                # isolated Chromium journeys on a runner-owned loopback port
```

The legacy Mac-mini web process is already stopped; both registered labels are unloaded, their
conventional installed plists are absent, and the stopped campaign directory remains the sole data
authority. Do not select or start the compiled web/worker pair, import campaigns, or change that
authority except through the explicit stopped-service procedure in
[`CAMPAIGN-CUTOVER.md`](CAMPAIGN-CUTOVER.md). Publish a change proved browser-only with:

`pnpm test:legacy` launches the exact retained `server/index.mjs` entrypoint and is its removal
guard until that cutover. The wrapper's only source delta adds the
`FAUNAPOOLEN_LOAD_ENV_FILE=false` test-isolation switch; the historical installed daemon did not set
it. No legacy plist is currently installed and no legacy process is running. Do not remove the
wrapper or its legacy contracts before the stopped-service backup/import/selection gate retires
them together.

```bash
node ../server-ops/bin/site-release.mjs --site faunapoolen --browser-only --apply
```

Changes that can affect the target server use the paired transaction. The release and rollback
behavior is owned by the root
[`SERVER-STANDARD.md`](../SERVER-STANDARD.md).

## Framework package boundary

The target server consumes the published `@mikaelcedergren/cx-framework/server/*` entrypoints from
GitHub `main`, and `pnpm-lock.yaml` records the repository's exact immutable resolution. Never
replace it with a local path, tarball, sibling import, or compatibility wrapper. The root
[`WEB-ARCHITECTURE-MIGRATION.md`](../WEB-ARCHITECTURE-MIGRATION.md) owns mutable rollout versions,
commit identities, and exact operational evidence;
[`CAMPAIGN-CUTOVER.md`](CAMPAIGN-CUTOVER.md) owns the separate operational data/process transition.

## Architecture

Angular 22 standalone, prerendered to static HTML (`angular.json` → `outputMode: "static"`; every
route `RenderMode.Prerender` in `app.routes.server.ts`), is served as plain files by the compiled
shared Node runtime — no SSR or TypeScript runner in production. The web and worker entrypoints
compose explicit published framework subpaths from an isolated `server/` workspace; product routes,
persistence, authorization, and provider behavior remain repository-owned. Client hydration reuses
the prerendered DOM so the static `scripts.js` keeps working.

```
src/
  index.html             <head>: GA tags, fonts, the reused compiled CSS, scripts.js; <fp-root>
  app/
    app.component.*       shared chrome (nav + footer), locale-gated, rendered inside <main>
    app.routes.ts         GENERATED route table ($localize SEO per page) — see scripts/gen-pages.mjs
    app.routes.server.ts  { path: '**', renderMode: Prerender }
    app.config.ts         router + client hydration + SeoTitleStrategy
    shared/seo.ts         SeoTitleStrategy: per-page title/desc/keywords/canonical/hreflang/OG/JSON-LD
    pages/**              one component per page; template = locale-gated body (@if (en){…}@else{…})
  locale/messages.en.xlf  English translations of the SEO strings (@angular/localize)
public/assets/**          images, compiled styles.css + normalize.css, scripts.js — copied verbatim
public/{robots.txt,sitemap.xml}
scripts/flatten.mjs       post-build: <route>.html/index.html → flat <route>.html (local or staged output)
scripts/gen-pages.mjs     one-time migration importer (site/** → Angular pages); see "source of truth"
scripts/verify-seo.mjs    per-page <head> SEO diff (new vs legacy site/)
scripts/verify-ui.mjs     screenshots, navigation parity, and accordion/menu assertions
server/src/index.ts       compiled web entrypoint; loads only `.env.web`
server/src/worker.ts      compiled listener-free entrypoint; loads only `.env.worker`
server/src/*-runtime.ts   injectable web/worker lifecycle composition
server/src/app.ts         HTTP/API composition, common errors, request IDs, noindex/no-store
server/src/*-service.ts   product behavior and durable admission rules
server/src/campaign-repository.ts
                          SQLite repositories, revision CAS, bounds, recovery, retention
server/src/openai-provider.ts
                          replay-safe native Responses adapter
server/src/environment-files.ts
                          pinned private web/worker role-only configuration loading
server/src/import-campaigns.ts
                          explicit one-time stopped-directory importer
server/src/quiesce-campaign-database.ts
                          offline identity-pinned WAL checkpoint and immutable close proof
server/src/verify-campaign-import.ts
                          read-only imported/restored database semantic verifier
server/dist/**            generated production JavaScript; never edit directly
```

### Campaigns (`/admin`)

One rough idea becomes **one** campaign, written once to the strictest limit every network imposes,
in Swedish and English. The admin UI is English; only the campaign copy is bilingual. It produces
**image prompts**, not images — the owner pastes them into an image generator of their choice.

| Module                   | Owns                                                              |
| ------------------------ | ----------------------------------------------------------------- |
| `copy-budgets.ts`        | per-field character budgets, resolved as `min()` across networks  |
| `marketing-rules.ts`     | the 14 id'd rules the studio writes by and teaches from           |
| `image-style.ts`         | the fixed non-HDR photographic house style and the 3 prompt slots |
| `brand-palette.ts`       | brand hexes mirrored from `public/assets/styles/_variables.scss`  |
| `campaign-schema.ts`     | exact durable campaign record contract                            |
| `campaign-repository.ts` | private SQLite persistence, revision CAS, bounds, recovery        |
| `generation-service.ts`  | atomic generation admission and retry lineage                     |
| `generation-handlers.ts` | the three durable generation-stage handlers                       |
| `openai-provider.ts`     | replay-safe provider effects and stored response receipts         |

Four rules govern changes here:

- **Never name a network in anything the user sees.** `copy-budgets.ts` names them internally so the
  numbers stay auditable; the API returns only the resolved budget and a neutral reason. Re-check the
  table against current ad specifications and bump `LIMITS_VERIFIED_ON` when you do. Only
  `NETWORK_LIMITS` may be described to the user as a platform constraint — `HOUSE_LIMITS` are our own
  editorial choices and their `reason` copy says so.
- **`teaches` text is authored in `marketing-rules.ts`, never by the model.** The model only cites
  rule ids and explains this campaign. That is what makes the studio teach the same lessons twice.
- **The protected API is a real typed HTTP contract.** Register `/api/admin` before browser static
  serving. Reads use GET; acceptance uses POST; copy edits use PATCH with an expected revision; and
  deletion uses a strong `If-Match` revision. Mutations require an allowed origin. Never add a
  parallel legacy route or let the browser catch-all own an API path.
- **The admin is reachable only through the login, and is never indexable.** Every campaign route
  sits behind `requireAdminSession`, and the studio renders inside `@if (authenticated())` so the
  prerendered page is the sign-in form and nothing else. Three layers keep it out of search and must
  stay in step: `public/robots.txt` disallows `/admin` and `/en/admin`; the route's `seo.private`
  flag strips the login page down to `noindex, nofollow` with no canonical, hreflang, social card or
  JSON-LD; and `PRIVATE_NOINDEX_PATHS` in `server/src/constants.ts` answers
  `X-Robots-Tag: noindex, nofollow` on
  every response beneath those paths — the only one of the three that reaches a JSON reply, an error
  page, or a request whose casing (`/ADMIN/`) a case-sensitive robots.txt rule would miss. A new
  admin path belongs in all three. The public pages are indexed exactly as before: they keep
  `Allow: /`, carry no robots meta, and are the only URLs in `sitemap.xml`.

Generation runs as three durable stages — strategy, bilingual copy, then image prompts — so the
screen reports work that genuinely finished instead of animating a timer, and a failed or ambiguous
stage remains available for a targeted retry. The web process only validates and admits work; the
listener-free worker claims one fenced job at a time. Only the normalized strategy idea crosses
from stage one into later work: nothing pasted into the studio reaches the copywriter verbatim.

A succeeded paid provider receipt that outlives a failed local application step is reconciled under
the original generation run and provider-effect identities. It never creates a cloned run or effect
and must never issue a second provider create. One persisted, one-use durable recovery handoff may
apply that sealed result and atomically enqueue the next stage; a fresh generation is blocked while
that receipt is awaiting recovery and remains blocked for operator review if the one-use handoff is
exhausted. Keep the fake-provider worker regression proving the same run/effect identities, the
next-stage handoff, and an unchanged provider POST count.

`data/faunapoolen.db` is the sole target authority for campaigns, signed owner sessions, login
windows, the global generation quota, durable jobs, generation runs, and provider effects. The
repositories enforce a 200-campaign refusal limit, 64 owner sessions, 10,000 login windows, 2,000
generation runs, 2,000 retained jobs, and explicit provider receipt bounds. Thirty-day terminal
retention and earlier pressure maintenance remove complete terminal aggregates while preserving
active work and bounded retry lineage. Never reintroduce process-local authority, oldest-campaign
eviction, JSON fallback, dual reads, or an unbounded collection.

The one-time importer is deliberately separate from both production processes. It requires an
explicit stopped legacy directory and explicit new database path, validates every physical entry
before creating the target, imports everything in one transaction, and seals physical and semantic
aggregate receipts. Production web and worker startup use the framework-owned SQLite opener,
require the database to exist, and verify that immutable receipt read-only on the exact connection
before it becomes writable; a missing or replaced path fails without materialising an empty
authority. The framework owns private ancestry, main/sidecar identity, WAL recovery, and statement
guards; Faunapoolen owns only its schema, receipt, migration, and capacity rules. Interrupted-import
recovery is intent-owned, bounded, and allowed only after its importer process is proven stopped. See
[`CAMPAIGN-CUTOVER.md`](CAMPAIGN-CUTOVER.md); never run the importer against a live writer, manually
delete recovery artifacts, or skip a corrupt/ambiguous campaign.

The compiled `verify-campaign-import` command is the operator-facing boundary for the existing
product-owned pre-activation verifier. Given an explicit database and the exact captured importer
receipt file, it opens SQLite read-only, runs full integrity and foreign-key checks, verifies the
canonical migration history and immutable marker, and recomputes ordered campaign IDs, source
hashes, and canonical record hashes. Use it on both the just-imported target and the database
extracted from the first required `sqlite-online` backup. It must reproduce the same receipt and
leave database identity, bytes, digest, and sidecar inventory unchanged.

If a stopped operational database has WAL/SHM after a supported online snapshot, never remove the
sidecars manually. Run the compiled `quiesce-campaign-database` command through the authenticated
inactive-candidate boundary with the exact database and importer receipt, then run the immutable
verifier. The quiescer verifies full logical import parity before gaining write authority, requires
one exact idle `wal_checkpoint(TRUNCATE)`, verifies parity again, closes through SQLite, requires
all journal/WAL/SHM names absent, preserves the main file allocation, and finishes with the same
immutable verifier. It is a one-shot stopped-service operator, never a runtime opening mode.

The one-time pre-activation aggregate verifier uses a direct immutable read-only SQLite connection
as a bounded cutover-only exception: it must not create WAL/SHM, closes before either runtime role
starts, and is unreachable from normal web/worker composition. It exists because the stopped,
hard-link-published import needs a side-effect-free physical/semantic proof before the long-lived
WAL owner is activated. It must never become a selectable runtime opening path.

Production role configuration is intentionally asymmetric. The web process loads only an owned
mode-`0600` `.env.web`, whose fixed allowlist is `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and
`SESSION_SECRET`. The worker loads only an owned mode-`0600` `.env.worker`, whose sole allowed value
is `OPENAI_API_KEY`; that file remains empty through Gate 5 and receives the key only at the
separately authorised Gate 6. Neither role reads legacy `.env` or the other role's file. The framework-owned
private-file loader rejects public modes, links, oversized or non-UTF-8 files, `NODE_OPTIONS`, and
any value outside the fixed product-role allowlist. Each role removes inherited private values
belonging to the other role before importing any runtime module. Non-secret origin, path, model,
and exact `CAMPAIGN_GENERATION_ENABLED=0|1` values belong in explicit LaunchDaemon/source
configuration. Keep that switch at `0` through cutover validation and enable `1` only as the
separate owner-approved post-cutover action in the runbook. The web process must be able to admit
durable work without possessing the provider secret.

Ordinary production worker readiness is a sealed release property: the worker starts its durable
runtime first, then acquires the framework identity-file readiness lease for the declared worker
role. Shutdown closes that lease before stopping claims or closing SQLite. Release validation stays
IPC-only and never creates the ordinary lease. With `CAMPAIGN_GENERATION_ENABLED=0`, that real
runtime is healthy but claim-disabled: it constructs no provider, claims no job, and performs no
generation recovery, maintenance, timer, or paid effect. Gate 6 is the first point at which this
process receives a provider key or may change generation state. Its current lease proves
process/release readiness only, not permission to generate.

### URLs (unchanged from the live site)

- **Sections** served from `<dir>/index.html`: `/about/`, `/pricing/`, `/services/`, `/contact/`,
  `/suppliers/`, `/blog/`, `/sweden-expert-…-baddammar/`.
- **Product / blog pages** are **literal `.html`** files: `/koi-pond-series.html`,
  `/nature-pools.html`, `/blog/posts/<slug>.html`, … Angular prerenders `<route>/index.html`, and
  `scripts/flatten.mjs` rewrites every `.html`-named directory into a flat file (the route paths
  literally end in `.html`).
- **English mirror** under `/en/` via `@angular/localize` `subPath` (sv = root `""`, en = `"en"`).

### i18n (@angular/localize)

- Swedish is the source locale (root); English builds under `/en/` (`angular.json` → `i18n`,
  `"localize": true` in the prod config).
- **SEO strings** (title, description, keywords, og:title/description) are translated via `$localize`
  with custom `@@ids` → `src/locale/messages.en.xlf`.
- **Chrome + page bodies** are **locale-gated** (`@if (en) {…} @else {…}`, driven by `LOCALE_ID`) —
  the English nav differs structurally (no "Nature pools" link) and the page copy is wholesale-
  different prose, so per-string xlf there is impractical. Canonical / hreflang / `<html lang>` /
  og:url are derived from `LOCALE_ID` in `SeoTitleStrategy`.
- To edit English copy: edit the `@if (en)` branch of the page template; for SEO strings edit the
  `<target>` in `messages.en.xlf`.

## Content source of truth

The **Angular app (`src/`) is the source of truth.** The pages were bulk-imported from the last
CodeKit output (`site/`) by `scripts/gen-pages.mjs` — a one-time migration tool that extracts each
page's body (between `<main>` and the nav), normalizes it through the HTML5 parser, and harvests the
`<head>` SEO into `app.routes.ts` + `messages.en.xlf`. **Going forward, edit the Angular templates
directly** (`src/app/pages/**`). `src/app/pages`, `app.routes.ts` and `src/locale` are prettier-
ignored to preserve exact inline-whitespace rendering.

`site/` is the **legacy CodeKit output**, kept only as the migration/verification baseline (the
`verify-*` scripts diff against it). It is no longer built or served and can be deleted once you're
comfortable — that also drops the duplicated `assets/` (~70 MB). The old CodeKit project
`../faunapoolen` is no longer used.

### Protected, top-ranking pages — never regress

- `/blog/posts/difference-between-normal-pool-and-natural-pool.html`
- `/blog/posts/build-your-own-nature-pool.html`

Swedish is primary; headings use European sentence case. `CNAME` is intentionally omitted from the
output so this local/test instance can't hijack the live domain — add it at go-live.

## Verify zero SEO / visual impact

```bash
node scripts/verify-seo.mjs dist/browser/<page> site/<page>   # per-page <head> SEO diff
node scripts/verify-ui.mjs                                     # new-vs-old screenshots + interactivity
```

The migration itself was verified byte-exact against `site/` (identical URL set and `<head>` SEO;
English exact apart from two cosmetic JSON-LD normalizations). Since 2026-07 the site intentionally
extends beyond that baseline, so `verify-seo.mjs` now reports these expected diffs and nothing else:

- blog posts (except the two protected ones) are `BlogPosting`/`og:type article` with
  `article:published_time`/`modified_time` and a per-post social card under `/assets/images/og/`
- product pages carry per-page social cards from the same `og/` directory
- the Organization JSON-LD node is typed `["Organization", "LocalBusiness"]` with
  `areaServed: Sweden` (service-area business, deliberately no address) — the **only** diff on the
  two protected posts
- heavy referenced photos are `.webp` (originals kept on disk so old URLs never 404); `styles.css`
  references one, hence the bumped `?v=` in `index.html`
- `index.html`: zoomable viewport (no `user-scalable=no`) and one consolidated gtag.js load
  configuring both GA4 and Google Ads

`scripts.js` (accordion, mobile menu, language switcher, sticky header) keeps working because
client hydration reuses the prerendered DOM.

## cx-framework (installed for admin only — public skin is a permanent exception)

`@mikaelcedergren/cx-framework` is installed but **not imported into the public site**, and never
will be. faunapoolen.se keeps its **own public visual skin permanently**: the existing site ranks
exceptionally well in Google, and adopting the framework's chrome would risk that ranking. This is a
deliberate, permanent visual exception — not a deferred restyle. The framework is used **only for
admin/internal screens** — today that is the campaigns tool at `/admin` — and never for the public
skin. Everything else here follows the exact same code philosophy, architecture, structure, and
engineering standard as every other repo — only the public visual skin is the exception. The
repository-owned `pnpm-workspace.yaml` peer policy prevents pnpm from synthesizing extra Angular
peers and keeps the intentional peer skew non-fatal.

Admin work follows the framework's own AI design package and skills, shipped inside the package at
`node_modules/@mikaelcedergren/cx-framework/ai/` (`design/00-start-here.md` first, then the smallest
relevant rule file; `skills/designer` and `skills/developer` define the roles). Compose admin screens
from `cx-*` components and the layout primitives — `admin.component.scss` styles page composition
only and never reaches into component internals.

The **Cortex -> cx-framework -> projects** loop still applies. Cortex authors reusable components,
tokens, AI skills, guidelines, and framework decisions; `cx-framework` packages them; faunapoolen.se
consumes the package for admin/internal UI only. Do not reference Cortex directly through imports,
package deps, scripts, styles, local paths, or copied source. If internal UI exposes a reusable
framework gap, fix it in Cortex, package/push `cx-framework`, then update this repo from the package.

## Toolchain (shared machine)

The shared [toolchain](../WEB-ARCHITECTURE.md#toolchain) and
[E2E containment](../WEB-ARCHITECTURE.md#end-to-end-test-isolation) contracts live in the root web
architecture. This repo's declared ports are dev `4240`, serve `3040`, and isolated server
contracts `4342/4343`; E2E uses the shared runner's dynamically owned loopback port. Shared service allocations remain owned by
[`PORTS.md`](../PORTS.md). Contract tests use only OS-temporary browser/campaign fixtures, refuse
external fetches, and never load repo private role files or the production campaign store.
