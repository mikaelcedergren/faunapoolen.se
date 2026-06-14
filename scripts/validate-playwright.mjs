#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const LIVE_ROOT = process.env.LIVE_ROOT || 'https://faunapoolen.se';
const LOCAL_ROOT = process.env.LOCAL_ROOT || 'http://127.0.0.1:4010/faunapoolen.se';
const START_SERVER = process.env.PLAYWRIGHT_NO_SERVER !== '1';
const HEADLESS = process.env.HEADED !== '1';
const PRIORITY_PATHS = [
  '/',
  '/blog/posts/difference-between-normal-pool-and-natural-pool.html',
  '/blog/posts/build-your-own-nature-pool.html'
];

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch (error) {
  console.error('Playwright is not installed. Run `npm install` and `npx playwright install chromium`, then try again.');
  process.exit(1);
}

if (typeof fetch !== 'function') {
  console.error('This script needs Node 18 or newer.');
  process.exit(1);
}

function joinUrl(root, pathname) {
  const cleanRoot = root.replace(/\/$/, '');
  if (pathname === '/') return `${cleanRoot}/`;
  return `${cleanRoot}${pathname}`;
}

function normalizeText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

async function readUrlMap() {
  const mapPath = path.join(ROOT, 'migration-audit', 'url-map.json');
  const raw = await fs.readFile(mapPath, 'utf8');
  return JSON.parse(raw);
}

async function checkHttp(url) {
  try {
    const response = await fetch(url, { redirect: 'follow' });
    return { ok: response.ok, status: response.status, finalUrl: response.url };
  } catch (error) {
    return { ok: false, status: 0, finalUrl: url, error: error.message };
  }
}

async function waitForLocalServer(url, timeoutMs = 45000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await checkHttp(url);
    if (result.ok) return true;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  return false;
}

async function startJekyllIfNeeded() {
  const alreadyRunning = await checkHttp(joinUrl(LOCAL_ROOT, '/'));
  if (alreadyRunning.ok) return null;

  if (!START_SERVER) {
    throw new Error(`Local site is not reachable at ${LOCAL_ROOT}. Start Jekyll or unset PLAYWRIGHT_NO_SERVER.`);
  }

  const port = new URL(LOCAL_ROOT).port || '4010';
  const child = spawn(
    'bundle',
    ['exec', 'jekyll', 'serve', '--host', '127.0.0.1', '--port', port, '--trace'],
    {
      cwd: ROOT,
      env: { ...process.env, HOME: process.env.HOME || '/private/tmp' },
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );

  child.stdout.on('data', (chunk) => process.stdout.write(`[jekyll] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[jekyll] ${chunk}`));

  const ready = await waitForLocalServer(joinUrl(LOCAL_ROOT, '/'));
  if (!ready) {
    child.kill('SIGINT');
    throw new Error(`Jekyll did not become reachable at ${LOCAL_ROOT}.`);
  }

  return child;
}

async function inspectPage(browser, url, options = {}) {
  const context = await browser.newContext({
    locale: options.locale || 'sv-SE',
    viewport: options.viewport || { width: 1440, height: 1100 }
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    failedRequests.push({
      url: request.url(),
      method: request.method(),
      error: request.failure()?.errorText || ''
    });
  });
  page.on('response', (response) => {
    const status = response.status();
    if (status >= 400) badResponses.push({ url: response.url(), status });
  });

  let response = null;
  let navigationError = null;
  try {
    response = await page.goto(url, { waitUntil: 'load', timeout: 20000 });
  } catch (error) {
    navigationError = error.message;
  }

  let data = null;
  if (!navigationError) {
    data = await page.evaluate(() => {
      const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || '';
      const prop = (property) => document.querySelector(`meta[property="${property}"]`)?.getAttribute('content') || '';
      const canonical = document.querySelector('link[rel="canonical"]')?.href || '';
      const alternates = [...document.querySelectorAll('link[rel="alternate"]')].map((node) => ({
        hreflang: node.getAttribute('hreflang'),
        href: node.href
      }));
      const brokenImages = [...document.images]
        .filter((image) => !image.complete || image.naturalWidth === 0)
        .map((image) => image.currentSrc || image.src || image.getAttribute('src') || '');
      const languageSwitch = document.querySelector('[data-lang-switch]');
      const bodyText = document.body ? document.body.innerText : '';
      const html = document.documentElement;
      const body = document.body;

      return {
        finalUrl: location.href,
        title: document.title,
        description: meta('description'),
        robots: meta('robots'),
        ogTitle: prop('og:title'),
        ogImage: prop('og:image'),
        canonical,
        alternates,
        htmlLang: html.lang || '',
        h1: [...document.querySelectorAll('h1')].map((node) => node.textContent.trim()).filter(Boolean),
        h2: [...document.querySelectorAll('h2')].map((node) => node.textContent.trim()).filter(Boolean),
        brokenImages,
        imageCount: document.images.length,
        languageSwitch: languageSwitch
          ? {
              text: languageSwitch.textContent.trim(),
              href: languageSwitch.href,
              lang: languageSwitch.getAttribute('data-lang-switch')
            }
          : null,
        bodyTextLength: bodyText.replace(/\s+/g, ' ').trim().length,
        scrollWidth: html.scrollWidth,
        clientWidth: html.clientWidth,
        rootOverflowX: getComputedStyle(html).overflowX,
        bodyOverflowX: body ? getComputedStyle(body).overflowX : ''
      };
    });
  }

  if (options.screenshotPath && data) {
    await fs.mkdir(path.dirname(options.screenshotPath), { recursive: true });
    await page.screenshot({ path: options.screenshotPath, fullPage: true });
  }

  await context.close();
  return {
    url,
    status: response ? response.status() : null,
    ok: response ? response.ok() : false,
    navigationError,
    consoleErrors,
    pageErrors,
    failedRequests,
    badResponses,
    data
  };
}

function localOnly(result) {
  const origin = new URL(LOCAL_ROOT).origin;
  return {
    failedRequests: result.failedRequests.filter((item) => item.url.startsWith(origin)),
    badResponses: result.badResponses.filter((item) => item.url.startsWith(origin))
  };
}

function priorityIssues(pathname, live, local) {
  const issues = [];
  if (!live.ok) issues.push(`live status ${live.status}`);
  if (!local.ok) issues.push(`local status ${local.status}`);
  if (live.navigationError) issues.push(`live navigation: ${live.navigationError}`);
  if (local.navigationError) issues.push(`local navigation: ${local.navigationError}`);
  if (!live.data || !local.data) return issues;

  if (normalizeText(live.data.title) !== normalizeText(local.data.title)) issues.push('title differs');
  if (normalizeText(live.data.description) !== normalizeText(local.data.description)) issues.push('meta description differs');
  if (normalizeText(live.data.h1[0]) !== normalizeText(local.data.h1[0])) issues.push('H1 differs');

  const liveH2 = live.data.h2.map(normalizeText);
  const localH2 = local.data.h2.map(normalizeText);
  if (JSON.stringify(liveH2) !== JSON.stringify(localH2)) issues.push(`H2 sequence differs: live ${liveH2.length}, local ${localH2.length}`);

  const expectedCanonical = pathname === '/' ? `${LIVE_ROOT}/` : `${LIVE_ROOT}${pathname}`;
  if (local.data.canonical !== expectedCanonical) issues.push(`canonical is ${local.data.canonical}, expected ${expectedCanonical}`);
  if (!local.data.robots.toLowerCase().includes('noindex')) issues.push('local staging page is missing noindex');
  if (!local.data.languageSwitch) issues.push('language switch missing');
  if (local.data.brokenImages.length) issues.push(`broken local images: ${local.data.brokenImages.length}`);
  if (local.pageErrors.length) issues.push(`local page errors: ${local.pageErrors.length}`);

  return issues;
}

function localPageIssues(pathname, result) {
  const issues = [];
  const local = localOnly(result);
  if (!result.ok) issues.push(`status ${result.status}`);
  if (result.navigationError) issues.push(result.navigationError);
  if (!result.data?.h1?.length) issues.push('missing H1');
  if (result.data?.brokenImages?.length) issues.push(`broken images: ${result.data.brokenImages.length}`);
  if (result.pageErrors.length) issues.push(`page errors: ${result.pageErrors.length}`);
  if (local.failedRequests.length) issues.push(`failed local requests: ${local.failedRequests.length}`);
  if (local.badResponses.length) issues.push(`bad local responses: ${local.badResponses.length}`);
  if (result.data && !result.data.robots.toLowerCase().includes('noindex')) issues.push('missing staging noindex');
  if (result.data && !result.data.canonical.startsWith(LIVE_ROOT)) issues.push(`canonical not production URL: ${result.data.canonical}`);
  if (
    result.data &&
    result.data.scrollWidth > result.data.clientWidth + 8 &&
    result.data.rootOverflowX !== 'hidden' &&
    result.data.bodyOverflowX !== 'hidden'
  ) {
    issues.push(`horizontal overflow: ${result.data.scrollWidth} > ${result.data.clientWidth}`);
  }
  return issues;
}

async function main() {
  const reportDir = path.join(ROOT, 'migration-audit');
  const screenshotDir = path.join(reportDir, 'playwright-screenshots');
  await fs.mkdir(reportDir, { recursive: true });
  await fs.mkdir(screenshotDir, { recursive: true });

  const urlMap = await readUrlMap();
  const localPaths = [...new Set(urlMap.flatMap((entry) => [entry.new_path, entry.english_path]).filter(Boolean))];

  let server = null;
  const report = {
    generatedAt: new Date().toISOString(),
    liveRoot: LIVE_ROOT,
    localRoot: LOCAL_ROOT,
    headless: HEADLESS,
    priority: [],
    localPages: [],
    language: {},
    admin: {},
    screenshots: screenshotDir,
    summary: {},
    failures: []
  };

  try {
    server = await startJekyllIfNeeded();
    const browser = await chromium.launch({ headless: HEADLESS });

    console.log(`Checking ${PRIORITY_PATHS.length} priority pages against live site...`);
    for (const pathname of PRIORITY_PATHS) {
      console.log(`  priority ${pathname}`);
      const live = await inspectPage(browser, joinUrl(LIVE_ROOT, pathname));
      const safeName = pathname === '/' ? 'home' : pathname.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/-$/, '');
      const local = await inspectPage(browser, joinUrl(LOCAL_ROOT, pathname), {
        screenshotPath: path.join(screenshotDir, `${safeName}-desktop.png`)
      });
      const issues = priorityIssues(pathname, live, local);
      report.priority.push({
        path: pathname,
        issues,
        live: {
          status: live.status,
          title: live.data?.title,
          description: live.data?.description,
          h1: live.data?.h1,
          h2: live.data?.h2,
          bodyTextLength: live.data?.bodyTextLength
        },
        local: {
          status: local.status,
          title: local.data?.title,
          description: local.data?.description,
          h1: local.data?.h1,
          h2: local.data?.h2,
          canonical: local.data?.canonical,
          robots: local.data?.robots,
          alternates: local.data?.alternates,
          languageSwitch: local.data?.languageSwitch,
          imageCount: local.data?.imageCount,
          brokenImages: local.data?.brokenImages,
          bodyTextLength: local.data?.bodyTextLength,
          pageErrors: local.pageErrors,
          localRequests: localOnly(local)
        }
      });
      if (issues.length) report.failures.push({ type: 'priority', path: pathname, issues });
    }

    console.log(`Checking ${localPaths.length} local mapped pages...`);
    let localIndex = 0;
    for (const pathname of localPaths) {
      localIndex += 1;
      console.log(`  local ${localIndex}/${localPaths.length} ${pathname}`);
      const result = await inspectPage(browser, joinUrl(LOCAL_ROOT, pathname));
      const issues = localPageIssues(pathname, result);
      report.localPages.push({
        path: pathname,
        status: result.status,
        finalUrl: result.data?.finalUrl,
        title: result.data?.title,
        h1: result.data?.h1,
        htmlLang: result.data?.htmlLang,
        canonical: result.data?.canonical,
        robots: result.data?.robots,
        imageCount: result.data?.imageCount,
        brokenImages: result.data?.brokenImages,
        languageSwitch: result.data?.languageSwitch,
        bodyTextLength: result.data?.bodyTextLength,
        pageErrors: result.pageErrors,
        localRequests: localOnly(result),
        issues
      });
      if (issues.length) report.failures.push({ type: 'local-page', path: pathname, issues });
    }

    console.log('Checking homepage language routing...');
    const englishContext = await browser.newContext({ locale: 'en-US', viewport: { width: 1440, height: 1100 } });
    const englishPage = await englishContext.newPage();
    await englishPage.goto(joinUrl(LOCAL_ROOT, '/'), { waitUntil: 'domcontentloaded', timeout: 30000 });
    await englishPage.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
    report.language.englishVisitorFinalUrl = englishPage.url();
    report.language.englishRedirectPassed = englishPage.url().endsWith('/faunapoolen.se/en/');
    await englishContext.close();
    if (!report.language.englishRedirectPassed) {
      report.failures.push({
        type: 'language',
        path: '/',
        issues: [`English visitor expected /faunapoolen.se/en/, got ${report.language.englishVisitorFinalUrl}`]
      });
    }

    const swedishContext = await browser.newContext({ locale: 'sv-SE', viewport: { width: 1440, height: 1100 } });
    const swedishPage = await swedishContext.newPage();
    await swedishPage.goto(joinUrl(LOCAL_ROOT, '/'), { waitUntil: 'domcontentloaded', timeout: 30000 });
    await swedishPage.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
    report.language.swedishVisitorFinalUrl = swedishPage.url();
    report.language.swedishDefaultPassed = swedishPage.url().endsWith('/faunapoolen.se/');
    await swedishContext.close();
    if (!report.language.swedishDefaultPassed) {
      report.failures.push({
        type: 'language',
        path: '/',
        issues: [`Swedish visitor expected /faunapoolen.se/, got ${report.language.swedishVisitorFinalUrl}`]
      });
    }

    console.log('Checking admin page...');
    const admin = await inspectPage(browser, joinUrl(LOCAL_ROOT, '/admin/'));
    const adminConfig = await checkHttp(joinUrl(LOCAL_ROOT, '/admin/config.yml'));
    report.admin = {
      indexStatus: admin.status,
      configStatus: adminConfig.status,
      title: admin.data?.title,
      bodyTextLength: admin.data?.bodyTextLength,
      pageErrors: admin.pageErrors,
      localRequests: localOnly(admin)
    };
    if (!admin.ok || !adminConfig.ok || admin.pageErrors.length || localOnly(admin).badResponses.length) {
      report.failures.push({ type: 'admin', path: '/admin/', issues: ['admin page/config did not validate cleanly'] });
    }

    await browser.close();
  } finally {
    if (server) server.kill('SIGINT');
  }

  report.summary = {
    priorityChecked: report.priority.length,
    priorityWithIssues: report.priority.filter((item) => item.issues.length).length,
    localPagesChecked: report.localPages.length,
    localPagesWithIssues: report.localPages.filter((item) => item.issues.length).length,
    missingImages: report.localPages.reduce((sum, item) => sum + (item.brokenImages?.length || 0), 0),
    totalFailures: report.failures.length
  };

  const reportPath = path.join(reportDir, 'playwright-validation-report.json');
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`Report: ${reportPath}`);
  console.log(`Screenshots: ${screenshotDir}`);

  if (report.failures.length) {
    console.log('Failures:');
    for (const failure of report.failures.slice(0, 50)) {
      console.log(`- ${failure.type} ${failure.path}: ${failure.issues.join('; ')}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
