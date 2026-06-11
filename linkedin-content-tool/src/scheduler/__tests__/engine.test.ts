import { expect, test, describe, beforeAll, afterAll, mock } from "bun:test";
import { Database } from 'bun:sqlite';
import { Scheduler } from '../engine';
import { MockLinkedInClient } from '../../linkedin/mock-client';
import { createDraft } from '../../content/draft';
import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { AppConfig } from '../../config/schema';

let TEST_DIR: string;
const CALENDAR_PATH = "data/calendar.db";
const ANALYTICS_PATH = "data/analytics.db";

function cleanupDb() {
  for (const p of [CALENDAR_PATH, ANALYTICS_PATH]) {
    try {
      if (existsSync(p)) rmSync(p);
    } catch {}
  }
}

function createTestDb(): Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS content_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idea',
      draft_path TEXT,
      scheduled_at TEXT,
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

function createMockConfig(): AppConfig {
  return {
    linkedin: {
      clientId: "",
      clientSecret: "",
      redirectUri: "",
      apiVersion: "202605",
    },
    ai: {
      provider: "opencode-go",
      apiKey: "",
      apiEndpoint: "",
      model: "",
      humanizationPasses: 1,
    },
    content: {
      draftsDir: TEST_DIR,
      voiceProfilesDir: "",
      defaultVoiceProfile: "default",
      maxPostLength: 3000,
      maxCommentLength: 1250,
    },
    scheduler: {
      enabled: false,
      checkIntervalMinutes: 5,
      minGapMinutes: 5,
    },
    timezone: "UTC",
  };
}

beforeAll(() => {
  cleanupDb();
  TEST_DIR = mkdtempSync(join(tmpdir(), "scheduler-test-"));
});

afterAll(() => {
  cleanupDb();
  if (TEST_DIR && existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("Scheduler", () => {
  test("checkAndPublish finds and publishes due posts", async () => {
    const db = createTestDb();
    const client = new MockLinkedInClient();
    const config = createMockConfig();
    const scheduler = new Scheduler(config, client, db);

    const draftPath = createDraft(
      "Due Post",
      "Content for due post",
      { status: "scheduled", topic: "test" },
      TEST_DIR,
    );

    const pastTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    db.run(
      `INSERT INTO content_items (id, title, status, draft_path, scheduled_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ["post-1", "Due Post", "scheduled", draftPath, pastTime, pastTime, pastTime],
    );

    await scheduler.checkAndPublish();

    const log = client.getCallLog();
    const postCalls = log.filter((entry) => entry.method === "createPost");
    expect(postCalls.length).toBe(1);

    db.close();
  });

  test("checkAndPublish skips future posts", async () => {
    const db = createTestDb();
    const client = new MockLinkedInClient();
    const config = createMockConfig();
    const scheduler = new Scheduler(config, client, db);

    const draftPath = createDraft(
      "Future Post",
      "Content for future post",
      { status: "scheduled", topic: "test" },
      TEST_DIR,
    );

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    db.run(
      `INSERT INTO content_items (id, title, status, draft_path, scheduled_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ["post-2", "Future Post", "scheduled", draftPath, tomorrow, tomorrow, tomorrow],
    );

    await scheduler.checkAndPublish();

    const log = client.getCallLog();
    const postCalls = log.filter((entry) => entry.method === "createPost");
    expect(postCalls.length).toBe(0);

    db.close();
  });

  test("checkAndPublish handles publish failure gracefully", async () => {
    mock.module("../../content/publisher", () => ({
      publishNow: mock(() => {
        throw new Error("Publish failed");
      }),
    }));

    const db = createTestDb();
    const client = new MockLinkedInClient();
    const config = createMockConfig();
    const scheduler = new Scheduler(config, client, db);

    const draftPath = createDraft(
      "Failing Post",
      "Content for failing post",
      { status: "scheduled", topic: "test" },
      TEST_DIR,
    );

    const pastTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    db.run(
      `INSERT INTO content_items (id, title, status, draft_path, scheduled_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ["post-3", "Failing Post", "scheduled", draftPath, pastTime, pastTime, pastTime],
    );

    await scheduler.checkAndPublish();

    const log = client.getCallLog();
    const postCalls = log.filter((entry) => entry.method === "createPost");
    expect(postCalls.length).toBe(0);

    db.close();
  });

  test("scheduler starts and stops correctly", async () => {
    const db = createTestDb();
    const client = new MockLinkedInClient();
    const config = createMockConfig();
    const scheduler = new Scheduler(config, client, db);

    expect(scheduler.isRunning()).toBe(false);
    expect(scheduler.getStatus()).toEqual({ running: false });

    scheduler.start();
    expect(scheduler.isRunning()).toBe(true);
    expect(scheduler.getStatus()).toEqual({ running: true });

    scheduler.stop();
    expect(scheduler.isRunning()).toBe(false);
    expect(scheduler.getStatus()).toEqual({ running: false });

    db.close();
  });
});
