/**
 * The public site's brand colours, mirrored from the canonical public/assets/styles/styles.css.
 * The stylesheet remains the visual source of truth; this typed copy keeps generated image
 * prompts in the same palette without importing browser styles into the server.
 */
export const BRAND_PALETTE = Object.freeze({
  primary: '#00A1E4',
  secondary: '#00D3C8',
  accent: '#FF9F71',
  contrast: '#001E29',
  white: '#FFFFFF',
} as const);
