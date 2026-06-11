import { Database } from 'bun:sqlite';
import type { SchedulerConfig } from '../config/schema';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface ContentItem {
  id: string;
  title: string;
  status: string;
  scheduled_at?: string;
}

/**
 * Validates that a schedule time is:
 * 1. Not in the past
 * 2. Does not collide with another post within minGapMinutes
 */
export function validateScheduleTime(
  datetime: string,
  config: SchedulerConfig,
  db: Database
): ValidationResult {
  const scheduledDate = new Date(datetime);
  const now = new Date();

  if (isNaN(scheduledDate.getTime())) {
    return { valid: false, error: 'Invalid datetime format' };
  }

  if (scheduledDate <= now) {
    return { valid: false, error: 'Scheduled time must be in the future' };
  }

  const collisions = findCollisions(datetime, config.minGapMinutes, db);
  if (collisions.length > 0) {
    const collisionTimes = collisions.map(c => c.scheduled_at).join(', ');
    return {
      valid: false,
      error: `Collision detected with existing posts scheduled at: ${collisionTimes}`,
    };
  }

  return { valid: true };
}

/**
 * Finds posts scheduled within `gapMinutes` of the given datetime.
 */
export function findCollisions(
  datetime: string,
  gapMinutes: number,
  db: Database
): ContentItem[] {
  const scheduledDate = new Date(datetime);
  const windowStart = new Date(scheduledDate.getTime() - gapMinutes * 60 * 1000).toISOString();
  const windowEnd = new Date(scheduledDate.getTime() + gapMinutes * 60 * 1000).toISOString();

  return db.prepare(`
    SELECT id, title, status, scheduled_at
    FROM content_items
    WHERE status = 'scheduled'
      AND scheduled_at IS NOT NULL
      AND scheduled_at >= ?
      AND scheduled_at <= ?
    ORDER BY scheduled_at ASC
  `).all(windowStart, windowEnd) as ContentItem[];
}
