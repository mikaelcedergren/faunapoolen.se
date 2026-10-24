import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import test, { type TestContext } from 'node:test';
import { createFaunapoolenPersistence } from './campaign-repository.js';
import { createSocialService } from './social-service.js';
import { createSocialAi, SOCIAL_ADAPT_JOB } from './social-ai.js';
import { createOpenAiResponsesProvider } from './openai-provider.js';
import {
  socialVariant,
  socialIssues,
  socialTextLength,
  type SocialPostInput,
} from './social-contracts.js';
import { inspectSocialMedia, exportSocialMedia } from './social-media.js';
function fixture(t: TestContext) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'fauna-social-test-'))),
    options = {
      operationalRoot: root,
      databasePath: join(root, 'synthetic.db'),
      executionScope: 'test',
    };
  const persistence = createFaunapoolenPersistence(options);
  t.after(() => {
    persistence.close();
    rmSync(root, { recursive: true, force: true });
  });
  return { persistence, posts: createSocialService(persistence.database.sqlite), options };
}
function input(): SocialPostInput {
  return {
    name: 'A wildlife pond',
    text: 'A pond full of life.',
    variants: [
      socialVariant('facebook', 'A pond full of life.', 'A wildlife pond', false),
      socialVariant('linkedin', 'A pond full of life.', 'A wildlife pond', false),
    ],
  };
}
test('posts retain independent versions and publication checkboxes across reopen, with revision conflicts and idempotent create', (t) => {
  const { posts, persistence, options } = fixture(t),
    id = randomUUID(),
    content = input();
  assert.equal(posts.create(id, content).revision, 1);
  assert.equal(posts.create(id, content).revision, 1);
  content.variants[0]!.text = 'Facebook wording';
  content.variants[0]!.published = true;
  const saved = posts.update(id, 1, content);
  assert.equal(saved.revision, 2);
  assert.deepEqual(posts.list()[0]!.published, ['facebook']);
  assert.equal(saved.variants[1]!.text, 'A pond full of life.');
  assert.throws(() => posts.update(id, 1, content), /changed elsewhere/);
  content.variants[0]!.text = 'Accidental edit';
  assert.throws(() => posts.update(id, 2, content), /Unmark/);
  persistence.close();
  const reopened = createFaunapoolenPersistence(options);
  try {
    assert.equal(
      createSocialService(reopened.database.sqlite).get(id).variants[0]!.published,
      true,
    );
  } finally {
    reopened.close();
  }
});
test('platform limits count unicode conservatively and flag missing media, title, and incompatible outputs', () => {
  assert.equal(socialTextLength('youtube', 'å🙂'), 6);
  assert.equal(socialTextLength('linkedin', '🙂'), 2);
  const youtube = socialVariant('youtube', 'Description', '', false);
  assert.ok(socialIssues(youtube, null).includes('Add a video for YouTube.'));
  const linkedin = socialVariant('linkedin', 'a'.repeat(3001), '', false);
  assert.match(socialIssues(linkedin, null)[0]!, /Shorten/);
});
test('post capacity refuses new records without evicting old ones', (t) => {
  const { posts } = fixture(t),
    ids = Array.from({ length: 500 }, () => randomUUID());
  for (const id of ids) posts.create(id, input());
  assert.throws(() => posts.create(randomUUID(), input()), /list is full/);
  assert.equal(posts.list().length, 500);
  assert.equal(posts.get(ids[0]!).name, input().name);
});
test('synthetic images and videos produce real JPEG and MP4 exports, with audio and trim', async (t) => {
  fixture(t);
  const image = execFileSync('ffmpeg', [
    '-nostdin',
    '-v',
    'error',
    '-f',
    'lavfi',
    '-i',
    'color=c=red:s=320x180',
    '-frames:v',
    '1',
    '-f',
    'image2pipe',
    '-vcodec',
    'png',
    'pipe:1',
  ]);
  const metadata = await inspectSocialMedia(image, 'synthetic.png');
  assert.equal(metadata.width, 320);
  assert.equal(metadata.kind, 'image');
  const v = socialVariant('instagram', 'Pond life', '', false),
    exported = await exportSocialMedia(image, metadata, v);
  const result = await inspectSocialMedia(exported.bytes, 'export.jpg');
  assert.deepEqual([result.width, result.height], [1080, 1350]);
  const video = execFileSync('ffmpeg', [
    '-nostdin',
    '-v',
    'error',
    '-f',
    'lavfi',
    '-i',
    'color=c=blue:s=320x180:r=10',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440',
    '-t',
    '4',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-movflags',
    'frag_keyframe+empty_moov',
    '-f',
    'mp4',
    'pipe:1',
  ]);
  const videoMeta = await inspectSocialMedia(video, 'clip.mp4');
  const output = await exportSocialMedia(video, videoMeta, {
    ...socialVariant('youtube', 'Pond life', 'Pond', true),
    format: 'vertical',
    start: 1,
    end: 3,
  });
  const outputMeta = await inspectSocialMedia(output.bytes, 'clip.mp4');
  assert.deepEqual([outputMeta.width, outputMeta.height], [1080, 1920]);
  assert.ok(Math.abs(outputMeta.duration - 2) < 0.2);
  assert.equal(output.type, 'video/mp4');
  const audio = execFileSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'a',
      '-show_entries',
      'stream=codec_name',
      '-of',
      'csv=p=0',
      'pipe:0',
    ],
    { input: output.bytes, encoding: 'utf8' },
  );
  assert.match(audio, /aac/);
  await assert.rejects(
    inspectSocialMedia(Buffer.from('#EXTM3U\nhttps://example.invalid'), 'bad.mp4'),
    /Choose a JPEG/,
  );
});
test('AI is explicit, deduplicated and worker-owned; saved suggestions never overwrite manual text', async (t) => {
  const { posts, persistence } = fixture(t),
    post = posts.create(randomUUID(), input()),
    db = persistence.database.sqlite,
    store = persistence.jobs;
  assert.throws(() => createSocialAi(db, store, false).admit(post.id, 1), /not enabled/);
  const ai = createSocialAi(db, store, true),
    accepted = ai.admit(post.id, 1);
  assert.equal(ai.admit(post.id, 1).id, accepted.id);
  let calls = 0;
  const handlers = ai.handlers((repository) =>
    createOpenAiResponsesProvider({
      repository,
      apiKey: 'synthetic-key',
      fetch: async () => {
        calls++;
        return new Response(
          JSON.stringify({
            id: 'resp_social_synthetic',
            status: 'completed',
            output: [
              {
                type: 'message',
                content: [
                  {
                    type: 'output_text',
                    text: JSON.stringify({
                      variants: post.variants.map((v) => ({
                        platform: v.platform,
                        title: '',
                        text: 'Adapted ' + v.platform,
                      })),
                    }),
                  },
                ],
              },
            ],
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      },
    }),
  );
  const claim = store.claim('social-test')!;
  const context = {
    executionScope: store.executionScope,
    attempt: 1,
    idempotencyKey: claim.idempotencyKey,
    jobId: claim.id,
    maxAttempts: 3,
    signal: new AbortController().signal,
    heartbeat: () => store.heartbeat(claim),
  };
  await handlers[SOCIAL_ADAPT_JOB]!(claim.payload, context);
  assert.equal(calls, 1);
  assert.equal(ai.status(accepted.id).state, 'complete');
  assert.equal(posts.get(post.id).variants[0]!.text, 'A pond full of life.');
  await handlers[SOCIAL_ADAPT_JOB]!(claim.payload, context);
  assert.equal(calls, 1);
  store.complete(claim);
});

test('a completed AI receipt survives a failed application without another paid create', async (t) => {
  const { posts, persistence } = fixture(t),
    post = posts.create(randomUUID(), input()),
    db = persistence.database.sqlite,
    store = persistence.jobs;
  const ai = createSocialAi(db, store, true),
    accepted = ai.admit(post.id, 1),
    claim = store.claim('receipt-test')!;
  let calls = 0;
  const handlers = ai.handlers((repository) =>
    createOpenAiResponsesProvider({
      repository,
      apiKey: 'synthetic-key',
      fetch: async () => {
        calls++;
        return new Response(
          JSON.stringify({
            id: 'resp_social_receipt',
            status: 'completed',
            output: [
              {
                type: 'message',
                content: [
                  {
                    type: 'output_text',
                    text: JSON.stringify({
                      variants: post.variants.map((v) => ({
                        platform: v.platform,
                        title: '',
                        text: 'Saved suggestion',
                      })),
                    }),
                  },
                ],
              },
            ],
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      },
    }),
  );
  const context = {
    executionScope: store.executionScope,
    attempt: 1,
    idempotencyKey: claim.idempotencyKey,
    jobId: claim.id,
    maxAttempts: 3,
    signal: new AbortController().signal,
    heartbeat: () => store.heartbeat(claim),
  };
  db.run(
    "CREATE TRIGGER social_test_fail BEFORE UPDATE OF state ON social_adaptations WHEN NEW.state='complete' BEGIN SELECT RAISE(ABORT,'synthetic application failure'); END",
  );
  await assert.rejects(
    handlers[SOCIAL_ADAPT_JOB]!(claim.payload, context),
    /synthetic application failure/,
  );
  assert.equal(calls, 1);
  db.run('DROP TRIGGER social_test_fail');
  await handlers[SOCIAL_ADAPT_JOB]!(claim.payload, { ...context, attempt: 2 });
  assert.equal(ai.status(accepted.id).state, 'complete');
  assert.equal(calls, 1);
  const edited = posts.update(post.id, 1, {
    ...input(),
    variants: input().variants.map((v) => ({ ...v, x: 75 })),
  });
  assert.equal(
    ai.admit(post.id, edited.revision).id,
    accepted.id,
    'framing changes reuse the saved text result',
  );
  store.complete(claim);
});
test('an ambiguous AI create blocks later spending for the post, even after an edit', async (t) => {
  const { posts, persistence } = fixture(t),
    post = posts.create(randomUUID(), input()),
    db = persistence.database.sqlite,
    store = persistence.jobs;
  const ai = createSocialAi(db, store, true),
    accepted = ai.admit(post.id, 1),
    claim = store.claim('ambiguous-test')!;
  let calls = 0;
  const handlers = ai.handlers((repository) =>
    createOpenAiResponsesProvider({
      repository,
      apiKey: 'synthetic-key',
      fetch: async () => {
        calls++;
        throw Error('synthetic lost response');
      },
    }),
  );
  const context = {
    executionScope: store.executionScope,
    attempt: 1,
    idempotencyKey: claim.idempotencyKey,
    jobId: claim.id,
    maxAttempts: 3,
    signal: new AbortController().signal,
    heartbeat: () => store.heartbeat(claim),
  };
  await handlers[SOCIAL_ADAPT_JOB]!(claim.payload, context);
  assert.equal(ai.status(accepted.id).state, 'failed');
  assert.equal(calls, 1);
  const updated = posts.update(post.id, 1, { ...input(), text: 'A changed idea' });
  assert.throws(() => ai.admit(post.id, updated.revision), /uncertain outcome/);
  assert.throws(() => posts.remove(post.id, updated.revision), /must be resolved/);
});
