# Local design data

The personal-Mac design environment uses `pnpm dev:owner` at `http://127.0.0.1:4240`.
It stores records in the ignored `data/owner-development/faunapoolen.db`, separate from the
Mac mini's production database. The owner launcher excludes mail/provider credentials and disables
paid generation. Sign in with `dev` / `dev`.

Run `pnpm dev:seed` to add the local sample set:

- Six fictional customers and eight enquiries across new, contacted and closed states.
- Four campaigns spanning strategy, bilingual copy and complete image prompts.
- Four social posts, including image previews, an unfinished text-only draft and a version marked published.

Names identify demo records and customer addresses use `example.test`. The published checkbox is
sample state only; no post is sent anywhere. Existing repository photos supply the social previews.
The Social posts preview notice remains in place; choose **Take me there anyway** to explore them.

Run setup after the owner environment has created its database. The command accepts no destination
or path arguments, refuses production mode and linked storage, and verifies the existing schema
before writing. It never loads secrets or migrates an existing store. It creates no generation runs
or provider effects, and retains no email notification work for sample enquiries.

Records and their media persist across reloads, dev restarts and source updates. Setup is explicit,
never part of application startup. Re-running it adds missing sample records and preserves edits to
existing records, including package prices. Removing a sample record and running setup again restores
that record. The recipe is versioned; the database and personal edits are not committed.

Fixture persistence and idempotency checks use only a temporary synthetic database:

```sh
cd server
node --import tsx --test src/development-demo.test.ts
```
