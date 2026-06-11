import { Database } from 'bun:sqlite';
import { describe, expect, test, beforeAll } from 'bun:test';
import { validateScheduleTime, findCollisions } from '../validation';
import type { SchedulerConfig } from '../../config/schema';

function createTestDb(): Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS content_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idea',
      scheduled_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return db;
}

function seedTestData(db: Database, items: Array<{ id: string; title: string; status: string; scheduled_at: string }>) {
  const insert = db.prepare(`
    INSERT INTO content_items (id, title, status, scheduled_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
  `);
  for (const item of items) {
    insert.run(item.id, item.title, item.status, item.scheduled_at);
  }
}

const defaultConfig: SchedulerConfig = {
  enabled: true,
  checkIntervalMinutes: 5,
  minGapMinutes: 5,
};

describe('validateScheduleTime', () => {
  test('rejects past datetime', () => {
    const db = createTestDb();
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const result = validateScheduleTime(past, defaultConfig, db);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('future');
    db.close();
  });

  test('rejects collision within minGapMinutes', () => {
    const db = createTestDb();
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    seedTestData(db, [
      { id: 'existing-1', title: 'Existing Post', status: 'scheduled', scheduled_at: future },
    ]);

    const result = validateScheduleTime(future, defaultConfig, db);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Collision detected');

    const nearFuture = new Date(Date.now() + 2 * 60 * 60 * 1000 + 4 * 60 * 1000).toISOString();
    const nearResult = validateScheduleTime(nearFuture, defaultConfig, db);
    expect(nearResult.valid).toBe(false);
    expect(nearResult.error).toContain('Collision detected');

    db.close();
  });

  test('accepts valid future datetime without collision', () => {
    const db = createTestDb();
    const farFuture = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const result = validateScheduleTime(farFuture, defaultConfig, db);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
    db.close();
  });

  test('rejects invalid datetime format', () => {
    const db = createTestDb();
    const result = validateScheduleTime('not-a-date', defaultConfig, db);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid datetime format');
    db.close();
  });
});

describe('findCollisions', () => {
  test('returns conflicting posts within gap window', () => {
    const db = createTestDb();
    const baseTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const targetTime = new Date(baseTime.getTime() + 2 * 60 * 1000).toISOString();
    const conflictTime = new Date(baseTime.getTime() + 1 * 60 * 1000).toISOString();

    seedTestData(db, [
      { id: 'conflict-1', title: 'Conflicting Post', status: 'scheduled', scheduled_at: conflictTime },
    ]);

    const collisions = findCollisions(targetTime, 5, db);
    expect(collisions.length).toBe(1);
    expect(collisions[0].id).toBe('conflict-1');
    expect(collisions[0].title).toBe('Conflicting Post');
    expect(collisions[0].status).toBe('scheduled');

    db.close();
  });

  test('returns empty array when no conflicts', () => {
    const db = createTestDb();
    const farFuture = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const collisions = findCollisions(farFuture, 5, db);
    expect(collisions).toEqual([]);
    db.close();
  });

  test('ignores non-scheduled posts in collision search', () => {
    const db = createTestDb();
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    seedTestData(db, [
      { id: 'draft-1', title: 'Draft Post', status: 'draft', scheduled_at: future },
      { id: 'published-1', title: 'Published Post', status: 'published', scheduled_at: future },
    ]);

    const collisions = findCollisions(future, 5, db);
    expect(collisions).toEqual([]);

    db.close();
  });
});
