import type { Routes } from '@angular/router';
import { siteRoutes } from './site/site.routes';
import type { PageSeo } from './shared/seo';
import { LEGACY_REDIRECTS } from '../../server/src/public-routes';
import { activeLanguage, languageBase } from './site/language';

const base = languageBase(activeLanguage());
const notFound = {
  loadComponent: () =>
    import('./pages/not-found/not-found.component').then((m) => m.NotFoundComponent),
  title: '404 | Faunapoolen',
  data: { seo: { path: '/404.html', description: '', noindex: true } satisfies PageSeo },
};

export const routes: Routes = [
  ...['admin', 'admin/enquiries', 'admin/campaigns'].map((path) => ({
    path,
    canDeactivate: [(component: { canLeave(): Promise<boolean> }) => component.canLeave()],
    loadComponent: () => import('./pages/admin/admin.component').then((m) => m.AdminComponent),
    title: 'Admin | Faunapoolen',
    data: { seo: { path: '/admin/', description: '', private: true } satisfies PageSeo },
  })),
  ...siteRoutes,
  ...Object.entries(LEGACY_REDIRECTS)
    .filter(([from]) => (base === '/' ? !/^\/(en|da)\//.test(from) : from.startsWith(base)))
    .map(([from, to]) => ({
      path: from.slice(base.length),
      pathMatch: 'full' as const,
      redirectTo: to.slice(base.length),
    })),
  { path: '404.html', ...notFound },
  { path: '**', ...notFound },
];
