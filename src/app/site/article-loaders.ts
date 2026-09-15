export const ARTICLE_LOADERS = {
  build: () => import('./articles/build-your-own-nature-pool').then((m) => m.BODY_HTML),
  difference: () =>
    import('./articles/difference-between-normal-pool-and-natural-pool').then((m) => m.BODY_HTML),
  '5-common-problems-installing-a-nature-pool': () =>
    import('./articles/5-common-problems-installing-a-nature-pool').then((m) => m.BODY_HTML),
  'how-faunapoolen-helps-golf-clubs-manage-ponds-lakes-and-streams': () =>
    import('./articles/how-faunapoolen-helps-golf-clubs-manage-ponds-lakes-and-streams').then(
      (m) => m.BODY_HTML,
    ),
  'pool-conversions': () => import('./articles/pool-conversions').then((m) => m.BODY_HTML),
  'sports-stars-natural-ponds': () =>
    import('./articles/sports-stars-natural-ponds').then((m) => m.BODY_HTML),
  'can-i-use-water-storage-solutions-when-traditional-wells-arent-an-option': () =>
    import('./articles/can-i-use-water-storage-solutions-when-traditional-wells-arent-an-option').then(
      (m) => m.BODY_HTML,
    ),
  'creating-harmony-intergrating-water-features-with-your-landscape': () =>
    import('./articles/creating-harmony-intergrating-water-features-with-your-landscape').then(
      (m) => m.BODY_HTML,
    ),
  'small-features-for-small-spaces': () =>
    import('./articles/small-features-for-small-spaces').then((m) => m.BODY_HTML),
  'algae-control-and-maintenance-tips': () =>
    import('./articles/algae-control-and-maintenance-tips').then((m) => m.BODY_HTML),
  'how-filtering-works-with-nature-pools': () =>
    import('./articles/how-filtering-works-with-nature-pools').then((m) => m.BODY_HTML),
  'why-you-should-get-a-natural-pool': () =>
    import('./articles/why-you-should-get-a-natural-pool').then((m) => m.BODY_HTML),
} as const;
