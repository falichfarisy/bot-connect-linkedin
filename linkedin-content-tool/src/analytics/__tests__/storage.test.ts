import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { saveSnapshot, getSnapshots, getLatestSnapshot, getAllLatestSnapshots } from '../storage';
import type { LinkedInAnalytics } from '../../linkedin/types';

const SCHEMA = `
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
`;

function createTestDb(): Database {
  const db = new Database(':memory:');
  db.exec(SCHEMA);
  return db;
}

describe('Analytics Storage', () => {
  test('saveSnapshot inserts a new record', () => {
    const db = createTestDb();
    const analytics: LinkedInAnalytics = {
      impressions: 100,
      reactions: 10,
      comments: 5,
      shares: 2,
      saves: 1,
      linkClicks: 3,
      followersGained: 7,
      profileViews: 50,
    };

    saveSnapshot('urn:li:activity:1', analytics, db, 'test-account');

    const row = db.prepare('SELECT * FROM analytics_snapshots').get() as any;
    expect(row.post_urn).toBe('urn:li:activity:1');
    expect(row.account_id).toBe('test-account');
    expect(row.impressions).toBe(100);
    expect(row.reactions).toBe(10);
    expect(row.comments).toBe(5);
    expect(row.shares).toBe(2);
    expect(row.saves).toBe(1);
    expect(row.link_clicks).toBe(3);
    expect(row.followers_gained).toBe(7);
    expect(row.profile_views).toBe(50);
    expect(row.snapshot_date).toBe(new Date().toISOString().split('T')[0]);

    db.close();
  });

  test('saveSnapshot updates existing record on same day (upsert)', () => {
    const db = createTestDb();

    saveSnapshot('urn:li:activity:1', { impressions: 100, reactions: 5 }, db);
    saveSnapshot('urn:li:activity:1', { impressions: 200, reactions: 15 }, db);

    const rows = db.prepare('SELECT * FROM analytics_snapshots').all();
    expect(rows.length).toBe(1);

    const row = rows[0] as any;
    expect(row.impressions).toBe(200);
    expect(row.reactions).toBe(15);

    db.close();
  });

  test('getSnapshots returns all records for a post ordered by date desc', () => {
    const db = createTestDb();

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    db.prepare(`
      INSERT INTO analytics_snapshots (post_urn, account_id, impressions, snapshot_date)
      VALUES (?, ?, ?, ?)
    `).run('urn:li:activity:1', 'default', 100, yesterday);

    db.prepare(`
      INSERT INTO analytics_snapshots (post_urn, account_id, impressions, snapshot_date)
      VALUES (?, ?, ?, ?)
    `).run('urn:li:activity:1', 'default', 200, today);

    db.prepare(`
      INSERT INTO analytics_snapshots (post_urn, account_id, impressions, snapshot_date)
      VALUES (?, ?, ?, ?)
    `).run('urn:li:activity:2', 'default', 300, today);

    const snapshots = getSnapshots('urn:li:activity:1', db);
    expect(snapshots.length).toBe(2);

    const first = snapshots[0] as any;
    const second = snapshots[1] as any;
    expect(first.impressions).toBe(200);
    expect(second.impressions).toBe(100);

    db.close();
  });

  test('getLatestSnapshot returns most recent record for a post', () => {
    const db = createTestDb();

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    db.prepare(`
      INSERT INTO analytics_snapshots (post_urn, account_id, impressions, snapshot_date)
      VALUES (?, ?, ?, ?)
    `).run('urn:li:activity:1', 'default', 100, yesterday);

    db.prepare(`
      INSERT INTO analytics_snapshots (post_urn, account_id, impressions, snapshot_date)
      VALUES (?, ?, ?, ?)
    `).run('urn:li:activity:1', 'default', 200, today);

    const latest = getLatestSnapshot('urn:li:activity:1', db) as any;
    expect(latest).not.toBeNull();
    expect(latest.impressions).toBe(200);

    db.close();
  });

  test('getLatestSnapshot returns null for non-existent post', () => {
    const db = createTestDb();

    const result = getLatestSnapshot('urn:li:activity:nonexistent', db);
    expect(result).toBeNull();

    db.close();
  });

  test('getAllLatestSnapshots returns one record per post', () => {
    const db = createTestDb();

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    // Post 1: two snapshots
    db.prepare(`
      INSERT INTO analytics_snapshots (post_urn, account_id, impressions, snapshot_date)
      VALUES (?, ?, ?, ?)
    `).run('urn:li:activity:1', 'default', 100, yesterday);

    db.prepare(`
      INSERT INTO analytics_snapshots (post_urn, account_id, impressions, snapshot_date)
      VALUES (?, ?, ?, ?)
    `).run('urn:li:activity:1', 'default', 200, today);

    // Post 2: one snapshot
    db.prepare(`
      INSERT INTO analytics_snapshots (post_urn, account_id, impressions, snapshot_date)
      VALUES (?, ?, ?, ?)
    `).run('urn:li:activity:2', 'default', 300, today);

    const allLatest = getAllLatestSnapshots(db);
    expect(allLatest.length).toBe(2);

    const latestMap = new Map(
      allLatest.map((r) => [r.postUrn, r.impressions]),
    );
    expect(latestMap.get('urn:li:activity:1')).toBe(200);
    expect(latestMap.get('urn:li:activity:2')).toBe(300);

    db.close();
  });

  test('saveSnapshot handles null metrics', () => {
    const db = createTestDb();
    const analytics: LinkedInAnalytics = {
      impressions: 0,
    };

    saveSnapshot('urn:li:activity:1', analytics, db);

    const row = db.prepare('SELECT * FROM analytics_snapshots').get() as any;
    expect(row.impressions).toBe(0);
    expect(row.reactions).toBeNull();
    expect(row.comments).toBeNull();
    expect(row.link_clicks).toBeNull();
    expect(row.followers_gained).toBeNull();
    expect(row.profile_views).toBeNull();
    expect(row.raw_json).toBe('{"impressions":0}');

    db.close();
  });
});
