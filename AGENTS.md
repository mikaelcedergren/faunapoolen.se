# faunapoolen.se

Current-site maintenance belongs on `main`; the upcoming website lives on `codex/redesign`.
Read [the branch workflow](BRANCH-WORKFLOW.md) before switching or merging these lines of work.

## Everyday development

Wolfie uses the product with real records, fixes problems in development as they appear, and
publishes when satisfied. Follow the shared [development contract](../SERVER-STANDARD.md#local-development)
and [dev-first delivery rule](../AGENTS.md#user-facing-delivery). Automated mutation checks and
release validation remain isolated and synthetic.

Normal dev and production share `data/faunapoolen.db`. Keep paid generation under its existing
explicit enablement and preserve the public-content publication boundary.

Shared-storage upgrades require a coordinated maintenance window for every writer. The
[cross-repo implementation record](../SHARED-DATA-DEVELOPMENT-PLAN.md) distinguishes source
preparation from installed runtime adoption.

Faunapoolen is the public English/Swedish/Danish website at [faunapoolen.se](https://faunapoolen.se),
private campaign studio at `/admin` and enquiry inbox at `/admin/enquiries`. The public site is an Angular 22 static-prerender application
served by one compiled TypeScript/Express web process. A separate listener-free worker owns durable
campaign generation. The owner-approved public rebuild uses the Aqua/editorial framework
composition; the admin retains its existing framework theme choices.

Root standards remain authoritative for shared architecture, releases, operations, ports, and
toolchain policy:

- [Web architecture](../WEB-ARCHITECTURE.md)
- [Server standard](../SERVER-STANDARD.md)
- [Server inventory](../SERVER-INVENTORY.md)
- [Ports](../PORTS.md)
- [Go-live](../GO-LIVE.md)

This file owns only Faunapoolen-specific product and implementation rules.

## Run

```bash
pnpm install
pnpm dev
pnpm build
pnpm typecheck
pnpm test
pnpm platform:check
pnpm verify:change
pnpm check
pnpm e2e
pnpm start:web
pnpm start:worker
```

Use `pnpm verify:change` for ordinary local proof. Its product-owned public/admin routes, worker and
provider risk boundaries, and options are documented in `DEVELOPMENT-VERIFICATION.md`.

Development uses Angular on `127.0.0.1:4240` and the compiled-compatible API on
`127.0.0.1:4241`. Production uses `127.0.0.1:3040`. E2E tests use a runner-owned dynamic
loopback port and synthetic temporary data.

Classify the complete releasable diff before publication. Use the registered shared browser-only,
server-only, or paired release flow from [SERVER-STANDARD.md](../SERVER-STANDARD.md); never publish
one half of an uncertain or full-stack change.

## Current architecture

```text
src/                         Angular source and route catalogue
public/                      canonical public images and robots policy
src/app/site/                public page compositions, copy and lazy article bodies
server/src/public-routes.ts  shared pure URL and redirect catalogue
scripts/sitemap.mjs          sitemap from rendered canonical pages
scripts/flatten.mjs          preserves literal .html URLs after prerender
server/src/index.ts          compiled web entrypoint
server/src/worker.ts         compiled listener-free worker entrypoint
server/src/runtime.ts        web lifecycle composition
server/src/worker-runtime.ts worker lifecycle composition
server/src/database.ts       product and shared-job migrations
server/src/campaign-repository.ts
                             sole campaign/auth/generation persistence
data/faunapoolen.db          sole operational authority
launchd/                     current web and worker definitions
```

There is one TypeScript server implementation and one Angular source tree. Do not add a parallel
JavaScript server, generated source mirror, alternate store, import fallback, or compatibility
wrapper. Git history is the historical record; active source and documentation describe only the
current system.

The database is required to exist in shared dev and production. Both roles verify the exact
current schema before writes and refuse pending migrations. Only explicit offline maintenance
accepts a supported older migration prefix. Current schema
owns campaigns, signed owner sessions, login windows, generation quotas, durable jobs, generation
runs, provider effects, and bounded recovery state. Existing databases move forward through
append-only migrations; never rewrite an applied migration or bypass the pre-write proof.

## Framework boundary

The target consumes the published GitHub `main` package through explicit
`@mikaelcedergren/cx-framework` entrypoints. Never use a local path, tarball, sibling Cortex
import, copied framework source, or compatibility shim.

The owner explicitly replaced the old public skin with the Playground Aqua/editorial design.
Established article URLs, wording, metadata and image paths remain protected independently of that
visual change. The public and private admin UI use framework components, tokens, layouts, and portable AI
guidance as-is. If the admin reveals a reusable gap, stop, explain it, and ask what the user wants
to do. Do not patch it here or change Cortex unless the user explicitly authorises that framework
work.

## Public content and URL contract

English is the source editing locale at `/en/`; Swedish remains at the root and Danish at `/da/`.
Public page route segments are English in all three languages (owner decision, 17 September
2026). Previous translated paths redirect in one hop through the shared route catalogue. Existing
article slugs remain unchanged; new article slugs may be Swedish.
Every public canonical route is prerendered. Browser preferences suggest a language without
redirecting visitors away from explicit URLs. Literal article `.html` URLs stay unchanged;
`scripts/flatten.mjs` preserves them. Retired product and section paths receive one-hop redirects
owned by `server/src/public-routes.ts`, with local Angular aliases using that same catalogue.

English `$localize` copy and article bodies live in `src/app/site/`. Swedish and Danish JSON
catalogues in `src/locale/` are consumed by Angular i18n for both production and local development.
Use `pnpm extract-i18n` then `pnpm i18n:check` when editing source copy. The article catalogue owns
metadata and the shared SEO strategy emits canonical, hreflang, Open Graph and JSON-LD. The frozen
baseline in `tests/fixtures/blog-seo-baseline.json` guards all original Swedish/English articles.
Never replace that baseline to hide a regression. Public image URLs remain stable.

The owner accepts minor English auxiliary labels in framework controls, including “Optional” and
“Clear”, on Swedish and Danish pages. No framework update or local replacement is authorised.

Never regress these high-ranking Swedish pages:

- `/blog/posts/difference-between-normal-pool-and-natural-pool.html`
- `/blog/posts/build-your-own-nature-pool.html`

Keep existing URL spelling, redirects, canonicals, hreflang, structured data, image URLs, and
indexability unless the owner explicitly chooses a product/SEO change. Headings and UI use
European sentence case. `public/CNAME` is intentionally absent because nginx hosts the site.

The Swedish SEO programme prioritizes Skåne, Halland, Blekinge and Småland without limiting the
offer to those regions. Public commercial copy serves all of Sweden and welcomes Denmark;
EU-wide delivery is a future ambition, not a current blanket promise. The owner confirmed package
starting prices of 430,000 / 1,100,000 / 4,400,000 SEK excluding VAT and shipping on 2 October 2026. Keep scope
and site qualifications beside prices and use the shared package source.

The ten other original articles were authorized for substantive SEO revisions on that date.
Retain the historical blog fixture, guard the two protected families separately in all locales,
and verify revised articles against their reviewed localized content. Historical recommendation
labels on protected articles have a small explicit presentation owner; never copy whole articles
or restore a parallel legacy renderer. See [implementation notes](docs/SEO-IMPLEMENTATION.md).

Public customer pages use internal website links, with email and telephone contact links allowed. Keep external research references in editorial documentation rather than public source blocks. Public captions, alt text and article copy describe photographs without AI-generation labels. This does not permit presenting illustrative scenes as completed customer installations.

## Photography and AI imagery

The current owner-approved photographic treatment is
[candid garden photography with natural depth](docs/PHOTOGRAPHY-STYLE.md), including its saved
visual reference (3 October 2026). Use both when generating or editing public photographs.
Preserve case-study photography and architectural illustrations. The approved blur is restrained:
the garden and water texture remain recognisable.

Architectural pool plans use the separate
[luminous landscape architecture blueprint guide](docs/ARCHITECTURAL-ILLUSTRATION-STYLE.md).
Use its approved visual references and fixed style prompt. Website exports have transparent
backgrounds so the actual page colour shows through; do not reintroduce a solid teal rectangle.

The owner-approved direction is beautiful, candid photography that feels natural and lived in
(17 September 2026). Use the real Gotland case-study photographs as the reference for believable
light, garden scale, materials and everyday character. Preserve those real photographs.

- Keep images appealing and well composed, with unposed moments, relaxed gestures, ordinary
  gardens, irregular planting and naturally weathered materials. Imperfection must feel incidental,
  never deliberately ugly, dirty or degraded.
- Use available light, restrained natural colour, softer optical detail and plausible reflections.
  Allow uneven exposure, dark areas that lose detail and occasional washed-out highlights, as in
  a normal single-exposure photograph.
- Absolutely no HDR, tone mapping, lifted shadows everywhere, enhanced local contrast, crunchy
  textures, oversharpening, glowing water, cinematic colour grading or artificial grain. Avoid
  perfectly staged people and glossy luxury-advertising scenes.
- The approved evening gathering after a swim and hand touching water are established motifs.
  Preserve their subject when revising them unless the owner requests a new motif. Other scenes
  may change when requested; apply this photographic direction throughout the set.
- Inspect generated images for anatomy, reflections and believable interactions before use.
  AI concept imagery must not be presented as evidence of a completed customer installation.

The image-generation history and current asset prompts are recorded in
[the editorial image record](docs/EDITORIAL-IMAGE-GENERATION.md).

## Campaign studio

The private admin turns one rough idea into one bilingual campaign through three durable stages:
strategy, copy, and image prompts. The web process validates and admits work; the worker claims one
fenced job at a time. The UI reports persisted state, not an artificial timer.

Four rules are non-negotiable:

- Never name an advertising network in user-facing copy. Internal network limits may remain
  auditable in `copy-budgets.ts`, but the API exposes only the resolved bound and neutral reason.
- Teaching text is authored in `marketing-rules.ts`; the model cites rule IDs and explains their
  application but does not invent the rules.
- The typed `/api/admin` HTTP contract owns reads and mutations. Mutations require an allowed
  origin, revisions use compare-and-swap, and API paths are registered before browser fallback.
- Every admin route is authenticated and non-indexable. Keep `public/robots.txt`, route
  `seo.private`, and `PRIVATE_NOINDEX_PATHS` aligned for any new private route.

An incomplete persisted campaign with no generation history may continue from the next derivable
stage. Failed or ambiguous stages use the bounded retry path. A paid provider result that survives
a local failure stays attached to its original run/effect identity and may use only the one durable
application-recovery handoff; it must never trigger a second provider create.

All collections have explicit hard bounds. Capacity is refused visibly—never silently evict a
campaign, create process-local authority, add JSON fallback, dual-read data, or grow an unbounded
history. Terminal generation aggregates use coordinated retention while active work and retry
lineage remain intact.

## Authentication and private configuration

The web process loads only owned mode-`0600` `.env.web` values:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`

The worker loads only owned mode-`0600` `.env.worker` value `OPENAI_API_KEY`. Neither role reads
the other role's file. Non-secret origin, data path, model, and
`CAMPAIGN_GENERATION_ENABLED=0|1` belong in LaunchDaemon configuration.

Paid generation remains disabled unless the owner explicitly authorises enablement. With generation
disabled, the worker proves its sealed release identity and readiness but constructs no provider,
claims no jobs, runs no recovery or maintenance timer, and creates no paid effect.

## Production roles

- `com.faunapoolen.server`: web listener on `127.0.0.1:3040`
- `com.faunapoolen.jobs`: listener-free campaign worker
- `/healthz`: fast web/database readiness
- worker readiness: sealed identity-file lease
- `.run/server.*.log` and `.run/jobs.*.log`: bounded runtime logs

`bin/install-server-daemon --check` validates the two current definitions.
`bin/install-server-daemon --apply` installs definitions only; it never starts or restarts
services. Activation uses the shared narrow service administrator after the selected release is
fully verified.

## Test and data boundaries

Tests use only OS-temporary synthetic databases, browser assets, and private-role fixtures. They
must refuse external fetches and never load the repository's real `.env.web`, `.env.worker`, or
`data/faunapoolen.db`.

Operational campaign data, secrets, logs, and release state are ignored by Git. Preserve the
authoritative SQLite database and registered backups. The protected private source archive under
`.run/campaigns` is data only and is never a runtime input or fallback.

## Shared storage maintenance

The registered offline candidate tools run `quiesce-database`, `migrate-database`, and
`verify-database` from `server/dist/database-maintenance.js`. They do not load secrets, seed data,
or start workers. The host operator must prove every dev and production writer stopped, take a
verified backup, migrate once, and select schema-compatible runtimes before restarting.

Migration preserves old jobs and their domain records in the held `legacy` scope. New workers
cannot claim them. `server/src/scope-migration.ts` assigns reviewed terminal or never-attempted jobs
and their domain owner atomically. Attempted or ambiguous provider work requires explicit outcome
resolution before assignment; never infer an origin or replay it automatically. Old isolated dev
stores remain preserved until a separately reviewed import resolves duplicate or changed records.
