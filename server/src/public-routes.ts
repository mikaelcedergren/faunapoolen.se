/** One URL authority for prerendering, HTTP redirects, browser navigation and the sitemap.
 * Page slugs are English in every locale; existing article addresses remain literal. */
const pagePaths = {
  home: '/',
  'nature-pools': '/nature-pools/',
  pricing: '/nature-pools/pricing/',
  skane: '/nature-pools/skane/',
  halland: '/nature-pools/halland/',
  blekinge: '/nature-pools/blekinge/',
  smaland: '/nature-pools/smaland/',
  gotland: '/projects/gotland/',
  waterscapes: '/waterscapes/',
  guides: '/blog/',
  about: '/about/',
  faq: '/faq/',
  cookies: '/cookies/',
  configure: '/configure/',
} as const;
export type PublicPage = keyof typeof pagePaths;
function localizedPages(prefix: '' | '/en' | '/da'): Record<PublicPage, string> {
  return Object.fromEntries(
    Object.entries(pagePaths).map(([key, path]) => [key, prefix + path]),
  ) as Record<PublicPage, string>;
}
export const PUBLIC_PAGES = {
  sv: localizedPages(''),
  en: localizedPages('/en'),
  da: localizedPages('/da'),
} as const;
export type PublicLanguage = keyof typeof PUBLIC_PAGES;
export const GUIDE_SLUGS = {
  'naturpool-10-vanliga-fragor': 'naturpool-10-vanliga-fragor.html',
  'naturpool-pris': 'naturpool-pris.html',
  'varma-upp-naturpool': 'varma-upp-naturpool.html',
  'din-naturpool-skotsel-efter-installation': 'din-naturpool-skotsel-efter-installation.html',
  'naturpool-i-sodra-sverige': 'naturpool-i-sodra-sverige.html',
  build: 'build-your-own-nature-pool.html',
  difference: 'difference-between-normal-pool-and-natural-pool.html',
  '5-common-problems-installing-a-nature-pool': '5-common-problems-installing-a-nature-pool.html',
  'how-faunapoolen-helps-golf-clubs-manage-ponds-lakes-and-streams':
    'how-faunapoolen-helps-golf-clubs-manage-ponds-lakes-and-streams.html',
  'pool-conversions': 'pool-conversions.html',
  'sports-stars-natural-ponds': 'sports-stars-natural-ponds.html',
  'can-i-use-water-storage-solutions-when-traditional-wells-arent-an-option':
    'can-i-use-water-storage-solutions-when-traditional-wells-arent-an-option.html',
  'creating-harmony-intergrating-water-features-with-your-landscape':
    'creating-harmony-intergrating-water-features-with-your-landscape.html',
  'small-features-for-small-spaces': 'small-features-for-small-spaces.html',
  'algae-control-and-maintenance-tips': 'algae-control-and-maintenance-tips.html',
  'how-filtering-works-with-nature-pools': 'how-filtering-works-with-nature-pools.html',
  'why-you-should-get-a-natural-pool': 'why-you-should-get-a-natural-pool.html',
  'hur-mycket-plats-behover-en-naturpool': 'hur-mycket-plats-behover-en-naturpool.html',
  'skotsel-av-naturpool-under-aret': 'skotsel-av-naturpool-under-aret.html',
  'naturpool-fran-forsta-samtal-till-bad': 'naturpool-fran-forsta-samtal-till-bad.html',
  'naturpool-sakerhet-och-tillstand': 'naturpool-sakerhet-och-tillstand.html',
  'vad-kostar-det-att-aga-en-naturpool': 'vad-kostar-det-att-aga-en-naturpool.html',
} as const;
export const PUBLIC_CANONICAL_PATHS = (['sv', 'en', 'da'] as const).flatMap((locale) => [
  ...Object.values(PUBLIC_PAGES[locale]),
  ...Object.values(GUIDE_SLUGS).map(
    (slug) => `${locale === 'sv' ? '' : '/' + locale}/blog/posts/${slug}`,
  ),
]);
const legacy = {
  about: 'about',
  services: 'waterscapes',
  pricing: 'pricing',
  contact: 'configure',
  projects: 'gotland',
  suppliers: 'about',
  'sweden-expert-naturpooler-biopooler-ecopooler-kemikaliefria-pooler-baddammar': 'nature-pools',
  'nature-pools.html': 'nature-pools',
  'koi-pond-series.html': 'waterscapes',
  'swim-series.html': 'nature-pools',
  'waterfront-series.html': 'waterscapes',
  'plunge-series.html': 'nature-pools',
  'pond-packages-landing.html': 'nature-pools',
  'campaigns/pond-packages': 'nature-pools',
} as const;
const translatedPaths: Partial<Record<PublicLanguage, Partial<Record<PublicPage, string>>>> = {
  sv: {
    'nature-pools': '/naturpooler',
    gotland: '/projekt/gotland',
    waterscapes: '/vattenmiljoer',
    about: '/om',
    faq: '/vanliga-fragor',
    configure: '/konfigurera',
  },
  da: {
    'nature-pools': '/da/naturpooler',
    gotland: '/da/projekter/gotland',
    waterscapes: '/da/vandmiljoer',
    about: '/da/om',
    faq: '/da/spoergsmaal',
    configure: '/da/konfigurer',
  },
};
export const LEGACY_REDIRECTS: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    (['sv', 'en', 'da'] as const).flatMap((locale) => {
      const prefix = locale === 'sv' ? '' : `/${locale}`;
      const inherited = Object.entries(legacy).flatMap(([oldPath, page]) => {
        const from = `${prefix}/${oldPath}`;
        const to = PUBLIC_PAGES[locale][page];
        return from === to.replace(/\/$/, '') ? [] : [[from, to]];
      });
      return [
        ...inherited,
        ...(locale === 'sv' ? [['/projekt', PUBLIC_PAGES.sv.gotland]] : []),
        ...(locale === 'da' ? [['/da/projekter', PUBLIC_PAGES.da.gotland]] : []),
        ...Object.entries(translatedPaths[locale] ?? {}).map(([page, from]) => [
          from,
          PUBLIC_PAGES[locale][page as PublicPage],
        ]),
      ];
    }),
  ),
);
export function legacyRedirect(pathname: string): string | undefined {
  return LEGACY_REDIRECTS[pathname.replace(/\/$/, '')];
}
