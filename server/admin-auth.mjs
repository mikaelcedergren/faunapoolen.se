import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'fp_admin_session';
const SESSION_HOURS = 8;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

const sessions = new Map();
const failures = new Map();

export function registerAdminAuthEndpoints(app, express) {
  const json = express.json({ limit: '2kb', strict: true });

  app.post('/admin-auth/session', noStore, (_req, res) => {
    pruneExpiredSessions();
    const token = readCookie(_req, COOKIE_NAME);
    const session = token ? sessions.get(token) : undefined;
    res.json({ authenticated: Boolean(session && session.expiresAt > Date.now()) });
  });

  app.post('/admin-auth/login', noStore, json, (req, res) => {
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;
    if (!username || !password) {
      res.status(503).json({ error: 'Admin login is not configured.' });
      return;
    }

    const client = req.ip || req.socket.remoteAddress || 'unknown';
    if (isRateLimited(client)) {
      res.status(429).json({ error: 'Too many sign-in attempts.' });
      return;
    }

    const suppliedUsername = typeof req.body?.username === 'string' ? req.body.username : '';
    const suppliedPassword = typeof req.body?.password === 'string' ? req.body.password : '';
    const usernameMatches = safeEqual(suppliedUsername, username);
    const passwordMatches = safeEqual(suppliedPassword, password);
    if (
      suppliedUsername.length > 256 ||
      suppliedPassword.length > 256 ||
      !usernameMatches ||
      !passwordMatches
    ) {
      recordFailure(client);
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    failures.delete(client);
    pruneExpiredSessions();
    const token = randomBytes(32).toString('base64url');
    const maxAgeSeconds = sessionMaxAgeSeconds();
    sessions.set(token, { expiresAt: Date.now() + maxAgeSeconds * 1000 });
    res.setHeader('Set-Cookie', sessionCookie(token, maxAgeSeconds));
    res.json({ ok: true });
  });

  app.post('/admin-auth/logout', noStore, (req, res) => {
    const token = readCookie(req, COOKIE_NAME);
    if (token) {
      sessions.delete(token);
    }
    res.setHeader('Set-Cookie', sessionCookie('', 0));
    res.json({ ok: true });
  });
}

export function requireAdminSession(req, res, next) {
  pruneExpiredSessions();
  const token = readCookie(req, COOKIE_NAME);
  const session = token ? sessions.get(token) : undefined;
  if (!token || !session || session.expiresAt <= Date.now()) {
    res.status(401).json({ error: 'Your admin session has expired.' });
    return;
  }

  res.locals.adminSessionKey = token;
  next();
}

function noStore(_req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  next();
}

function safeEqual(actual, expected) {
  const actualHash = createHash('sha256').update(actual).digest();
  const expectedHash = createHash('sha256').update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

function sessionMaxAgeSeconds() {
  const configured = Number.parseFloat(process.env.ADMIN_SESSION_HOURS ?? '');
  const hours = Number.isFinite(configured) && configured > 0 ? configured : SESSION_HOURS;
  return Math.floor(hours * 60 * 60);
}

function sessionCookie(token, maxAgeSeconds) {
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (process.env.ADMIN_COOKIE_SECURE === 'true') {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) {
    return undefined;
  }
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) {
      continue;
    }
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return undefined;
}

function isRateLimited(client) {
  const state = failures.get(client);
  if (!state || state.resetAt <= Date.now()) {
    failures.delete(client);
    return false;
  }
  return state.count >= MAX_FAILURES;
}

function recordFailure(client) {
  const state = failures.get(client);
  if (!state || state.resetAt <= Date.now()) {
    failures.set(client, { count: 1, resetAt: Date.now() + FAILURE_WINDOW_MS });
    return;
  }
  state.count += 1;
}

function pruneExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) {
      sessions.delete(token);
    }
  }
}
