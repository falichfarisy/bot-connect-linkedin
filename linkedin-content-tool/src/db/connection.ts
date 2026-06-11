import { Database } from 'bun:sqlite';

export function getCalendarDb(): Database {
  const db = new Database('data/calendar.db', { create: true });
  db.exec('PRAGMA journal_mode=WAL;');
  db.exec('PRAGMA busy_timeout=5000;');
  return db;
}

export function getAnalyticsDb(): Database {
  const db = new Database('data/analytics.db', { create: true });
  db.exec('PRAGMA journal_mode=WAL;');
  db.exec('PRAGMA busy_timeout=5000;');
  return db;
}
