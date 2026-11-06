-- A store owner's own products (their Shopify shop, single product links, or a CSV).
-- Shopify shops are re-pulled daily; their products that disappear or sell out turn unavailable.
CREATE TABLE IF NOT EXISTS own_sources (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  kind TEXT NOT NULL,              -- shopify
  url TEXT NOT NULL,               -- the shop's origin, e.g. https://mystore.com
  last_synced TEXT,
  last_error TEXT,
  product_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (store_id, url)
);
CREATE TABLE IF NOT EXISTS own_products (
  store_id TEXT NOT NULL,
  product_id TEXT NOT NULL,        -- own:<host>:<id>
  source_id TEXT,                  -- own_sources.id for Shopify imports; null for links and CSV rows
  kind TEXT NOT NULL,              -- shopify | link | csv
  card_json TEXT NOT NULL,         -- title, image, price, link, as shown on the store
  available INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (store_id, product_id)
);
CREATE INDEX IF NOT EXISTS own_products_store ON own_products(store_id, available);
