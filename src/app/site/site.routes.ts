import type { Route, Routes } from '@angular/router';
import { FAUNAPOOLEN_COPY, type FaunapoolenPage } from './content/faunapoolen-content';
import { sitePath } from './site-paths';
import { activeLanguage, languageBase } from './language';
import { BLOG_ARTICLES } from './content/blog-catalog';
import { ARTICLE_LOADERS } from './article-loaders';
import type { PageSeo } from '../shared/seo';
const locale = activeLanguage();
const loaders = {
  home: () => import('./pages/home.page').then((m) => m.HomePage),
  'nature-pools': () => import('./pages/nature-pools.page').then((m) => m.NaturePoolsPage),
  projects: () => import('./pages/projects.page').then((m) => m.ProjectsPage),
  gotland: () => import('./pages/gotland.page').then((m) => m.GotlandPage),
  waterscapes: () => import('./pages/waterscapes.page').then((m) => m.WaterscapesPage),
  guides: () => import('./pages/guides.page').then((m) => m.GuidesPage),
  about: () => import('./pages/about.page').then((m) => m.AboutPage),
  configure: () => import('./pages/configure.page').then((m) => m.ConfigurePage),
  guide: () => import('./pages/guide.page').then((m) => m.GuidePage),
};
const titles = {
  home: $localize`:@@seo.home.title:Nature pools for your garden | Faunapoolen`,
  'nature-pools': $localize`:@@seo.nature-pools.title:Nature pools · Faunapoolen`,
  projects: $localize`:@@seo.projects.title:Projects · Faunapoolen`,
  gotland: $localize`:@@seo.gotland.title:Nature pool on Gotland · Faunapoolen`,
  waterscapes: $localize`:@@seo.waterscapes.title:Waterscapes · Faunapoolen`,
  guides: $localize`:@@seo.guides.title:Guides · Faunapoolen`,
  about: $localize`:@@seo.about.title:About · Faunapoolen`,
  configure: $localize`:@@seo.configure.title:Start with your place · Faunapoolen`,
};
const descriptions = {
  home: FAUNAPOOLEN_COPY.home.ingress,
  'nature-pools': FAUNAPOOLEN_COPY.naturePools.ingress,
  projects: FAUNAPOOLEN_COPY.projects.ingress,
  gotland: $localize`:@@seo.gotland.description:Photographs and films of Faunapoolen’s completed nature pool on Gotland.`,
  waterscapes: FAUNAPOOLEN_COPY.waterscapes.ingress,
  guides: FAUNAPOOLEN_COPY.guides.ingress,
  about: FAUNAPOOLEN_COPY.about.ingress,
  configure: FAUNAPOOLEN_COPY.configure.ingress,
};
function pageRoute(page: Exclude<FaunapoolenPage, 'guide'>): Route {
  const path = sitePath(page, locale).slice(languageBase(locale).length).replace(/\/$/, '');
  const seo: PageSeo = {
    path: sitePath(page, 'sv'),
    enPath: sitePath(page, 'en'),
    daPath: sitePath(page, 'da'),
    description: descriptions[page],
    ogImage:
      'https://faunapoolen.se/assets/images/faunapoolen/' +
      (page === 'gotland' ? 'gotland/1528.webp' : 'hero-family.webp'),
  };
  return {
    path,
    pathMatch: 'full',
    title: titles[page],
    loadComponent: loaders[page],
    data: { page, seo, locale },
  };
}
export const siteRoutes: Routes = [
  pageRoute('home'),
  pageRoute('nature-pools'),
  pageRoute('gotland'),
  pageRoute('projects'),
  pageRoute('waterscapes'),
  pageRoute('guides'),
  pageRoute('about'),
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
