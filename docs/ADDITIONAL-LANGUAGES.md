# Additional public languages — 24 October 2026

The owner requested Italian, Spanish, Portuguese, German and Polish across the public website. Portuguese uses European Portuguese. English remains the editing source; Swedish stays at the root. The additional public roots are `/it/`, `/es/`, `/pt/`, `/de/` and `/pl/`.

The complete catalogues cover sales pages, package descriptions, service choices, contact validation and receipt copy, cookie controls, image descriptions, all 22 guides and their metadata. Proper Aquascape names, company details, SEK prices, exclusions and existing factual qualifications are retained. New article translations use their own locale's internal links; public page segments and historical article filenames stay unchanged.

`server/src/public-routes.ts` is the shared language and URL authority. It feeds public routes, navigation, language names, hreflang, sitemap validation, enquiry language admission and private noindex paths. Each public page has reciprocal alternatives for all eight languages plus x-default. Language switching is an explicit document navigation, retains the corresponding page and supported enquiry choices, and never relies on browser-language detection.

## Package data and activation

Package titles remain editable in the existing package editor. Append-only migration 17 adds the five languages to each scoped catalogue while preserving current prices and existing English, Swedish and Danish titles. It increments the revision to invalidate older edit snapshots. It does not modify campaign records or enable paid generation. Migration 18 refines the seeded Italian small-pool title to “Bagni quotidiani”, avoiding a word that can suggest diving; it preserves any owner-edited Italian name. Existing migrations remain unchanged.

The ordinary owner preview uses isolated data and the existing isolated-startup migration policy. Shared development and production require the registered offline maintenance process before selecting this schema-compatible runtime: stop every writer, take and verify the registered backup, apply pending migrations 17–18 once, verify the database, and restart compatible web and worker roles together. This translation task does not authorize production publication or shared-data maintenance.

## Verification

Coverage includes exact catalogue keys and placeholders, translated prerendered pages and all article bodies, internal links, canonical/hreflang reciprocity, sitemap completeness, localized 404s, mobile overflow, language switching, enquiry selection/submission, editable package titles, and migration preservation of existing values. Translation review is performed against the English source and the rendered website; it is not a claim of an external native-speaker review.

The full local `pnpm verify:change` gate passed on 24 October 2026, including the production build and isolated browser journeys. The five added-language journeys submit a synthetic rainwater enquiry, then verify its translated answer and language in the private inbox. Package editing covers all eight public locales and a persisted Polish-title edit.

Rendered review covered the main sales pages, pricing cards, waterscapes, contact form, guide index and article, Gotland, about, regional guidance and cookies. The added languages were checked at desktop and mobile widths; a separate 1,024 px header check caught crowding in longer navigation labels. Short, natural navigation and contact labels resolved it without changing the layout. Existing English auxiliary labels supplied by shared framework controls remain as permitted by the product's framework boundary.
