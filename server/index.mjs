import compression from 'compression';
import express from 'express';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStaticSiteServer } from '../../server-ops/lib/site-server.mjs';

// Served entirely by the shared static-site server. The prerendered output (dist/browser) mixes
// section directories (/about/) and literal *.html files (/koi-pond-series.html); the shared
// clean-URL routing serves both. SAMEORIGIN: this marketing site may frame its own pages.
const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
createStaticSiteServer({
  express,
  compression,
  appName: 'faunapoolen.se',
  browserDir: join(ROOT, 'dist', 'browser'),
  host: process.env.HOST ?? '127.0.0.1',
  port: Number.parseInt(process.env.PORT ?? '3040', 10),
  frameOptions: 'SAMEORIGIN',
});
