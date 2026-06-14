# AGENTS.md

## Purpose

This repository contains the Jekyll + Decap CMS migration of `faunapoolen.se`, the public company website for Faunapoolen. Mikael is a co-owner of the company, so treat this as a real business and SEO asset, not a demo project.

The goal is to preserve the strengths of the current live site while making content management safer and easier for nontechnical editors through Decap CMS at `/admin/`.

## Read First

Before making changes, read these files:

- `README.md` for setup, Decap editing notes, and future go-live steps.
- `MIGRATION-BRIEF.md` for migration decisions, priority pages, validation rules, and current project state.

If those files disagree, prefer `MIGRATION-BRIEF.md` for migration intent and `README.md` for day-to-day usage.

## Core Context

- Static site generator: Jekyll.
- CMS: Decap CMS.
- Auth and Git gateway: DecapBridge.
- Current staging URL: `https://mikaelcedergren.github.io/faunapoolen.se/`.
- Future production URL: `https://faunapoolen.se/`.
- Hosting target: GitHub Pages.
- Swedish content remains the primary source of truth.
- English content lives under `/en/`.
- Existing Swedish URLs must be preserved, including `.html` endings.
- Do not add a `CNAME` file until the real domain cutover is approved.

## High-Priority SEO Pages

Be especially careful with:

1. `/`
2. `/blog/posts/difference-between-normal-pool-and-natural-pool.html`
3. `/blog/posts/build-your-own-nature-pool.html`

For these pages, preserve URL, title, meta description, H1, H2 structure, content quality, internal linking, canonical behavior, and media intent. The live site is the source of truth for these pages.

## Content Rules

- Do not rewrite Swedish copy casually.
- Do not change existing Swedish permalinks unless Mikael explicitly asks for that exact URL change.
- Keep editor-facing content structured through frontmatter, collections, includes, and data files.
- Avoid putting layout HTML into Markdown body fields when a template or structured field can handle it.
- Both Mikael and Ben should see the same Decap CMS interface and editing power.
- Access control for Ben is handled by Mikael outside the app; do not create separate admin roles unless asked.

## SEO And Indexing Rules

- Canonical URLs should point to `https://faunapoolen.se`.
- Staging should discourage indexing while the site lives at GitHub Pages.
- Keep `robots.txt`, `sitemap.xml`, `hreflang`, and schema output consistent.
- Do not publish thin new URLs just because a collection exists.
- Do not remove, rename, or redirect important URLs without documenting the reason.

## Media Rules

- Use `assets/media/...` for migrated and uploaded media.
- Do not copy unused old images unless there is a clear reason.
- Keep images reasonably optimized.
- Future uploaded images are expected to be optimized by the GitHub Action in `.github/workflows/optimize-media.yml`.
- Be careful with Ben-uploaded images: large images are a known operational problem for this site.

## Decap And Secrets

- Decap CMS config lives in `admin/config.yml`.
- DecapBridge PKCE config may be committed.
- Never commit GitHub personal access tokens or private DecapBridge secrets.
- Tracking IDs and the Formspree endpoint belong in `_data/settings.yml` and are editable through Decap.

## Validation Expectations

After meaningful changes, run:

```sh
HOME=/private/tmp bundle exec jekyll build --trace
```

Also verify as relevant:

- Priority pages still render at their original URLs.
- Internal links resolve.
- Referenced images exist.
- Staging paths work with `/faunapoolen.se`.
- Canonicals still point to the future production domain.
- Staging still noindexes unless preparing real go-live.
- `/admin/` still loads and `admin/config.yml` remains valid.

For browser validation, Playwright may require a normal local terminal rather than the Codex sandbox. If Playwright browser launch fails inside Codex with macOS permission errors, do not silently replace it with weaker validation. Tell Mikael what is blocked and ask how he wants to proceed.

The repo includes a Playwright validation command for a normal local terminal:

```sh
npm install
npx playwright install chromium
npm run validate:playwright
```

## Go-Live Guardrails

Do not do these unless Mikael explicitly says the site is ready to go live:

- Add `CNAME`.
- Repoint `faunapoolen.se`.
- Set `_config.yml` `baseurl` to an empty string.
- Set `_config.yml` `staging_noindex` to `false`.
- Change DecapBridge login URL to the production domain.

The exact go-live checklist is in `README.md`.

## Git Rules

- Do not revert user changes you did not make.
- Keep commits logical and focused.
- If Git metadata cannot be written from the current environment, leave the working tree intact and explain the exact blocker.
- Never use destructive Git commands unless Mikael explicitly asks for them.
