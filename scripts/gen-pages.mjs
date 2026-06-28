#!/usr/bin/env node
// Page generator (dev tool, NOT part of the build). For every route, reads the legacy CodeKit pages
// (sv = site/**, en = site/en/**) and regenerates, applying the validated pilot pattern uniformly:
//   - a locale-gated component template:  @if (en) { <en body> } @else { <sv body> }
//   - a standalone component (.ts)
//   - a route entry whose SEO strings are $localize-translated (sv source → custom @@id)
//   - matching en <target>s in src/locale/messages.en.xlf
// Then assembles src/app/app.routes.ts and src/locale/messages.en.xlf. Re-run after editing sources.
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFragment, serialize } from 'parse5';

const ORIGIN = 'https://faunapoolen.se';
const DEFAULT_OG = `${ORIGIN}/assets/images/og-image.jpg`;
const BT = '`';

// Route order: home, sections, products, blog index, blog posts. The '**' not-found is appended last.
const ROUTES = [
  '',
  'about',
  'services',
  'pricing',
  'contact',
  'suppliers',
  'sweden-expert-naturpooler-biopooler-ecopooler-kemikaliefria-pooler-baddammar',
  'nature-pools.html',
  'koi-pond-series.html',
  'swim-series.html',
  'waterfront-series.html',
  'plunge-series.html',
  'pond-packages-landing.html',
  'blog',
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
];

const svPath = (r) =>
  r === '' ? 'site/index.html' : r.endsWith('.html') ? `site/${r}` : `site/${r}/index.html`;
const enPath = (r) =>
  r === ''
    ? 'site/en/index.html'
    : r.endsWith('.html')
      ? `site/en/${r}`
      : `site/en/${r}/index.html`;
const canonical = (r) => (r === '' ? '/' : r.endsWith('.html') ? `/${r}` : `/${r}/`);

function meta(r) {
  if (r === '') return { dir: 'src/app/pages/home', base: 'home' };
  if (r === 'blog') return { dir: 'src/app/pages/blog', base: 'blog-index' };
  if (r.startsWith('blog/posts/')) {
    const slug = r.replace('blog/posts/', '').replace(/\.html$/, '');
    return { dir: 'src/app/pages/blog/posts', base: slug };
  }
  const slug = r.replace(/\.html$/, '');
  return { dir: `src/app/pages/${slug}`, base: slug };
}
function pascal(s) {
  const p = s
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');
  return /^[0-9]/.test(p) ? 'Page' + p : p;
}
const importPath = (r) =>
  './' + meta(r).dir.replace('src/app/', '') + '/' + meta(r).base + '.component';
const idFor = (r) =>
  meta(r)
    .base.replace(/[^a-zA-Z0-9]+/g, '_')
    .toLowerCase();

// --- parsing ---
const parseAttrs = (tag) => {
  const a = {};
  for (const m of tag.matchAll(/([a-zA-Z:_-]+)\s*=\s*"([^"]*)"/g)) a[m[1].toLowerCase()] = m[2];
  return a;
};
const tagsOf = (html, name) =>
  [...html.matchAll(new RegExp(`<${name}\\b[^>]*?>`, 'gi'))].map((m) => parseAttrs(m[0]));
function seoOf(file) {
  const html = readFileSync(file, 'utf8');
  const head = html.slice(0, html.indexOf('</head>') + 7);
  const metas = tagsOf(head, 'meta');
  const mc = (n) => metas.find((a) => a.name === n)?.content;
  const og = (p) => metas.find((a) => a.property === p)?.content;
  return {
    title: (head.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.trim() ?? '',
    keywords: mc('keywords'),
    description: mc('description') ?? '',
    ogTitle: og('og:title'),
    ogDescription: og('og:description'),
    ogImage: og('og:image'),
  };
}
function body(file) {
  const html = readFileSync(file, 'utf8');
  const o = html.indexOf('<main>');
  const n = html.indexOf('<nav class="navigation">', o);
  if (o === -1 || n === -1) throw new Error(`boundaries not found in ${file}`);
  // Normalize through the HTML5 parser (browser-equivalent: balances implied/auto-closed tags,
  // escapes bare '&') so the markup is well-formed for Angular's stricter template parser. Then
  // escape the few characters that are special in Angular templates. DOM is unchanged → no
  // visual/SEO impact.
  const normalized = serialize(parseFragment(html.slice(o + 6, n)));
  return normalized
    .replace(/@/g, '&#64;')
    .replace(/\{\{/g, '&#123;&#123;')
    .replace(/\}\}/g, '&#125;&#125;')
    .trim();
}

const tl = (s) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const loc = (id, sv) => '$localize' + BT + ':@@' + id + ':' + tl(sv) + BT;

// --- generate ---
rmSync('src/app/pages', { recursive: true, force: true });
const routeEntries = [];
const transUnits = [];
let done = 0;

for (const r of ROUTES) {
  const sv = svPath(r);
  const en = enPath(r);
  if (!existsSync(sv)) {
    console.warn('MISSING sv', sv);
    continue;
  }
  if (!existsSync(en)) {
    console.warn('MISSING en', en);
    continue;
  }
  const m = meta(r);
  const id = idFor(r);
  const cls = pascal(m.base) + 'Component';
  const s = seoOf(sv);
  const e = seoOf(en);

  mkdirSync(m.dir, { recursive: true });
  writeFileSync(
    join(m.dir, m.base + '.html'),
    `@if (en) {\n${body(en)}\n} @else {\n${body(sv)}\n}\n`,
  );
  writeFileSync(
    join(m.dir, m.base + '.component.ts'),
    `import { ChangeDetectionStrategy, Component, LOCALE_ID, inject } from '@angular/core';\n\n` +
      `@Component({\n  selector: 'fp-${m.base}',\n  templateUrl: './${m.base}.html',\n` +
      `  styles: [':host { display: contents; }'],\n  changeDetection: ChangeDetectionStrategy.OnPush,\n})\n` +
      `export class ${cls} {\n  protected readonly en = inject(LOCALE_ID).toLowerCase().startsWith('en');\n}\n`,
  );

  const seoLines = [];
  let titleLine = '';
  for (const [field, svv, env] of [
    ['title', s.title, e.title],
    ['keywords', s.keywords, e.keywords],
    ['description', s.description, e.description],
    ['ogTitle', s.ogTitle, e.ogTitle],
    ['ogDescription', s.ogDescription, e.ogDescription],
  ]) {
    if (svv == null || svv === '') continue;
    const mid = id + '.' + field;
    if (field === 'title') titleLine = '    title: ' + loc(mid, svv) + ',';
    else seoLines.push('        ' + field + ': ' + loc(mid, svv) + ',');
    transUnits.push(
      `      <trans-unit id="${mid}" datatype="html">\n        <source>${xml(svv)}</source>\n        <target>${xml(env ?? svv)}</target>\n      </trans-unit>`,
    );
  }
  const ogImg = s.ogImage && s.ogImage !== DEFAULT_OG ? `        ogImage: '${s.ogImage}',\n` : '';

  routeEntries.push(
    `  {\n    path: '${r}',\n    loadComponent: () => import('${importPath(r)}').then((m) => m.${cls}),\n` +
      titleLine +
      `\n    data: {\n      seo: {\n        path: '${canonical(r)}',\n` +
      seoLines.join('\n') +
      `\n${ogImg}      } satisfies PageSeo,\n    },\n  },`,
  );
  done++;
}

// not-found component + route + xlf
mkdirSync('src/app/pages/not-found', { recursive: true });
writeFileSync(
  'src/app/pages/not-found/not-found.component.ts',
  `import { ChangeDetectionStrategy, Component } from '@angular/core';\n\n` +
    `@Component({\n  selector: 'fp-not-found',\n  template: \`\n    <section>\n      <div class="section-content">\n` +
    `        <h1 i18n="@@notfound.h1">Sidan kunde inte hittas</h1>\n` +
    `        <p><a href="/" i18n="@@notfound.home">Till startsidan</a></p>\n` +
    `      </div>\n    </section>\n  \`,\n  styles: [':host { display: contents; }'],\n` +
    `  changeDetection: ChangeDetectionStrategy.OnPush,\n})\nexport class NotFoundComponent {}\n`,
);
routeEntries.push(
  `  {\n    path: '**',\n    loadComponent: () =>\n      import('./pages/not-found/not-found.component').then((m) => m.NotFoundComponent),\n` +
    '    title: ' +
    loc('notfound.title', 'Sidan kunde inte hittas | Faunapoolen') +
    ',\n' +
    `    data: {\n      seo: {\n        path: '/404',\n        description: ` +
    loc('notfound.description', 'Sidan kunde inte hittas.') +
    `,\n        noindex: true,\n      } satisfies PageSeo,\n    },\n  },`,
);
for (const [id, sv, en] of [
  ['notfound.title', 'Sidan kunde inte hittas | Faunapoolen', 'Page not found | Faunapoolen'],
  ['notfound.description', 'Sidan kunde inte hittas.', 'The page could not be found.'],
  ['notfound.h1', 'Sidan kunde inte hittas', 'Page not found'],
  ['notfound.home', 'Till startsidan', 'Back to the homepage'],
])
  transUnits.push(
    `      <trans-unit id="${id}" datatype="html">\n        <source>${xml(sv)}</source>\n        <target>${xml(en)}</target>\n      </trans-unit>`,
  );

writeFileSync(
  'src/app/app.routes.ts',
  `import { Routes } from '@angular/router';\nimport { PageSeo } from './shared/seo';\n\n` +
    `// GENERATED by scripts/gen-pages.mjs from the legacy site/** sources — do not hand-edit.\n` +
    `// SEO strings are translated via @angular/localize (custom $localize ids → src/locale/messages.en.xlf).\n` +
    `// Page body content + chrome are locale-gated by LOCALE_ID in the components/templates.\n` +
    `export const routes: Routes = [\n${routeEntries.join('\n')}\n];\n`,
);
writeFileSync(
  'src/locale/messages.en.xlf',
  `<?xml version="1.0" encoding="UTF-8" ?>\n<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n` +
    `  <file source-language="sv" target-language="en" datatype="plaintext" original="ng2.template">\n    <body>\n` +
    transUnits.join('\n') +
    `\n    </body>\n  </file>\n</xliff>\n`,
);

console.log(`generated ${done} pages + not-found; ${transUnits.length} translation units.`);
