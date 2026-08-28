# Campaign data and runtime cutover

## Status

This is a prepared runbook, not an active migration. The legacy `server/index.mjs` process is
already stopped; its stopped campaign directory remains the sole campaign authority on the Mac
mini. The compiled web process, jobs worker, SQLite database, backup registration, service
definitions, and server-release selection must not be activated until the owner explicitly
authorises a maintenance window.

As of 2026-08-28, both `com.faunapoolen.server` and `com.faunapoolen.jobs` return exact unloaded
status `113`, both conventional files under `/Library/LaunchDaemons` are absent, and port `3040` has
no listener. Re-prove all three conditions at the maintenance boundary. Git history retains a
legacy plist template, but neither a byte-exact copy nor the digest of the last installed legacy
definition was captured. The historical template is context, not an authenticated restart or
rollback artifact.

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

All retained cutover receipts, proof databases, and extracted backup roots belong under the
current-user-owned private parent
`/Users/cortex/Development/.run/web-architecture-migration/faunapoolen`, never inside the product's
operational repo. At the maintenance boundary, create or re-prove that parent as a canonical
mode-`0700` real directory. Every operator that requires a new root receives its own missing child
under that parent; never reuse an earlier proof destination.

## Non-negotiable invariants

- Keep the legacy writer stopped and confirm no generation was active before reading its campaign
  directory. Process absence alone is not cancellation proof.
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

| State                  | Web role                | Worker role                          | Campaign authority                       | Backup authority                            |
| ---------------------- | ----------------------- | ------------------------------------ | ---------------------------------------- | ------------------------------------------- |
| Current stopped        | stopped                 | stopped                              | stopped legacy campaign directory        | not yet proved                              |
| Frozen and proved      | stopped                 | stopped                              | stopped legacy campaign directory        | extracted and verified directory bundle     |
| Imported, not selected | stopped                 | stopped                              | imported private SQLite; legacy retained | both proofs retained; no live selection yet |
| After cutover          | supervised compiled web | independently supervised jobs worker | `data/faunapoolen.db` only               | registered `sqlite-online` snapshot         |

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
- [ ] Record the current stopped topology: exact unloaded status `113` for both labels, absent
      conventional plist files, no listener on port `3040`, and the current browser build identity.
      Preserve any already captured prior legacy process, health, and campaign-count evidence, but
      do not invent missing historical facts or print secrets or campaign content.
- [ ] Require retained pre-stop evidence that no campaign stage or provider request was active. If
      that evidence was not captured, record the uncertainty explicitly; process absence is not
      cancellation proof, and the strict source inventory and importer must still reject any
      partial or ambiguous record rather than repair or skip it.
- [ ] Confirm production secrets exist with correct ownership and modes without displaying their
      values. Provision an owned mode-`0600` `.env.web` containing only `ADMIN_USERNAME`,
      `ADMIN_PASSWORD`, and `SESSION_SECRET`, plus an empty owned mode-`0600` `.env.worker` reserved
      for the later provider key. Neither role may load legacy `.env` or the other role's file. Do
      not provision `OPENAI_API_KEY` before Gate 6. Keep the non-secret
      `CAMPAIGN_GENERATION_ENABLED=0` explicit in both tracked service definitions throughout
      validation.

Failure leaves the stopped legacy data authority and absent service topology unchanged.

## Gate 2 — freeze and prove the legacy source

- [ ] Re-prove the already stopped state; do not start either compiled role. Both registered launchd
      labels must return exact unloaded status `113`, port `3040` must have no listener, and both
      conventional web and worker plist paths must remain absent.
- [ ] Record that no installed legacy plist is available to move into rollback storage. The legacy
      template retained in Git history does not prove the bytes of the definition that was actually
      installed, so do not copy it into `/Library/LaunchDaemons` or describe it as a byte-exact
      rollback.
- [ ] Pin the stopped campaign-directory inventory, file count, aggregate byte count, and aggregate
      digest. Do not log individual campaign content.
- [ ] Confirm the canonical registry still names the literal stopped `.run/campaigns` directory as
      required `legacy-campaigns` storage with `directory-snapshot`; do not substitute a copied or
      temporary source.
- [ ] Ensure cleanup and backup select the same reviewed immutable `server-ops` release containing
      the exact canonical registry. Install that pair together if needed. Choose one new evidence ID
      and bind every backup and extraction preview/apply result to its own missing file below the
      canonical private evidence root. These are exclusive no-replace evidence targets, never
      terminal-only output or reusable log files:

  ```bash
  FAUNAPOOLEN_EVIDENCE=/Users/cortex/Development/.run/web-architecture-migration/faunapoolen
  FAUNAPOOLEN_LEGACY_EVIDENCE_ID='<unique-evidence-id>'
  FAUNAPOOLEN_LEGACY_BACKUP_PREVIEW="$FAUNAPOOLEN_EVIDENCE/$FAUNAPOOLEN_LEGACY_EVIDENCE_ID-backup-preview.txt"
  FAUNAPOOLEN_LEGACY_BACKUP_APPLY="$FAUNAPOOLEN_EVIDENCE/$FAUNAPOOLEN_LEGACY_EVIDENCE_ID-backup-apply.txt"
  FAUNAPOOLEN_LEGACY_RESTORE_ROOT="$FAUNAPOOLEN_EVIDENCE/$FAUNAPOOLEN_LEGACY_EVIDENCE_ID-registry-restore"
  FAUNAPOOLEN_LEGACY_EXTRACTION_PREVIEW="$FAUNAPOOLEN_EVIDENCE/$FAUNAPOOLEN_LEGACY_EVIDENCE_ID-extraction-preview.txt"
  FAUNAPOOLEN_LEGACY_EXTRACTION_APPLY="$FAUNAPOOLEN_EVIDENCE/$FAUNAPOOLEN_LEGACY_EVIDENCE_ID-extraction-apply.json"
  readonly FAUNAPOOLEN_EVIDENCE FAUNAPOOLEN_LEGACY_EVIDENCE_ID
  readonly FAUNAPOOLEN_LEGACY_BACKUP_PREVIEW FAUNAPOOLEN_LEGACY_BACKUP_APPLY
  readonly FAUNAPOOLEN_LEGACY_RESTORE_ROOT FAUNAPOOLEN_LEGACY_EXTRACTION_PREVIEW
  readonly FAUNAPOOLEN_LEGACY_EXTRACTION_APPLY

  for FAUNAPOOLEN_LEGACY_EVIDENCE_PATH in \
    "$FAUNAPOOLEN_LEGACY_BACKUP_PREVIEW" \
    "$FAUNAPOOLEN_LEGACY_BACKUP_APPLY" \
    "$FAUNAPOOLEN_LEGACY_RESTORE_ROOT" \
    "$FAUNAPOOLEN_LEGACY_EXTRACTION_PREVIEW" \
    "$FAUNAPOOLEN_LEGACY_EXTRACTION_APPLY"; do
    if [[ -e "$FAUNAPOOLEN_LEGACY_EVIDENCE_PATH" || -L "$FAUNAPOOLEN_LEGACY_EVIDENCE_PATH" ]]; then
      echo "Faunapoolen legacy evidence path already exists: $FAUNAPOOLEN_LEGACY_EVIDENCE_PATH" >&2
      exit 1
    fi
  done

  /Users/cortex/Development/server-ops/bin/install-system-jobs
  (umask 077; set -C; /Users/cortex/Development/server-ops/bin/system-job-launcher.mjs \
    --selected-backup-preview \
    >"$FAUNAPOOLEN_LEGACY_BACKUP_PREVIEW")

  FAUNAPOOLEN_LEGACY_BACKUP_IDENTITY='<exact-selectionIdentity-from-first-preview-line>'
  readonly FAUNAPOOLEN_LEGACY_BACKUP_IDENTITY

  (umask 077; set -C; /Users/cortex/Development/server-ops/bin/system-job-launcher.mjs \
    --selected-backup-apply \
    --expected-selected-backup-identity "$FAUNAPOOLEN_LEGACY_BACKUP_IDENTITY" \
    >"$FAUNAPOOLEN_LEGACY_BACKUP_APPLY")

  FAUNAPOOLEN_LEGACY_BACKUP_ARCHIVE='<exact-final-archive-path-from-applied-output>'
  readonly FAUNAPOOLEN_LEGACY_BACKUP_ARCHIVE
  ```

  The selected preview's first JSON line must report operation `selected-system-job-backup`, state
  `preview`, `releaseDigest`, and `selectionIdentity`; its plan must contain the required
  Faunapoolen `legacy-campaigns` `directory-snapshot`. The selected apply must exit `0`; its final
  output supplies the exact newly created archive path. Mutable-checkout `backup-state.mjs --apply`
  and manual launchd kickstart are not accepted reviewed apply paths.

- [ ] Choose a missing extraction destination under an existing canonical current-user-owned
      mode-`0700` parent. Preview the exact new mode-`0600`, single-link archive, capture
      `archiveIdentity`, then apply that reviewed identity:

  ```bash
  (umask 077; set -C; node /Users/cortex/Development/server-ops/bin/extract-backup-archive.mjs \
    --archive "$FAUNAPOOLEN_LEGACY_BACKUP_ARCHIVE" \
    --destination "$FAUNAPOOLEN_LEGACY_RESTORE_ROOT" \
    >"$FAUNAPOOLEN_LEGACY_EXTRACTION_PREVIEW")

  FAUNAPOOLEN_LEGACY_ARCHIVE_IDENTITY='<exact-archiveIdentity-from-preview>'
  readonly FAUNAPOOLEN_LEGACY_ARCHIVE_IDENTITY

  (umask 077; set -C; node /Users/cortex/Development/server-ops/bin/extract-backup-archive.mjs \
    --archive "$FAUNAPOOLEN_LEGACY_BACKUP_ARCHIVE" \
    --destination "$FAUNAPOOLEN_LEGACY_RESTORE_ROOT" \
    --expected-archive-identity "$FAUNAPOOLEN_LEGACY_ARCHIVE_IDENTITY" \
    --apply \
    >"$FAUNAPOOLEN_LEGACY_EXTRACTION_APPLY")
  ```

  The extractor preview supplies `archiveBytes`, `archiveSha256`, and `archiveIdentity`; retain that
  exact archive digest and identity. Require apply state `verified`, retain the whole-bundle receipt
  and extracted root, and require its exact manifest verification. Never extract a backup with raw
  `tar`.

- [ ] Prove the manifest's `legacy-campaigns` storage identity, recursive inventory, file count,
      aggregate byte count, and root digest equal the frozen source proof, then recompute the same
      proof from the extracted `products/faunapoolen/legacy-campaigns` tree and require exact
      equality. A manifest-valid archive without this source-to-extraction equality is insufficient.
- [ ] Confirm the stopped source directory still has the same identity, inventory, and bytes after
      backup. Any change or incomplete archive aborts the cutover.

If this gate fails, leave all evidence intact and keep the site stopped while the failure is
understood. An unchanged legacy restart cannot currently be promised because the last installed
definition was not captured byte-exactly. Do not reconstruct it from the historical Git template;
restart requires a separately authenticated exact definition or a newly reviewed and authorised
recovery definition.

## Gate 3 — one-time atomic import

The post-import pre-activation aggregate verifier deliberately opens the published main database
through immutable read-only SQLite and closes before runtime selection. This is a bounded offline
cutover exception to the framework's long-lived WAL opener: it cannot create WAL/SHM and is not
reachable from web or worker startup.

- [ ] On the first attempt, create the canonical `data/` parent as a canonical, current-user-owned
      mode-`0700` real directory and prove its path, owner, mode, and single directory identity. The
      target `data/faunapoolen.db`, SQLite sidecars, and importer-owned recovery artifacts must not
      exist.
- [ ] Run the registered offline importer only through the authenticated inactive-candidate
      boundary, as the non-root `cortex` owner. Use the exact server ID prepared in Gate 1, the
      stopped canonical source directory, the canonical target, and one missing receipt path below
      the private evidence root. Preview, capture `identity`, then repeat every argument and apply:

  ```bash
  node /Users/cortex/Development/server-ops/bin/server-candidate-tool.mjs \
    --site faunapoolen \
    --release-id <server-id> \
    --tool import-campaigns \
    --evidence-root /Users/cortex/Development/.run/web-architecture-migration/faunapoolen \
    --path source=/Users/cortex/Development/faunapoolen.se/.run/campaigns \
    --path database=/Users/cortex/Development/faunapoolen.se/data/faunapoolen.db \
    --output /Users/cortex/Development/.run/web-architecture-migration/faunapoolen/<evidence-id>-import-receipt.json

  node /Users/cortex/Development/server-ops/bin/server-candidate-tool.mjs \
    --site faunapoolen \
    --release-id <server-id> \
    --tool import-campaigns \
    --evidence-root /Users/cortex/Development/.run/web-architecture-migration/faunapoolen \
    --path source=/Users/cortex/Development/faunapoolen.se/.run/campaigns \
    --path database=/Users/cortex/Development/faunapoolen.se/data/faunapoolen.db \
    --output /Users/cortex/Development/.run/web-architecture-migration/faunapoolen/<evidence-id>-import-receipt.json \
    --expected-identity <preview-identity> \
    --apply
  ```

  Require preview state `preview` and applied state `applied`. The applied result must bind the
  candidate, current source, reviewed identity, and output path, byte count, and digest. The output
  file itself—not the command wrapper—is the canonical product receipt: one new single-line JSON
  file created mode `0600` with format version, campaign count, source bytes, physical aggregate
  hash, and ordered semantic aggregate hash. Do not redirect stdout or execute a retained artifact
  path directly.

- [ ] Pin the published target's identity, mode, byte count, SHA-256, and absence of SQLite sidecars.
      Preview and apply the same registered importer again with the same candidate, source, and
      database but a second missing output file and its newly reviewed identity:

  ```bash
  node /Users/cortex/Development/server-ops/bin/server-candidate-tool.mjs \
    --site faunapoolen \
    --release-id <server-id> \
    --tool import-campaigns \
    --evidence-root /Users/cortex/Development/.run/web-architecture-migration/faunapoolen \
    --path source=/Users/cortex/Development/faunapoolen.se/.run/campaigns \
    --path database=/Users/cortex/Development/faunapoolen.se/data/faunapoolen.db \
    --output /Users/cortex/Development/.run/web-architecture-migration/faunapoolen/<evidence-id>-import-replay-receipt.json

  node /Users/cortex/Development/server-ops/bin/server-candidate-tool.mjs \
    --site faunapoolen \
    --release-id <server-id> \
    --tool import-campaigns \
    --evidence-root /Users/cortex/Development/.run/web-architecture-migration/faunapoolen \
    --path source=/Users/cortex/Development/faunapoolen.se/.run/campaigns \
    --path database=/Users/cortex/Development/faunapoolen.se/data/faunapoolen.db \
    --output /Users/cortex/Development/.run/web-architecture-migration/faunapoolen/<evidence-id>-import-replay-receipt.json \
    --expected-identity <replay-preview-identity> \
    --apply
  ```

  It must take the exact-replay path, the two canonical product receipt files must be
  byte-identical, and the target identity, mode, bytes, hash, and sidecar absence must remain
  unchanged.

- [ ] Run the product-owned read-only semantic verifier against the published target and the first
      captured receipt through the same authenticated inactive candidate. Preview and apply with a
      third missing output file:

  ```bash
  node /Users/cortex/Development/server-ops/bin/server-candidate-tool.mjs \
    --site faunapoolen \
    --release-id <server-id> \
    --tool verify-campaign-import \
    --evidence-root /Users/cortex/Development/.run/web-architecture-migration/faunapoolen \
    --path database=/Users/cortex/Development/faunapoolen.se/data/faunapoolen.db \
    --path receipt=/Users/cortex/Development/.run/web-architecture-migration/faunapoolen/<evidence-id>-import-receipt.json \
    --output /Users/cortex/Development/.run/web-architecture-migration/faunapoolen/<evidence-id>-import-verification-receipt.json

  node /Users/cortex/Development/server-ops/bin/server-candidate-tool.mjs \
    --site faunapoolen \
    --release-id <server-id> \
    --tool verify-campaign-import \
    --evidence-root /Users/cortex/Development/.run/web-architecture-migration/faunapoolen \
    --path database=/Users/cortex/Development/faunapoolen.se/data/faunapoolen.db \
    --path receipt=/Users/cortex/Development/.run/web-architecture-migration/faunapoolen/<evidence-id>-import-receipt.json \
    --output /Users/cortex/Development/.run/web-architecture-migration/faunapoolen/<evidence-id>-import-verification-receipt.json \
    --expected-identity <verification-preview-identity> \
    --apply
  ```

  Require its canonical output receipt to be byte-identical to both importer receipts. This proof
  recomputes the receipt, ordered campaign sequence, IDs, stored source hashes, and canonical record
  hashes without creating WAL/SHM or changing the database. The runner hashes and re-proves both
  read-only inputs across execution.

- [ ] Prove the target is an owned private single-link regular file, all SQLite sidecars remain
      absent, full SQLite integrity and foreign keys pass, migration history is canonical, the
      immutable import marker matches the receipt, and every imported campaign ID, sequence, record
      hash, and aggregate hash matches.
- [ ] Prove the legacy directory remains byte- and identity-equivalent to the frozen source.

No malformed record may be removed to make this gate pass. Correct the owning source problem or
abort; never edit migration input in place.

The importer publishes a durable parent-level intent before any staging artifact. After an
interruption, never delete or rename intent, preparation, staging, target, or sidecar paths by hand.
First prove the recorded importer process has stopped, then preview and apply the same registered
candidate tool with the same server ID and two product paths but a new missing evidence output. It
either performs bounded recovery of its own identity-proven artifacts or takes exact replay. A live
owner, changed source/candidate/offline boundary, mismatched intent, unexpected link, or unowned
artifact fails closed and requires review; it is not permission to clean around the evidence.

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
- [ ] Use a new evidence ID for the SQLite registry backup. Reserve distinct missing no-replace
      output files and a distinct missing extraction root before previewing anything:

  ```bash
  FAUNAPOOLEN_SQLITE_EVIDENCE=/Users/cortex/Development/.run/web-architecture-migration/faunapoolen
  FAUNAPOOLEN_SQLITE_EVIDENCE_ID='<new-unique-evidence-id>'
  FAUNAPOOLEN_SQLITE_BACKUP_PREVIEW="$FAUNAPOOLEN_SQLITE_EVIDENCE/$FAUNAPOOLEN_SQLITE_EVIDENCE_ID-backup-preview.txt"
  FAUNAPOOLEN_SQLITE_BACKUP_APPLY="$FAUNAPOOLEN_SQLITE_EVIDENCE/$FAUNAPOOLEN_SQLITE_EVIDENCE_ID-backup-apply.txt"
  FAUNAPOOLEN_SQLITE_RESTORE_ROOT="$FAUNAPOOLEN_SQLITE_EVIDENCE/$FAUNAPOOLEN_SQLITE_EVIDENCE_ID-registry-restore"
  FAUNAPOOLEN_SQLITE_EXTRACTION_PREVIEW="$FAUNAPOOLEN_SQLITE_EVIDENCE/$FAUNAPOOLEN_SQLITE_EVIDENCE_ID-extraction-preview.txt"
  FAUNAPOOLEN_SQLITE_EXTRACTION_APPLY="$FAUNAPOOLEN_SQLITE_EVIDENCE/$FAUNAPOOLEN_SQLITE_EVIDENCE_ID-extraction-apply.json"
  FAUNAPOOLEN_POST_GATE_BACKUP_PREVIEW="$FAUNAPOOLEN_SQLITE_EVIDENCE/$FAUNAPOOLEN_SQLITE_EVIDENCE_ID-post-gate-backup-preview.txt"
  readonly FAUNAPOOLEN_SQLITE_EVIDENCE FAUNAPOOLEN_SQLITE_EVIDENCE_ID
  readonly FAUNAPOOLEN_SQLITE_BACKUP_PREVIEW FAUNAPOOLEN_SQLITE_BACKUP_APPLY
  readonly FAUNAPOOLEN_SQLITE_RESTORE_ROOT FAUNAPOOLEN_SQLITE_EXTRACTION_PREVIEW
  readonly FAUNAPOOLEN_SQLITE_EXTRACTION_APPLY FAUNAPOOLEN_POST_GATE_BACKUP_PREVIEW

  for FAUNAPOOLEN_SQLITE_EVIDENCE_PATH in \
    "$FAUNAPOOLEN_SQLITE_BACKUP_PREVIEW" \
    "$FAUNAPOOLEN_SQLITE_BACKUP_APPLY" \
    "$FAUNAPOOLEN_SQLITE_RESTORE_ROOT" \
    "$FAUNAPOOLEN_SQLITE_EXTRACTION_PREVIEW" \
    "$FAUNAPOOLEN_SQLITE_EXTRACTION_APPLY" \
    "$FAUNAPOOLEN_POST_GATE_BACKUP_PREVIEW"; do
    if [[ -e "$FAUNAPOOLEN_SQLITE_EVIDENCE_PATH" || -L "$FAUNAPOOLEN_SQLITE_EVIDENCE_PATH" ]]; then
      echo "Faunapoolen SQLite evidence path already exists: $FAUNAPOOLEN_SQLITE_EVIDENCE_PATH" >&2
      exit 1
    fi
  done
  ```

- [ ] Preview the selected immutable backup into the reserved file. Require the new sealed plan to
      contain the required Faunapoolen `sqlite-online` storage at
      `products/faunapoolen/faunapoolen.db`, capture `selectionIdentity`, then apply through that
      exact selected authority:

  ```bash
  (umask 077; set -C; /Users/cortex/Development/server-ops/bin/system-job-launcher.mjs \
    --selected-backup-preview \
    >"$FAUNAPOOLEN_SQLITE_BACKUP_PREVIEW")

  FAUNAPOOLEN_SQLITE_BACKUP_IDENTITY='<exact-selectionIdentity-from-first-preview-line>'
  readonly FAUNAPOOLEN_SQLITE_BACKUP_IDENTITY

  (umask 077; set -C; /Users/cortex/Development/server-ops/bin/system-job-launcher.mjs \
    --selected-backup-apply \
    --expected-selected-backup-identity "$FAUNAPOOLEN_SQLITE_BACKUP_IDENTITY" \
    >"$FAUNAPOOLEN_SQLITE_BACKUP_APPLY")

  FAUNAPOOLEN_SQLITE_BACKUP_ARCHIVE='<exact-final-archive-path-from-applied-output>'
  readonly FAUNAPOOLEN_SQLITE_BACKUP_ARCHIVE
  ```

  The selected preview supplies `releaseDigest` and `selectionIdentity`; the selected apply's final
  output supplies the real archive path.

- [ ] Preview the exact archive into the reserved extraction evidence, capture its
      `archiveIdentity`, and apply into the reserved missing root:

  ```bash
  (umask 077; set -C; node /Users/cortex/Development/server-ops/bin/extract-backup-archive.mjs \
    --archive "$FAUNAPOOLEN_SQLITE_BACKUP_ARCHIVE" \
    --destination "$FAUNAPOOLEN_SQLITE_RESTORE_ROOT" \
    >"$FAUNAPOOLEN_SQLITE_EXTRACTION_PREVIEW")

  FAUNAPOOLEN_SQLITE_ARCHIVE_IDENTITY='<exact-archiveIdentity-from-preview>'
  readonly FAUNAPOOLEN_SQLITE_ARCHIVE_IDENTITY

  (umask 077; set -C; node /Users/cortex/Development/server-ops/bin/extract-backup-archive.mjs \
    --archive "$FAUNAPOOLEN_SQLITE_BACKUP_ARCHIVE" \
    --destination "$FAUNAPOOLEN_SQLITE_RESTORE_ROOT" \
    --expected-archive-identity "$FAUNAPOOLEN_SQLITE_ARCHIVE_IDENTITY" \
    --apply \
    >"$FAUNAPOOLEN_SQLITE_EXTRACTION_APPLY")
  ```

  The extractor preview supplies the real `archiveSha256` and `archiveIdentity`. Require apply state
  `verified`, retain the whole-bundle receipt and extracted root, and never substitute raw `tar`
  extraction.

- [ ] Run the product-owned verifier against the extracted
      `products/faunapoolen/faunapoolen.db` and the original private import receipt:

  First return the still-stopped operational database to one immutable main file through SQLite;
  never unlink WAL/SHM manually. Preview and apply the registered quiescer with a new missing
  evidence output, then rerun the existing immutable target verifier with another new output:

  ```bash
  node /Users/cortex/Development/server-ops/bin/server-candidate-tool.mjs \
    --site faunapoolen \
    --release-id <server-id> \
    --tool quiesce-campaign-database \
    --evidence-root /Users/cortex/Development/.run/web-architecture-migration/faunapoolen \
    --path database=/Users/cortex/Development/faunapoolen.se/data/faunapoolen.db \
    --path receipt=/Users/cortex/Development/.run/web-architecture-migration/faunapoolen/<evidence-id>-import-receipt.json \
    --output /Users/cortex/Development/.run/web-architecture-migration/faunapoolen/<evidence-id>-quiescence-receipt.json

  node /Users/cortex/Development/server-ops/bin/server-candidate-tool.mjs \
    --site faunapoolen \
    --release-id <server-id> \
    --tool quiesce-campaign-database \
    --evidence-root /Users/cortex/Development/.run/web-architecture-migration/faunapoolen \
    --path database=/Users/cortex/Development/faunapoolen.se/data/faunapoolen.db \
    --path receipt=/Users/cortex/Development/.run/web-architecture-migration/faunapoolen/<evidence-id>-import-receipt.json \
    --output /Users/cortex/Development/.run/web-architecture-migration/faunapoolen/<evidence-id>-quiescence-receipt.json \
    --expected-identity <quiescence-preview-identity> \
    --apply

  node /Users/cortex/Development/server-ops/bin/server-candidate-tool.mjs \
    --site faunapoolen \
    --release-id <server-id> \
    --tool verify-campaign-import \
    --evidence-root /Users/cortex/Development/.run/web-architecture-migration/faunapoolen \
    --path database=/Users/cortex/Development/faunapoolen.se/data/faunapoolen.db \
    --path receipt=/Users/cortex/Development/.run/web-architecture-migration/faunapoolen/<evidence-id>-import-receipt.json \
    --output /Users/cortex/Development/.run/web-architecture-migration/faunapoolen/<evidence-id>-post-backup-target-verification-receipt.json

  node /Users/cortex/Development/server-ops/bin/server-candidate-tool.mjs \
    --site faunapoolen \
    --release-id <server-id> \
    --tool verify-campaign-import \
    --evidence-root /Users/cortex/Development/.run/web-architecture-migration/faunapoolen \
    --path database=/Users/cortex/Development/faunapoolen.se/data/faunapoolen.db \
    --path receipt=/Users/cortex/Development/.run/web-architecture-migration/faunapoolen/<evidence-id>-import-receipt.json \
    --output /Users/cortex/Development/.run/web-architecture-migration/faunapoolen/<evidence-id>-post-backup-target-verification-receipt.json \
    --expected-identity <post-backup-target-verification-preview-identity> \
    --apply
  ```

  Require the quiescer's receipt to report an idle truncated checkpoint, no sidecars after close,
  an allocation-stable main file, and the exact sealed campaign-import receipt. Require the
  following target verifier output to be byte-identical to both importer receipts. Then verify the
  extracted database separately:

  ```bash
  node /Users/cortex/Development/server-ops/bin/server-candidate-tool.mjs \
    --site faunapoolen \
    --release-id <server-id> \
    --tool verify-campaign-import \
    --evidence-root /Users/cortex/Development/.run/web-architecture-migration/faunapoolen \
    --path "database=$FAUNAPOOLEN_SQLITE_RESTORE_ROOT/products/faunapoolen/faunapoolen.db" \
    --path receipt=/Users/cortex/Development/.run/web-architecture-migration/faunapoolen/<evidence-id>-import-receipt.json \
    --output /Users/cortex/Development/.run/web-architecture-migration/faunapoolen/<evidence-id>-restore-verification-receipt.json

  node /Users/cortex/Development/server-ops/bin/server-candidate-tool.mjs \
    --site faunapoolen \
    --release-id <server-id> \
    --tool verify-campaign-import \
    --evidence-root /Users/cortex/Development/.run/web-architecture-migration/faunapoolen \
    --path "database=$FAUNAPOOLEN_SQLITE_RESTORE_ROOT/products/faunapoolen/faunapoolen.db" \
    --path receipt=/Users/cortex/Development/.run/web-architecture-migration/faunapoolen/<evidence-id>-import-receipt.json \
    --output /Users/cortex/Development/.run/web-architecture-migration/faunapoolen/<evidence-id>-restore-verification-receipt.json \
    --expected-identity <restore-verification-preview-identity> \
    --apply
  ```

  Require its emitted receipt to be byte-identical to both importer receipts. This is the explicit
  restored-database semantic proof: full integrity and foreign keys, immutable import marker,
  campaign count, ordered sequence, IDs, source hashes, and canonical record hashes must all match.
  Record the extracted database identity and digest before and after to prove the verifier was
  non-mutating.

- [ ] Retain both the pre-import legacy bundle and the first SQLite bundle. Do not delete or rewrite
      either proof.
- [ ] Only after the imported-target and extracted-restore verifier outputs are byte-identical to
      both importer receipts, remove the exact Faunapoolen `firstSelectionGate` from the canonical
      registry. Run the complete `server-ops` source gate again, reinstall cleanup and backup
      together, then write the selected immutable backup preview to its reserved no-replace file:

  ```bash
  (umask 077; set -C; /Users/cortex/Development/server-ops/bin/system-job-launcher.mjs \
    --selected-backup-preview \
    >"$FAUNAPOOLEN_POST_GATE_BACKUP_PREVIEW")
  ```

  Require that preview to show the same Faunapoolen `sqlite-online` entry. A source edit or gate
  removal without that new sealed job pair is not final registry activation.

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
- [ ] As the non-root `cortex` owner, preview the authenticated selected server release, exact
      root-owned installed definitions, and complete unloaded role family. Capture `identity`, then
      apply that same reviewed first-bootstrap boundary:

  ```bash
  node /Users/cortex/Development/server-ops/bin/bootstrap-site-services.mjs \
    --site faunapoolen
  sudo -v
  node /Users/cortex/Development/server-ops/bin/bootstrap-site-services.mjs \
    --site faunapoolen \
    --expected-identity <preview-identity> \
    --apply
  ```

  Run `sudo -v` immediately before apply; the non-root Node operator accepts only a cached
  non-interactive sudo session. It crosses privilege only for the exact launchctl bootstrap calls,
  starts the web role before the jobs worker, and bootouts every role started by a partial attempt
  in reverse order. Both roles must prove their sealed release identity and immutable import marker
  before writable startup. Keep `CAMPAIGN_GENERATION_ENABLED=0`; first bootstrap is not permission
  to add the worker key or enable paid generation.

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
unselected server state. There is no authenticated byte-exact legacy web plist to restore: the
historical Git template is not proof of the previously installed bytes. Keep the site stopped until
an exact legacy definition is independently recovered and authenticated or the owner explicitly
authorises a newly reviewed recovery definition. Never run independent browser/server rollbacks,
recreate the old definition by assumption, or delete the imported database; retain it as failure
evidence.

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
