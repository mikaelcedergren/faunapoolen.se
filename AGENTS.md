# faunapoolen.se

Faunapoolen is the public Swedish/English website at [faunapoolen.se](https://faunapoolen.se) and a
private campaign studio at `/admin`. The public site is an Angular 22 static-prerender application
served by one compiled TypeScript/Express web process. A separate listener-free worker owns durable
campaign generation. The public visual skin is a permanent product-owned exception; the admin UI
uses `@mikaelcedergren/cx-framework`.

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
public/                      canonical public images, plain CSS/JS, robots, and sitemap
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

The database is required to exist in production. Its exact supported migration prefix and complete
schema are verified on the same connection before any write or pending migration. Current schema
owns campaigns, signed owner sessions, login windows, generation quotas, durable jobs, generation
runs, provider effects, and bounded recovery state. Existing databases move forward through
append-only migrations; never rewrite an applied migration or bypass the pre-write proof.

## Framework boundary

The target consumes the published GitHub `main` package through explicit
`@mikaelcedergren/cx-framework` entrypoints. Never use a local path, tarball, sibling Cortex
import, copied framework source, or compatibility shim.

The public visual skin is deliberately product-owned because visual churn risks established search
performance. The exception is visual only: engineering structure, TypeScript, tests, server
runtime, releases, operations, and AI working rules follow the same architecture as every other
web product. The private admin UI uses framework components, tokens, layouts, and portable AI
guidance. If the admin reveals a reusable gap, fix Cortex, publish `cx-framework`, then update this
consumer.

## Public content and URL contract

Swedish is the source locale at the root; English lives under `/en/`. Every route is prerendered.
Section pages use directory URLs such as `/about/`; product and blog routes deliberately retain
literal `.html` URLs. `scripts/flatten.mjs` converts Angular's route directories to those stable
files.

The Angular templates, `src/app/app.routes.ts`, `src/locale/messages.en.xlf`, and
`public/assets/` are the only content sources. Public `styles.css` and `scripts.js` are edited
directly; there is no generated Sass/minified mirror. Edit the relevant sources together. The route
catalogue owns title, description, keywords, canonical, hreflang, Open Graph, and JSON-LD metadata.
The page templates use locale-gated bodies because the Swedish and English prose can differ
structurally.

Never regress these high-ranking Swedish pages:

- `/blog/posts/difference-between-normal-pool-and-natural-pool.html`
- `/blog/posts/build-your-own-nature-pool.html`

Keep existing URL spelling, redirects, canonicals, hreflang, structured data, image URLs, and
indexability unless the owner explicitly chooses a product/SEO change. Headings and UI use
European sentence case. `public/CNAME` is intentionally absent because nginx hosts the site.

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
