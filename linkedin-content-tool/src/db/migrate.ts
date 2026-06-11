import { getCalendarDb, getAnalyticsDb } from './connection';
import { readFileSync } from 'fs';
import { join } from 'path';

export function runMigrations(): void {
  const calendarDb = getCalendarDb();
  const analyticsDb = getAnalyticsDb();

  const calendarSql = readFileSync(join(__dirname, 'migrations/calendar.sql'), 'utf-8');
  const analyticsSql = readFileSync(join(__dirname, 'migrations/analytics.sql'), 'utf-8');

  calendarDb.exec(calendarSql);
  analyticsDb.exec(analyticsSql);

  calendarDb.close();
  analyticsDb.close();
}
