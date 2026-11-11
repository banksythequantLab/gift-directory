-- Page-view counts per day. No cookies, no IPs, nothing about the visitor: only which page, on which site,
-- and whether the request looked like a person or a crawler.
CREATE TABLE IF NOT EXISTS page_views (
  day TEXT NOT NULL,              -- 2026-11-11 (UTC)
  host TEXT NOT NULL,             -- gift.directory, lawyers.gift.directory
  path TEXT NOT NULL,             -- /gifts/christmas-gifts-for-lawyers
  kind TEXT NOT NULL,             -- human | bot
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, host, path, kind)
);
