# Website maintenance and redesign

`main` maintains the current production website. `codex/redesign` contains the upcoming website.
The registered development service uses the branch checked out in this repository; normally keep
this checkout on `main`. Production uses its selected immutable release, independently of the
checkout. A commit or push does not publish the website.

## Preserved baseline

On 28 September 2026, the running browser and server both proved release `logging-20260907`, built
from clean commit `672e1f2696caf258a89100a121ccf2c5c91f3dcb`. The tag
`production-baseline-2026-09-28` preserves that source. Main's restoration keeps its application,
locked dependencies and tests unchanged. Alongside this workflow and its instruction link, main
retains the exact Node 26.5.0 declarations required by today's registered development service.

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

## Current tooling constraint

The production-pinned framework's platform checker and server artifact builder require the older
`>=26 <27` engine declaration and `.nvmrc` value `26`. Today's registered development manager
requires `26.5.0`. Main uses the latter so the restored development service can run. Consequently,
`pnpm platform:check` (and therefore `pnpm check`) currently fails the old declaration checks;
server release preparation has the same conflict. Do not bypass these checks or publish until the
shared tooling compatibility is resolved under separately authorised scope. No framework or
server-ops source was changed for this restoration.

The complete production-baseline check passed before retaining the new Node declarations.
With those declarations, formatting, frozen dependency installation, all 12 isolated browser
journeys and the isolated hot-reload regression passed. The registered development service and
its API/worker reported ready, and its home page and admin login were inspected in a browser.

## Launching the redesign

Review and merge `codex/redesign` into `main` only when the new website is approved. Run the normal
verification and classified publication flow. The redesign includes newer database migrations;
do not start it against the shared production database until the required coordinated maintenance
has been explicitly authorised and completed. Do not migrate or downgrade the database merely to
switch branches. Existing production remains selected until a separately authorised publication.
