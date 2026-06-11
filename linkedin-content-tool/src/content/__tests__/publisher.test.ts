import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { createDraft, readDraft } from "../draft";
import { publishNow, type PublishResult } from "../publisher";
import { MockLinkedInClient } from "../../linkedin/mock-client";
import { getCalendarDb } from "../../db/connection";
import { runMigrations } from "../../db/migrate";
import type { AppConfig } from "../../config/schema";

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

function createMockConfig(maxPostLength = 3000): AppConfig {
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
      maxPostLength,
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
  TEST_DIR = mkdtempSync(join(tmpdir(), "publisher-test-"));
  runMigrations();
});

afterAll(() => {
  cleanupDb();
  if (TEST_DIR && existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("publishNow", () => {
  test("transitions state correctly (status → published, got postUrn)", async () => {
    const filePath = createDraft(
      "Publish Test",
      "Hello LinkedIn!",
      { status: "approved", topic: "test" },
      TEST_DIR,
    );
    const client = new MockLinkedInClient();
    const config = createMockConfig();

    const result = await publishNow(filePath, client, config);

    expect(result.success).toBe(true);
    expect(result.postUrn).toMatch(/^urn:li:activity:\d+$/);
    expect(result.commentFailed).toBeUndefined();

    const draft = readDraft(filePath);
    expect(draft.metadata.status).toBe("published");
    expect(draft.metadata.linkedinPostUrn).toBe(result.postUrn);
    expect(draft.metadata.publishedAt).toBeDefined();

    const db = getCalendarDb();
    const row = db
      .query<{ to_status: string }, [string]>(
        "SELECT to_status FROM state_transitions WHERE item_id = ?",
      )
      .get(draft.metadata.id);
    expect(row?.to_status).toBe("published");
    db.close();
  });

  test("handles comment failure gracefully (post still published, commentFailed: true)", async () => {
    const filePath = createDraft(
      "Comment Fail Test",
      "Post with comment",
      { status: "approved", topic: "test", firstComment: "This will fail" },
      TEST_DIR,
    );

    class FailingCommentClient extends MockLinkedInClient {
      async createComment(): Promise<{ commentUrn: string }> {
        throw new Error("Comment failed");
      }
    }
    const client = new FailingCommentClient();
    const config = createMockConfig();

    const result = await publishNow(filePath, client, config);

    expect(result.success).toBe(true);
    expect(result.postUrn).toBeDefined();
    expect(result.commentFailed).toBe(true);
    expect(result.commentUrn).toBeUndefined();

    const draft = readDraft(filePath);
    expect(draft.metadata.status).toBe("published");
    expect(draft.metadata.linkedinPostUrn).toBe(result.postUrn);
  });

  test("rejects invalid status (e.g., 'idea')", async () => {
    const filePath = createDraft(
      "Idea Draft",
      "Not ready yet",
      { status: "idea", topic: "test" },
      TEST_DIR,
    );
    const client = new MockLinkedInClient();
    const config = createMockConfig();

    const result = await publishNow(filePath, client, config);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid status");
    expect(result.postUrn).toBeUndefined();

    const draft = readDraft(filePath);
    expect(draft.metadata.status).toBe("idea");
  });

  test("rejects content >3000 chars", async () => {
    const longContent = "a".repeat(3001);
    const filePath = createDraft(
      "Long Draft",
      longContent,
      { status: "approved", topic: "test" },
      TEST_DIR,
    );
    const client = new MockLinkedInClient();
    const config = createMockConfig();

    const result = await publishNow(filePath, client, config);

    expect(result.success).toBe(false);
    expect(result.error).toContain("exceeds maximum length");
    expect(result.postUrn).toBeUndefined();
  });

  test("saves URNs to frontmatter", async () => {
    const filePath = createDraft(
      "URN Test",
      "Save my URNs",
      { status: "approved", topic: "test", firstComment: "First!" },
      TEST_DIR,
    );
    const client = new MockLinkedInClient();
    const config = createMockConfig();

    const result = await publishNow(filePath, client, config);

    expect(result.success).toBe(true);
    expect(result.postUrn).toBeDefined();
    expect(result.commentUrn).toBeDefined();

    const draft = readDraft(filePath);
    expect(draft.metadata.linkedinPostUrn).toBe(result.postUrn);
    expect(draft.metadata.firstCommentUrn).toBe(result.commentUrn);
  });

  test("posts first comment when specified in frontmatter", async () => {
    const filePath = createDraft(
      "Comment Test",
      "Main post content",
      { status: "approved", topic: "test", firstComment: "Check this out!" },
      TEST_DIR,
    );
    const client = new MockLinkedInClient();
    const config = createMockConfig();

    const result = await publishNow(filePath, client, config);

    expect(result.success).toBe(true);
    expect(result.postUrn).toBeDefined();
    expect(result.commentUrn).toBeDefined();
    expect(result.commentFailed).toBe(false);

    const log = client.getCallLog();
    const commentCalls = log.filter((entry) => entry.method === "createComment");
    expect(commentCalls.length).toBe(1);
  });

  test("handles missing first comment (no comment posted)", async () => {
    const filePath = createDraft(
      "No Comment Test",
      "Just a post",
      { status: "approved", topic: "test" },
      TEST_DIR,
    );
    const client = new MockLinkedInClient();
    const config = createMockConfig();

    const result = await publishNow(filePath, client, config);

    expect(result.success).toBe(true);
    expect(result.postUrn).toBeDefined();
    expect(result.commentUrn).toBeUndefined();
    expect(result.commentFailed).toBeUndefined();

    const log = client.getCallLog();
    const commentCalls = log.filter((entry) => entry.method === "createComment");
    expect(commentCalls.length).toBe(0);
  });
});
