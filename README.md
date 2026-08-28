# faunapoolen.se

The [Faunapoolen](https://faunapoolen.se) website as an **Angular 22 SSG app** — prerendered to
static HTML and served by a strict compiled TypeScript/Express web process. A separate listener-free
worker owns durable campaign jobs. It follows the same shared web architecture as bitsize.me /
blinkdrop while deliberately keeping its own public visual skin. Swedish is at the root, English
under `/en/`. CodeKit is retired.

> The public site has run from this Mac mini over HTTPS since 2026-08-27. Its currently selected
> legacy web process remains intentionally separate from the pending compiled-runtime and campaign
> storage migration. See [`DOMAIN_SETUP.md`](DOMAIN_SETUP.md) and
> [`CAMPAIGN-CUTOVER.md`](CAMPAIGN-CUTOVER.md).

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
pnpm verify:campaign-import -- --database <restored-db> --receipt <receipt-json-file>
pnpm e2e          # isolated Chromium journeys against synthetic data
```

The Mac mini still selects the existing legacy web process on port 3040; the checked-in web/worker
LaunchDaemon templates describe the later compiled target and are not selected yet. See
[`DOMAIN_SETUP.md`](DOMAIN_SETUP.md). `pnpm build` remains the local build; publish a production
change proved browser-only atomically with:

```bash
node ../server-ops/bin/site-release.mjs --site faunapoolen --browser-only --apply
```

Changes that can affect the target server use the paired transaction. The shared release and
rollback contract is documented in
[`../SERVER-STANDARD.md`](../SERVER-STANDARD.md). The checked-in target architecture uses compiled
web and worker entrypoints plus private SQLite data under `data/`. It is intentionally not the
currently selected Mac-mini runtime yet: the existing legacy service and campaign directory stay
authoritative until the separate, stopped-service migration in
[`CAMPAIGN-CUTOVER.md`](CAMPAIGN-CUTOVER.md) is explicitly authorised and verified.
`pnpm test:legacy` launches the exact selected `server/index.mjs` wrapper and guards it from
premature removal; its test-only environment-file opt-out is inactive in the installed daemon.

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
`OPENAI_API_KEY`. That file stays empty through Gate 5 and receives the provider key only at Gate 6.
Each file rejects values belonging to the other role, and neither process loads legacy `.env`. Use
[`.env.web.example`](.env.web.example) and [`.env.worker.example`](.env.worker.example) as shape
references, never as real credentials. Non-secret paths, origins, models, and the
`CAMPAIGN_GENERATION_ENABLED` switch remain explicit LaunchDaemon/source configuration.
At the target cutover both roles pin that switch to `0`: the worker initializes and proves its
selected release through the readiness lease without a provider key, constructs no provider, and
accepts no claims.
It also runs no generation recovery, maintenance, or timer, so Gate 6 is the first point generation
state may change. Paid generation becomes processing-ready only after that separately authorised
change.

The one-time cutover currently protects `.run/campaigns` through the required registry-driven
directory snapshot. After the stopped import and byte-identical replay are sealed, that declaration
is replaced by required `sqlite-online` coverage for `data/faunapoolen.db`, and the immutable cleanup
and backup jobs are reinstalled before the first SQLite backup. The compiled
`verify:campaign-import` command then recomputes the complete imported campaign receipt read-only on
both the published database and the database extracted from that real backup. The exact ordered
procedure and rollback boundary live only in [`CAMPAIGN-CUTOVER.md`](CAMPAIGN-CUTOVER.md).

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
server/src/verify-campaign-import.ts  read-only import/restore semantic verifier
server/src/**         strict TypeScript routes, services, repositories, and provider adapter
server/dist/**        generated production JavaScript; never edit directly
```

The Angular app (`src/`) is the source of truth. Pages were bulk-imported from the last CodeKit
output (`site/`) via `scripts/gen-pages.mjs`; edit the Angular templates going forward. `site/` is the
legacy baseline the `verify-*` scripts diff against — see [`AGENTS.md`](AGENTS.md) for full notes,
the URL scheme, i18n, and the protected pages.
