import compression from 'compression';
import express from 'express';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Serves the Faunapoolen site as a carbon copy of the CodeKit-generated output (in ./site),
// with no CodeKit needed to run. Same always-on Express pattern as bitsize.me / blinkdrop.
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');
const SITE = join(ROOT, 'site');
const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = Number.parseInt(process.env.PORT ?? '3040', 10);

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(compression());

app.get('/api/health', (_req, res) => {
  res.json({ app: 'faunapoolen.se', ok: true, port: PORT });
});

// Static site: section pages live at `<dir>/index.html` (served for trailing-slash URLs),
// product/blog pages are literal `*.html` files. `extensions: ['html']` also lets an
// extensionless URL resolve to its .html file.
app.use(
  express.static(SITE, {
    extensions: ['html'],
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      } else if (/\.[0-9a-f]{8,}\.[a-z0-9]+$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=3600');
      }
    },
  }),
);

// Real 404 (use the site's own 404 page if it has one).
app.use((_req, res) => {
  res.status(404);
  res.setHeader('Cache-Control', 'no-cache');
  const notFound = join(SITE, '404.html');
  if (existsSync(notFound)) res.sendFile(notFound);
  else res.type('html').send('<!doctype html><meta charset="utf-8"><title>404</title><h1>404 — sidan kunde inte hittas</h1>');
});

app.listen(PORT, HOST, () => {
  console.log(`[faunapoolen] serving ${SITE} on http://${HOST}:${PORT}`);
});
