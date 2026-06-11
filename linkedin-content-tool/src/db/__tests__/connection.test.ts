import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { Database } from 'bun:sqlite';
import { unlinkSync, existsSync } from 'fs';
import { getCalendarDb, getAnalyticsDb } from '../connection';
import { runMigrations } from '../migrate';

const CALENDAR_PATH = 'data/calendar.db';
const ANALYTICS_PATH = 'data/analytics.db';

function cleanup() {
  for (const p of [CALENDAR_PATH, ANALYTICS_PATH]) {
    try { if (existsSync(p)) unlinkSync(p); } catch { /* ok */ }
  }
}

describe('Database Connection', () => {
  afterAll(cleanup);

  test('getCalendarDb creates database with WAL mode', () => {
    const db = getCalendarDb();
    const row = db.query<{ journal_mode: string }, []>("PRAGMA journal_mode;").get();
    expect(row?.journal_mode?.toLowerCase()).toBe('wal');
    db.close();
  });

  test('getCalendarDb sets busy timeout to 5000ms', () => {
    const db = getCalendarDb();
    const row = db.query<{ timeout: number }, []>("PRAGMA busy_timeout;").get();
    expect(row?.timeout).toBe(5000);
    db.close();
  });

  test('getAnalyticsDb creates database with WAL mode', () => {
    const db = getAnalyticsDb();
    const row = db.query<{ journal_mode: string }, []>("PRAGMA journal_mode;").get();
    expect(row?.journal_mode?.toLowerCase()).toBe('wal');
    db.close();
  });

  test('getAnalyticsDb sets busy timeout to 5000ms', () => {
    const db = getAnalyticsDb();
    const row = db.query<{ timeout: number }, []>("PRAGMA busy_timeout;").get();
    expect(row?.timeout).toBe(5000);
    db.close();
  });

  test('opening both databases works without error', () => {
    const calendarDb = getCalendarDb();
    const analyticsDb = getAnalyticsDb();
    expect(calendarDb).toBeInstanceOf(Database);
    expect(analyticsDb).toBeInstanceOf(Database);
    calendarDb.close();
    analyticsDb.close();
  });
});

describe('Migrations', () => {
  beforeAll(() => {
    cleanup();
    runMigrations();
  });

  afterAll(cleanup);

  test('calendar.db has content_items table', () => {
    const db = getCalendarDb();
    const row = db.query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='content_items'"
    ).get();
    expect(row?.name).toBe('content_items');
    db.close();
  });

  test('calendar.db has state_transitions table', () => {
    const db = getCalendarDb();
    const row = db.query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='state_transitions'"
    ).get();
    expect(row?.name).toBe('state_transitions');
    db.close();
  });

  test('analytics.db has analytics_snapshots table', () => {
    const db = getAnalyticsDb();
    const row = db.query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='analytics_snapshots'"
    ).get();
    expect(row?.name).toBe('analytics_snapshots');
    db.close();
  });
});
