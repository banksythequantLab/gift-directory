-- gift.directory/sales
-- deals: guide picks whose price has been re-checked with the catalog. on_sale=1 rows are listed while checked_at is
-- recent; on_sale=0 rows remember a product that was looked at and was not (or no longer) marked down.
CREATE TABLE IF NOT EXISTS deals (
  product_id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,            -- the guide it was picked for
  card_json TEXT NOT NULL,       -- the product card as of the last check
  price_cents INTEGER NOT NULL,
  was_cents INTEGER NOT NULL,
  pct INTEGER NOT NULL,          -- percent off (0 when not on sale)
  on_sale INTEGER NOT NULL,
  checked_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS deals_listed ON deals (on_sale, checked_at);
-- promos: live coupon codes and sale events from joined CJ advertisers, replaced on each fetch.
CREATE TABLE IF NOT EXISTS promos (
  id TEXT PRIMARY KEY,           -- CJ link id
  advertiser_id TEXT NOT NULL,
  advertiser TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  code TEXT,
  kind TEXT NOT NULL,            -- coupon | sale
  starts_at TEXT,
  ends_at TEXT,                  -- NULL when the store gave no end date
  url TEXT NOT NULL,             -- CJ tracking link
  category TEXT,
  fetched_at TEXT NOT NULL
);
