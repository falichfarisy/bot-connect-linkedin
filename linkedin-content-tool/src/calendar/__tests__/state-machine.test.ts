import { describe, test, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import {
  CONTENT_STATES,
  ALLOWED_TRANSITIONS,
  canTransition,
  validateTransition,
  transition,
} from '../state-machine';

function createTestDb(): Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS content_items (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'idea',
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
  `);
  return db;
}

describe('state machine', () => {
  describe('canTransition', () => {
    test('all valid transitions return true', () => {
      for (const [from, toStates] of Object.entries(ALLOWED_TRANSITIONS)) {
        for (const to of toStates) {
          expect(canTransition(from, to)).toBe(true);
        }
      }
    });

    test('all invalid transitions return false', () => {
      for (const from of CONTENT_STATES) {
        const allowed = ALLOWED_TRANSITIONS[from];
        for (const to of CONTENT_STATES) {
          if (allowed.includes(to)) continue;
          expect(canTransition(from, to)).toBe(false);
        }
      }
    });

    test('published is a terminal state', () => {
      for (const to of CONTENT_STATES) {
        expect(canTransition('published', to)).toBe(false);
      }
    });

    test('failed can retry to draft', () => {
      expect(canTransition('failed', 'draft')).toBe(true);
    });

    test('returns false for unknown states', () => {
      expect(canTransition('unknown', 'draft')).toBe(false);
      expect(canTransition('idea', 'unknown')).toBe(false);
    });
  });

  describe('validateTransition', () => {
    test('throws for invalid transition', () => {
      expect(() => validateTransition('idea', 'published')).toThrow(
        'Invalid transition: idea → published'
      );
    });

    test('does not throw for valid transition', () => {
      expect(() => validateTransition('idea', 'draft')).not.toThrow();
    });
  });

  describe('transition', () => {
    test('updates database correctly', () => {
      const db = createTestDb();

      // Insert a test content item
      const now = new Date().toISOString();
      db.prepare(
        'INSERT INTO content_items (id, status, created_at, updated_at) VALUES (?, ?, ?, ?)'
      ).run('test-1', 'idea', now, now);

      transition('test-1', 'idea', 'draft', db);

      const item = db.prepare('SELECT status FROM content_items WHERE id = ?').get('test-1') as { status: string };
      expect(item.status).toBe('draft');

      // Verify state_transitions record
      const transitions = db.prepare(
        'SELECT item_id, from_status, to_status FROM state_transitions'
      ).all() as Array<{ item_id: string; from_status: string; to_status: string }>;
      expect(transitions).toHaveLength(1);
      expect(transitions[0]).toEqual({
        item_id: 'test-1',
        from_status: 'idea',
        to_status: 'draft',
      });
    });

    test('throws on invalid transition', () => {
      const db = createTestDb();
      const now = new Date().toISOString();
      db.prepare(
        'INSERT INTO content_items (id, status, created_at, updated_at) VALUES (?, ?, ?, ?)'
      ).run('test-2', 'idea', now, now);

      expect(() => transition('test-2', 'idea', 'published', db)).toThrow(
        'Invalid transition: idea → published'
      );

      // Verify no partial update occurred
      const item = db.prepare('SELECT status FROM content_items WHERE id = ?').get('test-2') as { status: string };
      expect(item.status).toBe('idea');

      const transitions = db.prepare('SELECT * FROM state_transitions').all();
      expect(transitions).toHaveLength(0);
    });
  });
});
