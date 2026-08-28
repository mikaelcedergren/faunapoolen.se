# Campaign data and runtime cutover

## Status

This is a prepared runbook, not an active migration. The legacy `server/index.mjs` process and its
campaign directory remain authoritative on the Mac mini. The compiled web process, jobs worker,
SQLite database, backup registration, service definitions, and server-release selection must not be
activated until the owner explicitly authorises a maintenance window.

The current source-safe preflight has two recorded facts that must still be re-proved at the start
of the maintenance window:

- the read-only browser-history preview reports all five retained releases as schema v2, so
  Faunapoolen requires no browser-history adoption at the current source state; and
- the canonical server-ops registry deliberately requires a `directory-snapshot` of
  `.run/campaigns`. That transient declaration protects the stopped legacy authority. It must not
  become `sqlite-online` until the import and exact replay proofs in Gate 3 are sealed.

Shared publication, backup, restart, health, and rollback mechanics are owned by
[`../SERVER-STANDARD.md`](../SERVER-STANDARD.md). This document owns only Faunapoolen's one-time
campaign-data and process-role transition.

## Non-negotiable invariants

- Stop the legacy writer and confirm no generation is active before reading its campaign directory.
- Back up and extract-verify the complete stopped directory before creating the SQLite target.
- Import every valid historical writer record or import nothing. Corrupt, extra, duplicate, linked,
  special, changed, or ambiguous input blocks the migration.
- Name both importer paths explicitly. The importer never discovers live data, skips a record,
  repairs input, deletes source files, dual-writes, or falls back to JSON.
- Keep the stopped legacy directory and its verified backup unchanged as rollback evidence.
- Start production web or worker code only after the importer has published and re-verified the
  sealed receipt in the new database.
- Use the compiled product verifier for both the imported database and the database extracted from
  the first SQLite backup. It opens SQLite read-only, recomputes every stored physical and semantic
  aggregate, and must reproduce the captured importer receipt without changing the database.
- Activate `sqlite-online` backup and prove a real extracted restore before allowing admin writes.
- Keep provider calls disabled throughout validation. A paid generation is a separate post-cutover
  owner action, never a migration probe.
- Do not combine this data/runtime transition with DNS, nginx, TLS, or public-host cutover.

## Authority transition

| State                  | Web role                  | Worker role                          | Campaign authority                       | Backup authority                            |
| ---------------------- | ------------------------- | ------------------------------------ | ---------------------------------------- | ------------------------------------------- |
| Legacy active          | legacy `server/index.mjs` | embedded/process-local               | live legacy campaign directory           | not activated for that live directory       |
| Frozen                 | stopped                   | stopped                              | stopped legacy campaign directory        | extracted and verified directory bundle     |
| Imported, not selected | stopped                   | stopped                              | imported private SQLite; legacy retained | both proofs retained; no live selection yet |
| After cutover          | supervised compiled web   | independently supervised jobs worker | `data/faunapoolen.db` only               | registered `sqlite-online` snapshot         |

`.run/` remains purge-class logs/runtime noise. It is never product-data authority after cutover.

## Gate 1 — authorisation and preflight

- [ ] Obtain explicit approval for the maintenance window, privileged service changes, backup
      activation, paired selection, and restarts. Approval for source work alone is insufficient.
- [ ] Confirm the published GitHub `@mikaelcedergren/cx-framework` lock contains the accepted server
      contract; no local tarball or Cortex path may be used.
- [ ] Confirm the source worktree contains only reviewed releasable changes, and run `pnpm check`,
      isolated browser E2E, SEO/UI comparison, the frozen importer contract, and two deterministic
      source-away server artifacts.
- [ ] Run the non-mutating browser-history preview and record every retained release. The current
      expected result is five `already-v2` releases and no adoption transaction:

  ```bash
  node ../server-ops/bin/adopt-browser-releases-v2.mjs --site faunapoolen
  ```

  Any schema-v1, mixed, unknown, linked, or changed history blocks this gate. It must be handled by
  the shared offline adopter while the service is absent; never carry a compatibility path into the
  product or release flow.

- [ ] Prepare one inactive browser candidate and one inactive server candidate through the paired
      preparation flow, using explicit recorded release IDs. Preview, then apply:

  ```bash
  node ../server-ops/bin/site-release.mjs \
    --site faunapoolen --prepare-only --release-id <browser-id>
  node ../server-ops/bin/site-release.mjs \
    --site faunapoolen --prepare-only --release-id <browser-id> --apply
  node ../server-ops/bin/server-release.mjs \
    --site faunapoolen --prepare-only --release-id <server-id>
  node ../server-ops/bin/server-release.mjs \
    --site faunapoolen --prepare-only --release-id <server-id> --apply
  ```

  Pin the reviewed source identity before either preparation. Prove the two candidate receipts name
  that same revision, source fingerprint, and dirty-state identity; prove the server artifact is
  deterministic from a second source-away build; and prove preparation changed neither live pointer
  nor process. If either source receipt differs, discard neither candidate by hand: stop and use the
  registered release cleanup/recovery contract.

- [ ] Run the fake-provider completed-receipt regression: a real durable worker must apply the paid
      result under the original run/effect identities, enqueue the next stage atomically, and leave
      the provider POST count unchanged. Never use a paid request as this proof.
- [ ] Confirm the shared backup implementation and independent security audit are green, then add
      and validate the explicitly reviewed Faunapoolen registry declarations. Do not manufacture a
      temporary config outside the canonical registry.
- [ ] Record the current service identity, PID, command, port, health result, legacy campaign count,
      and current browser build identity without printing secrets or campaign content.
- [ ] In the authenticated studio, confirm no campaign stage is running and wait for any active
      provider request to reach a durable terminal result. A process stop is not cancellation proof.
- [ ] Confirm production secrets exist with correct ownership and modes without displaying their
      values. Provision an owned mode-`0600` `.env.web` containing only `ADMIN_USERNAME`,
      `ADMIN_PASSWORD`, and `SESSION_SECRET`, plus an empty owned mode-`0600` `.env.worker` reserved
      for the later provider key. Neither role may load legacy `.env` or the other role's file. Do
      not provision `OPENAI_API_KEY` before Gate 6. Keep the non-secret
      `CAMPAIGN_GENERATION_ENABLED=0` explicit in both tracked service definitions throughout
      validation.

Failure leaves the current legacy service and data authority unchanged.

## Gate 2 — freeze and prove the legacy source

- [ ] Stop the legacy service using the shared privileged-service procedure. Do not start either
      compiled role yet.
- [ ] Prove both registered launchd labels return exact unloaded status `113`, port `3040` has no
      listener, and the recorded legacy PID has exited. Move the installed legacy web plist to
      reviewed rollback storage outside `/Library/LaunchDaemons`; prove both conventional web and
      worker plist paths are absent. Do not destroy or repurpose the legacy definition.
- [ ] Pin the stopped campaign-directory inventory, file count, aggregate byte count, and aggregate
      digest. Do not log individual campaign content.
- [ ] Confirm the canonical registry still names the literal stopped `.run/campaigns` directory as
      required `legacy-campaigns` storage with `directory-snapshot`; do not substitute a copied or
      temporary source.
- [ ] Preview and apply the registry-driven backup. Capture the resulting bundle ID, verify its
      complete manifest, extract that exact archive to a new canonical current-user-owned
      mode-`0700` temporary root, and run the shared whole-bundle verifier:

  ```bash
  node ../server-ops/bin/backup-state.mjs
  node ../server-ops/bin/backup-state.mjs --apply
  node ../server-ops/bin/verify-backup-restore.mjs \
    --root <canonical-absolute-mode-0700-extracted-backup-root>
  ```

- [ ] Prove the manifest's `legacy-campaigns` storage identity, recursive inventory, file count,
      aggregate byte count, and root digest equal the frozen source proof, then recompute the same
      proof from the extracted `products/faunapoolen/legacy-campaigns` tree and require exact
      equality. A manifest-valid archive without this source-to-extraction equality is insufficient.
- [ ] Confirm the stopped source directory still has the same identity, inventory, and bytes after
      backup. Any change or incomplete archive aborts the cutover.

If this gate fails, leave all evidence intact and restart the unchanged legacy service only after
the failure is understood.

## Gate 3 — one-time atomic import

The post-import pre-activation aggregate verifier deliberately opens the published main database
through immutable read-only SQLite and closes before runtime selection. This is a bounded offline
cutover exception to the framework's long-lived WAL opener: it cannot create WAL/SHM and is not
reachable from web or worker startup.

- [ ] On the first attempt, create the canonical `data/` parent as a canonical, current-user-owned
      mode-`0700` real directory and prove its path, owner, mode, and single directory identity. The
      target `data/faunapoolen.db`, SQLite sidecars, and importer-owned recovery artifacts must not
      exist.
- [ ] Run the compiled offline importer with both normalized absolute paths:

  ```bash
  node server/dist/import-campaigns.js \
    --source <stopped-legacy-campaign-directory> \
    --database <absolute-operational-root>/data/faunapoolen.db
  ```

- [ ] With a private evidence directory and `umask 077`, capture the emitted single-line JSON
      receipt as migration evidence: format version, campaign count, source bytes, physical
      aggregate hash, and ordered semantic aggregate hash.
- [ ] Pin the published target's identity, mode, byte count, SHA-256, and absence of SQLite sidecars.
      Run the identical compiled import command again with the same two absolute paths, capturing a
      second receipt. It must take the exact-replay path, the receipt files must be byte-identical,
      and the target identity, mode, bytes, hash, and sidecar absence must remain unchanged.
- [ ] Run the product-owned read-only semantic verifier against the published target and the first
      captured receipt. Its emitted receipt must be byte-identical too:

  ```bash
  node server/dist/verify-campaign-import.js \
    --database <absolute-operational-root>/data/faunapoolen.db \
    --receipt <absolute-private-evidence-root>/import-receipt.json
  ```

  This proof recomputes the receipt, ordered campaign sequence, IDs, stored source hashes, and
  canonical record hashes without creating WAL/SHM or changing the database.

- [ ] Prove the target is an owned private single-link regular file, all SQLite sidecars remain
      absent, full SQLite integrity and foreign keys pass, migration history is canonical, the
      immutable import marker matches the receipt, and every imported campaign ID, sequence, record
      hash, and aggregate hash matches.
- [ ] Prove the legacy directory remains byte- and identity-equivalent to the frozen source.

No malformed record may be removed to make this gate pass. Correct the owning source problem or
abort; never edit migration input in place.

The importer publishes a durable parent-level intent before any staging artifact. After an
interruption, never delete or rename intent, preparation, staging, target, or sidecar paths by hand.
First prove the recorded importer process has stopped, then rerun the identical compiled command
with the same two paths. It either performs bounded recovery of its own identity-proven artifacts or
takes exact replay. A live owner, mismatched intent, unexpected link, or unowned artifact fails
closed and requires review; it is not permission to clean around the evidence.

## Gate 4 — backup the new authority

- [ ] Only after Gate 3 is sealed, change the reviewed canonical registry in one transition: remove
      `legacy-campaigns` and declare `data/faunapoolen.db` as required backup storage using
      `sqlite-online` at `products/faunapoolen/faunapoolen.db`. Do not leave both declarations as
      competing authorities and do not make the SQLite entry optional.
- [ ] Run the complete server-ops source gate, then reinstall cleanup and backup together through
      `/Users/cortex/Development/server-ops/bin/install-system-jobs`. Prove both loaded definitions
      select the same new immutable release and its root-owned installed-authority record before
      running a backup. A registry edit in the mutable checkout does not update the already-sealed
      jobs and is not backup activation.
- [ ] Run the backup preview from that exact selected server-ops release, inspect the required
      `sqlite-online` plan, apply it, and capture the bundle ID. Extract the real archive to a new
      owned mode-`0700` disposable root and run `verify-backup-restore.mjs` against the complete
      extracted bundle.
- [ ] Run the product-owned verifier against the extracted
      `products/faunapoolen/faunapoolen.db` and the original private import receipt:

  ```bash
  node server/dist/verify-campaign-import.js \
    --database <canonical-absolute-mode-0700-extracted-root>/products/faunapoolen/faunapoolen.db \
    --receipt <absolute-private-evidence-root>/import-receipt.json
  ```

  Require its emitted receipt to be byte-identical to both importer receipts. This is the explicit
  restored-database semantic proof: full integrity and foreign keys, immutable import marker,
  campaign count, ordered sequence, IDs, source hashes, and canonical record hashes must all match.
  Record the extracted database identity and digest before and after to prove the verifier was
  non-mutating.

- [ ] Retain both the pre-import legacy bundle and the first SQLite bundle. Do not delete or rewrite
      either proof.

Admin access remains blocked until this gate passes.

## Gate 5 — select and start the compiled roles

- [ ] Preview and apply the offline paired selection using the exact candidate IDs recorded in Gate
      1, then record the returned cutover ID. Never start from source or `server/dist` in the
      repository and never select either half independently:

  ```bash
  node ../server-ops/bin/full-stack-cutover.mjs \
    --site faunapoolen \
    --browser-release-id <browser-id> \
    --server-release-id <server-id> \
    --verify-path /
  node ../server-ops/bin/full-stack-cutover.mjs \
    --site faunapoolen \
    --browser-release-id <browser-id> \
    --server-release-id <server-id> \
    --verify-path / \
    --apply
  ```

- [ ] Run `bin/install-server-daemon --check`, then install both reviewed system service definitions
      together with `bin/install-server-daemon --apply`. The installer validates the selected
      identity, both compiled entrypoints, private role-file metadata, and database metadata without
      reading private contents. It does not activate either role. Only the web role may listen on
      `127.0.0.1:3040`.
- [ ] Start the web role, then the jobs worker, through the authorised privileged procedure. Both
      must prove their sealed release identity and immutable import marker before writable startup.
- [ ] Verify `/healthz`, `/cx-server.json`, worker readiness, one listener on port `3040`, private
      database ownership, and clean startup diagnostics. Record that the worker's current lease is
      process/release readiness while `CAMPAIGN_GENERATION_ENABLED=0`, with provider construction,
      claims, recovery, maintenance, timers, and paid effects disabled. No generation state may
      change before Gate 6.
- [ ] Verify signed-out and signed-in admin flows, no-store API responses, noindex headers on
      `/admin`, `/en/admin`, `/api/admin`, and retired `/admin-auth`, campaign list/count/order, and
      recovery after a browser reload and session replacement. Do not enqueue provider work.
- [ ] Restart each role independently and repeat health, identity, campaign parity, session, worker
      readiness, and no-duplicate-claim checks.
- [ ] Run paired status, preview finalization, then apply finalization. Record the selected and
      previous browser/server IDs and keep the cutover journal open until every preceding check is
      green:

  ```bash
  node ../server-ops/bin/full-stack-cutover.mjs \
    --site faunapoolen --status --cutover-id <cutover-id>
  node ../server-ops/bin/full-stack-cutover.mjs \
    --site faunapoolen --finalize --cutover-id <cutover-id> --verify-path /
  node ../server-ops/bin/full-stack-cutover.mjs \
    --site faunapoolen --finalize --cutover-id <cutover-id> --verify-path / --apply
  ```

Only after every check is green may normal non-generation admin access resume. This transition does
not change Faunapoolen's already-live DNS, nginx, or HTTPS route; their current state is documented
in [`DOMAIN_SETUP.md`](DOMAIN_SETUP.md).

## Gate 6 — separately enable paid generation

- [ ] Obtain the owner's explicit post-cutover approval to enable paid generation. Completion of
      runtime validation alone is not that approval.
- [ ] Provision `OPENAI_API_KEY` exclusively in the owned mode-`0600` `.env.worker`, change the
      reviewed non-secret service/source configuration for both roles to exact
      `CAMPAIGN_GENERATION_ENABLED=1`, and reinstall both definitions together through the validated
      installer.
- [ ] Restart both roles through the authorised shared procedure and re-prove web health, server
      identity, worker readiness, database authority, and that startup enqueued no work.
- [ ] Let the owner choose the first real generation. Observe its durable stages and persisted
      receipt lineage; do not manufacture a paid migration probe.

Generation may remain disabled indefinitely without invalidating the data/runtime cutover.

## Rollback boundaries

Before the first post-cutover admin mutation, take both compiled roles offline and remove both
installed target definitions. If selection was not finalized, use the paired `--abort` preview and
apply forms. If it was finalized, use the paired `--revert` preview and apply forms. This first
cutover records no old compiled server selection, so it restores the prior browser pointer and an
unselected server state; restore the byte-exact legacy web plist separately, restart the unchanged
legacy service, and verify its original directory and health. Never run independent browser/server
rollbacks or delete the imported database; retain it as failure evidence.

The exact offline rollback commands are:

```bash
node ../server-ops/bin/full-stack-cutover.mjs \
  --site faunapoolen --abort --cutover-id <awaiting-cutover-id>
node ../server-ops/bin/full-stack-cutover.mjs \
  --site faunapoolen --abort --cutover-id <awaiting-cutover-id> --apply

node ../server-ops/bin/full-stack-cutover.mjs \
  --site faunapoolen --revert --cutover-id <completed-cutover-id>
node ../server-ops/bin/full-stack-cutover.mjs \
  --site faunapoolen --revert --cutover-id <completed-cutover-id> --apply
```

Use only the pair appropriate to the journal's recorded state; abort and revert are alternatives,
not a sequence.

After any session, campaign mutation, or generation is accepted by SQLite, the legacy directory is
stale. Returning to it would lose acknowledged work and is forbidden. From that boundary onward,
rollback stays inside the SQLite architecture: stop both roles, use a paired revert only to a
recorded compiled browser/server pair that uses SQLite, or restore a verified SQLite bundle, then
restart both roles and re-run the complete identity/data/health/finalization proof. The first
cutover's legacy pair is forbidden after this boundary. There is no reverse exporter, dual writer,
or JSON fallback.

## Completion record

Record dates, authorisations, source and target aggregate receipts, verified backup bundle IDs,
server artifact IDs, service identities, health/identity results, rollback boundary, and every
intentional deferral in [`../WEB-ARCHITECTURE-MIGRATION.md`](../WEB-ARCHITECTURE-MIGRATION.md).
Do not mark the source-only architecture phase as an operational cutover, and do not mark public
go-live complete until the separate DNS/TLS/external-verification procedure passes.
