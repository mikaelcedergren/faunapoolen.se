import type { SqliteMigration } from '@mikaelcedergren/cx-framework/server/sqlite';
import {
  SOCIAL_MAX_POSTS,
  SOCIAL_MAX_MEDIA_BYTES,
  SOCIAL_MAX_TOTAL_MEDIA_BYTES,
} from './social-contracts.js';
export const SOCIAL_MIGRATION: SqliteMigration = {
  version: 14,
  name: 'private_social_posts',
  statements: [
    `CREATE TABLE social_posts (
      id TEXT PRIMARY KEY CHECK(length(id)=36),
      revision INTEGER NOT NULL CHECK(revision>=1),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      record_json TEXT NOT NULL CHECK(json_valid(record_json) AND length(record_json)<=500000),
      media_json TEXT CHECK(media_json IS NULL OR (json_valid(media_json) AND length(media_json)<=2000)),
      media BLOB CHECK(media IS NULL OR length(media)<=${SOCIAL_MAX_MEDIA_BYTES}),
      CHECK((media IS NULL)=(media_json IS NULL))
    ) STRICT`,
    `CREATE TRIGGER social_posts_capacity BEFORE INSERT ON social_posts
      WHEN (SELECT COUNT(*) FROM social_posts)>=${SOCIAL_MAX_POSTS}
      BEGIN SELECT RAISE(ABORT,'social post capacity reached'); END`,
    `CREATE TRIGGER social_media_capacity BEFORE UPDATE OF media ON social_posts
      WHEN (SELECT COALESCE(SUM(length(media)),0) FROM social_posts WHERE id<>NEW.id)+COALESCE(length(NEW.media),0)>${SOCIAL_MAX_TOTAL_MEDIA_BYTES}
      BEGIN SELECT RAISE(ABORT,'social media capacity reached'); END`,
    `CREATE TABLE social_adaptations (
      id TEXT PRIMARY KEY CHECK(length(id)=36), post_id TEXT NOT NULL REFERENCES social_posts(id),
      execution_scope TEXT NOT NULL, job_id TEXT NOT NULL UNIQUE,
      input_json TEXT NOT NULL CHECK(json_valid(input_json) AND length(input_json)<=500000),
      state TEXT NOT NULL CHECK(state IN ('pending','complete','failed')),
      result_json TEXT CHECK(result_json IS NULL OR (json_valid(result_json) AND length(result_json)<=500000)),
      error TEXT, created_at INTEGER NOT NULL, UNIQUE(post_id, input_json)
    ) STRICT`,
    `CREATE TRIGGER social_adaptations_capacity BEFORE INSERT ON social_adaptations
      WHEN (SELECT COUNT(*) FROM social_adaptations)>=1000
      BEGIN SELECT RAISE(ABORT,'social adaptation capacity reached'); END`,
    `CREATE TABLE social_effects (
      id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES social_adaptations(id),
      record_json TEXT NOT NULL CHECK(json_valid(record_json) AND length(record_json)<=1500000)
    ) STRICT`,
    `CREATE TRIGGER social_effects_capacity BEFORE INSERT ON social_effects
      WHEN (SELECT COUNT(*) FROM social_effects WHERE run_id=NEW.run_id)>=2
      BEGIN SELECT RAISE(ABORT,'social effect capacity reached'); END`,
  ],
};
