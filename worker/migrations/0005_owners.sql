-- Store owners: Log in with PayPal, sessions, and what they curate.

-- Who paid for the store, as PayPal knows them (filled in when the subscription is checked).
ALTER TABLE stores ADD COLUMN owner_payer_id TEXT;

-- One login. The cookie holds only the id; nothing here is a PayPal token.
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  payer_id TEXT,
  emails_json TEXT NOT NULL,     -- every verified email PayPal returned for this person
  name TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- The OAuth state parameter: a login only completes if it started here.
CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

-- An owner's hand on the shelves: pinned products (optionally in a named collection) and hidden ones.
CREATE TABLE IF NOT EXISTS store_items (
  store_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  status TEXT NOT NULL,          -- pinned | hidden
  collection TEXT,               -- shelf name for pinned items; null = "Our picks"
  card_json TEXT NOT NULL,       -- the product as it was when pinned (title, image, price, link)
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (store_id, product_id)
);
