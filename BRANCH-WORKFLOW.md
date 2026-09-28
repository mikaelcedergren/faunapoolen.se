# Website maintenance and redesign

`main` maintains the current production website. `codex/redesign` contains the upcoming website.
The registered development service uses the branch checked out in this repository; normally keep
this checkout on `main`. Production uses its selected immutable release, independently of the
checkout. A commit or push does not publish the website.

## Preserved baseline

On 28 September 2026, the running browser and server both proved release `logging-20260907`, built
from clean commit `672e1f2696caf258a89100a121ccf2c5c91f3dcb`. The tag
`production-baseline-2026-09-28` preserves that source. Main retains the current website's pages,
copy, public routes, images, server implementation and database schema. Its tooling has been
updated for today's registered development and release contracts as described below.

The tag `redesign-preserved-2026-09-28` preserves the complete redesign at
`e51e4a3544be3a3350a36a414ca072a4b569a171`, including the two commits that had not yet been pulled
into this checkout. No Git history was rewritten.

## Continuing work

- Make current-site fixes on `main`, verify in development, and publish only when requested.
- Make new-website changes on `codex/redesign`.
- Merge subsequent `main` fixes into `codex/redesign` regularly, reviewing conflicts against the
  redesigned implementation.
- Before switching this registered checkout, stop its development service, preserve local work,
  and install the destination branch's frozen lockfile. Restart only after storage compatibility
  is established. Follow the shared [development contract](../SERVER-STANDARD.md#local-development).

The initial restoration is recorded as merged into `codex/redesign` while retaining the complete
redesign tree. This deliberate one-time reconciliation lets later fixes merge normally and keeps
a future merge of the redesign from silently retaining the restoration. Do not repeat the
keep-our-tree merge strategy for ordinary fixes.

## Maintenance tooling

Both branches use the published framework's current Node contract. Main consumes the published
package through the existing GitHub `main` dependency and keeps its exact revision in the lockfile.
The matching Playwright version, development favicon format, full style audit and removal of a
retired admin styling hook follow the package's upgrade notes. The public campaign stylesheet's
local variables were replaced with their exact existing values, preserving its colours.

This resolves the older package's conflict with the registered development manager without
changing shared framework or server-ops source, weakening a check, or migrating product data.
The framework refresh makes a future production release a paired browser/server release; it is
not a browser-only change. Publication remains a separate explicit instruction.

## Launching the redesign

Review and merge `codex/redesign` into `main` only when the new website is approved. Run the normal
verification and classified publication flow. The redesign includes newer database migrations;
do not start it against the shared production database until the required coordinated maintenance
has been explicitly authorised and completed. Do not migrate or downgrade the database merely to
switch branches. Existing production remains selected until a separately authorised publication.
