# faunapoolen.se

The **Faunapoolen** website, rebuilt as an **Angular 22 SSG app** — prerendered to fully static HTML
and served by a small Express server on the Mac mini, the same architecture as **bitsize.me** /
**blinkdrop**. Swedish at the root, English under `/en/`. **CodeKit is retired**; this repo builds
and serves the site.

## Run

```bash
pnpm install            # Angular 22 + express + compression (+ @mikaelcedergren/cx-framework, unused)
pnpm dev                # ng serve (Swedish) at http://127.0.0.1:4240
pnpm build              # ng build (prerender sv + en) → dist/browser, then flatten
pnpm build:release      # internal staged build used by the shared release command
pnpm start              # release-aware server at http://127.0.0.1:3040 (HOST/PORT env; health: /healthz)
pnpm e2e                # Playwright smoke test (serves on :4341)
```

Always-on service on this Mac mini: `launchd/com.faunapoolen.server.plist` (port `3040`,
RunAtLoad + KeepAlive), fronted by nginx — see [`DOMAIN_SETUP.md`](DOMAIN_SETUP.md). Publish a
production build with:

```bash
node ../server-ops/bin/site-release.mjs --site faunapoolen --apply
```

The release and rollback behavior is owned by the root
[`SERVER-STANDARD.md`](../SERVER-STANDARD.md).

## Architecture

Angular 22 standalone, prerendered to static HTML (`angular.json` → `outputMode: "static"`; every
route `RenderMode.Prerender` in `app.routes.server.ts`), served as plain files by Express — no SSR at
runtime. Client hydration reuses the prerendered DOM so the static `scripts.js` keeps working.

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
scripts/verify-ui.mjs     screenshots new-vs-old + interactivity (accordion/menu)
server/index.mjs          release-aware static server (caching, /healthz, retained chunks, 404)
```

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
deliberate, permanent visual exception — not a deferred restyle. The framework stays installed only
for **future admin/internal screens**, never the public skin. Everything else here follows the exact
same code philosophy, architecture, structure, and engineering standard as every other repo — only
the public visual skin is the exception. `.npmrc` relaxes peer-deps so it pulls no Angular peers it
doesn't need here.

The **Cortex -> cx-framework -> projects** loop still applies. Cortex authors reusable components,
tokens, AI skills, guidelines, and framework decisions; `cx-framework` packages them; faunapoolen.se
may consume the package for future admin/internal UI only. Do not reference Cortex directly through
imports, package deps, scripts, styles, local paths, or copied source. If future internal UI exposes
a reusable framework gap, fix it in Cortex, package/push `cx-framework`, then update this repo from
the package.

## Toolchain (shared machine)

Runs alongside **cortex**, **bitsize.me**, **blinkdrop**. pnpm `10.7.1` via corepack; Node 24;
Angular `22` + `@angular/localize`; Playwright pinned `1.60.0` (chromium only, default shared cache
`~/Library/Caches/ms-playwright` — never set `PLAYWRIGHT_BROWSERS_PATH`). Ports: dev `4240`, serve
`3040`, e2e `4341` (chosen to avoid bitsize `3020/4319` and blinkdrop `4400/4419`).
