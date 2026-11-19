-- "Email me if the price drops": one row per address per product. The row (and the address) is deleted when the
-- one email is sent, or after 90 days.
CREATE TABLE IF NOT EXISTS price_alerts (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  product_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  UNIQUE (email, product_id)
);
CREATE INDEX IF NOT EXISTS price_alerts_product ON price_alerts (product_id, checked_at);
