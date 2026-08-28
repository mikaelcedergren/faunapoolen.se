import { BRAND_PALETTE } from './brand-palette.js';

export const IMAGE_PROMPT_COUNT = 3;

export type ImageConceptId = 'photograph' | 'composite' | 'detail';

export type ImageConcept = Readonly<{
  id: ImageConceptId;
  label: string;
  aspect: string;
  direction: string;
}>;

export const IMAGE_CONCEPTS: readonly ImageConcept[] = Object.freeze(
  [
    {
      id: 'photograph',
      label: 'Straight photograph',
      aspect: 'Square, 1:1. Keep the subject comfortably inside the middle 70% of the frame.',
      direction:
        'A single unstaged photograph with no graphic elements whatsoever. One person or one clear subject experiencing the outcome the campaign promises. This is the hero image.',
    },
    {
      id: 'composite',
      label: 'Photograph with a graphic element',
      aspect: 'Square, 1:1. Leave one uncluttered area where the graphic element can sit.',
      direction:
        'A photograph with exactly one restrained graphic element composited over it, the way a designer would build it in Photoshop: a flat shape or colour field from the brand palette, sitting cleanly over an otherwise untouched photograph. The graphic must never carry text.',
    },
    {
      id: 'detail',
      label: 'Material detail',
      aspect:
        'Vertical, 9:16. Keep the subject clear of the top 15% and bottom 20%, where interfaces sit.',
      direction:
        'A close, tactile detail — water surface, stone, timber, planting, hands — that carries the same promise without showing the whole scene. No people’s faces, no graphic elements.',
    },
  ].map((concept) => Object.freeze(concept)) as readonly ImageConcept[],
);

export const IMAGE_CONCEPT_IDS: readonly ImageConceptId[] = Object.freeze(
  IMAGE_CONCEPTS.map((concept) => concept.id),
);

export const NO_GRAPHIC = 'none';

const HOUSE_STYLE = `PHOTOGRAPHIC STYLE
Straight photography with natural dynamic range. No HDR tone mapping, no local contrast or clarity enhancement, no halos along edges, no crushed blacks, no blown highlights. Highlights roll off softly and shadows stay open and slightly cool. Neutral white balance, no colour grading LUT, no film emulation, no vignette, no bloom, no lens flare. Shot on a full-frame camera with a 35mm or 50mm prime at f/2.8–f/5.6, ISO 100, on an overcast Nordic day or in soft late-afternoon light. It should look like a competent professional photograph that has been colour-corrected and nothing more.

COLOUR
The scene's own materials should land close to the brand palette, reached through subject and light rather than through any filter or grade. Water reads cyan through blue (${BRAND_PALETTE.secondary} to ${BRAND_PALETTE.primary}). Depth, shadow and wet stone read as a near-black blue (${BRAND_PALETTE.contrast}). Warm accents (${BRAND_PALETTE.accent}) appear only in small doses — skin in warm light, timber decking, a towel, dry grass. White (${BRAND_PALETTE.white}) stays as clean daylight, never as a wash over the image.`;

const NEGATIVES = `MUST NOT CONTAIN
No text, letters, numbers, captions, logos, watermarks or signatures. No collage, split screen, before-and-after panel, diagram, frame or border. No HDR look, no oversaturation, no teal-and-orange grade, no Instagram filter, no artificial bokeh, no plastic skin, no CGI or 3D-render look. No tropical or Mediterranean planting, no turquoise tiled swimming pool, no chlorinated-pool blue. Water, landscape, construction and human anatomy must all be physically believable.`;

export type ImageScene = Readonly<{
  subject: string;
  environment: string;
  light: string;
  composition: string;
  graphic: string;
}>;

function graphicBlock(concept: ImageConcept, graphic: string): string {
  const value = graphic.trim();
  if (concept.id !== 'composite' || !value || value.toLowerCase() === NO_GRAPHIC) {
    return '';
  }
  return `\n\nGRAPHIC ELEMENT
${value}

Build it as a flat, clean overlay in the brand palette — solid colour, no gradient mesh, no drop shadow, no bevel, no texture. The photograph underneath keeps its natural colours and stays completely unfiltered.`;
}

export function composeImagePrompt(concept: ImageConcept, scene: ImageScene): string {
  return `${scene.subject}

SETTING
${scene.environment}

LIGHT
${scene.light}

COMPOSITION
${scene.composition} ${concept.aspect}${graphicBlock(concept, scene.graphic)}

${HOUSE_STYLE}

${NEGATIVES}`;
}

export function imageStylePromptBlock(): string {
  return IMAGE_CONCEPTS.map(
    (concept) => `- ${concept.id} (${concept.label}): ${concept.direction}`,
  ).join('\n');
}
