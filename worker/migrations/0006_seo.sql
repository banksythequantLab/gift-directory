-- Gift guides (gift.directory/gifts/<slug>): the written guide once, the products refreshed.
CREATE TABLE IF NOT EXISTS seo_pages (
  slug TEXT PRIMARY KEY,
  guide_json TEXT NOT NULL,      -- meta, intro paragraphs, FAQ (model-written, checked)
  cards_json TEXT NOT NULL,      -- products shown, with reasons
  updated_at TEXT NOT NULL,      -- when the products were last refreshed
  created_at TEXT NOT NULL
);
