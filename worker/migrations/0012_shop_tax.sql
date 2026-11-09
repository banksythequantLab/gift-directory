-- Sales tax collected on a shop order (New Jersey for now; see DEFAULT_TAX in shop.js).
ALTER TABLE shop_orders ADD COLUMN tax_cents INTEGER NOT NULL DEFAULT 0;
