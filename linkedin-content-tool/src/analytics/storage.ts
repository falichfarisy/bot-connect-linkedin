import { Database } from 'bun:sqlite';
import type { LinkedInAnalytics } from '../linkedin/types';
import { getAnalyticsDb } from '../db/connection';

export interface AnalyticsSnapshot {
  id?: number;
  postUrn: string;
  accountId: string;
  impressions: number | null;
  reactions: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  linkClicks: number | null;
  followersGained: number | null;
  profileViews: number | null;
  snapshotDate: string;
  rawJson?: string;
}

/**
 * Extension of AnalyticsSnapshot with a data-completeness flag.
 */
export interface AnalyticsSnapshotWithComplete extends AnalyticsSnapshot {
  dataComplete: boolean;
}

/**
 * Checks if a snapshot has all primary metrics present.
 * Returns false if any of impressions, reactions, comments, shares, or saves
 * is null or undefined.
 */
export function isDataComplete(analytics: AnalyticsSnapshot | LinkedInAnalytics): boolean {
  return (
    analytics.impressions !== undefined && analytics.impressions !== null &&
    analytics.reactions !== undefined && analytics.reactions !== null &&
    analytics.comments !== undefined && analytics.comments !== null &&
    analytics.shares !== undefined && analytics.shares !== null &&
    analytics.saves !== undefined && analytics.saves !== null
  );
}

/**
 * Saves or updates an analytics snapshot.
 * Uses upsert semantics (UNIQUE on post_urn + snapshot_date).
 */
export function saveSnapshot(
  postUrn: string,
  analytics: LinkedInAnalytics,
  db: Database,
  accountId: string = 'default'
): void {
  const snapshotDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  const stmt = db.prepare(`
    INSERT INTO analytics_snapshots 
      (post_urn, account_id, impressions, reactions, comments, shares, saves, 
       link_clicks, followers_gained, profile_views, snapshot_date, raw_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(post_urn, snapshot_date) DO UPDATE SET
      impressions = excluded.impressions,
      reactions = excluded.reactions,
      comments = excluded.comments,
      shares = excluded.shares,
      saves = excluded.saves,
      link_clicks = excluded.link_clicks,
      followers_gained = excluded.followers_gained,
      profile_views = excluded.profile_views,
      raw_json = excluded.raw_json
  `);
  
  stmt.run(
    postUrn,
    accountId,
    analytics.impressions ?? null,
    analytics.reactions ?? null,
    analytics.comments ?? null,
    analytics.shares ?? null,
    analytics.saves ?? null,
    analytics.linkClicks ?? null,
    analytics.followersGained ?? null,
    analytics.profileViews ?? null,
    snapshotDate,
    JSON.stringify(analytics)
  );
}

/** Converts a raw DB row to an AnalyticsSnapshot (snake_case → camelCase). */
function rowToAnalyticsSnapshot(row: Record<string, unknown>): AnalyticsSnapshot {
  return {
    id: row.id as number | undefined,
    postUrn: row.post_urn as string,
    accountId: row.account_id as string,
    snapshotDate: row.snapshot_date as string,
    impressions: row.impressions != null ? Number(row.impressions) : null,
    reactions: row.reactions != null ? Number(row.reactions) : null,
    comments: row.comments != null ? Number(row.comments) : null,
    shares: row.shares != null ? Number(row.shares) : null,
    saves: row.saves != null ? Number(row.saves) : null,
    linkClicks: row.link_clicks != null ? Number(row.link_clicks) : null,
    followersGained: row.followers_gained != null ? Number(row.followers_gained) : null,
    profileViews: row.profile_views != null ? Number(row.profile_views) : null,
    rawJson: row.raw_json as string | undefined,
  };
}

/** Converts a raw DB row into an AnalyticsSnapshotWithComplete. */
function rowToSnapshotWithComplete(row: Record<string, unknown>): AnalyticsSnapshotWithComplete {
  const base = rowToAnalyticsSnapshot(row);
  return {
    ...base,
    dataComplete: isDataComplete({
      impressions: base.impressions ?? undefined,
      reactions: base.reactions ?? undefined,
      comments: base.comments ?? undefined,
      shares: base.shares ?? undefined,
      saves: base.saves ?? undefined,
    }),
  };
}

/**
 * Retrieves all snapshots for a post.
 */
export function getSnapshots(postUrn: string, db: Database): AnalyticsSnapshot[] {
  const rows = db.prepare(`
    SELECT * FROM analytics_snapshots 
    WHERE post_urn = ? 
    ORDER BY snapshot_date DESC
  `).all(postUrn) as Record<string, unknown>[];

  return rows.map(rowToAnalyticsSnapshot);
}

/**
 * Retrieves the most recent snapshot for a post.
 */
export function getLatestSnapshot(postUrn: string, db: Database): AnalyticsSnapshot | null {
  const row = db.prepare(`
    SELECT * FROM analytics_snapshots 
    WHERE post_urn = ? 
    ORDER BY snapshot_date DESC 
    LIMIT 1
  `).get(postUrn) as Record<string, unknown> | undefined;
  
  return row ? rowToAnalyticsSnapshot(row) : null;
}

/**
 * Retrieves the latest snapshot for all posts.
 */
export function getAllLatestSnapshots(db: Database): AnalyticsSnapshot[] {
  const rows = db.prepare(`
    SELECT a.* FROM analytics_snapshots a
    INNER JOIN (
      SELECT post_urn, MAX(snapshot_date) as max_date
      FROM analytics_snapshots
      GROUP BY post_urn
    ) b ON a.post_urn = b.post_urn AND a.snapshot_date = b.max_date
    ORDER BY a.snapshot_date DESC
  `).all() as Record<string, unknown>[];

  return rows.map(rowToAnalyticsSnapshot);
}

/**
 * Retrieves ALL snapshots (every snapshot, not just latest per post).
 * Returns them enriched with the dataComplete flag.
 */
export function getAllSnapshots(db: Database): AnalyticsSnapshotWithComplete[] {
  const rows = db.prepare(`
    SELECT * FROM analytics_snapshots
    ORDER BY snapshot_date DESC
  `).all() as Record<string, unknown>[];

  return rows.map(rowToSnapshotWithComplete);
}
