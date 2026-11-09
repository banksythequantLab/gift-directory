-- gift.directory's own shop (Printful print-on-demand, paid with PayPal). One row per checkout.
CREATE TABLE IF NOT EXISTS shop_orders (
  id TEXT PRIMARY KEY,
  pf_product_id INTEGER NOT NULL,      -- Printful sync product in the gift.directory store
  pf_sync_variant_id INTEGER NOT NULL,
  pf_catalog_variant_id INTEGER NOT NULL,
  kind TEXT NOT NULL,                  -- text (buyer's own lines) | fixed (a set design)
  title TEXT NOT NULL,
  variant_label TEXT,                  -- "Black Heather / M"
  qty INTEGER NOT NULL,
  lines_json TEXT,                     -- the buyer's lines for a custom-text shirt
  gift_message TEXT,
  recipient_json TEXT NOT NULL,        -- shipping name and address, receipt email
  email TEXT NOT NULL,
  unit_cents INTEGER NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  shipping_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | cancelled | failed
  paypal_order_id TEXT UNIQUE,
  pf_order_id INTEGER,                 -- the Printful order (a draft until confirmed)
  pf_status TEXT,
  note TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS shop_orders_ip ON shop_orders(ip_hash, created_at);
