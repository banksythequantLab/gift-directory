-- Clicks on links that leave for a store, counted per day. Like page_views: no cookies, no IPs, nothing about
-- the visitor. Only which of our pages the click was on and which store it went to.
CREATE TABLE IF NOT EXISTS link_clicks (
  day TEXT NOT NULL,              -- 2026-11-19 (UTC)
  host TEXT NOT NULL,             -- gift.directory, lawyers.gift.directory
  path TEXT NOT NULL,             -- /gifts/christmas-gifts-for-lawyers
  merchant TEXT NOT NULL,         -- levenger.com, Abracadabra NYC
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, host, path, merchant)
);
