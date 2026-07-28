# faunapoolen.se

The [Faunapoolen](https://faunapoolen.se) website as an **Angular 22 SSG app** — prerendered to
static HTML and served by a small Express server on the Mac mini. Same always-on architecture as
bitsize.me / blinkdrop. Swedish at the root, English under `/en/`. CodeKit is retired.

> The public site currently runs on its **existing host**; `faunapoolen.se` is its canonical address.
> This repo is prepared on the Mac mini in **HTTP prelaunch** — public DNS is not yet cut over, so the
> Mac-mini deployment is not live. See [`DOMAIN_SETUP.md`](DOMAIN_SETUP.md).

## Run

```bash
pnpm install     # Angular 22 + express + compression
pnpm dev         # ng serve (Swedish) at http://127.0.0.1:4240
pnpm build       # prerender (sv + en) → dist/browser, then flatten literal .html URLs
pnpm start       # release-aware server at http://127.0.0.1:3040 (health: /healthz)
pnpm e2e         # Playwright smoke test
```

Always-on via launchd (`launchd/com.faunapoolen.server.plist`, port 3040), fronted by nginx — see
[`DOMAIN_SETUP.md`](DOMAIN_SETUP.md). `pnpm build` remains the local build; publish production
content atomically with:

```bash
node ../server-ops/bin/site-release.mjs --site faunapoolen --apply
```

The shared release and rollback contract is documented in
[`../SERVER-STANDARD.md`](../SERVER-STANDARD.md).

## Layout

```
src/app/pages/**   one component per page; locale-gated body (@if (en){…}@else{…})
src/app/shared/seo.ts   per-page title/description/canonical/hreflang/OG/JSON-LD
src/locale/        English SEO translations (@angular/localize)
public/assets/**   images, compiled CSS, scripts.js (served verbatim)
scripts/flatten.mjs   <route>.html/index.html → flat <route>.html
server/index.mjs   release-aware Express static server
```

The Angular app (`src/`) is the source of truth. Pages were bulk-imported from the last CodeKit
output (`site/`) via `scripts/gen-pages.mjs`; edit the Angular templates going forward. `site/` is the
legacy baseline the `verify-*` scripts diff against — see [`AGENTS.md`](AGENTS.md) for full notes,
the URL scheme, i18n, and the protected pages.
