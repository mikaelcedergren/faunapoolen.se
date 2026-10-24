# Editable pool packages

`/admin/packages` edits the three existing packages. Titles are stored separately for English,
Swedish and Danish; each package has one starting price in whole SEK, excluding VAT and shipping.
The catalogue starts with the public site's 3 October 2026 values. Package IDs, order, images,
descriptions and swimming areas do not change when editing titles or prices.

Migration 16 stores a bounded, revisioned catalogue for each execution scope in the existing
SQLite database. Development updates cannot change production prices, including when the two
roles share a database. No operational database is read or written during builds or tests.
Shared storage activation still requires the existing coordinated offline migration procedure.

The authenticated, origin-checked admin API reads and updates the whole catalogue atomically.
Concurrent edits return a conflict instead of overwriting another save. Unsaved edits stay in the
editor after failed requests; leaving or reloading requires discarding them explicitly.

The public `/api/packages` read uses the serving process's scope and disables caching. Public
cards and enquiry choices use these saved values, without a rebuild. Prerendered pages keep their
surrounding content but do not freeze prices or package titles into static HTML: the browser loads
the current catalogue. A failed read displays recovery rather than obsolete fallback prices.
Enquiries retain their submitted title snapshot, so later renaming does not rewrite history.
