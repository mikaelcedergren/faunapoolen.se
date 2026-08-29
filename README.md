# faunapoolen.se

The [Faunapoolen](https://faunapoolen.se) website as an **Angular 22 SSG app** — prerendered to
static HTML and served by a strict compiled TypeScript/Express web process. A separate listener-free
worker owns durable campaign jobs. It follows the same shared web architecture as bitsize.me /
blinkdrop while deliberately keeping its own public visual skin. Swedish is at the root, English
under `/en/`. CodeKit is retired.

> The public site has run from this Mac mini over HTTPS since 2026-08-27. See
> [`DOMAIN_SETUP.md`](DOMAIN_SETUP.md) for that dated public-routing record. Exact selected and
> running releases, service state, and migration evidence live only in
> [`../WEB-ARCHITECTURE-MIGRATION.md`](../WEB-ARCHITECTURE-MIGRATION.md).

## Run

```bash
pnpm install      # install the immutable graph; cx-framework needs no lifecycle build
pnpm dev          # target Angular/web/worker development suite on :4240/:4241
pnpm build        # prerender/flatten 56 browser routes and compile server JavaScript
pnpm typecheck    # strict application and NodeNext server TypeScript verification
pnpm test         # target server, importer, and isolated runtime contracts
pnpm platform:check # shared manifest and architecture validation
pnpm check        # canonical format, platform, typecheck, test, and production-build gate
pnpm start:web    # compiled release-aware web process (health: /healthz)
pnpm start:worker # compiled listener-free campaign worker
pnpm import:campaigns -- --source <stopped-dir> --database <new-db>
pnpm quiesce:campaign-database -- --database <stopped-db> --receipt <receipt-json-file>
pnpm verify:campaign-import -- --database <restored-db> --receipt <receipt-json-file>
pnpm e2e          # isolated Chromium journeys against synthetic data
```

`pnpm build` remains the local build. Classify the complete releasable diff before publication. A
change proved browser-only uses:

```bash
node ../server-ops/bin/site-release.mjs --site faunapoolen --browser-only --apply
```

A change proved server-only uses `server-release.mjs`; a change that affects browser and server
closures, or whose closure is uncertain, uses the paired transaction. The shared release and
rollback contract is documented in [`../SERVER-STANDARD.md`](../SERVER-STANDARD.md). The production
architecture uses compiled web and worker entrypoints plus private SQLite data under `data/`.
`pnpm test:legacy` retains frozen characterization of the historical `server/index.mjs` wrapper
while that wrapper remains in the repository.

The target source consumes the published `@mikaelcedergren/cx-framework/server/*` entrypoints from
GitHub `main`, and `pnpm-lock.yaml` records the repository's exact immutable resolution. Never
substitute a local path, tarball, sibling import, or compatibility wrapper. The root
[`WEB-ARCHITECTURE-MIGRATION.md`](../WEB-ARCHITECTURE-MIGRATION.md) owns mutable rollout versions,
commit identities, and exact operational evidence.

The protected campaign studio persists campaigns, signed owner sessions, login throttles,
generation quotas, durable jobs, generation runs, and replay-safe provider receipts in
`data/faunapoolen.db`. Web requests accept long-running generation work quickly; the listener-free
worker completes strategy, bilingual copy, and image prompts. State and retry lineage therefore
survive browser, web-process, and worker-process restarts. Every store has a hard bound, and
capacity is refused visibly instead of silently evicting a campaign. A paid result that survives a
local crash is applied once under its original run and receipt without a second provider create;
the canonical recovery invariant is documented in [`AGENTS.md`](AGENTS.md).

Production private configuration is role-separated. The web process loads only an owned
mode-`0600` `.env.web` containing `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `SESSION_SECRET`; the
worker loads only an owned mode-`0600` `.env.worker`, whose only permitted value is
`OPENAI_API_KEY`. Each file rejects values belonging to the other role, and neither process loads
legacy `.env`. Use [`.env.web.example`](.env.web.example) and
[`.env.worker.example`](.env.worker.example) as shape references, never as real credentials.
Non-secret paths, origins, models, and the `CAMPAIGN_GENERATION_ENABLED` switch remain explicit
LaunchDaemon/source configuration. Paid generation is disabled by policy: keep the switch at `0`
and do not provision or use the provider key unless the owner separately authorises enablement and
the operation is recorded in the root migration ledger. In disabled mode the worker may prove
release readiness, but it constructs no provider, accepts no claims, and performs no generation
recovery, maintenance, timer, or paid effect.

[`CAMPAIGN-CUTOVER.md`](CAMPAIGN-CUTOVER.md) preserves the historical one-time directory-to-SQLite
procedure and its rollback boundaries. It is not a current checklist and does not establish live
authority or selection. Exact operational evidence and remaining work belong only in the root
[`WEB-ARCHITECTURE-MIGRATION.md`](../WEB-ARCHITECTURE-MIGRATION.md).

## Layout

```
src/app/pages/**   one component per page; locale-gated body (@if (en){…}@else{…})
src/app/shared/seo.ts   per-page title/description/canonical/hreflang/OG/JSON-LD
src/locale/        English SEO translations (@angular/localize)
public/assets/**   images, compiled CSS, scripts.js (served verbatim)
scripts/flatten.mjs   <route>.html/index.html → flat <route>.html
server/src/index.ts   compiled web entrypoint; loads only `.env.web`
server/src/worker.ts  compiled worker entrypoint; loads only `.env.worker`
server/src/*-runtime.ts  injectable web/worker lifecycle composition
server/src/import-campaigns.ts  explicit, one-time stopped-directory importer
server/src/quiesce-campaign-database.ts  stopped WAL checkpoint and immutable close proof
server/src/verify-campaign-import.ts  read-only import/restore semantic verifier
server/src/**         strict TypeScript routes, services, repositories, and provider adapter
server/dist/**        generated production JavaScript; never edit directly
```

The Angular app (`src/`) is the source of truth. Pages were bulk-imported from the last CodeKit
output (`site/`) via `scripts/gen-pages.mjs`; edit the Angular templates going forward. `site/` is the
legacy baseline the `verify-*` scripts diff against — see [`AGENTS.md`](AGENTS.md) for full notes,
the URL scheme, i18n, and the protected pages.
