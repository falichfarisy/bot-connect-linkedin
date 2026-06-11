CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_urn TEXT NOT NULL,
  account_id TEXT NOT NULL DEFAULT 'default',
  impressions INTEGER,
  reactions INTEGER,
  comments INTEGER,
  shares INTEGER,
  saves INTEGER,
  link_clicks INTEGER,
  followers_gained INTEGER,
  profile_views INTEGER,
  snapshot_date TEXT NOT NULL,
  raw_json TEXT,
  UNIQUE(post_urn, snapshot_date)
);
