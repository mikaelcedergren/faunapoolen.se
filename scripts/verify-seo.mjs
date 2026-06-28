#!/usr/bin/env node
// Verification gate: parse the <head> SEO surface of a prerendered page (NEW) and the legacy source
// page (OLD) into normalized maps and diff the VALUES. Attribute order / whitespace are ignored;
// only semantic SEO content must match. Usage: node scripts/verify-seo.mjs <new.html> <old.html>
import { readFileSync } from 'node:fs';

const [newFile, oldFile] = process.argv.slice(2);

function parseAttrs(tag) {
  const a = {};
  for (const m of tag.matchAll(/([a-zA-Z:_-]+)\s*=\s*"([^"]*)"/g)) a[m[1].toLowerCase()] = m[2];
  return a;
}
function tagList(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*?>`, 'gi'))].map((m) => parseAttrs(m[0]));
}
// The legacy auto-translated en JSON-LD has two cosmetic quirks the user chose NOT to replicate
// (we keep the clean/consistent form): a stray trailing slash in a WebPage @id (`.html/#webpage`),
// and a capitalized first word after ' | ' in WebPage name (the visible <title> uses sentence case).
// Normalize only those two, tightly, so any real structured-data difference still fails.
function normLd(ld) {
  for (const node of ld?.['@graph'] ?? []) {
    if (node['@type'] !== 'WebPage') continue;
    if (typeof node['@id'] === 'string')
      node['@id'] = node['@id'].replace(/\.html\/#webpage$/, '.html#webpage');
    // The legacy en JSON-LD name is Title-Cased; we keep it equal to the visible <title> (verified
    // exactly, case-sensitively, elsewhere). So compare the WebPage name case-insensitively — only
    // casing is masked; any word/content difference still fails.
    if (typeof node.name === 'string') node.name = node.name.toLowerCase();
  }
  return ld;
}
function canon(x) {
  if (Array.isArray(x)) return x.map(canon);
  if (x && typeof x === 'object') {
    const o = {};
    for (const k of Object.keys(x).sort()) o[k] = canon(x[k]);
    return o;
  }
  return x;
}
function extract(file) {
  const html = readFileSync(file, 'utf8');
  const end = html.indexOf('</head>');
  const head = end === -1 ? html : html.slice(0, end + 7);
  const metas = tagList(head, 'meta');
  const links = tagList(head, 'link');
  const m = {};
  m.title = (head.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.trim() ?? null;
  m.lang = (html.match(/<html\b[^>]*\slang="([^"]*)"/i) || [])[1] ?? null;
  m.description = metas.find((a) => a.name === 'description')?.content ?? null;
  m.keywords = metas.find((a) => a.name === 'keywords')?.content ?? null;
  m.robots = metas.find((a) => a.name === 'robots')?.content ?? null;
  m.canonical = links.find((a) => a.rel === 'canonical')?.href ?? null;
  m.alternates = {};
  for (const l of links.filter((a) => a.rel === 'alternate' && a.hreflang))
    m.alternates[l.hreflang] = l.href;
  m.og = {};
  for (const a of metas.filter((a) => (a.property || '').startsWith('og:')))
    m.og[a.property] = a.content;
  m.twitter = {};
  for (const a of metas.filter((a) => (a.name || '').startsWith('twitter:')))
    m.twitter[a.name] = a.content;
  const ld = (head.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/i) || [])[1];
  m.jsonld = ld ? canon(normLd(JSON.parse(ld))) : null;
  return m;
}

const a = extract(newFile);
const b = extract(oldFile);
let diffs = 0;
const cmp = (path, x, y) => {
  const sx = JSON.stringify(x);
  const sy = JSON.stringify(y);
  if (sx !== sy) {
    diffs++;
    console.log(`  DIFF ${path}\n    new: ${sx}\n    old: ${sy}`);
  }
};
for (const k of ['title', 'lang', 'description', 'keywords', 'robots', 'canonical', 'alternates']) {
  cmp(k, a[k], b[k]);
}
cmp('og', canon(a.og), canon(b.og));
cmp('twitter', canon(a.twitter), canon(b.twitter));
cmp('jsonld', a.jsonld, b.jsonld);
console.log(diffs === 0 ? `✅ SEO MATCH  ${newFile}` : `❌ ${diffs} diff(s)  ${newFile}`);
process.exit(diffs === 0 ? 0 : 1);
