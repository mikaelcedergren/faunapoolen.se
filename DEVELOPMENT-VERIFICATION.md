# Change-aware development verification

Run `pnpm verify:change` after a coherent local change. It compares the exact current source with
the last successful proof, reuses checks only while their owned inputs are byte-identical, and runs
independent selected checks together. The first run deliberately executes the complete `pnpm check`
gate and the Angular hot-reload regression.

Useful controls:

```bash
pnpm verify:change --plan
pnpm verify:change --visual
pnpm verify:change --force
pnpm verify:change --full
```

## Faunapoolen map

- Documentation uses formatting only.
- Public product-skin changes use formatting, types, a production browser build, and the affected
  stable public route in the already-running local product on port `4240`.
- Private admin and campaign-interface changes additionally run the isolated E2E journey and render
  the `/admin/` or campaign route. The rendered route may show the real local login boundary; E2E
  owns authenticated synthetic behavior.
- E2E changes run the isolated repository-owned E2E command.
- Dependency, pnpm patch, and hot-reload harness changes also run `pnpm e2e:hmr`.
- Dependencies, repository authority, authentication, SQLite, durable jobs, the worker and provider
  boundary, environment ownership, private-route/robots alignment, installers, service/release and
  flattening machinery, and this verifier's trust implementation use the complete `pnpm check`
  gate.
- Unclassified source changes fail conservatively into the complete gate.

The verifier never enables paid generation, calls a provider, reads `.env.web`, `.env.worker`, or
operational data, or starts, stops, or repairs either local role. Receipts and screenshots stay in
ignored `.run/verification/` with private permissions and must never be committed.

The authoritative option meanings, hashing, evidence, escalation, and release-separation contract
lives in the Development root's
[`DEVELOPMENT-VERIFICATION.md`](https://github.com/mikaelcedergren/development-root/blob/main/DEVELOPMENT-VERIFICATION.md).
This file owns only Faunapoolen's checks, public/admin route catalogue, and effect boundaries.
