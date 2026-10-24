import type {
  FaunapoolenGuideId,
  FaunapoolenLocale,
  FaunapoolenPage,
} from './content/faunapoolen-content';

export { PUBLIC_PAGES as SITE_PATHS } from '../../../server/src/public-routes';
import { PUBLIC_PAGES as SITE_PATHS } from '../../../server/src/public-routes';
export { GUIDE_SLUGS } from '../../../server/src/public-routes';
import { GUIDE_SLUGS } from '../../../server/src/public-routes';
export function sitePath(
  page: FaunapoolenPage,
  locale: FaunapoolenLocale = 'en',
  guide?: FaunapoolenGuideId,
): string {
  return page === 'guide'
    ? (locale === 'sv' ? '' : '/' + locale) + '/blog/posts/' + GUIDE_SLUGS[guide ?? 'build']
    : SITE_PATHS[locale][page];
}
