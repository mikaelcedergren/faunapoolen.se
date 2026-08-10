import compression from 'compression';
import express from 'express';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hardenApp, noindexHeader, securityHeaders } from '../../server-ops/lib/site-server.mjs';
import { registerAdminAdBuilderEndpoint } from './admin-ad-builder.mjs';
import { registerAdminAuthEndpoints } from './admin-auth.mjs';
import { loadProjectEnv } from './load-env.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const HOST = '127.0.0.1';
const PORT = 4241;

loadProjectEnv(join(ROOT, '.env'));

const app = express();
hardenApp(app);
app.use(securityHeaders({ frameOptions: 'SAMEORIGIN' }));
// Same never-index guarantee as the release server, so dev and production answer identically.
app.use(noindexHeader(['/admin', '/en/admin', '/admin-auth']));
app.use(compression());
registerAdminAuthEndpoints(app, express);
registerAdminAdBuilderEndpoint(app, express);

app.listen(PORT, HOST, () => {
  console.log(`[faunapoolen.se admin auth] listening on http://${HOST}:${PORT}`);
});
