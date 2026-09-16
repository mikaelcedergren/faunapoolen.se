import { HttpError } from '@mikaelcedergren/cx-framework/server/errors';
import {
  withImmediateTransaction,
  type SqliteRow,
  type SyncSqliteDatabase,
} from '@mikaelcedergren/cx-framework/server/sqlite';
import {
  SOCIAL_PLATFORMS,
  SOCIAL_MAX_POSTS,
  SOCIAL_MAX_TOTAL_MEDIA_BYTES,
  SOCIAL_MAX_TEXT,
  SOCIAL_DIMENSIONS,
  socialIssues,
  type SocialMedia,
  type SocialPost,
  type SocialPostInput,
  type SocialPostSummary,
  type SocialVariant,
} from './social-contracts.js';
export function socialError(message: string, status = 400): never {
  throw new HttpError({ code: 'social_post_error', message, status });
}
export function socialObject(value: unknown, keys: string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join() !== keys.sort().join()
  )
    socialError('The post fields are incomplete or unsupported.');
  return value as Record<string, unknown>;
}
export function socialId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
    socialError('The post reference is invalid.');
  return value;
}
function text(value: unknown, max: number): string {
  if (
    typeof value !== 'string' ||
    value.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  )
    socialError('A post field is invalid or too long.');
  return value;
}
export function parseSocialPost(value: unknown): SocialPostInput {
  const r = socialObject(value, ['name', 'text', 'variants']);
  const name = text(r.name, 200).trim(),
    content = text(r.text, SOCIAL_MAX_TEXT);
  if (!name || !content.trim()) socialError('Add the post content and a name.');
  if (!Array.isArray(r.variants) || !r.variants.length || r.variants.length > 4)
    socialError('Choose at least one platform.');
  const variants = r.variants.map((value): SocialVariant => {
    const v = socialObject(value, [
      'platform',
      'text',
      'title',
      'published',
      'format',
      'fit',
      'x',
      'y',
      'start',
      'end',
    ]);
    if (
      !SOCIAL_PLATFORMS.includes(v.platform as never) ||
      !Object.hasOwn(SOCIAL_DIMENSIONS, String(v.format)) ||
      !['cover', 'contain'].includes(String(v.fit)) ||
      typeof v.published !== 'boolean'
    )
      socialError('A platform choice is invalid.');
    for (const key of ['x', 'y', 'start'])
      if (
        typeof v[key] !== 'number' ||
        !Number.isFinite(v[key]) ||
        v[key] < 0 ||
        v[key] > (key === 'start' ? 600 : 100)
      )
        socialError('The media framing is invalid.');
    if (
      v.end !== null &&
      (typeof v.end !== 'number' ||
        !Number.isFinite(v.end) ||
        v.end <= Number(v.start) ||
        v.end > 600)
    )
      socialError('The video trim is invalid.');
    return {
      ...v,
      text: text(v.text, SOCIAL_MAX_TEXT),
      title: text(v.title, 200),
    } as SocialVariant;
  });
  if (new Set(variants.map((v) => v.platform)).size !== variants.length)
    socialError('Choose each platform once.');
  return { name, text: content, variants };
}
export function socialRevision(value: unknown): number {
  const revision = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 1)
    socialError('The saved post reference is invalid.');
  return revision;
}
function fromRow(row: SqliteRow): SocialPost {
  return {
    ...parseSocialPost(JSON.parse(String(row.record_json))),
    id: String(row.id),
    revision: Number(row.revision),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    media: row.media_json ? (JSON.parse(String(row.media_json)) as SocialMedia) : null,
  };
}
export function createSocialService(database: SyncSqliteDatabase, now = Date.now) {
  function get(id: string): SocialPost {
    const row = database.get(
      'SELECT id,revision,created_at,updated_at,record_json,media_json FROM social_posts WHERE id=?',
      [socialId(id)],
    );
    if (!row) socialError('This post no longer exists.', 404);
    return fromRow(row);
  }
  function checked(id: string, revision: unknown): SocialPost {
    const post = get(id);
    if (post.revision !== socialRevision(revision))
      socialError('This post changed elsewhere. Reopen it before saving.', 409);
    return post;
  }
  return {
    get,
    list(): SocialPostSummary[] {
      return database
        .all(
          'SELECT id,revision,created_at,updated_at,record_json,media_json FROM social_posts ORDER BY updated_at DESC,id LIMIT ?',
          [SOCIAL_MAX_POSTS],
        )
        .map(fromRow)
        .map((p) => ({
          id: p.id,
          name: p.name,
          revision: p.revision,
          updatedAt: p.updatedAt,
          platforms: p.variants.map((v) => v.platform),
          published: p.variants.filter((v) => v.published).map((v) => v.platform),
        }));
    },
    create(id: string, input: unknown): SocialPost {
      socialId(id);
      const record = parseSocialPost(input),
        json = JSON.stringify(record);
      return withImmediateTransaction(database, () => {
        const existing = database.get('SELECT record_json FROM social_posts WHERE id=?', [id]);
        if (existing) {
          if (existing.record_json !== json)
            socialError('This post was already saved. Reopen it to continue.', 409);
          return get(id);
        }
        if (record.variants.some((v) => v.published))
          socialError('Create the post before marking it published.');
        if (Number(database.get('SELECT count(*) AS n FROM social_posts')?.n) >= SOCIAL_MAX_POSTS)
          socialError('The post list is full. Remove an unused post before adding another.', 409);
        const time = new Date(now()).toISOString();
        database.run(
          'INSERT INTO social_posts(id,revision,created_at,updated_at,record_json) VALUES(?,1,?,?,?)',
          [id, time, time, json],
        );
        return get(id);
      });
    },
    update(id: string, revision: unknown, input: unknown): SocialPost {
      const record = parseSocialPost(input);
      return withImmediateTransaction(database, () => {
        const previous = checked(id, revision);
        for (const old of previous.variants.filter((v) => v.published)) {
          const next = record.variants.find((v) => v.platform === old.platform);
          if (!next || (next.published && JSON.stringify(next) !== JSON.stringify(old)))
            socialError('Unmark this version as published before changing it.');
        }
        for (const v of record.variants)
          if (
            v.published &&
            !previous.variants.find((p) => p.platform === v.platform)?.published &&
            socialIssues(v, previous.media).length
          )
            socialError('Resolve the highlighted fields before marking this version published.');
        database.run(
          'UPDATE social_posts SET record_json=?,revision=revision+1,updated_at=? WHERE id=?',
          [JSON.stringify(record), new Date(now()).toISOString(), id],
        );
        return get(id);
      });
    },
    media(id: string): Buffer {
      get(id);
      const data = database.get('SELECT media FROM social_posts WHERE id=?', [id])?.media;
      if (!(data instanceof Uint8Array)) socialError('This post has no media.', 404);
      return Buffer.from(data);
    },
    setMedia(
      id: string,
      revision: unknown,
      data: Buffer | null,
      metadata: SocialMedia | null,
    ): SocialPost {
      return withImmediateTransaction(database, () => {
        const previous = checked(id, revision);
        if (previous.variants.some((v) => v.published))
          socialError('Unmark the published versions before replacing the media.');
        const used = Number(
          database.get('SELECT COALESCE(SUM(length(media)),0) AS n FROM social_posts WHERE id<>?', [
            id,
          ])?.n,
        );
        if (used + (data?.length ?? 0) > SOCIAL_MAX_TOTAL_MEDIA_BYTES)
          socialError('Media storage is full. Remove unused media before uploading more.', 409);
        database.run(
          'UPDATE social_posts SET media=?,media_json=?,revision=revision+1,updated_at=? WHERE id=?',
          [data, metadata ? JSON.stringify(metadata) : null, new Date(now()).toISOString(), id],
        );
        return get(id);
      });
    },
    remove(id: string, revision: unknown): void {
      withImmediateTransaction(database, () => {
        checked(id, revision);
        if (
          database.get('SELECT id FROM social_adaptations WHERE post_id=? AND state=?', [
            id,
            'pending',
          ])
        )
          socialError('Wait for text adaptation to finish before removing this post.', 409);
        if (
          database.get(
            "SELECT e.id FROM social_effects e JOIN social_adaptations a ON a.id=e.run_id WHERE a.post_id=? AND json_extract(e.record_json,'$.state') IN ('creating','ambiguous','submitted','polling')",
            [id],
          )
        )
          socialError('A previous AI request must be resolved before deleting this post.', 409);
        database.run(
          'DELETE FROM social_effects WHERE run_id IN (SELECT id FROM social_adaptations WHERE post_id=?)',
          [id],
        );
        database.run('DELETE FROM social_adaptations WHERE post_id=?', [id]);
        database.run('DELETE FROM social_posts WHERE id=?', [id]);
      });
    },
  };
}
export type SocialService = ReturnType<typeof createSocialService>;
