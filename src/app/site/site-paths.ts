import type {
  FaunapoolenGuideId,
  FaunapoolenLocale,
  FaunapoolenPage,
} from './content/faunapoolen-content';

export { PUBLIC_PAGES as SITE_PATHS } from '../../../server/src/public-routes';
import { PUBLIC_PAGES as SITE_PATHS } from '../../../server/src/public-routes';
export const GUIDE_SLUGS = {
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
} as const;
export function sitePath(
  page: FaunapoolenPage,
  locale: FaunapoolenLocale = 'en',
  guide?: FaunapoolenGuideId,
): string {
  return page === 'guide'
    ? (locale === 'sv' ? '' : '/' + locale) + '/blog/posts/' + GUIDE_SLUGS[guide ?? 'build']
    : SITE_PATHS[locale][page];
}
