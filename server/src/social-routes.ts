import express, { type Express } from 'express';
import type { SocialAi } from './social-ai.js';
import {
  SOCIAL_MAX_MEDIA_BYTES,
  SOCIAL_PLATFORMS,
  socialIssues,
  type SocialPlatform,
} from './social-contracts.js';
import { exportSocialMedia, inspectSocialMedia } from './social-media.js';
import { socialError, socialObject, socialRevision, type SocialService } from './social-service.js';
/** Mounted after authentication/origin middleware, before the private API fallback. */
export function mountSocialRoutes(
  app: Express,
  posts: SocialService,
  ai: SocialAi,
  aiEnabled: boolean,
): void {
  const base = '/api/admin/social-posts';
  app.use(base, express.json({ limit: '512kb', strict: true }));
  app.get(base, (_req, res) => res.json({ posts: posts.list(), aiEnabled }));
  app.post(base, (req, res) => {
    const r = socialObject(req.body, ['id', 'post']);
    res.status(201).json({ post: posts.create(String(r.id), r.post) });
  });
  app.get(base + '/:id', (req, res) =>
    res.json({
      post: posts.get(String(req.params.id)),
      adaptation: ai.latest(String(req.params.id)),
    }),
  );
  app.patch(base + '/:id', (req, res) => {
    const r = socialObject(req.body, ['expectedRevision', 'post']);
    res.json({ post: posts.update(String(req.params.id), r.expectedRevision, r.post) });
  });
  app.delete(base + '/:id', (req, res) => {
    posts.remove(String(req.params.id), req.headers['if-match']);
    res.json({ ok: true });
  });
  app.post(base + '/:id/adapt', (req, res) => {
    const r = socialObject(req.body, ['expectedRevision']);
    res.status(202).json({ adaptation: ai.admit(String(req.params.id), r.expectedRevision) });
  });
  app.get('/api/admin/social-adaptations/:id', (req, res) =>
    res.json({ adaptation: ai.status(String(req.params.id)) }),
  );
  app.put(
    base + '/:id/media',
    express.raw({ type: 'application/octet-stream', limit: SOCIAL_MAX_MEDIA_BYTES }),
    async (req, res) => {
      const id = String(req.params.id),
        revision = socialRevision(req.headers['if-match']);
      if (posts.get(id).revision !== revision)
        socialError('The post changed. Reopen it before uploading.', 409);
      if (!Buffer.isBuffer(req.body)) socialError('Choose a media file.');
      let name = 'Media';
      try {
        if (typeof req.headers['x-file-name'] === 'string')
          name = decodeURIComponent(req.headers['x-file-name']);
      } catch {
        socialError('The file name is invalid. Rename it and try again.');
      }
      const metadata = await inspectSocialMedia(req.body, name);
      res.json({ post: posts.setMedia(id, revision, req.body, metadata) });
    },
  );
  app.delete(base + '/:id/media', (req, res) =>
    res.json({ post: posts.setMedia(String(req.params.id), req.headers['if-match'], null, null) }),
  );
  app.get(base + '/:id/media', (req, res) => {
    const id = String(req.params.id),
      post = posts.get(id);
    if (!post.media) socialError('This post has no media.', 404);
    const bytes = posts.media(id);
    res.setHeader('Content-Type', post.media.type);
    res.setHeader('Accept-Ranges', 'bytes');
    const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? '');
    if (match) {
      const start = Number(match[1]),
        end = Math.min(Number(match[2] || bytes.length - 1), bytes.length - 1);
      if (start > end || start >= bytes.length) {
        res.status(416).set('Content-Range', `bytes */${bytes.length}`).end();
        return;
      }
      res
        .status(206)
        .set('Content-Range', `bytes ${start}-${end}/${bytes.length}`)
        .send(bytes.subarray(start, end + 1));
    } else res.send(bytes);
  });
  app.post(base + '/:id/export/:platform', async (req, res) => {
    const id = String(req.params.id),
      post = posts.get(id),
      r = socialObject(req.body, ['expectedRevision']);
    if (post.revision !== socialRevision(r.expectedRevision))
      socialError('The post changed. Save and try again.', 409);
    const platform = req.params.platform as SocialPlatform;
    if (!SOCIAL_PLATFORMS.includes(platform)) socialError('Choose a platform.');
    const variant = post.variants.find((v) => v.platform === platform);
    if (!variant || !post.media) socialError('Add media before downloading.');
    const issues = socialIssues(variant, post.media);
    if (issues.length) socialError(issues[0]!);
    const result = await exportSocialMedia(posts.media(id), post.media, variant);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${platform}-post.${result.extension}"`,
    );
    res.type(result.type).send(result.bytes);
  });
}
