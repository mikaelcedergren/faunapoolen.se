import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'fp_admin_session';
const SESSION_HOURS = 8;
export const MAX_SESSION_HOURS = 24;
export const MAX_ADMIN_SESSIONS = 64;
const SESSION_SWEEP_INTERVAL_MS = 60 * 1000;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;
const FAILURE_SWEEP_INTERVAL_MS = 60 * 1000;
export const MAX_FAILURE_STATES = 10_000;

const sessions = createSessionStore();
sessions.startSweep();
const failureTracker = createFailureTracker();
failureTracker.startSweep();

export function registerAdminAuthEndpoints(app, express) {
  const json = express.json({ limit: '2kb', strict: true });

  app.post('/admin-auth/session', noStore, (_req, res) => {
    const token = readCookie(_req, COOKIE_NAME);
    const session = token ? sessions.get(token) : undefined;
    res.json({ authenticated: Boolean(session) });
  });

  app.post('/admin-auth/login', noStore, json, (req, res) => {
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;
    if (!username || !password) {
      res.status(503).json({ error: 'Admin login is not configured.' });
      return;
    }

    const client = req.ip || req.socket.remoteAddress || 'unknown';
    if (failureTracker.isRateLimited(client)) {
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
      failureTracker.record(client);
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    failureTracker.clear(client);
    const token = randomBytes(32).toString('base64url');
    const maxAgeSeconds = sessionMaxAgeSeconds();
    sessions.add(token, maxAgeSeconds);
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
  const token = readCookie(req, COOKIE_NAME);
  const session = token ? sessions.get(token) : undefined;
  if (!token || !session) {
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

export function sessionMaxAgeSeconds(value = process.env.ADMIN_SESSION_HOURS) {
  const configured = Number.parseFloat(value ?? '');
  const hours =
    Number.isFinite(configured) && configured > 0
      ? Math.min(configured, MAX_SESSION_HOURS)
      : SESSION_HOURS;
  return Math.max(1, Math.floor(hours * 60 * 60));
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

export function createFailureTracker({
  windowMs = FAILURE_WINDOW_MS,
  maxFailures = MAX_FAILURES,
  maxClients = MAX_FAILURE_STATES,
  sweepIntervalMs = FAILURE_SWEEP_INTERVAL_MS,
  now = Date.now,
} = {}) {
  for (const [name, value] of Object.entries({
    windowMs,
    maxFailures,
    maxClients,
    sweepIntervalMs,
  })) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new TypeError(`${name} must be a positive integer.`);
    }
  }

  const states = new Map();
  let nextSweepAt = 0;
  let sweepTimer;

  function sweep(currentTime = now(), force = false) {
    if (!force && currentTime < nextSweepAt) return 0;
    let removed = 0;
    for (const [client, state] of states) {
      if (state.resetAt <= currentTime) {
        states.delete(client);
        removed += 1;
      }
    }
    nextSweepAt = currentTime + sweepIntervalMs;
    return removed;
  }

  function stateFor(client, currentTime) {
    const state = states.get(client);
    if (state && state.resetAt <= currentTime) {
      states.delete(client);
      return undefined;
    }
    return state;
  }

  function hasCapacity(currentTime) {
    if (states.size < maxClients) return true;
    sweep(currentTime);
    return states.size < maxClients;
  }

  function isRateLimited(client) {
    const currentTime = now();
    sweep(currentTime);
    const state = stateFor(client, currentTime);
    if (state) return state.count >= maxFailures;
    // Fail closed once all live slots are occupied. Evicting a live entry would let a rotating
    // attacker erase another client's failure history.
    return !hasCapacity(currentTime);
  }

  function record(client) {
    const currentTime = now();
    sweep(currentTime);
    const state = stateFor(client, currentTime);
    if (state) {
      state.count += 1;
      return true;
    }
    if (!hasCapacity(currentTime)) return false;
    states.set(client, { count: 1, resetAt: currentTime + windowMs });
    return true;
  }

  function startSweep() {
    if (sweepTimer) return;
    sweepTimer = setInterval(() => sweep(now(), true), sweepIntervalMs);
    sweepTimer.unref();
  }

  function stopSweep() {
    if (!sweepTimer) return;
    clearInterval(sweepTimer);
    sweepTimer = undefined;
  }

  return {
    isRateLimited,
    record,
    clear: (client) => states.delete(client),
    sweep: (force = true) => sweep(now(), force),
    size: () => states.size,
    startSweep,
    stopSweep,
  };
}

export function createSessionStore({
  maxSessions = MAX_ADMIN_SESSIONS,
  sweepIntervalMs = SESSION_SWEEP_INTERVAL_MS,
  now = Date.now,
} = {}) {
  for (const [name, value] of Object.entries({ maxSessions, sweepIntervalMs })) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new TypeError(`${name} must be a positive integer.`);
    }
  }

  const states = new Map();
  let sweepTimer;

  function sweep(currentTime = now()) {
    let removed = 0;
    for (const [token, session] of states) {
      if (session.expiresAt <= currentTime) {
        states.delete(token);
        removed += 1;
      }
    }
    return removed;
  }

  function add(token, maxAgeSeconds) {
    const currentTime = now();
    sweep(currentTime);
    let evicted = false;
    if (!states.has(token) && states.size >= maxSessions) {
      const oldestToken = states.keys().next().value;
      if (oldestToken !== undefined) {
        states.delete(oldestToken);
        evicted = true;
      }
    }
    states.set(token, { expiresAt: currentTime + maxAgeSeconds * 1000 });
    return { evicted };
  }

  function get(token) {
    const currentTime = now();
    sweep(currentTime);
    return states.get(token);
  }

  function startSweep() {
    if (sweepTimer) return;
    sweepTimer = setInterval(() => sweep(now()), sweepIntervalMs);
    sweepTimer.unref();
  }

  function stopSweep() {
    if (!sweepTimer) return;
    clearInterval(sweepTimer);
    sweepTimer = undefined;
  }

  return {
    add,
    get,
    delete: (token) => states.delete(token),
    sweep,
    size: () => states.size,
    startSweep,
    stopSweep,
  };
}
