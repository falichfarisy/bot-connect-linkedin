import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import matter from "gray-matter";
import { generateDraft } from "../drafter";
import { AIProvider } from "../../ai/provider";
import { Draft, DraftOptions } from "../../ai/types";
import { AppConfig } from "../../config/schema";

const TEST_DIR = join(import.meta.dirname, "..", "..", "..", "tmp-test-drafter");
const DRAFTS_DIR = join(TEST_DIR, "drafts");
const VOICE_PROFILES_DIR = join(TEST_DIR, "voice-profiles");

const TEST_CONFIG: AppConfig = {
  timezone: "UTC",
  linkedin: {
    clientId: "",
    clientSecret: "",
    redirectUri: "http://localhost:3000/callback",
    apiVersion: "202605",
  },
  ai: {
    provider: "opencode-go",
    apiKey: "",
    apiEndpoint: "https://api.test.com",
    model: "test-model",
    humanizationPasses: 2,
  },
  content: {
    draftsDir: DRAFTS_DIR,
    voiceProfilesDir: VOICE_PROFILES_DIR,
    defaultVoiceProfile: "default",
    maxPostLength: 3000,
    maxCommentLength: 1250,
  },
  scheduler: {
    enabled: false,
    checkIntervalMinutes: 5,
    minGapMinutes: 5,
  },
};

const DEFAULT_VOICE_PROFILE = `name: Default
sentenceRhythm: mixed
openerPattern: statement
bannedPhrases: []
closingStyle: specific_question
contractionFrequency: moderate
examples:
  - "Most companies get this wrong."
  - "Here's what actually works."
`;

class CleanMockProvider implements AIProvider {
  constructor(private content: string) {}
  async generateDraft(): Promise<Draft> {
    return {
      content: this.content,
      metadata: {
        topic: "test",
        angle: "general",
        wordCount: this.content.split(/\s+/).length,
        charCount: this.content.length,
        hook: this.content.slice(0, 200),
        aiModel: "mock",
        humanizationPasses: 0,
      },
    };
  }
  async refineDraft(draft: string, feedback: string): Promise<string> {
    return draft;
  }
}

class SlopThenCleanMockProvider implements AIProvider {
  constructor(private slopContent: string, private cleanContent: string) {}
  async generateDraft(): Promise<Draft> {
    return {
      content: this.slopContent,
      metadata: {
        topic: "test",
        angle: "general",
        wordCount: this.slopContent.split(/\s+/).length,
        charCount: this.slopContent.length,
        hook: this.slopContent.slice(0, 200),
        aiModel: "mock",
        humanizationPasses: 0,
      },
    };
  }
  async refineDraft(draft: string, feedback: string): Promise<string> {
    return this.cleanContent;
  }
}

beforeAll(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
  mkdirSync(DRAFTS_DIR, { recursive: true });
  mkdirSync(VOICE_PROFILES_DIR, { recursive: true });
  writeFileSync(join(VOICE_PROFILES_DIR, "default.yaml"), DEFAULT_VOICE_PROFILE, "utf-8");
});

afterAll(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("generateDraft", () => {
  test("produces valid markdown with frontmatter", async () => {
    const content = "This is a clean draft about testing.";
    const provider = new CleanMockProvider(content);
    const options: DraftOptions = { topic: "testing" };

    const result = await generateDraft(options, TEST_CONFIG, provider);

    expect(existsSync(result.path)).toBe(true);
    expect(result.path).toContain(DRAFTS_DIR);
    expect(result.content).toBe(content);
    expect(result.metadata.topic).toBe("testing");
    expect(result.metadata.status).toBe("draft");
    expect(result.antiSlopCheck.passes).toBe(true);
    expect(result.humanizationPasses).toBe(0);

    const raw = readFileSync(result.path, "utf-8");
    const parsed = matter(raw);
    expect(parsed.data.topic).toBe("testing");
    expect(parsed.content.trim()).toBe(content);
  });

  test("enforces character limit", async () => {
    const longContent = "a".repeat(3500);
    const provider = new CleanMockProvider(longContent);
    const options: DraftOptions = { topic: "long post" };

    const result = await generateDraft(options, TEST_CONFIG, provider);

    expect(result.content.length).toBeLessThanOrEqual(TEST_CONFIG.content.maxPostLength);
    expect(result.content.length).toBe(3000);
  });

  test("runs anti-slop check", async () => {
    const content = "I enjoy writing concise, natural content for my audience.";
    const provider = new CleanMockProvider(content);
    const options: DraftOptions = { topic: "clean writing" };

    const result = await generateDraft(options, TEST_CONFIG, provider);

    expect(result.antiSlopCheck.passes).toBe(true);
    expect(result.antiSlopCheck.matches).toHaveLength(0);
  });

  test("refines draft when anti-slop fails", async () => {
    const slopContent = "We should leverage this cutting-edge technology.";
    const cleanContent = "We should use this advanced technology.";
    const provider = new SlopThenCleanMockProvider(slopContent, cleanContent);
    const options: DraftOptions = { topic: "tech" };

    const result = await generateDraft(options, TEST_CONFIG, provider);

    expect(result.humanizationPasses).toBeGreaterThan(0);
    expect(result.antiSlopCheck.passes).toBe(true);
    expect(result.content).toBe(cleanContent);
  });

  test("extracts hook correctly", async () => {
    const hookText = "The first two hundred characters of this draft should serve as the hook for the entire post.";
    const content = hookText + " More content here.";
    const provider = new CleanMockProvider(content);
    const options: DraftOptions = { topic: "hooks" };

    const result = await generateDraft(options, TEST_CONFIG, provider);

    expect(result.content.slice(0, 200)).toBe(content.slice(0, 200));
  });

  test("respects maxPostLength from config", async () => {
    const shortConfig: AppConfig = {
      ...TEST_CONFIG,
      content: {
        ...TEST_CONFIG.content,
        maxPostLength: 100,
      },
    };
    const longContent = "b".repeat(500);
    const provider = new CleanMockProvider(longContent);
    const options: DraftOptions = { topic: "short post" };

    const result = await generateDraft(options, shortConfig, provider);

    expect(result.content.length).toBeLessThanOrEqual(100);
  });
});
