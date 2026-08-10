import compression from 'compression';
import express from 'express';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStaticSiteServer } from '../../server-ops/lib/site-server.mjs';
import { registerAdminAdBuilderEndpoint } from './admin-ad-builder.mjs';
import { registerAdminAuthEndpoints } from './admin-auth.mjs';
import { loadProjectEnv } from './load-env.mjs';

// Served entirely by the shared static-site server. The prerendered output (dist/browser) mixes
// section directories (/about/) and literal *.html files (/koi-pond-series.html); the shared
// clean-URL routing serves both. SAMEORIGIN: this marketing site may frame its own pages.
const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
loadProjectEnv(join(ROOT, '.env'));

const app = createStaticSiteServer({
  express,
  compression,
  appName: 'faunapoolen.se',
  browserDir: join(ROOT, 'dist', 'browser'),
  releaseRepoRoot: ROOT,
  browserDirOverride: process.env.SITE_BROWSER_DIR,
  host: process.env.HOST ?? '127.0.0.1',
  port: Number.parseInt(process.env.PORT ?? '3040', 10),
  frameOptions: 'SAMEORIGIN',
  // The campaigns studio and its API are login-gated and must never reach a search index. Three
  // layers say so: robots.txt keeps compliant crawlers off these paths, the prerendered login page
  // carries `noindex, nofollow` and no other indexing signal, and this header repeats it on every
  // response — including the JSON replies, which have no <head> to carry a meta tag.
  noindexPaths: ['/admin', '/en/admin', '/admin-auth'],
});

// The shared static server reserves /api; these POST-only auth routes are deliberately separate
// and are registered on the returned app before it begins handling event-loop work.
registerAdminAuthEndpoints(app, express);
registerAdminAdBuilderEndpoint(app, express);
