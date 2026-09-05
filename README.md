# faunapoolen.se

The public [Faunapoolen](https://faunapoolen.se) website and its private campaign studio. Swedish
content is served at the root and English under `/en/`.

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

Faunapoolen deliberately keeps its established public visual skin. That is a visual exception, not
an engineering exception.

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

Angular's build dependency carries a tracked pnpm patch that clears stale template-update
metadata when browser JavaScript is rebuilt. Template and stylesheet hot updates remain enabled.
The pinned build version and patch are installed together from the lockfile; an ordinary reinstall
retains the fix. Remove the patch only when an upstream build version passes `pnpm e2e:hmr` without
it. That hermetic regression edits synthetic template, TypeScript, and CSS files, checks hot
updates and page reloads, and runs in CI without touching the development campaign data.

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
src/app/pages/**             source-owned Swedish and English page templates
src/app/app.routes.ts        route and SEO catalogue
src/locale/                  English SEO translations
public/assets/**             canonical public images plus directly maintained CSS and scripts
scripts/flatten.mjs          preserves stable literal .html routes
server/src/index.ts          compiled web entrypoint
server/src/worker.ts         compiled worker entrypoint
server/src/*-runtime.ts      lifecycle composition
server/src/database.ts       SQLite migrations and complete schema proof
server/src/campaign-repository.ts
                             campaign, auth, generation, and job persistence
data/faunapoolen.db          private operational authority
```

The Angular tree and `public/` are the only public-site sources. Edit them directly; the shipped
`styles.css` and `scripts.js` are the sources, with no Sass/minified or historical mirror.

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
