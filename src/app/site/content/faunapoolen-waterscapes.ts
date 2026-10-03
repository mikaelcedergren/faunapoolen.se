const ROOT = '/assets/images/faunapoolen/editorial';

export const WATERSCAPE_DETAILS = [
  {
    image: `${ROOT}/waterscape-koi-detail.webp`,
    alt: $localize`:@@site.waterscapes.koi.alt:Concept image of koi beneath the surface of a planted garden pond.`,
    detail: $localize`:@@site.waterscapes.koi.detail:A place to sit close to the water makes the fish part of everyday garden life. We consider feeding, seasonal care and access to the equipment as part of the design.`,
    service: 'pond',
  },
  {
    image: `${ROOT}/waterscape-stream.webp`,
    alt: $localize`:@@site.waterscapes.stream.alt:Concept image of a garden stream flowing over low stone waterfalls.`,
    detail: $localize`:@@site.waterscapes.stream.detail:Small changes in height and stone shape change the sound of the water. We work with the garden’s levels and your seating area, from a gentle trickle to a more noticeable cascade.`,
    service: 'stream',
  },
  {
    image: `${ROOT}/waterscape-fountain.webp`,
    alt: $localize`:@@site.waterscapes.fountain.alt:Concept image of three slate-style urn fountains at different heights beside a garden terrace.`,
    detail: $localize`:@@site.waterscapes.fountain.detail:Water spilling over an urn or bowl brings movement to a planted corner. We plan the water supply, circulation and access to the pump, and explain cleaning and winter care.`,
    service: 'unsure',
  },
] as const;
