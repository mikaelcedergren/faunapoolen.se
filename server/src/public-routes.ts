const catalogue = {
  pages: {
    sv: {
      home: '/',
      'nature-pools': '/naturpooler/',
      projects: '/projekt/',
      gotland: '/projekt/gotland/',
      waterscapes: '/vattenmiljoer/',
      guides: '/blog/',
      about: '/om/',
      configure: '/konfigurera/',
    },
    en: {
      home: '/en/',
      'nature-pools': '/en/nature-pools/',
      projects: '/en/projects/',
      gotland: '/en/projects/gotland/',
      waterscapes: '/en/waterscapes/',
      guides: '/en/blog/',
      about: '/en/about/',
      configure: '/en/configure/',
    },
    da: {
      home: '/da/',
      'nature-pools': '/da/naturpooler/',
      projects: '/da/projekter/',
      gotland: '/da/projekter/gotland/',
      waterscapes: '/da/vandmiljoer/',
      guides: '/da/blog/',
      about: '/da/om/',
      configure: '/da/konfigurer/',
    },
  },
  legacy: {
    about: 'about',
    services: 'waterscapes',
    pricing: 'configure',
    contact: 'configure',
    suppliers: 'about',
    'sweden-expert-naturpooler-biopooler-ecopooler-kemikaliefria-pooler-baddammar': 'nature-pools',
    'nature-pools.html': 'nature-pools',
    'koi-pond-series.html': 'waterscapes',
    'swim-series.html': 'nature-pools',
    'waterfront-series.html': 'waterscapes',
    'plunge-series.html': 'nature-pools',
    'pond-packages-landing.html': 'nature-pools',
    'campaigns/pond-packages': 'nature-pools',
  },
} as const;

// Pure product URL data: shared by the browser router and the HTTP serving boundary.
export const PUBLIC_PAGES = catalogue.pages;
export type PublicLanguage = keyof typeof PUBLIC_PAGES;
export type PublicPage = keyof typeof PUBLIC_PAGES.en;
export const LEGACY_REDIRECTS: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    (['sv', 'en', 'da'] as const).flatMap((locale) => {
      const prefix = locale === 'sv' ? '' : `/${locale}`;
      return Object.entries(catalogue.legacy).flatMap(([oldPath, page]) => {
        const from = `${prefix}/${oldPath}`;
        const to = PUBLIC_PAGES[locale][page as PublicPage];
        return from === to.replace(/\/$/, '') ? [] : [[from, to]];
      });
    }),
  ),
);

export function legacyRedirect(pathname: string): string | undefined {
  return LEGACY_REDIRECTS[pathname.replace(/\/$/, '')];
}
