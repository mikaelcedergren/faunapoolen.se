import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  SOCIAL_DIMENSIONS,
  SOCIAL_MAX_MEDIA_BYTES,
  type SocialMedia,
  type SocialVariant,
} from './social-contracts.js';
import { socialError } from './social-service.js';
const execute = promisify(execFile);
const PROCESS_ENV = { PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin', LANG: 'C' };
// This semaphore bounds temporary CPU/memory only. Posts and media remain owned by SQLite.
let processing = false;
async function withMedia<T>(
  bytes: Buffer,
  callback: (input: string, directory: string) => Promise<T>,
): Promise<T> {
  if (processing) socialError('Another file is being prepared. Try again in a moment.', 429);
  if (!bytes.length || bytes.length > SOCIAL_MAX_MEDIA_BYTES)
    socialError('Choose a file no larger than 100 MB.');
  processing = true;
  let directory: string | undefined;
  try {
    directory = await mkdtemp(join(tmpdir(), 'fauna-social-'));
    const input = join(directory, 'source');
    await writeFile(input, bytes, { mode: 0o600 });
    return await callback(input, directory);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
      socialError(
        'Media processing is unavailable. FFmpeg and FFprobe must be installed on this server.',
        503,
      );
    throw error;
  } finally {
    if (directory) await rm(directory, { recursive: true, force: true });
    processing = false;
  }
}
function mediaType(bytes: Buffer): string {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.subarray(4, 8).toString() === 'ftyp') return 'video/mp4';
  if (bytes.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]))) return 'video/webm';
  socialError('Choose a JPEG, PNG, MP4, MOV or WebM file.');
}
export async function inspectSocialMedia(bytes: Buffer, name: string): Promise<SocialMedia> {
  const type = mediaType(bytes);
  return withMedia(bytes, async (input) => {
    let result;
    try {
      result = await execute(
        'ffprobe',
        [
          '-v',
          'error',
          '-protocol_whitelist',
          'file,pipe',
          '-max_alloc',
          '67108864',
          '-show_entries',
          'stream=codec_type,width,height:format=duration',
          '-of',
          'json',
          input,
        ],
        { env: PROCESS_ENV, timeout: 15000, maxBuffer: 65536 },
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw error;
      socialError('This media could not be read. Choose another file.');
    }
    const info = JSON.parse(result.stdout) as {
      streams?: { codec_type: string; width: number; height: number }[];
      format?: { duration?: string };
    };
    const video = info.streams?.find((s) => s.codec_type === 'video');
    const duration = Number(info.format?.duration ?? 0),
      kind = type.startsWith('image/') ? 'image' : 'video';
    if (
      !video ||
      !Number.isFinite(video.width) ||
      !Number.isFinite(video.height) ||
      video.width < 16 ||
      video.height < 16 ||
      video.width > 8192 ||
      video.height > 8192 ||
      video.width * video.height > 40_000_000
    )
      socialError('Choose media between 16 and 8,192 pixels per side, up to 40 megapixels.');
    if (kind === 'video' && (!Number.isFinite(duration) || duration <= 0 || duration > 600))
      socialError('Choose a video no longer than 10 minutes.');
    return {
      kind,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      name: name.replace(/[\x00-\x1f\/\\]/g, '').slice(0, 200) || 'Media',
      type,
      bytes: bytes.length,
      width: video.width,
      height: video.height,
      duration: kind === 'video' ? duration : 0,
    };
  });
}
export function socialMediaFilter(variant: SocialVariant, image: boolean): string {
  let [width, height] = SOCIAL_DIMENSIONS[variant.format];
  if (image && width > 1080) {
    height = Math.round((height * 1080) / width);
    width = 1080;
  }
  const size = `${width}:${height}`;
  return variant.fit === 'contain'
    ? `scale=${size}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${size}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1`
    : `scale=${size}:force_original_aspect_ratio=increase:force_divisible_by=2,crop=${size}:(iw-ow)*${variant.x / 100}:(ih-oh)*${variant.y / 100},setsar=1`;
}
export async function exportSocialMedia(
  bytes: Buffer,
  metadata: SocialMedia,
  variant: SocialVariant,
): Promise<{ bytes: Buffer; type: string; extension: string }> {
  return withMedia(bytes, async (input, directory) => {
    const isImage = metadata.kind === 'image',
      output = join(directory, isImage ? 'post.jpg' : 'post.mp4');
    const args = [
      '-nostdin',
      '-v',
      'error',
      '-protocol_whitelist',
      'file,pipe',
      '-max_alloc',
      '67108864',
      '-threads',
      '2',
      '-i',
      input,
    ];
    if (!isImage)
      args.push(
        '-ss',
        String(variant.start),
        '-t',
        String((variant.end ?? metadata.duration) - variant.start),
      );
    args.push(
      '-map',
      '0:v:0',
      '-map_metadata',
      '-1',
      '-vf',
      socialMediaFilter(variant, isImage),
      '-filter_threads',
      '2',
    );
    if (isImage) args.push('-frames:v', '1', '-q:v', '3');
    else
      args.push(
        '-map',
        '0:a:0?',
        '-c:v',
        'libx264',
        '-preset',
        'fast',
        '-crf',
        '23',
        '-pix_fmt',
        'yuv420p',
        '-r',
        '30',
        '-threads',
        '2',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        '-fs',
        String(200 * 1024 * 1024),
      );
    args.push(output);
    try {
      await execute('ffmpeg', args, { env: PROCESS_ENV, timeout: 180000, maxBuffer: 65536 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw error;
      socialError('The file could not be prepared. Try a shorter or smaller source file.', 422);
    }
    const size = (await stat(output)).size;
    if (size >= (isImage ? 8 : 200) * 1024 * 1024)
      socialError('The prepared file is too large. Use a smaller image or shorter video.', 422);
    if (!isImage) {
      const probe = await execute(
        'ffprobe',
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', output],
        { env: PROCESS_ENV, timeout: 10000, maxBuffer: 4096 },
      );
      const duration = Number(probe.stdout.trim());
      if (
        !Number.isFinite(duration) ||
        Math.abs(duration - ((variant.end ?? metadata.duration) - variant.start)) > 0.2
      )
        socialError('The full selected video could not be exported. Try a shorter selection.', 422);
    }
    return {
      bytes: await readFile(output),
      type: isImage ? 'image/jpeg' : 'video/mp4',
      extension: isImage ? 'jpg' : 'mp4',
    };
  });
}
