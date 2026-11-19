-- The weekly sales email. An address is mailed only after its owner clicks the confirmation link (confirmed_at);
-- unconfirmed rows are deleted after a week, and unsubscribing deletes the row.
CREATE TABLE IF NOT EXISTS subscribers (
  email TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  confirmed_at TEXT,
  last_sent TEXT                 -- date of the last issue sent, 2026-11-20
);
