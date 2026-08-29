# Domain & routing — faunapoolen.se

The site is a local always-on service on this Mac mini (same public-gateway pattern as
**bitsize.me** and **blinkdrop**): prerendered SSG output behind nginx, with a compiled Express web
process and a separate listener-free campaign worker.

```
visitor -> DNS -> 81.170.132.41 -> router TCP 80/443 -> nginx -> Express (127.0.0.1:3040) -> current release
```

Public DNS was cut over to this Mac on 2026-08-27 and HTTPS is live; the dated go-live record below
owns that historical fact. Exact selected and running release identities, service-definition state,
and migration evidence live only in the root
[`WEB-ARCHITECTURE-MIGRATION.md`](../WEB-ARCHITECTURE-MIGRATION.md). Do not infer current runtime
state from this durable routing document. [`CAMPAIGN-CUTOVER.md`](CAMPAIGN-CUTOVER.md) preserves the
historical one-time data/process transition procedure.

The retained legacy entrypoint's common `.env` loader is historical compatibility code, not part
of the role-separated architecture; do not extend or copy it. `pnpm test:legacy` characterizes that
wrapper while it remains in the repository.

## Local service

The production architecture has two independently supervised roles from one sealed server
artifact:

- `server/dist/index.js`: the only listener, bound to `127.0.0.1:3040`.
- `server/dist/worker.js`: no listener; owns durable campaign generation claims.
- `data/faunapoolen.db`: private structured product state shared through SQLite, never `.run/`.
- `.env.web`: owned mode-`0600` web secrets; `.env.worker`: owned mode-`0600` provider secret.
- `launchd/com.faunapoolen.server.plist`: selected compiled web artifact plus sealed identity.
- `launchd/com.faunapoolen.jobs.plist`: selected compiled worker artifact plus the same sealed
  identity, with no `HOST` or `PORT`.
- Web logs: `.run/server.out.log`, `.run/server.err.log`; worker logs:
  `.run/jobs.out.log`, `.run/jobs.err.log`.
- Health: `http://127.0.0.1:3040/healthz`; the worker proves readiness through its sealed
  identity-file lease and has no HTTP endpoint. While `CAMPAIGN_GENERATION_ENABLED=0`, that lease
  proves process/release identity but the worker remains explicitly claim-disabled.

Source validation changes no service definition or running process:

```bash
bin/install-server-daemon          # same as --check
bin/install-server-daemon --check
```

`bin/install-server-daemon --apply` installs both plist files as one transaction. It validates only
private-file metadata, never reads secret or database contents, requires both roles exactly
unloaded, and accepts only an all-absent or all-exact target set. A failed later write rolls back
definitions created earlier in the attempt. It does not load, stop, start, kick, or restart either
role. Installation and activation remain separate authorised operations under the root server
standard; never use the installer to bypass release or restart verification.

Publish a change proved browser-only without restarting the service:

```bash
node ../server-ops/bin/site-release.mjs --site faunapoolen --browser-only --apply
```

A change proved server-only uses `server-release.mjs`; a change that affects both closures or whose
closure is uncertain uses the paired transaction. Release and rollback behavior is owned by the
root [`SERVER-STANDARD.md`](../SERVER-STANDARD.md).

## nginx

The active nginx config lives at:

```text
/opt/homebrew/etc/nginx/servers/faunapoolen.se.conf
```

Since the 2026-08-27 cutover it is the live HTTPS configuration — `ops/faunapoolen.nginx.live.conf.example` installed verbatim: the ACME location stays on port 80, all HTTP and `www` traffic 301s to the canonical apex HTTPS URL, and only the HTTPS apex proxies to the app. Certificate renewal is owned by the shared `com.cortex.cert-renewal` job.

Public static pages use the shared 60-second nginx micro-cache. `/healthz` and the entire
`/api/admin` prefix remain uncached; `/admin-auth` is retired as an API and remains only a noindexed
404 safety path. Do not cache authentication, generation status, or campaign mutations.

The compiled Express server sets `X-Robots-Tag: noindex, nofollow` on `/admin`, `/en/admin`,
`/api/admin`, and the retired `/admin-auth` prefix. `proxy_pass` forwards those headers; nothing in
nginx may strip or override them.

## Go-live (completed 2026-08-27)

The owner moved public DNS to this Mac on 2026-08-27. The public-routing cutover followed the shared
procedure — see [`../GO-LIVE.md`](../GO-LIVE.md) and
[`../SERVER-STANDARD.md`](../SERVER-STANDARD.md) — with these faunapoolen-specific values:

- **Domains:** `faunapoolen.se` and `www.faunapoolen.se`.
- **Local target:** `127.0.0.1:3040`, daemon `com.faunapoolen.server`.
- **Health endpoint:** `http://127.0.0.1:3040/healthz`.
- **Status:** live since 2026-08-27 — DNS cut over, certificate issued for both names, live HTTPS
  configuration installed and externally verified.

`public/CNAME` is omitted for Mac-mini nginx hosting. Add one containing `faunapoolen.se` only for
a deliberate GitHub Pages deployment after that hosting change is explicitly approved.

Cloudflared is not used for this cutover; the standard path is direct DNS/static IP/router/nginx.

### Cutover record (2026-08-27)

Executed per the baseline below with fresh same-day verification: apex A `81.170.132.41` and the
`www` → apex CNAME confirmed on 1.1.1.1 and 8.8.8.8 with the GitHub Pages A/AAAA records gone; the
public HTTP path and ACME route proven through the router; the certificate issued via the prepared
webroot (`certbot certonly --webroot`, both names, expires 2026-11-25, auto-renewed by
`com.cortex.cert-renewal`); the live nginx config installed verbatim, `nginx -t` clean, reloaded.
External checks: apex 200 over HTTP/2 with a certificate valid for both names; HTTP and `www` 301
to the apex preserving paths; sitemap, `/koi-pond-series.html`, a blog post carrying
`article:published_time`, `/en/`, and a real 404 all correct; gzip active.

The owner waived the rollback window on 2026-08-27. HSTS has been live since that day (per-site
header in the nginx config and its `ops/` example, `max-age=31536000`, deliberately without
`includeSubDomains`; the shared hardening snippet's global variant stays opt-in). The dated record
also noted restoring the web-record TTL to 3600 at one.com and removing the GitHub Pages
custom-domain binding as follow-ups; their current status belongs in the root migration ledger.

## Historical public-cutover baseline (observed 2026-07-06)

The generic activation procedure is [`../GO-LIVE.md`](../GO-LIVE.md) — this section adds only what
is faunapoolen-specific. The stakes are different here: this domain ranks exceptionally well, so
the goal was that **Google notices nothing except the IP changing**. At the observation date the
host was GitHub Pages and the www DNS record pointed at a third-party GitHub account
(`benjaminrehmie.github.io`).

Everything below is dated evidence, not current authority. Before any public move, freshly verify
the live host, DNS/TTL records, registrar/WHOIS renewal state, TLS behavior, redirects, and nginx
preparation, then record the new observation date. Do not execute a 2026-07 observation as a current
runbook.

### Historical parity baseline — probed 2026-07-06

| Behaviour                        | GitHub Pages observed 2026-07-06 | Mac mini after cutover         | Action                                                                                                                             |
| -------------------------------- | -------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `https://` apex                  | 200, valid cert                  | 200 after certbot              | —                                                                                                                                  |
| `http://`                        | **200, no redirect**             | 301 → https                    | Intentional improvement, keep                                                                                                      |
| `https://www`                    | 301 → apex                       | **must replicate**             | Check the prepared 443 block does `www → apex 301`. Note: the wargr conf serves www directly (200) — do NOT copy that pattern here |
| `/about` (no slash)              | 301 → `/about/`                  | 200, no redirect               | Acceptable — canonicals point to `/about/`; optional nginx tidy later                                                              |
| Unknown path                     | real 404                         | real 404                       | —                                                                                                                                  |
| HTML caching                     | `max-age=600`                    | `no-cache`                     | Fine (fresher after deploys)                                                                                                       |
| Compression                      | gzip                             | gzip                           | —                                                                                                                                  |
| `access-control-allow-origin: *` | present (GH default)             | absent                         | Nothing consumes assets cross-origin — no action                                                                                   |
| HSTS                             | absent                           | enable after HTTPS is verified | Do not pin browsers until the new certificate and both names are proven                                                            |

### Pre-flight (on the Mac mini, before touching DNS)

1. Pull this repo, install the locked dependencies, and run the complete source gate. Classify the
   complete releasable diff: browser-only used `site-release`, server-only used `server-release`,
   and both/uncertain used the paired transaction. The browser-only form was:

   ```bash
   corepack pnpm install --frozen-lockfile
   corepack pnpm check
   node ../server-ops/bin/site-release.mjs --site faunapoolen --browser-only --apply
   corepack pnpm e2e
   ```

   If server source or dependencies changed, prepare and select the source-identical pair through
   the root paired-cutover contract; do not publish either half, start source files, or restart only
   one role. Verify `/healthz`, `/cx-server.json`, worker readiness, and that a blog post's `<head>`
   carries `article:published_time` (proves the expected browser build is serving). Never restart
   after a pull before dependency and artifact validation.

2. Inspect `/opt/homebrew/etc/nginx/servers/faunapoolen.se.conf`: the prepared HTTPS configuration
   has separate blocks for the apex proxy and the `www` → apex 301. `nginx -t` passes.
3. `launchctl print system/com.cortex.cert-renewal` — renewal job loaded; certbot webroot matches
   the ACME location root (`/opt/homebrew/var/www/letsencrypt`).
4. Router still forwards TCP 80/443 (true for the six live domains — just confirm unchanged).
5. At the registrar, freshly confirm the one.com renewal state. Historical registry WHOIS observed
   on 2026-07-20 reported an expiry date of **2026-08-14**, which has passed; it is not evidence of
   current registration. Do not cut over without a new authoritative lookup and recorded result.
6. Lower TTL on the apex A/AAAA and `www` records to 300 at least one full current TTL (currently
   3600 seconds) before cutover. The old GitHub Pages AAAA records may be deleted at this point:
   IPv6 clients will safely fall back to the still-live GitHub Pages A records.

### Cutover day (ordered; pick a low-traffic hour)

1. In the existing one.com DNS zone — **do not change nameservers or DNSSEC**:
   - replace all four apex GitHub Pages A records with one `A` record to `81.170.132.41`
   - delete all four apex GitHub Pages AAAA records; this origin is IPv4-only
   - replace the `www` CNAME to `benjaminrehmie.github.io` with a CNAME to `faunapoolen.se`
   - leave MX, TXT, CAA, NS, DS/DNSSEC, and every non-web record untouched
2. Wait until both `@1.1.1.1` and `@8.8.8.8` return only `81.170.132.41` for the apex A, no apex
   AAAA answer, and `faunapoolen.se` for the `www` CNAME. Leaving the old AAAA records can send
   IPv6 visitors and Let's Encrypt validation to GitHub Pages indefinitely.
3. → GO-LIVE.md activation steps 1–2 (nginx -t, external HTTP check).
4. Issue the certificate through the already prepared ACME webroot:

   ```bash
   /opt/homebrew/bin/certbot certonly \
     --webroot -w /opt/homebrew/var/www/letsencrypt \
     -d faunapoolen.se -d www.faunapoolen.se
   ```

5. Install the fully prepared live config. It keeps the ACME location, redirects all HTTP and
   `www` traffic to the canonical apex HTTPS URL, and proxies only the HTTPS apex to the app:

   ```bash
   cp ops/faunapoolen.nginx.live.conf.example \
     /opt/homebrew/etc/nginx/servers/faunapoolen.se.conf
   /opt/homebrew/bin/nginx -t
   /opt/homebrew/bin/nginx -s reload
   ```

6. External verification (below).

**The cert gap:** between step 1 and step 5, visitors whose resolver already switched get a
broken `https://` (no cert yet); everyone else still reaches GitHub Pages. With steps pre-staged
the gap is minutes. Do not point DNS until the pre-flight is green.

**Version skew during propagation:** resolvers switch over gradually (up to the old TTL). The old
host keeps serving the pre-2026-07 site to stragglers. Harmless — but it is why the mini must be
serving the NEW build from minute one.

### External verification (from outside the home network)

- `https://faunapoolen.se/` 200, cert valid for both names
- `http://faunapoolen.se/` → 301 https; `https://www.faunapoolen.se/` → 301 apex
- `/sitemap.xml` 200; `/koi-pond-series.html` 200; a blog post 200 with
  `article:published_time` in the head; `/en/` 200; a garbage path → 404
- gzip active; response times sane

### 48-hour watch

- `.run/server.err.log` on the mini; `server-ops/bin/server-health.mjs`
- cert shows the renewal config: `certbot certificates`
- manual brand-query spot check ("faunapoolen") — listing should look unchanged
- Search Console is deferred by owner choice; its data backfills whenever it is eventually added

### Rollback (five minutes, restores the OLD site)

Restore the DNS records captured 2026-07-06:

- apex `A`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
- apex `AAAA`: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`,
  `2606:50c0:8003::153`
- `www` `CNAME`: `benjaminrehmie.github.io`

This resurrects the pre-cutover site (without the 2026-07 SEO improvements). For HTTPS-only
problems, prefer the nginx-level rollback in GO-LIVE.md and leave DNS alone.

### After 1–2 weeks stable

- Restore the web-record TTL from the temporary 300 seconds to the previous 3600 seconds.
- After confirming there are no intentionally HTTP-only subdomains, enable HSTS for this domain,
  validate nginx, and reload. Do not enable `includeSubDomains` before that inventory.
- Keep the GitHub Pages deployment while it is the rollback target; once confident, have its
  custom-domain binding removed so a stale mirror can't linger.
- Revisit deferred items at leisure: Search Console, the `/about` trailing-slash 301 parity.
