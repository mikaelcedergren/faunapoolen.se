# Faunapoolen.se

Static Jekyll + Decap CMS version of Faunapoolen.

The purpose of this repo is to preserve the current site's URLs, SEO structure, performance, and Swedish content while making day-to-day editing possible through `/admin/`.

Current staging site:

<https://mikaelcedergren.github.io/faunapoolen.se/>

Admin URL:

<https://mikaelcedergren.github.io/faunapoolen.se/admin/>

## Local Development

Install dependencies:

```sh
bundle install
```

Build the site:

```sh
HOME=/private/tmp bundle exec jekyll build --trace
```

Run locally:

```sh
HOME=/private/tmp bundle exec jekyll serve --host 127.0.0.1 --port 4000
```

Then open:

<http://127.0.0.1:4000/faunapoolen.se/>

## Playwright Validation

Run this from a normal macOS Terminal, not from inside Codex, if Codex cannot launch Chromium because of sandbox permissions.

Install the validation dependency and Chromium:

```sh
cd /Volumes/Development/faunapoolen.se
npm install
npx playwright install chromium
```

Run the validation:

```sh
npm run validate:playwright
```

The script starts a local Jekyll preview on port `4010` if one is not already running, compares the priority pages against `https://faunapoolen.se`, checks all mapped Swedish and English pages, verifies local images and page errors, checks the language redirect, and checks `/admin/`.

Outputs are written to:

- `migration-audit/playwright-validation-report.json`
- `migration-audit/playwright-screenshots/`

Optional visible-browser run:

```sh
HEADED=1 npm run validate:playwright
```

## Editing In Decap

Decap CMS is available at `/admin/` and uses DecapBridge for login and GitHub writes.

Both Mikael and Ben should see the same admin interface and the same editing power. Access control is handled socially: Ben should only edit the areas Mikael tells him to edit.

Main editable areas:

- Pages: general pages such as home, pricing, contact, about, services, blog index, suppliers.
- Articles: blog posts under `/blog/posts/...`.
- Product and series pages: Plunge, Swim, Waterfront, Koi, package landing pages.
- Services: structured service cards used on the services page.
- Pricing items: structured pricing sections used on the pricing page.
- Suppliers: supplier logos and supplier metadata used on the suppliers page.
- Site settings: phone, email, Formspree endpoint, analytics IDs, default SEO, CTA text, languages.
- Navigation, FAQ, and testimonials: reusable shared content.

Important editing rules:

- Do not change existing Swedish permalinks unless the URL change is intentional.
- Do not rewrite Swedish copy casually. The Swedish content is the source of truth.
- Images should be uploaded through Decap media fields. A GitHub Action optimizes uploaded images after they are committed.
- Priority SEO pages are `/`, `/blog/posts/difference-between-normal-pool-and-natural-pool.html`, and `/blog/posts/build-your-own-nature-pool.html`.
- Tracking IDs and the Formspree endpoint live in Site settings, not in page HTML.

## Content Model Notes

Swedish content stays at the current URLs.

English content lives under `/en/` with matching slugs.

The homepage has a gentle browser-language redirect only on the homepage. If the visitor is clearly non-Swedish, it sends them to `/en/`; otherwise Swedish remains the default. Visitors can always switch language manually.

Service entries currently power the services listing. They are not output as separate service detail pages yet, to avoid publishing thin new URLs before those pages are intentionally written.

## SEO And Indexing

Canonical URLs point to `https://faunapoolen.se`, even while this repo is staged on GitHub Pages.

Staging is intentionally noindexed:

- `_config.yml` has `staging_noindex: true`.
- `robots.txt` disallows crawling while staging is active.

The sitemap is custom so it does not include the GitHub Pages staging base path in production URLs.

## Future Go-Live Checklist

Only do this when the new site is approved and the real domain is ready to move.

1. In `_config.yml`, set:

```yml
baseurl: ""
staging_noindex: false
```

2. In `admin/config.yml`, update:

```yml
site_url: https://faunapoolen.se
display_url: https://faunapoolen.se
```

3. Add a root-level `CNAME` file containing:

```txt
faunapoolen.se
```

4. In DecapBridge, update the Decap CMS login URL to:

<https://faunapoolen.se/admin/>

5. In GitHub Pages settings, configure the custom domain when ready.

6. Update DNS for `faunapoolen.se` only after the staging site has been reviewed.

7. After DNS resolves, verify:

- `https://faunapoolen.se/` loads.
- `/admin/` login works.
- Contact forms submit to Formspree.
- Sitemap is `https://faunapoolen.se/sitemap.xml`.
- Robots no longer blocks crawling.
- Canonicals do not contain `/faunapoolen.se/`.
- Priority pages keep their current URLs and headings.

Do not commit GitHub personal access tokens or DecapBridge private secrets.
