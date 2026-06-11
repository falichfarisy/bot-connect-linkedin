import { Database } from 'bun:sqlite';

export const CONTENT_STATES = [
  'idea',
  'draft',
  'review',
  'approved',
  'scheduled',
  'published',
  'failed',
] as const;

export type ContentState = typeof CONTENT_STATES[number];

export const ALLOWED_TRANSITIONS: Record<ContentState, ContentState[]> = {
  idea: ['draft'],
  draft: ['review', 'idea'],
  review: ['approved', 'draft'],
  approved: ['scheduled', 'published'],
  scheduled: ['published', 'approved'], // cancel scheduling
  published: [], // terminal state
  failed: ['draft'], // retry
};

export function canTransition(from: string, to: string): boolean {
  const allowed = ALLOWED_TRANSITIONS[from as ContentState];
  if (!allowed) return false;
  return allowed.includes(to as ContentState);
}

export function validateTransition(from: string, to: string): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid transition: ${from} → ${to}`);
  }
}

export function transition(itemId: string, from: string, to: string, db: Database): void {
  validateTransition(from, to);

  const updateStmt = db.prepare('UPDATE content_items SET status = ?, updated_at = ? WHERE id = ?');
  updateStmt.run(to, new Date().toISOString(), itemId);

  const insertStmt = db.prepare(
    'INSERT INTO state_transitions (item_id, from_status, to_status, created_at) VALUES (?, ?, ?, ?)'
  );
  insertStmt.run(itemId, from, to, new Date().toISOString());
}
