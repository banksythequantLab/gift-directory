-- Gift registries: one list from any store (catalog search, CJ, Etsy, any product link). Guests mark what they
-- bought so nothing is doubled; big items can be group-funded with a PayPal group gift (a pool).
CREATE TABLE IF NOT EXISTS registries (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,          -- public address: /r/<slug>
  manage_hash TEXT NOT NULL,          -- sha-256 of the owner's private manage token (also manages its pools)
  title TEXT NOT NULL,                -- "Maria & Sam's wedding"
  occasion TEXT,
  event_date TEXT,                    -- YYYY-MM-DD, optional
  owner_name TEXT NOT NULL,
  paypal_email TEXT,                  -- receives group-gift contributions; no group gifts without it
  message TEXT,
  ip_hash TEXT,                       -- creation rate limit only
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS registries_ip ON registries(ip_hash, created_at);

CREATE TABLE IF NOT EXISTS registry_items (
  registry_id TEXT NOT NULL REFERENCES registries(id),
  item_id TEXT NOT NULL,
  product_id TEXT,
  card_json TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  claimed INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  pool_id TEXT,                       -- the group gift for this item, once someone starts one
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (registry_id, item_id)
);

CREATE TABLE IF NOT EXISTS registry_claims (
  id TEXT PRIMARY KEY,
  registry_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  name TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS registry_claims_item ON registry_claims(registry_id, item_id);
