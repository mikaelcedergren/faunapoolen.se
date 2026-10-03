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
    image: `${ROOT}/waterscape-reflecting.webp`,
    alt: $localize`:@@site.waterscapes.reflecting.alt:Concept image of a still reflecting pond beside a timber terrace.`,
    detail: $localize`:@@site.waterscapes.reflecting.detail:Still water brings the sky and surrounding plants into view. Shape, depth and the finish around the edge can make it a garden focal point or a quiet part of the terrace.`,
    service: 'pond',
  },
] as const;
