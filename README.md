# faunapoolen.se

A **carbon copy** of the public [Faunapoolen](https://faunapoolen.se) website, served as plain
static files by a small Express server on the Mac mini — **no CodeKit needed to run**. Same
always-on service pattern as bitsize.me / blinkdrop.

`site/` holds the exact CodeKit-generated output of the source project (`../faunapoolen`). This repo
serves it; it does not rebuild it.

## Run

```bash
pnpm install     # express + compression
pnpm start       # serve site/ at http://127.0.0.1:3040   (health: /api/health)
pnpm refresh     # re-sync site/ from ../faunapoolen after a CodeKit regenerate
pnpm e2e         # Playwright smoke test
```

Always-on on this machine via launchd (`launchd/com.faunapoolen.server.plist`, port 3040), fronted
by nginx — see [`DOMAIN_SETUP.md`](DOMAIN_SETUP.md). Full notes in [`AGENTS.md`](AGENTS.md).

## Layout

```
site/              the carbon copy (generated static site) — served as-is, never hand-edited
server/index.mjs   Express static server (caching, security headers, /api/health, 404)
scripts/refresh.sh rsync ../faunapoolen → site/
launchd/ · ops/    macOS service + nginx example
e2e/               Playwright smoke test
```

The authoring sources (`.kit`, `.scss`, images) live in `../faunapoolen` (a CodeKit project) — the
content & SEO source of truth. Don't hand-edit `site/`; regenerate at the source and `pnpm refresh`.
