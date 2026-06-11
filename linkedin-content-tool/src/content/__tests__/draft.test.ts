import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { existsSync, mkdirSync, rmSync, readFileSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import matter from "gray-matter";
import {
  createDraft,
  readDraft,
  updateDraft,
  deleteDraft,
  listDrafts,
} from "../draft";

let TEST_DIR: string;

beforeAll(() => {
  TEST_DIR = mkdtempSync(join(tmpdir(), "draft-test-"));
});

afterAll(() => {
  if (TEST_DIR && existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("draft CRUD", () => {
  test("createDraft creates file with valid YAML frontmatter", () => {
    const filePath = createDraft(
      "Test Draft",
      "Hello world content",
      { topic: "testing", voiceProfile: "professional" },
      TEST_DIR,
    );

    expect(existsSync(filePath)).toBe(true);
    expect(filePath).toMatch(/\.md$/);
    expect(filePath).toContain(TEST_DIR);

    const raw = readFileSync(filePath, "utf-8");
    const parsed = matter(raw);

    expect(parsed.data.title).toBe("Test Draft");
    expect(parsed.data.topic).toBe("testing");
    expect(parsed.data.voiceProfile).toBe("professional");
    expect(parsed.data.status).toBe("draft");
    expect(parsed.data.id).toMatch(/^draft-\d{8}-\d{9}-\d{3}$/);
    expect(parsed.data.createdAt).toBeDefined();
    expect(parsed.data.updatedAt).toBeDefined();
    expect(parsed.content.trim()).toBe("Hello world content");
  });

  test("readDraft parses frontmatter correctly", () => {
    const filePath = createDraft(
      "Read Test",
      "Content to read",
      { topic: "reading", status: "review" },
      TEST_DIR,
    );

    const result = readDraft(filePath);

    expect(result.metadata.title).toBe("Read Test");
    expect(result.metadata.topic).toBe("reading");
    expect(result.metadata.status).toBe("review");
    expect(result.metadata.id).toMatch(/^draft-\d{8}-\d{9}-\d{3}$/);
    expect(result.content).toBe("Content to read");
  });

  test("updateDraft preserves existing frontmatter and updates modified fields", () => {
    const filePath = createDraft(
      "Update Test",
      "Original content",
      { topic: "updating", status: "draft", voiceProfile: "casual" },
      TEST_DIR,
    );

    updateDraft(
      filePath,
      "Original content",
      { status: "approved", voiceProfile: "professional" },
    );

    const result = readDraft(filePath);

    expect(result.metadata.title).toBe("Update Test");
    expect(result.metadata.topic).toBe("updating");
    expect(result.metadata.status).toBe("approved");
    expect(result.metadata.voiceProfile).toBe("professional");
    expect(result.content).toBe("Original content");
  });

  test("updateDraft updates content", () => {
    const filePath = createDraft(
      "Content Update",
      "Old content",
      { topic: "content" },
      TEST_DIR,
    );

    updateDraft(filePath, "New updated content", {});

    const result = readDraft(filePath);
    expect(result.content).toBe("New updated content");
    expect(result.metadata.title).toBe("Content Update");
  });

  test("listDrafts returns all drafts sorted by createdAt descending", () => {
    const filePath1 = createDraft(
      "First Draft",
      "Content 1",
      { topic: "alpha" },
      TEST_DIR,
    );
    const filePath2 = createDraft(
      "Second Draft",
      "Content 2",
      { topic: "beta" },
      TEST_DIR,
    );

    const drafts = listDrafts(TEST_DIR);

    expect(drafts.length).toBeGreaterThanOrEqual(2);

    const found1 = drafts.find((d) => d.title === "First Draft");
    const found2 = drafts.find((d) => d.title === "Second Draft");

    expect(found1).toBeDefined();
    expect(found2).toBeDefined();
    expect(found1!.path).toBe(filePath1);
    expect(found2!.path).toBe(filePath2);

    expect(drafts[0].createdAt.localeCompare(drafts[1].createdAt)).toBeGreaterThanOrEqual(0);
  });

  test("listDrafts with status filter returns only matching drafts", () => {
    createDraft(
      "Approved Draft",
      "Approved content",
      { topic: "filter", status: "approved" },
      TEST_DIR,
    );
    createDraft(
      "Draft Draft",
      "Draft content",
      { topic: "filter", status: "draft" },
      TEST_DIR,
    );

    const approvedDrafts = listDrafts(TEST_DIR, { status: "approved" });
    const draftStatusDrafts = listDrafts(TEST_DIR, { status: "draft" });

    expect(approvedDrafts.length).toBeGreaterThanOrEqual(1);
    expect(draftStatusDrafts.length).toBeGreaterThanOrEqual(1);
    expect(approvedDrafts.every((d) => d.status === "approved")).toBe(true);
    expect(draftStatusDrafts.every((d) => d.status === "draft")).toBe(true);
  });

  test("deleteDraft removes the file", () => {
    const filePath = createDraft(
      "Delete Test",
      "To be deleted",
      { topic: "deletion" },
      TEST_DIR,
    );

    expect(existsSync(filePath)).toBe(true);

    deleteDraft(filePath);

    expect(existsSync(filePath)).toBe(false);
  });

  test("readDraft with non-existent file throws clear error", () => {
    const fakePath = join(TEST_DIR, "non-existent-draft.md");

    expect(() => readDraft(fakePath)).toThrow(/Draft not found/);
  });
});
