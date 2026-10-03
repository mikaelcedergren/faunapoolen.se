const ASSET_ROOT = '/assets/images/faunapoolen';

/** The only visual asset retained from the previous Faunapoolen site. */
export const FAUNAPOOLEN_LOGO = `${ASSET_ROOT}/logo.png`;

/** New editorial imagery made for this website. */
export const FAUNAPOOLEN_IMAGES = {
  hero: `${ASSET_ROOT}/hero-family.webp`,
  naturePoolHero: `${ASSET_ROOT}/editorial/nature-pool-evening.webp`,
  pricing: `${ASSET_ROOT}/editorial/pricing-garden.webp`,
  architecture: `${ASSET_ROOT}/architecture-threshold.webp`,
  poolDesign: `${ASSET_ROOT}/editorial/pool-design-concept.webp`,
  detail: `${ASSET_ROOT}/water-touch.webp`,
  evening: `${ASSET_ROOT}/evening-deck.webp`,
  waterscape: `${ASSET_ROOT}/editorial/waterscapes-evening.webp`,
  waterscapePause: `${ASSET_ROOT}/editorial/waterscape-pause.webp`,
} as const;

/** Supplier imagery and the owner-supplied certification emblem. */
export const AQUASCAPE_IMAGES = {
  certificationEmblem: `${ASSET_ROOT}/aquascape-certified-emblem.png`,
  recreationalPond: `${ASSET_ROOT}/aquascape-recreational-pond.jpg`,
} as const;
