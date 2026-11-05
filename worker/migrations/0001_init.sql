-- Gift Finder: AI gift picks from Channel3, and group gift pools paid through PayPal.

-- One run of the finder: what the buyer told us and what we showed them, so a pick can be shared.
CREATE TABLE IF NOT EXISTS searches (
  id TEXT PRIMARY KEY,
  brief_json TEXT NOT NULL,          -- recipient, occasion, budget, notes (as typed)
  plan_json TEXT,                    -- the searches the AI chose to run
  picks_json TEXT,                   -- ranked picks with reasons
  created_at TEXT NOT NULL
);

-- A group gift. Contributions are paid straight to the organizer's PayPal (payee), so the site
-- never holds the money; this row only keeps the tally and the link to share.
CREATE TABLE IF NOT EXISTS pools (
  id TEXT PRIMARY KEY,               -- short public id used in the share link
  manage_hash TEXT NOT NULL,         -- sha-256 of the organizer's private manage token
  title TEXT NOT NULL,               -- "For Maria — made partner"
  occasion TEXT,
  organizer_name TEXT NOT NULL,
  organizer_email TEXT NOT NULL,     -- PayPal account that receives the contributions
  product_json TEXT NOT NULL,        -- the gift: title, image, url, merchant, price_cents
  target_cents INTEGER NOT NULL,
  raised_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open', -- open | funded | closed
  closes_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contributions (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL REFERENCES pools(id),
  paypal_order_id TEXT,
  paypal_capture_id TEXT,
  amount_cents INTEGER NOT NULL,
  name TEXT,                         -- shown on the pool page unless hidden
  message TEXT,
  hide_name INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | refunded | cancelled
  note TEXT,
  created_at TEXT NOT NULL,
  paid_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS contributions_order ON contributions(paypal_order_id);
CREATE INDEX IF NOT EXISTS contributions_pool ON contributions(pool_id, status);

-- Webhook events already handled (PayPal redelivers).
CREATE TABLE IF NOT EXISTS paypal_events (
  id TEXT PRIMARY KEY,
  event_type TEXT,
  outcome TEXT,
  received_at TEXT NOT NULL
);
