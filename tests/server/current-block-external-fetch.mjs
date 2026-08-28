const nativeFetch = globalThis.fetch.bind(globalThis);
const loopbackHosts = new Set(['127.0.0.1', '::1', 'localhost']);

globalThis.fetch = async (input, init) => {
  const raw = typeof input === 'string' || input instanceof URL ? String(input) : String(input.url);
  const url = new URL(raw);
  if (!loopbackHosts.has(url.hostname)) {
    throw new Error(`External fetch disabled in Faunapoolen characterization: ${url.origin}`);
  }
  return nativeFetch(input, init);
};
