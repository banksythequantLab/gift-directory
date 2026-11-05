-- gift.directory: anyone can run a niche gift store. A store is a configuration of the same finder
-- and group gifts: its niche, its occasions, what to search for, its look. Publishing it takes a
-- PayPal subscription; the store is live while that subscription is active.
CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,              -- <slug>.gift.directory
  name TEXT NOT NULL,                     -- "Lawyer Gifts"
  tagline TEXT,
  niche TEXT NOT NULL,                    -- who the store is for, in the owner's words
  config_json TEXT NOT NULL,              -- occasions, recipient examples, search guidance, colors
  owner_email TEXT NOT NULL,
  manage_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',   -- draft | active | lapsed
  paypal_subscription_id TEXT,
  subscription_status TEXT,               -- PayPal's own word: APPROVAL_PENDING, ACTIVE, SUSPENDED, CANCELLED, EXPIRED
  checked_at TEXT,                        -- last time PayPal was asked
  custom_host TEXT,                       -- e.g. gifts.nota.lawyer
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS stores_sub ON stores(paypal_subscription_id);
CREATE UNIQUE INDEX IF NOT EXISTS stores_host ON stores(custom_host);

ALTER TABLE pools ADD COLUMN store_id TEXT;
ALTER TABLE searches ADD COLUMN store_id TEXT;
