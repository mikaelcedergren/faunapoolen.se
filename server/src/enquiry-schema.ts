import type { SqliteMigration } from '@mikaelcedergren/cx-framework/server/sqlite';

export const MAX_ENQUIRIES = 1_000;
export const ENQUIRY_MIGRATION: SqliteMigration = {
  version: 13,
  name: 'public_enquiry_inbox',
  statements: [
    `CREATE TABLE enquiries (
      id TEXT PRIMARY KEY CHECK(length(id) = 36),
      request_hash TEXT NOT NULL CHECK(length(request_hash) = 64),
      record_json TEXT NOT NULL CHECK(length(record_json) BETWEEN 2 AND 12000 AND json_valid(record_json)),
      status TEXT NOT NULL CHECK(status IN ('new','contacted','closed')),
      revision INTEGER NOT NULL CHECK(revision >= 1),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT`,
    'CREATE INDEX enquiries_created ON enquiries(created_at DESC, id)',
    `CREATE TRIGGER enquiries_capacity BEFORE INSERT ON enquiries
      WHEN (SELECT COUNT(*) FROM enquiries) >= ${MAX_ENQUIRIES}
      BEGIN SELECT RAISE(ABORT, 'enquiry capacity reached'); END`,
    `CREATE TABLE enquiry_windows (
      key_hash TEXT PRIMARY KEY CHECK(length(key_hash) = 64),
      window_started INTEGER NOT NULL CHECK(window_started >= 0),
      count INTEGER NOT NULL CHECK(count >= 1)
    ) STRICT`,
    `CREATE TRIGGER enquiry_windows_capacity BEFORE INSERT ON enquiry_windows
      WHEN (SELECT COUNT(*) FROM enquiry_windows) >= 1000
      BEGIN SELECT RAISE(ABORT, 'enquiry rate window capacity reached'); END`,
  ],
};
