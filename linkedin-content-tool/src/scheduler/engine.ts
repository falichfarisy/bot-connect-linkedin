import { Database } from 'bun:sqlite';
import { LinkedInClient } from '../linkedin/client';
import { publishNow } from '../content/publisher';
import type { AppConfig } from '../config/schema';
import { getCalendarDb } from '../db/connection';

export class Scheduler {
  private config: AppConfig;
  private client: LinkedInClient;
  private db: Database;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(config: AppConfig, client: LinkedInClient, db?: Database) {
    this.config = config;
    this.client = client;
    this.db = db || getCalendarDb();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    
    const intervalMs = this.config.scheduler.checkIntervalMinutes * 60 * 1000;
    console.log(`Scheduler started (check every ${this.config.scheduler.checkIntervalMinutes} min)`);
    
    this.checkAndPublish();
    
    this.intervalId = setInterval(() => {
      this.checkAndPublish();
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;
    console.log('Scheduler stopped');
  }

  async checkAndPublish(): Promise<void> {
    try {
      const windowEnd = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      
      const duePosts = this.db.prepare(`
        SELECT id, draft_path, title, scheduled_at 
        FROM content_items 
        WHERE status = 'scheduled' 
          AND scheduled_at IS NOT NULL
          AND scheduled_at <= ?
        ORDER BY scheduled_at ASC
      `).all(windowEnd) as any[];
      
      if (duePosts.length === 0) return;
      
      console.log(`Found ${duePosts.length} due post(s)`);
      
      for (const post of duePosts) {
        if (!post.draft_path) {
          console.log(`Skipping ${post.id}: no draft_path`);
          continue;
        }
        
        try {
          const result = await publishNow(post.draft_path, this.client, this.config);
          if (result.success) {
            console.log(`✅ Published ${post.title}: ${result.postUrn}`);
          } else {
            console.log(`❌ Failed to publish ${post.title}: ${result.error}`);
          }
        } catch (error: any) {
          console.log(`❌ Error publishing ${post.title}: ${error.message}`);
        }
      }
    } catch (error: any) {
      console.log(`Scheduler error: ${error.message}`);
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  getStatus(): { running: boolean; duePosts?: number } {
    return { running: this.running };
  }
}
