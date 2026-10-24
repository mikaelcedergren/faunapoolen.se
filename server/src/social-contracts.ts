/** Shared, browser-safe contract for the private social post editor. */
export const SOCIAL_PLATFORMS = ['facebook', 'linkedin', 'instagram', 'youtube'] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  youtube: 'YouTube',
};
export const SOCIAL_MAX_POSTS = 500;
export const SOCIAL_MAX_MEDIA_BYTES = 100 * 1024 * 1024;
export const SOCIAL_MAX_TOTAL_MEDIA_BYTES = 2 * 1024 * 1024 * 1024;
export const SOCIAL_MAX_TEXT = 20_000;
export type SocialFormat = 'square' | 'portrait' | 'landscape' | 'vertical';
export type SocialVariant = {
  platform: SocialPlatform;
  text: string;
  title: string;
  published: boolean;
  format: SocialFormat;
  fit: 'contain' | 'cover';
  x: number;
  y: number;
  start: number;
  end: number | null;
};
export type SocialMedia = {
  sha256: string;
  kind: 'image' | 'video';
  name: string;
  type: string;
  bytes: number;
  width: number;
  height: number;
  duration: number;
};
export type SocialPostInput = { name: string; text: string; variants: SocialVariant[] };
export type SocialPost = SocialPostInput & {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  media: SocialMedia | null;
};
export type SocialPostSummary = Pick<SocialPost, 'id' | 'name' | 'revision' | 'updatedAt'> & {
  platforms: SocialPlatform[];
  published: SocialPlatform[];
};
export type SocialAdaptation = {
  id: string;
  state: 'pending' | 'complete' | 'failed';
  error: string | null;
  variants: Pick<SocialVariant, 'platform' | 'text' | 'title'>[] | null;
};
export const SOCIAL_DIMENSIONS: Record<SocialFormat, readonly [number, number]> = {
  square: [1080, 1080],
  portrait: [1080, 1350],
  landscape: [1920, 1080],
  vertical: [1080, 1920],
};
// Conservative tool ceilings; source notes distinguish these from platform-wide claims.
export const SOCIAL_TEXT_LIMITS: Record<SocialPlatform, number> = {
  facebook: 20_000,
  linkedin: 3000,
  instagram: 2200,
  youtube: 5000,
};
export function socialTextLength(platform: SocialPlatform, text: string): number {
  return platform === 'youtube' ? new TextEncoder().encode(text).length : text.length;
}
export function socialVariant(
  platform: SocialPlatform,
  text: string,
  name: string,
  video: boolean,
): SocialVariant {
  return {
    platform,
    text,
    title: platform === 'youtube' ? name : '',
    published: false,
    format:
      platform === 'instagram'
        ? video
          ? 'vertical'
          : 'portrait'
        : platform === 'youtube'
          ? 'landscape'
          : 'square',
    fit: 'contain',
    x: 50,
    y: 50,
    start: 0,
    end: null,
  };
}
export function socialIssues(v: SocialVariant, media: SocialMedia | null): string[] {
  const issues: string[] = [];
  const count = socialTextLength(v.platform, v.text),
    limit = SOCIAL_TEXT_LIMITS[v.platform];
  if (!v.text.trim()) issues.push('Add the post text.');
  if (count > limit)
    issues.push(
      `Shorten the text by ${count - limit} ${v.platform === 'youtube' ? 'UTF-8 bytes' : 'characters'}.`,
    );
  if (v.platform === 'youtube') {
    if (!v.title.trim()) issues.push('Add a video title.');
    if (v.title.length > 100) issues.push('Keep the video title within 100 characters.');
    if (/[<>]/.test(v.title + v.text))
      issues.push('Remove < and > from the video title and description.');
    if (media?.kind !== 'video') issues.push('Add a video for YouTube.');
    if (v.format !== 'landscape' && v.format !== 'vertical')
      issues.push('Choose landscape video or a vertical Short.');
    if (v.format === 'vertical' && media && (v.end ?? media.duration) - v.start > 180)
      issues.push('Trim this Short to 3 minutes or less.');
  }
  if (v.platform === 'instagram') {
    if (!media) issues.push('Add an image or video for Instagram.');
    if (media?.kind === 'image' && v.format === 'vertical')
      issues.push('Choose portrait, square or landscape for this image.');
    if (media?.kind === 'video' && (v.end ?? media.duration) - v.start < 3)
      issues.push('Use at least 3 seconds of video.');
    if ((v.text.match(/(^|\s)#[^\s#]+/gu) ?? []).length > 5)
      issues.push('Keep this caption to 5 hashtags or fewer.');
  }
  if (
    media?.kind === 'video' &&
    (v.start >= (v.end ?? media.duration) || (v.end ?? media.duration) > media.duration)
  )
    issues.push('Choose a trim inside the video.');
  return issues;
}
