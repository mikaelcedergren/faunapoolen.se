# Domain and routing — faunapoolen.se

Faunapoolen is live on the Mac mini through the standard static-IP path:

```text
DNS -> 81.170.132.41 -> router TCP 80/443 -> nginx -> 127.0.0.1:3040
```

The root [GO-LIVE.md](../GO-LIVE.md), [SERVER-STANDARD.md](../SERVER-STANDARD.md), and
[SERVER-INVENTORY.md](../SERVER-INVENTORY.md) own shared routing, TLS, release, and operations
policy. This file records only Faunapoolen-specific values.

## Public contract

- canonical origin: `https://faunapoolen.se`
- alternate hostname: `www.faunapoolen.se`, redirected to the apex
- app listener: `127.0.0.1:3040`
- web service: `com.faunapoolen.server`
- worker service: `com.faunapoolen.jobs`
- health: `http://127.0.0.1:3040/healthz`
- active nginx file: `/opt/homebrew/etc/nginx/servers/faunapoolen.se.conf`
- source examples: `ops/faunapoolen.nginx.conf.example` and
  `ops/faunapoolen.nginx.live.conf.example`

HTTP and `www` redirect to the canonical HTTPS apex while preserving the request path. Only the
apex HTTPS block proxies to the app. The ACME webroot remains available on port 80, and the shared
certificate-renewal service owns renewal.

`public/CNAME` is intentionally absent. Do not add GitHub Pages or another public host without an
explicit hosting change.

## Cache and private routes

Public static pages use the shared short nginx micro-cache. Never cache:

- `/healthz`
- `/api/admin`
- authentication responses
- generation status
- campaign mutations

The Express process sets `X-Robots-Tag: noindex, nofollow` on every private admin/API response.
nginx must preserve that header. `public/robots.txt`, private route metadata, and
`PRIVATE_NOINDEX_PATHS` must remain aligned.

## Production roles

The two roles come from one selected immutable server artifact:

- `server/dist/index.js` is the only listener
- `server/dist/worker.js` is listener-free
- `data/faunapoolen.db` is their sole structured authority
- `.env.web` and `.env.worker` are separate mode-`0600` private files
- the worker publishes readiness through its sealed identity-file lease

Validate source definitions with:

```bash
bin/install-server-daemon --check
```

Applying that installer updates definitions only. Service activation and restarts use the shared
narrow administrator after the selected release passes full verification.

## Release verification

After a release, verify the closure required by its class:

- selected and running browser/server identities agree
- local `/healthz` is ready
- both LaunchDaemon roles are running when expected
- worker readiness matches the selected server release
- apex HTTPS returns the selected browser build
- `www` and HTTP redirect to the apex
- a representative Swedish page, English page, protected blog post, sitemap, and real 404 behave
  correctly
- private admin/API responses are uncached and noindexed

Do not use DNS changes as application rollback. Current immutable release selection and protected
data backups are the recovery mechanisms for the current architecture.
