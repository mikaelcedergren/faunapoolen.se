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

It is intentionally in HTTP prelaunch mode until DNS is moved and a real certificate is issued. The HTTP ACME route is ready, and the prepared HTTPS block should be enabled only after certificate issuance.

## Go-live (do not do until approved)

The domain `faunapoolen.se` currently remains on the existing public host by design. Cutover steps:

1. In GoDaddy, keep the domain on GoDaddy/domaincontrol nameservers unless a deliberate exception is documented.
2. Set `@` to an `A` record pointing at `81.170.132.41`.
3. Set `www` to a `CNAME` pointing at `faunapoolen.se`.
4. Wait until public DNS resolves to this Mac mini.
5. Issue a Let's Encrypt certificate for `faunapoolen.se` and `www.faunapoolen.se` using the shared certbot/nginx setup.
6. Enable the prepared HTTPS nginx block, validate nginx, and reload.
7. Verify local health, public HTTP redirect, public HTTPS, canonical/hreflang/sitemap, legacy `.html` URLs, and 301'd trailing-slash URLs.

Add a `public/CNAME` containing `faunapoolen.se` **only if** deploying via GitHub Pages
   instead of the local server (omitted by default so a test deploy can't hijack the domain).

Cloudflared is not used for this future cutover; the standard path is direct DNS/static IP/router/nginx.
