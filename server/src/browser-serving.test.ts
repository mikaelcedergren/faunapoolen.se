import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';

import { assertBrowserServingForStartup } from '@mikaelcedergren/cx-framework/server/static-files';
import express from 'express';

import { createFaunapoolenBrowserServing, mountFaunapoolenBrowser } from './browser-serving.js';
import type { FaunapoolenEnvironment } from './environment.js';

const PUBLIC_SECTION_ROUTES = [
  '',
  'admin',
  'about',
  'services',
  'pricing',
  'contact',
  'suppliers',
  'sweden-expert-naturpooler-biopooler-ecopooler-kemikaliefria-pooler-baddammar',
  'campaigns/pond-packages',
  'blog',
] as const;

const PUBLIC_LITERAL_HTML_ROUTES = [
  'nature-pools.html',
  'koi-pond-series.html',
  'swim-series.html',
  'waterfront-series.html',
  'plunge-series.html',
  'pond-packages-landing.html',
  'blog/posts/5-common-problems-installing-a-nature-pool.html',
  'blog/posts/algae-control-and-maintenance-tips.html',
  'blog/posts/build-your-own-nature-pool.html',
  'blog/posts/can-i-use-water-storage-solutions-when-traditional-wells-arent-an-option.html',
  'blog/posts/creating-harmony-intergrating-water-features-with-your-landscape.html',
  'blog/posts/difference-between-normal-pool-and-natural-pool.html',
  'blog/posts/how-faunapoolen-helps-golf-clubs-manage-ponds-lakes-and-streams.html',
  'blog/posts/how-filtering-works-with-nature-pools.html',
  'blog/posts/pool-conversions.html',
  'blog/posts/small-features-for-small-spaces.html',
  'blog/posts/sports-stars-natural-ponds.html',
  'blog/posts/why-you-should-get-a-natural-pool.html',
] as const;

function createEnvironment(root: string, browserDirectory: string): FaunapoolenEnvironment {
  return {
    adminPassword: 'synthetic-password-value',
    adminUsername: 'owner',
    appOrigin: 'http://127.0.0.1:4359',
    browserDirectory: path.join(root, 'dist', 'browser'),
    browserDirectoryOverride: browserDirectory,
    cookieSecure: false,
    dataDirectory: path.join(root, 'data'),
    databasePath: path.join(root, 'data', 'faunapoolen.db'),
    generationEnabled: false,
    host: '127.0.0.1',
    isProduction: false,
    mutationOrigins: ['http://127.0.0.1:4359'],
    nodeEnvironment: 'test',
    operationalRoot: root,
    port: 4359,
    releaseValidation: false,
    sessionSecret: 's'.repeat(48),
    sessionTtlSeconds: 3_600,
  };
}

function writeFixture(browserDirectory: string): void {
  fs.mkdirSync(path.join(browserDirectory, 'about'), { recursive: true });
  fs.mkdirSync(path.join(browserDirectory, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(browserDirectory, 'index.html'), '<p>root-page</p>');
  fs.writeFileSync(path.join(browserDirectory, 'about', 'index.html'), '<p>about-page</p>');
  fs.writeFileSync(path.join(browserDirectory, 'koi-pond-series.html'), '<p>literal-page</p>');
  fs.writeFileSync(path.join(browserDirectory, '404.html'), '<p>not-found-page</p>');
  fs.writeFileSync(path.join(browserDirectory, 'main-abcdef12.js'), 'hashed');
  fs.writeFileSync(path.join(browserDirectory, 'styles.css'), 'ordinary');
  fs.writeFileSync(path.join(browserDirectory, 'cx-build.json'), '{}');
}

function writeCompleteRouteFixture(browserDirectory: string): void {
  writeFixture(browserDirectory);
  for (const locale of ['', 'en'] as const) {
    for (const route of PUBLIC_SECTION_ROUTES) {
      const file = path.join(browserDirectory, locale, route, 'index.html');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `<p>section:${locale || 'sv'}:${route || 'root'}</p>`);
    }
    for (const route of PUBLIC_LITERAL_HTML_ROUTES) {
      const file = path.join(browserDirectory, locale, route);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `<p>literal:${locale || 'sv'}:${route}</p>`);
    }
  }
}

async function start(app: express.Express, t: TestContext): Promise<string> {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  t.after(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${String(address.port)}`;
}

test('SSG sections, literal HTML, three cache tiers, and the real 404 stay exact', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faunapoolen-browser-target-'));
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));
  const browserDirectory = path.join(root, 'browser');
  writeFixture(browserDirectory);
  const app = express();
  const environment = createEnvironment(root, browserDirectory);
  mountFaunapoolenBrowser(app, environment, createFaunapoolenBrowserServing(environment));
  const baseUrl = await start(app, t);

  for (const [pathname, marker] of [
    ['/', 'root-page'],
    ['/about', 'about-page'],
    ['/about/', 'about-page'],
    ['/koi-pond-series.html', 'literal-page'],
  ] as const) {
    const response = await fetch(`${baseUrl}${pathname}`);
    assert.equal(response.status, 200, pathname);
    assert.equal(response.headers.get('cache-control'), 'no-cache', pathname);
    assert.match(await response.text(), new RegExp(marker), pathname);
  }

  const literalWithSlash = await fetch(`${baseUrl}/koi-pond-series.html/`);
  assert.equal(literalWithSlash.status, 404);
  assert.match(await literalWithSlash.text(), /not-found-page/);

  const unknown = await fetch(`${baseUrl}/unknown-page`);
  assert.equal(unknown.status, 404);
  assert.equal(unknown.headers.get('cache-control'), 'no-cache');
  assert.match(await unknown.text(), /not-found-page/);

  const hashed = await fetch(`${baseUrl}/main-abcdef12.js`);
  assert.equal(hashed.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  const ordinary = await fetch(`${baseUrl}/styles.css`);
  assert.equal(ordinary.headers.get('cache-control'), 'public, max-age=3600');
  const build = await fetch(`${baseUrl}/cx-build.json`);
  assert.equal(build.headers.get('cache-control'), 'no-store, no-cache, must-revalidate');

  const missingAsset = await fetch(`${baseUrl}/assets/missing.js`);
  assert.equal(missingAsset.status, 404);
  assert.equal(missingAsset.headers.get('cache-control'), 'no-store');
  assert.equal(await missingAsset.text(), 'Asset not found');
});

test('all 28 Swedish and 28 English public outputs retain their section or literal-file URL', async (t) => {
  assert.equal(PUBLIC_SECTION_ROUTES.length + PUBLIC_LITERAL_HTML_ROUTES.length, 28);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faunapoolen-browser-route-matrix-'));
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));
  const browserDirectory = path.join(root, 'browser');
  writeCompleteRouteFixture(browserDirectory);
  const app = express();
  const environment = createEnvironment(root, browserDirectory);
  mountFaunapoolenBrowser(app, environment, createFaunapoolenBrowserServing(environment));
  const baseUrl = await start(app, t);

  let requests = 0;
  for (const locale of ['', 'en'] as const) {
    const prefix = locale ? `/${locale}` : '';
    for (const route of PUBLIC_SECTION_ROUTES) {
      const pathname = `${prefix}/${route}${route ? '/' : ''}` || '/';
      const response = await fetch(`${baseUrl}${pathname}`);
      assert.equal(response.status, 200, pathname);
      assert.match(await response.text(), new RegExp(`section:${locale || 'sv'}:`), pathname);
      requests += 1;
    }
    for (const route of PUBLIC_LITERAL_HTML_ROUTES) {
      const pathname = `${prefix}/${route}`;
      const response = await fetch(`${baseUrl}${pathname}`);
      assert.equal(response.status, 200, pathname);
      assert.match(await response.text(), new RegExp(`literal:${locale || 'sv'}:`), pathname);
      requests += 1;
    }
  }
  assert.equal(requests, 56);
});

test('browser serving never catches API or non-read methods', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faunapoolen-browser-order-'));
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));
  const browserDirectory = path.join(root, 'browser');
  writeFixture(browserDirectory);
  const app = express();
  const environment = createEnvironment(root, browserDirectory);
  mountFaunapoolenBrowser(app, environment, createFaunapoolenBrowserServing(environment));
  app.use((request, response) => response.status(418).json({ method: request.method }));
  const baseUrl = await start(app, t);

  const api = await fetch(`${baseUrl}/api/admin/config`);
  assert.equal(api.status, 418);
  const post = await fetch(`${baseUrl}/about`, { method: 'POST' });
  assert.equal(post.status, 418);
  assert.deepEqual(await post.json(), { method: 'POST' });
});

test('an explicit browser root without index.html fails closed before application startup', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faunapoolen-browser-missing-index-'));
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));
  const browserDirectory = path.join(root, 'browser');
  fs.mkdirSync(browserDirectory, { recursive: true });
  const app = express();
  const environment = createEnvironment(root, browserDirectory);
  assert.throws(
    () => mountFaunapoolenBrowser(app, environment, createFaunapoolenBrowserServing(environment)),
    /missing .*index\.html/,
  );
});

test('ordinary production startup requires a validated browser snapshot', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'faunapoolen-browser-startup-'));
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));
  const environment: FaunapoolenEnvironment = {
    ...createEnvironment(root, path.join(root, 'unused-browser-override')),
    browserDirectoryOverride: undefined,
    isProduction: true,
    nodeEnvironment: 'production',
  };
  const browserServing = createFaunapoolenBrowserServing(environment);

  assert.throws(
    () =>
      assertBrowserServingForStartup({
        browserServing,
        environment: { NODE_ENV: 'production' },
      }),
    /Browser snapshot is missing/,
  );
});

test('runtime proves browser availability before opening campaign storage or binding HTTP', () => {
  const source = fs.readFileSync(new URL('./runtime.ts', import.meta.url), 'utf8');
  const startup = source.indexOf('export async function startFaunapoolenServer');
  const browserAssertion = source.indexOf('assertBrowserServingForStartup({', startup);
  const persistenceOpen = source.indexOf('createFaunapoolenPersistence({', startup);
  const listener = source.indexOf('await listenHttpApplication(', startup);

  assert.ok(startup >= 0);
  assert.ok(browserAssertion > startup);
  assert.ok(persistenceOpen > browserAssertion);
  assert.ok(listener > persistenceOpen);

  const browserSource = fs.readFileSync(new URL('./browser-serving.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(
    browserSource,
    /Faunapoolen browser release is missing|readActiveBrowserRelease/,
  );
});
