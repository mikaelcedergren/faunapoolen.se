export const ARTICLE_LOADERS = {
  'naturpool-10-vanliga-fragor': () =>
    import('./articles/naturpool-10-vanliga-fragor').then((m) => m.BODY_HTML),
  'naturpool-pris': () => import('./articles/naturpool-pris').then((m) => m.BODY_HTML),
  'varma-upp-naturpool': () => import('./articles/varma-upp-naturpool').then((m) => m.BODY_HTML),
  'din-naturpool-skotsel-efter-installation': () =>
    import('./articles/din-naturpool-skotsel-efter-installation').then((m) => m.BODY_HTML),
  'naturpool-i-sodra-sverige': () =>
    import('./articles/naturpool-i-sodra-sverige').then((m) => m.BODY_HTML),
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
  'hur-mycket-plats-behover-en-naturpool': () =>
    import('./articles/hur-mycket-plats-behover-en-naturpool').then((m) => m.BODY_HTML),
  'skotsel-av-naturpool-under-aret': () =>
    import('./articles/skotsel-av-naturpool-under-aret').then((m) => m.BODY_HTML),
  'naturpool-fran-forsta-samtal-till-bad': () =>
    import('./articles/naturpool-fran-forsta-samtal-till-bad').then((m) => m.BODY_HTML),
  'naturpool-sakerhet-och-tillstand': () =>
    import('./articles/naturpool-sakerhet-och-tillstand').then((m) => m.BODY_HTML),
  'vad-kostar-det-att-aga-en-naturpool': () =>
    import('./articles/vad-kostar-det-att-aga-en-naturpool').then((m) => m.BODY_HTML),
} as const;
