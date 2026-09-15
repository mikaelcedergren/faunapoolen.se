const ASSET_ROOT = '/assets/images/faunapoolen';

/** The only visual asset retained from the previous Faunapoolen site. */
export const FAUNAPOOLEN_LOGO = `${ASSET_ROOT}/logo.png`;

/** New editorial imagery made for this website. */
export const FAUNAPOOLEN_IMAGES = {
  hero: `${ASSET_ROOT}/hero-family.webp`,
  architecture: `${ASSET_ROOT}/architecture-threshold.webp`,
  detail: `${ASSET_ROOT}/water-touch.webp`,
  evening: `${ASSET_ROOT}/evening-deck.webp`,
  waterscape: `${ASSET_ROOT}/waterscape-koi.webp`,
} as const;

/** Official supplier artwork; provenance is recorded in docs/IMAGERY.md. */
export const AQUASCAPE_IMAGES = {
  certification: `${ASSET_ROOT}/aquascape-certified.png`,
  recreationalPond: `${ASSET_ROOT}/aquascape-recreational-pond.jpg`,
} as const;
