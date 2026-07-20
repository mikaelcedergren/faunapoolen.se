# Domain & routing — faunapoolen.se

The site runs as a local always-on Express server on this Mac mini (same pattern as
**bitsize.me** and **blinkdrop**): prerendered SSG output served by `server/index.mjs`,
kept alive by a system LaunchDaemon and fronted by nginx.

```
visitor -> DNS -> 81.170.132.41 -> router TCP 80/443 -> nginx -> Express (127.0.0.1:3040) -> dist/browser
```

Important current state: the local service and nginx route are prepared on this Mac, but public DNS is intentionally not cut over yet. The existing public domain should keep serving the old/live site until the owner explicitly approves the move.

## Local service

- Service definition: [`launchd/com.faunapoolen.server.plist`](launchd/com.faunapoolen.server.plist)
- Listens on `127.0.0.1:3040` (`HOST`/`PORT`), `NODE_ENV=production`.
- Logs: `.run/server.out.log`, `.run/server.err.log`.
- Health check: `http://127.0.0.1:3040/healthz`.

Install / control (system LaunchDaemon — the server standard; needs sudo):

```bash
sudo cp launchd/com.faunapoolen.server.plist /Library/LaunchDaemons/
sudo chown root:wheel /Library/LaunchDaemons/com.faunapoolen.server.plist
sudo chmod 644 /Library/LaunchDaemons/com.faunapoolen.server.plist
sudo launchctl bootstrap system /Library/LaunchDaemons/com.faunapoolen.server.plist  # install + start
sudo launchctl kickstart -k system/com.faunapoolen.server   # restart after a new build
sudo launchctl bootout system/com.faunapoolen.server         # stop
```

Rebuild + restart after content changes:

```bash
pnpm build && sudo launchctl kickstart -k system/com.faunapoolen.server
```

## nginx

The active nginx config lives at:

```text
/opt/homebrew/etc/nginx/servers/faunapoolen.se.conf
```

It is intentionally in HTTP prelaunch mode until DNS is moved and a real certificate is issued. The HTTP ACME route is ready, and the prepared HTTPS configuration should be installed only after certificate issuance.

Public static pages use the shared 60-second nginx micro-cache. `/healthz` and `/admin-auth/` have
dedicated uncached proxy locations so health checks are live and authentication responses can never
inherit page caching.

## Go-live (do not do until approved)

The domain `faunapoolen.se` currently remains on the existing public host by design. The cutover
follows the shared procedure — see [`../GO-LIVE.md`](../GO-LIVE.md) and
[`../SERVER-STANDARD.md`](../SERVER-STANDARD.md). Apply it with these faunapoolen-specific values:

- **Domains:** `faunapoolen.se` and `www.faunapoolen.se`.
- **Local target:** `127.0.0.1:3040`, daemon `com.faunapoolen.server`.
- **Health endpoint:** `http://127.0.0.1:3040/healthz`.
- **Status:** intentional HTTP prelaunch — DNS not cut over, HTTP/ACME route ready, prepared HTTPS
  configuration installed only after certificate issuance.

Add a `public/CNAME` containing `faunapoolen.se` **only if** deploying via GitHub Pages instead of
the local server (omitted by default so a test deploy can't hijack the domain).

Cloudflared is not used for this cutover; the standard path is direct DNS/static IP/router/nginx.

## Cutover runbook (prepared 2026-07-06)

The generic activation procedure is [`../GO-LIVE.md`](../GO-LIVE.md) — this section adds only what
is faunapoolen-specific. The stakes are different here: this domain ranks exceptionally well, so
the goal is that **Google notices nothing except the IP changing**. The current host is GitHub
Pages, and the www DNS record points at a third-party GitHub account
(`benjaminrehmie.github.io`) — assume the old site's content cannot be updated, only pointed at.

### Parity baseline — what the live host does today (probed 2026-07-06)

| Behaviour                        | GitHub Pages today   | Mac mini after cutover         | Action                                                                                                                             |
| -------------------------------- | -------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `https://` apex                  | 200, valid cert      | 200 after certbot              | —                                                                                                                                  |
| `http://`                        | **200, no redirect** | 301 → https                    | Intentional improvement, keep                                                                                                      |
| `https://www`                    | 301 → apex           | **must replicate**             | Check the prepared 443 block does `www → apex 301`. Note: the wargr conf serves www directly (200) — do NOT copy that pattern here |
| `/about` (no slash)              | 301 → `/about/`      | 200, no redirect               | Acceptable — canonicals point to `/about/`; optional nginx tidy later                                                              |
| Unknown path                     | real 404             | real 404                       | —                                                                                                                                  |
| HTML caching                     | `max-age=600`        | `no-cache`                     | Fine (fresher after deploys)                                                                                                       |
| Compression                      | gzip                 | gzip                           | —                                                                                                                                  |
| `access-control-allow-origin: *` | present (GH default) | absent                         | Nothing consumes assets cross-origin — no action                                                                                   |
| HSTS                             | absent               | enable after HTTPS is verified | Do not pin browsers until the new certificate and both names are proven                                                            |

### Pre-flight (on the Mac mini, before touching DNS)

1. Pull this repo, install the locked dependencies, build, run tests, and restart the daemon:

   ```bash
   corepack pnpm install --frozen-lockfile
   corepack pnpm build
   corepack pnpm test:admin
   corepack pnpm e2e
   sudo launchctl kickstart -k system/com.faunapoolen.server
   ```

   Verify `/healthz` and that a blog post's `<head>` carries `article:published_time` (proves the
   2026-07 build is what's serving, not an older dist). Never restart after a pull before the
   dependency install: server-side dependencies may have changed even when the static build passes.

2. Inspect `/opt/homebrew/etc/nginx/servers/faunapoolen.se.conf`: the prepared HTTPS configuration
   has separate blocks for the apex proxy and the `www` → apex 301. `nginx -t` passes.
3. `launchctl print system/com.cortex.cert-renewal` — renewal job loaded; certbot webroot matches
   the ACME location root (`/opt/homebrew/var/www/letsencrypt`).
4. Router still forwards TCP 80/443 (true for the six live domains — just confirm unchanged).
5. At the registrar, confirm the one.com renewal invoice/payment. Registry WHOIS reported an expiry
   date of **2026-08-14** on 2026-07-20; do not cut over without confirming renewal.
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
