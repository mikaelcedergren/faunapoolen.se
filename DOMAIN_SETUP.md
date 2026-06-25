# Domain & routing — faunapoolen.se

The site runs as a local always-on Express server on this Mac mini (same pattern as
**bitsize.me** and **blinkdrop**): prerendered SSG output served by `server/index.mjs`,
kept alive by a `launchd` agent, fronted by nginx and a Cloudflare Tunnel for the public
domain.

```
visitor → Cloudflare (DNS + TLS + Tunnel) → nginx (:80) → Express (127.0.0.1:3040) → dist/browser
```

## Local service

- Service definition: [`launchd/com.faunapoolen.server.plist`](launchd/com.faunapoolen.server.plist)
- Listens on `127.0.0.1:3040` (`HOST`/`PORT`), `NODE_ENV=production`.
- Logs: `.run/server.out.log`, `.run/server.err.log`.
- Health check: `http://127.0.0.1:3040/api/health`.

Install / control (LaunchAgent):

```bash
cp launchd/com.faunapoolen.server.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.faunapoolen.server.plist
launchctl kickstart -k gui/$(id -u)/com.faunapoolen.server   # restart after a new build
launchctl bootout gui/$(id -u)/com.faunapoolen.server         # stop
```

Rebuild + restart after content changes:

```bash
pnpm build && launchctl kickstart -k gui/$(id -u)/com.faunapoolen.server
```

## nginx

See [`ops/faunapoolen.nginx.conf.example`](ops/faunapoolen.nginx.conf.example) — a plain
reverse proxy to `127.0.0.1:3040`.

## Go-live (do not do until approved)

The domain `faunapoolen.se` currently points at the legacy site. Cutover steps:

1. Point the Cloudflare Tunnel / DNS at this machine's nginx.
2. Add a `public/CNAME` containing `faunapoolen.se` **only if** deploying via GitHub Pages
   instead of the local server (omitted by default so a test deploy can't hijack the domain).
3. Verify canonical/hreflang/sitemap resolve on the production host and that the legacy
   `.html` URLs + 301'd trailing-slash URLs all respond.
