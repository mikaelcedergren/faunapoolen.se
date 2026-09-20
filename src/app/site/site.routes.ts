import type { Route, Routes } from '@angular/router';
import type { FaunapoolenPage } from './content/faunapoolen-content';
import { PAGE_SEO } from './content/page-seo';
import { sitePath } from './site-paths';
import { activeLanguage, languageBase } from './language';
import { BLOG_ARTICLES } from './content/blog-catalog';
import { ARTICLE_LOADERS } from './article-loaders';
import type { PageSeo } from '../shared/seo';
const locale = activeLanguage();
const loaders = {
  home: () => import('./pages/home.page').then((m) => m.HomePage),
  'nature-pools': () => import('./pages/nature-pools.page').then((m) => m.NaturePoolsPage),
  pricing: () => import('./pages/pricing.page').then((m) => m.PricingPage),
  skane: () => import('./pages/region.page').then((m) => m.RegionPage),
  halland: () => import('./pages/region.page').then((m) => m.RegionPage),
  blekinge: () => import('./pages/region.page').then((m) => m.RegionPage),
  smaland: () => import('./pages/region.page').then((m) => m.RegionPage),
  gotland: () => import('./pages/gotland.page').then((m) => m.GotlandPage),
  waterscapes: () => import('./pages/waterscapes.page').then((m) => m.WaterscapesPage),
  guides: () => import('./pages/guides.page').then((m) => m.GuidesPage),
  cookies: () => import('./pages/cookies.page').then((m) => m.CookiesPage),
  faq: () => import('./pages/faq.page').then((m) => m.FaqPage),
  about: () => import('./pages/about.page').then((m) => m.AboutPage),
  configure: () => import('./pages/configure.page').then((m) => m.ConfigurePage),
  guide: () => import('./pages/guide.page').then((m) => m.GuidePage),
};
function pageRoute(page: Exclude<FaunapoolenPage, 'guide'>): Route {
  const path = sitePath(page, locale).slice(languageBase(locale).length).replace(/\/$/, '');
  const seo: PageSeo = {
    path: sitePath(page, 'sv'),
    enPath: sitePath(page, 'en'),
    daPath: sitePath(page, 'da'),
    description: PAGE_SEO[page].description,
    ogImageWidth: page === 'gotland' ? 1920 : 1536,
    ogImageHeight: page === 'gotland' ? 1440 : 1024,
    ogImage:
      'https://faunapoolen.se/assets/images/faunapoolen/' +
      (page === 'gotland' ? 'gotland/1528.webp' : 'hero-family.webp'),
  };
  if (['nature-pools', 'pricing', 'skane', 'halland', 'blekinge', 'smaland'].includes(page)) {
    const names: Record<string, string> = {
      skane: 'Skåne',
      halland: 'Halland',
      blekinge: 'Blekinge',
      smaland: 'Småland',
    };
    seo.graph = [
      {
        '@type': 'Service',
        '@id': 'https://faunapoolen.se' + sitePath(page, locale) + '#service',
        name: PAGE_SEO[page].title.split(' | ')[0],
        url: 'https://faunapoolen.se' + sitePath(page, locale),
        provider: { '@id': 'https://faunapoolen.se/#organization' },
        areaServed: names[page]
          ? [
              {
                '@type': 'Place',
                name: names[page],
                containedInPlace: { '@type': 'Country', name: 'Sweden' },
              },
            ]
          : [
              { '@type': 'Country', name: 'Sweden' },
              { '@type': 'Country', name: 'Denmark' },
            ],
      },
    ];
  }
  return {
    path,
    pathMatch: 'full',
    title: PAGE_SEO[page].title,
    loadComponent: loaders[page],
    data: { page, seo, locale },
  };
}
export const siteRoutes: Routes = [
  pageRoute('home'),
  pageRoute('nature-pools'),
  pageRoute('pricing'),
  pageRoute('skane'),
  pageRoute('halland'),
  pageRoute('blekinge'),
  pageRoute('smaland'),
  pageRoute('gotland'),
  pageRoute('waterscapes'),
  pageRoute('guides'),
  pageRoute('about'),
  pageRoute('faq'),
  pageRoute('cookies'),
  pageRoute('configure'),
  ...BLOG_ARTICLES.map((article) => ({
    path: sitePath('guide', locale, article.id).slice(languageBase(locale).length),
    pathMatch: 'full' as const,
    title: article.seo.title,
    loadComponent: loaders.guide,
    resolve: { bodyHtml: ARTICLE_LOADERS[article.id] },
    data: { page: 'guide', guide: article.id, seo: article.seo, locale },
  })),
];
