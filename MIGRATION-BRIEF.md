# Faunapoolen Migration Brief

## Purpose

Migrate the existing Faunapoolen site from the CodeKit/HTML workflow into a production-ready Jekyll + Decap CMS + DecapBridge site that can eventually replace the current live site without sacrificing SEO, URL stability, performance, content quality, or editor confidence.

The new site should remain static, fast, GitHub Pages-friendly, and easy for nontechnical editors to maintain from `/admin/`. The migration is not a redesign. It is a structured rebuild that preserves what already works, makes content safer to edit, and prepares the site for Swedish and English content.

## Core Decisions

- Static site generator: Jekyll.
- CMS: Decap CMS.
- CMS authentication/editing bridge: DecapBridge.
- Hosting: GitHub Pages from `main` and `/root`.
- Implementation branch: work directly on `main`.
- Commit strategy: make logical commits during implementation.
- Current staging URL: `https://mikaelcedergren.github.io/faunapoolen.se/`.
- Future production URL: `https://faunapoolen.se/`.
- Swedish content stays at current URLs.
- English content lives under `/en/`.
- English pages use the same slugs as Swedish pages.
- Existing URLs are preserved exactly, including `.html` where present.
- Swedish copy is preserved exactly, except broken markup/attributes may be fixed.
- English copy may be natural marketing English, not a literal translation.
- Current visual design should be preserved closely.
- No `CNAME` file until go-live.
- Canonical URLs should point to `https://faunapoolen.se`.
- Staging should discourage indexing.
- Real domain cutover is months away and must only be documented, not performed.

## Priority Source Of Truth

These pages are the highest SEO priority and must be treated carefully:

1. `/`
2. `/blog/posts/difference-between-normal-pool-and-natural-pool.html`
3. `/blog/posts/build-your-own-nature-pool.html`

For these three pages, use the live site as the source of truth. For all other pages, use the local old repository as the main source, supplemented by a live crawl.

## Operating Rule

After every implementation step:

1. Validate the step using the validation instructions listed for that step.
2. Reread this file before continuing.
3. Mark the step complete only after validation passes.
4. Do not skip ahead when a validation gate fails.

This document is the drift-prevention guide. Follow it before making the next decision.

## Implementation Checklist

### 1. Baseline Audit

- [x] Inventory the new repo before changes.
- [x] Inventory the old local repo at `/Volumes/Development/faunapoolen`.
- [x] Crawl reachable internal URLs from the live site.
- [x] Capture live source for the three priority pages.
- [x] Build a URL map of old path, new path, page type, language, source file, and priority.
- [x] Record current title, description, H1, canonical, important images, and internal links.

Validation:

- [x] URL map includes all local source pages and all reachable live internal pages.
- [x] The three priority pages are explicitly marked as live-source-of-truth.
- [x] No page is removed without a documented reason.
- [x] Reread this document before step 2.

### 2. Jekyll Foundation

- [x] Add Jekyll project structure at repo root.
- [x] Use only GitHub Pages-supported Jekyll features/plugins.
- [x] Add `_config.yml` with staging `baseurl` support.
- [x] Configure future production URL as `https://faunapoolen.se`.
- [x] Add layouts, includes, data folders, collections, and assets folders.
- [x] Add no `CNAME` file.

Validation:

- [x] Jekyll builds locally.
- [x] GitHub Pages-compatible config is used.
- [x] Staging paths work with `baseurl`.
- [x] No custom unsupported Jekyll plugin is required.
- [x] Reread this document before step 3.

### 3. Content Model

- [x] Define Markdown + YAML frontmatter model for main content.
- [x] Add collections for pages, articles, services, pricing/packages, product/series pages, and suppliers.
- [x] Add data files for navigation, site settings, FAQ, testimonials, and reusable global content.
- [x] Support structured templates plus limited freeform Markdown.
- [x] Expose all fields consistently to both Mikael and Ben.
- [x] Use clear editor-friendly labels and short help text in Decap.

Validation:

- [x] Every old page type has a target content type.
- [x] Generated listing pages can be built from content fields.
- [x] Dangerous fields such as slug/permalink/SEO fields are exposed as requested.
- [x] Reread this document before step 4.

### 4. Decap CMS And DecapBridge

- [x] Add `/admin/` with Decap CMS.
- [x] Wire DecapBridge using the generated backend/config snippet supplied by Mikael.
- [x] Do not store private tokens in the repository.
- [x] Configure direct publishing to `main`.
- [x] Add styled Decap preview close to the real site.
- [x] Add collections for all agreed content areas.

Validation:

- [x] `/admin/` loads locally or in staging.
- [x] Decap config parses successfully.
- [x] DecapBridge secrets are not committed.
- [x] CMS collections match the agreed content model.
- [x] Reread this document before step 5.

### 5. Templates And Visual Preservation

- [x] Recreate current shared layout in Jekyll includes.
- [x] Preserve current navigation/footer/header behavior closely.
- [x] Preserve current visual design, spacing, imagery intent, and page rhythm.
- [x] Convert CodeKit include patterns into Jekyll layouts/includes.
- [x] Keep templates semantic and SEO-friendly.
- [x] Add branded 404 page.

Validation:

- [x] Pages visually resemble the current site.
- [x] Header, nav, footer, CTA, FAQ, gallery, and testimonial patterns render consistently.
- [x] Generated HTML is semantic and not dependent on editor-authored HTML for layout.
- [x] Reread this document before step 6.

### 6. Swedish Content Migration

- [x] Migrate all existing pages.
- [x] Preserve Swedish copy exactly.
- [x] Fix broken markup/attributes where needed.
- [x] Normalize rough pages into the new templates without rewriting Swedish wording.
- [x] Preserve all existing URLs exactly.
- [x] Keep existing `.html` endings where present.

Validation:

- [x] The three priority pages match live Swedish content and structure closely.
- [x] Other pages match local repo Swedish content, except documented markup fixes.
- [x] No Swedish copy rewrite is introduced.
- [x] Current internal links still resolve.
- [x] Reread this document before step 7.

### 7. English Content

- [x] Create English versions under `/en/`.
- [x] Use the same slugs as Swedish pages.
- [x] Publish English pages immediately.
- [x] Translate into natural English marketing copy.
- [x] Add language pairing metadata.
- [x] Add language switch.
- [x] Add gentle homepage-only browser-language redirect to `/en/` when clearly non-Swedish.
- [x] Remember the user's language choice.
- [x] Default to Swedish when unsure.

Validation:

- [x] Swedish pages remain at original URLs.
- [x] English equivalents exist under `/en/`.
- [x] Language switch works both directions.
- [x] Homepage-only redirect does not affect deep links.
- [x] `hreflang` alternates are present.
- [x] Reread this document before step 8.

### 8. Media Migration And Optimization

- [x] Reorganize used media by content type.
- [x] Do not copy unused old images.
- [x] Preserve image meaning and placement.
- [x] Aggressively optimize migrated images.
- [x] Keep source/originals only where useful and clearly separated.
- [x] Configure Decap media folders by content type.

Validation:

- [x] All referenced images exist.
- [x] No page references an old missing path.
- [x] Image sizes are materially smaller than the old originals where possible.
- [x] Visual quality remains acceptable.
- [x] Reread this document before step 9.

### 9. Future Upload Image Cleanup

- [x] Add GitHub Action to optimize newly uploaded media in-place.
- [x] Resize uploaded images to max 2000px wide.
- [x] Use quality around 75-82.
- [x] Strip metadata.
- [x] Keep original file format.
- [x] Commit optimized files back to `main`.

Validation:

- [x] Action is scoped to upload/media folders.
- [x] Action does not touch unrelated files.
- [x] Large test image is reduced in-place.
- [x] Jekyll still builds after optimization.
- [x] Reread this document before step 10.

### 10. SEO, Schema, And Indexing

- [x] Add editable SEO fields.
- [x] Move tracking IDs into editable Decap site settings.
- [x] Preserve existing tracking values initially.
- [x] Add canonical URLs pointing to `https://faunapoolen.se`.
- [x] Add `hreflang`.
- [x] Generate sitemap.
- [x] Maintain robots/noindex behavior for staging.
- [x] Add basic schema: Organization, Website, BreadcrumbList, BlogPosting, FAQPage where relevant.
- [x] Add targeted redirects only for known useful alternates.

Validation:

- [x] Priority pages preserve SEO-critical structure.
- [x] Sitemap excludes admin and drafts.
- [x] Staging discourages indexing.
- [x] Canonicals point to future production domain.
- [x] Schema validates structurally.
- [x] Reread this document before step 11.

### 11. Generated Listings And Reusable Data

- [x] Generate blog index from article frontmatter.
- [x] Generate service listings from service content.
- [x] Generate pricing page from structured pricing entries.
- [x] Generate supplier page from supplier entries.
- [x] Generate FAQ and testimonial sections from reusable data.
- [x] Use editable order fields where needed.

Validation:

- [x] New content appears in the correct listings automatically.
- [x] Ordering behaves predictably.
- [x] Empty/disabled entries do not break layouts.
- [x] Reread this document before step 12.

### 12. Forms And Business Settings

- [x] Preserve current Formspree behavior.
- [x] Centralize business info in Decap settings.
- [x] Centralize phone, email, social links, CTA text, Formspree endpoint, and default SEO text.
- [x] Keep contact page functional and clear.

Validation:

- [x] Contact form markup points to the intended Formspree endpoint.
- [x] Shared business details render consistently.
- [x] Changing settings updates dependent templates.
- [x] Reread this document before step 13.

### 13. Documentation

- [x] Update README with local development commands.
- [x] Add Decap/DecapBridge editor guide.
- [x] Add how to create/edit pages, articles, media, navigation, and settings.
- [x] Add future go-live checklist.
- [x] Document switching `baseurl` off before production cutover.
- [x] Document adding `CNAME` only at go-live.
- [x] Document removing staging noindex behavior at go-live.

Validation:

- [x] README is useful for Mikael and Ben.
- [x] Go-live steps are clear and do not imply the domain has already moved.
- [x] No secrets are documented.
- [x] Reread this document before step 14.

### 14. Full Verification

- [x] Run local Jekyll build.
- [x] Run link check.
- [x] Run image size check.
- [x] Compare URL map old vs new.
- [x] Compare priority page content and heading structure.
- [x] Check Decap config.
- [x] Check language switch.
- [x] Check staging noindex/canonical behavior.
- [x] Run browser/static performance sanity checks.
- [x] Run Playwright validation from a normal macOS Terminal against live `faunapoolen.se` and the local Jekyll site.

Playwright result from `migration-audit/playwright-validation-report.json`:

- Priority pages checked: 3.
- Priority pages with issues: 0.
- Local mapped pages checked: 52.
- Local mapped pages with issues: 0.
- Missing images: 0.
- Total failures: 0.

Validation:

- [x] Build passes.
- [x] No broken internal links.
- [x] No missing referenced images.
- [x] Priority pages pass comparison.
- [x] Staging site is reviewable.
- [x] Browser-rendered Playwright validation passes with zero failures.
- [x] Reread this document before step 15.

### 15. Final Handoff

- [x] Summarize what changed.
- [x] List validation results.
- [x] List any known gaps or risks.
- [x] Confirm DecapBridge setup status.
- [x] Confirm what Mikael should review before eventual domain cutover.
- [ ] Make final logical commit if needed.

Commit note: staging/committing was attempted before and after final Playwright validation, but this Codex session could not write to `.git/index.lock` because the sandbox did not grant Git metadata write permission. The migration files are prepared in the working tree and should be committed from a normal local terminal or from a future session with `.git` write access.

Validation:

- [x] User has a clear review path.
- [x] No implementation sessions are left running.
- [x] No secrets are committed.
- [x] Migration is ready for staging review.

## Do Not Do Yet

- [ ] Do not add `CNAME`.
- [ ] Do not repoint `faunapoolen.se`.
- [ ] Do not rewrite Swedish copy.
- [ ] Do not remove existing high-performing URLs.
- [ ] Do not use unsupported Jekyll plugins.
- [ ] Do not commit DecapBridge/GitHub private tokens.
