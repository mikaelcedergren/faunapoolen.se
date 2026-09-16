/** Presentation retained on the two protected articles when the linked guides are revised.
 * This owns only their historical recommendation labels, never duplicate article content. */
export const PROTECTED_RECOMMENDATIONS = {
  'why-you-should-get-a-natural-pool': {
    title: $localize`:@@protected.related.why-you-should-get-a-natural-pool.title:Why choose an ecological pool without chlorine?`,
    description: $localize`:@@protected.related.why-you-should-get-a-natural-pool.description:An ecological pool provides swimming without chlorine, low chemical use, natural design, and an environmentally friendly pool that blends into the garden.`,
  },
  '5-common-problems-installing-a-nature-pool': {
    title: $localize`:@@protected.related.5-common-problems-installing-a-nature-pool.title:5 common problems with natural pools and chlorine-free pools`,
    description: $localize`:@@protected.related.5-common-problems-installing-a-nature-pool.description:Avoid common mistakes when planning an ecological pool or chlorine-free pool: balance, placement, sealing, circulation, and the right plants.`,
  },
  'pool-conversions': {
    title: $localize`:@@protected.related.pool-conversions.title:Convert chlorine pool to natural pool or swimming pond`,
    description: $localize`:@@protected.related.pool-conversions.description:See how a traditional pool can be converted into an organic pool, swimming pond, or ecological pool with natural filtration without chlorine.`,
  },
  'creating-harmony-intergrating-water-features-with-your-landscape': {
    title: $localize`:@@protected.related.creating-harmony-intergrating-water-features-with-your-landscape.title:Water landscape in the garden: waterfall, koi pond, and fountain`,
    description: $localize`:@@protected.related.creating-harmony-intergrating-water-features-with-your-landscape.description:How to integrate waterfalls, koi ponds, and fountains into a natural garden design with ecological balance.`,
  },
} as const;
