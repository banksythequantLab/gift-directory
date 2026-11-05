-- A store's front-page grid, kept for a few hours: it is the same for every visitor, and each
-- rebuild costs five Channel3 searches and a model call.
CREATE TABLE IF NOT EXISTS browse_cache (
  store_id TEXT PRIMARY KEY,
  cards_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
