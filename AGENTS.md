# faunapoolen.se

A **carbon copy** of the public **Faunapoolen** website, served as plain static files by a small
Express server on the Mac mini — **no CodeKit needed to run**. The HTML/CSS/JS in `site/` is the
exact CodeKit-generated output of the source project; this repo just serves it, as an always-on
service (same pattern as **bitsize.me** / **blinkdrop**).

> **What this is — and isn't.** `site/` is a byte-for-byte copy of the generated site (Swedish at
> the root, English under `/en/`). It is **not** rebuilt here. The authoring sources (`.kit`,
> `.scss`, images) live in **`../faunapoolen`** (a CodeKit project) — that's still the content & SEO
> source of truth. To update: regenerate there, then `pnpm refresh` to re-sync `site/`. Do **not**
> hand-edit files under `site/` — they're generated output and get overwritten on the next refresh.

## Run

```bash
pnpm install            # just express + compression
pnpm start              # serve site/ at http://127.0.0.1:3040  (HOST/PORT env; health: /api/health)
pnpm refresh            # re-sync site/ from ../faunapoolen after a CodeKit regenerate
pnpm e2e                # Playwright smoke test (serves on :4341)
```

Always-on service on this Mac mini: `launchd/com.faunapoolen.server.plist` (port `3040`), fronted by
nginx — see [`DOMAIN_SETUP.md`](DOMAIN_SETUP.md). Restart after a refresh:

```bash
launchctl kickstart -k gui/$(id -u)/com.faunapoolen.server
```

## URLs (exactly the live site's)

- Sections: `/about/`, `/pricing/`, `/services/`, `/contact/`, `/suppliers/`, `/blog/` — served from
  `<dir>/index.html`.
- Product / blog pages: literal `*.html` — `/koi-pond-series.html`, `/nature-pools.html`,
  `/blog/posts/<slug>.html`, etc.
- English mirror under `/en/`. `robots.txt` + `sitemap.xml` are copied from the source.

## Layout

```
site/                generated static site (the carbon copy) — served as-is, never hand-edited
server/index.mjs     Express static server (caching, security headers, /api/health, 404)
scripts/refresh.sh   rsync ../faunapoolen → site/ (excludes .kit/.scss sources, codekit, docs)
launchd/ · ops/      macOS launchd service + nginx reverse-proxy example (DOMAIN_SETUP.md)
e2e/                 Playwright smoke test
```

## Source of truth & SEO

`../faunapoolen` is the content/SEO source. Protected, top-ranking pages — **never change**:

- `/blog/posts/difference-between-normal-pool-and-natural-pool.html`
- `/blog/posts/build-your-own-nature-pool.html`

Swedish is the primary language; headings use European sentence case. `CNAME` is intentionally
omitted from `site/` so this local/test instance can't hijack the live domain — add it at go-live.

## Toolchain (shared machine)

Runs alongside **cortex**, **bitsize.me**, **blinkdrop** on the Mac mini. pnpm `10.7.1` via corepack;
Playwright pinned to `1.60.0` (chromium only, default shared cache `~/Library/Caches/ms-playwright` —
never set `PLAYWRIGHT_BROWSERS_PATH`; bump in lockstep with the siblings). Ports: serve `3040`,
e2e `4341` (chosen to avoid bitsize `3020/4319` and blinkdrop `4400/4419`).
