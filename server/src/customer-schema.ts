import type { SqliteMigration } from '@mikaelcedergren/cx-framework/server/sqlite';

export const CUSTOMER_MIGRATION: SqliteMigration = {
  version: 15,
  name: 'customers_and_enquiry_notifications',
  statements: [
    `CREATE TABLE customers (
      id TEXT PRIMARY KEY CHECK(length(id)=36),
      email TEXT NOT NULL UNIQUE CHECK(length(email) BETWEEN 3 AND 254),
      name TEXT NOT NULL CHECK(length(name)<=120),
      status TEXT NOT NULL DEFAULT 'lead' CHECK(status IN ('lead','customer')),
      revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    ) STRICT`,
    `CREATE TRIGGER customers_capacity BEFORE INSERT ON customers
      WHEN (SELECT count(*) FROM customers)>=1000
      BEGIN SELECT RAISE(ABORT,'customer capacity reached'); END`,
    // An existing enquiry identity supplies a stable customer identity. No historical mail is queued.
    `INSERT INTO customers(id,email,name,created_at,updated_at)
      SELECT id,lower(trim(json_extract(record_json,'$.email'))),
        json_extract(record_json,'$.name'),created_at,updated_at FROM (
        SELECT *,row_number() OVER (
          PARTITION BY lower(trim(json_extract(record_json,'$.email'))) ORDER BY created_at,id
        ) AS position FROM enquiries
      ) WHERE position=1`,
    'ALTER TABLE enquiries ADD COLUMN customer_id TEXT REFERENCES customers(id)',
    `UPDATE enquiries SET customer_id=(SELECT id FROM customers
      WHERE email=lower(trim(json_extract(enquiries.record_json,'$.email'))))`,
    `CREATE TRIGGER enquiry_customer_required BEFORE INSERT ON enquiries
      WHEN NEW.customer_id IS NULL
      BEGIN SELECT RAISE(ABORT,'enquiry customer required'); END`,
    'CREATE INDEX enquiries_customer ON enquiries(customer_id,created_at DESC,id)',
    `CREATE TABLE enquiry_notifications (
      enquiry_id TEXT PRIMARY KEY REFERENCES enquiries(id) ON DELETE CASCADE,
      execution_scope TEXT NOT NULL CHECK(execution_scope IN ('development','production','test')),
      state TEXT NOT NULL CHECK(state IN ('queued','sending','sent','failed','uncertain')),
      revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),
      attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
      available_at INTEGER NOT NULL, lease_until INTEGER,
      claim_token TEXT, recipient TEXT, message_id TEXT,
      error_code TEXT, updated_at TEXT NOT NULL
    ) STRICT`,
    'CREATE INDEX enquiry_notifications_ready ON enquiry_notifications(execution_scope,state,available_at)',
    `CREATE TRIGGER enquiry_notifications_capacity BEFORE INSERT ON enquiry_notifications
      WHEN (SELECT count(*) FROM enquiry_notifications)>=1000
      BEGIN SELECT RAISE(ABORT,'notification capacity reached'); END`,
  ],
};
