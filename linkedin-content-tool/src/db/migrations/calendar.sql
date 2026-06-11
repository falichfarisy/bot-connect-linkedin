CREATE TABLE IF NOT EXISTS content_items (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL DEFAULT 'default',
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idea',
  draft_path TEXT,
  scheduled_at TEXT,
  published_at TEXT,
  linkedin_post_urn TEXT,
  first_comment TEXT,
  first_comment_urn TEXT,
  comment_failed BOOLEAN DEFAULT FALSE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS state_transitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT REFERENCES content_items(id),
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
