import { describe, expect, test, beforeEach, afterAll } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync, realpathSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  loadConfig,
  saveConfig,
  validateConfig,
  getConfigPath,
  setConfigPath,
} from "../loader";
import { DEFAULT_CONFIG } from "../defaults";
import type { AppConfig } from "../schema";

const tempDirs: string[] = [];

function useTempConfig(): string {
  const dir = mkdtempSync(join(realpathSync(tmpdir()), "linkedin-content-tool-test-"));
  tempDirs.push(dir);
  return join(dir, "config.json");
}

describe("loadConfig", () => {
  let origPath: string;

  beforeEach(() => {
    origPath = getConfigPath();
  });

  afterAll(() => {
    for (const d of tempDirs) {
      try {
        rmSync(d, { recursive: true });
      } catch {
        // ignore cleanup errors
      }
    }
  });

  test("returns defaults when no config file exists", () => {
    setConfigPath(useTempConfig());
    expect(existsSync(getConfigPath())).toBe(false);

    const config = loadConfig();
    expect(config).toEqual(DEFAULT_CONFIG);
    setConfigPath(origPath);
  });

  test("merges file values with defaults", () => {
    setConfigPath(useTempConfig());
    const partial = {
      timezone: "Asia/Jakarta",
      linkedin: { clientId: "test-client" },
    };
    writeFileSync(getConfigPath(), JSON.stringify(partial), "utf-8");

    const config = loadConfig();
    expect(config.timezone).toBe("Asia/Jakarta");
    expect(config.linkedin.clientId).toBe("test-client");
    // defaults preserved
    expect(config.linkedin.clientSecret).toBe(DEFAULT_CONFIG.linkedin.clientSecret);
    expect(config.linkedin.apiVersion).toBe(DEFAULT_CONFIG.linkedin.apiVersion);
    expect(config.content.draftsDir).toBe(DEFAULT_CONFIG.content.draftsDir);
    setConfigPath(origPath);
  });

  test("applies overrides on top of file values", () => {
    setConfigPath(useTempConfig());
    const fileConfig = {
      timezone: "America/New_York",
      content: { maxPostLength: 5000 },
    };
    writeFileSync(getConfigPath(), JSON.stringify(fileConfig), "utf-8");

    const config = loadConfig({ timezone: "Asia/Jakarta" });
    expect(config.timezone).toBe("Asia/Jakarta");
    expect(config.content.maxPostLength).toBe(5000); // from file
    setConfigPath(origPath);
  });

  test("applies overrides when no config file exists", () => {
    setConfigPath(useTempConfig());
    expect(existsSync(getConfigPath())).toBe(false);

    const config = loadConfig({ timezone: "Europe/London" });
    expect(config.timezone).toBe("Europe/London");
    expect(config.linkedin.clientId).toBe(DEFAULT_CONFIG.linkedin.clientId);
    setConfigPath(origPath);
  });
});

describe("saveConfig + loadConfig roundtrip", () => {
  let origPath: string;

  beforeEach(() => {
    origPath = getConfigPath();
    setConfigPath(useTempConfig());
  });

  afterAll(() => {
    setConfigPath(origPath);
  });

  test("roundtrip preserves data", () => {
    const config: AppConfig = {
      ...DEFAULT_CONFIG,
      timezone: "Asia/Jakarta",
      linkedin: {
        ...DEFAULT_CONFIG.linkedin,
        clientId: "roundtrip-client",
        clientSecret: "roundtrip-secret",
      },
      content: {
        ...DEFAULT_CONFIG.content,
        maxPostLength: 4000,
      },
    };

    saveConfig(config);
    expect(existsSync(getConfigPath())).toBe(true);

    const loaded = loadConfig();
    expect(loaded).toEqual(config);
  });
});

describe("validateConfig", () => {
  test("accepts valid config", () => {
    const valid: AppConfig = {
      timezone: "Asia/Jakarta",
      linkedin: {
        clientId: "abc123",
        clientSecret: "secret123",
        redirectUri: "http://localhost:3000/callback",
        apiVersion: "202605",
      },
      ai: {
        provider: "opencode-go",
        apiKey: "key-123",
        apiEndpoint: "https://api.example.com",
        model: "claude-sonnet-4",
        humanizationPasses: 2,
      },
      content: {
        draftsDir: "content/drafts",
        voiceProfilesDir: "content/voice-profiles",
        defaultVoiceProfile: "default",
        maxPostLength: 3000,
        maxCommentLength: 1250,
      },
      scheduler: {
        enabled: true,
        checkIntervalMinutes: 10,
        minGapMinutes: 5,
      },
    };
    expect(validateConfig(valid)).toBe(true);
  });

  test("rejects null / non-object", () => {
    expect(validateConfig(null)).toBe(false);
    expect(validateConfig(undefined)).toBe(false);
    expect(validateConfig("string")).toBe(false);
    expect(validateConfig(42)).toBe(false);
  });

  test("rejects missing linkedin.clientId", () => {
    const invalid = {
      ...DEFAULT_CONFIG,
      linkedin: { ...DEFAULT_CONFIG.linkedin, clientId: "" },
    };
    expect(validateConfig(invalid)).toBe(false);
  });

  test("rejects missing linkedin.clientSecret", () => {
    const invalid = {
      ...DEFAULT_CONFIG,
      linkedin: { ...DEFAULT_CONFIG.linkedin, clientSecret: "" },
    };
    expect(validateConfig(invalid)).toBe(false);
  });

  test("rejects invalid linkedin.apiVersion format", () => {
    const invalid = {
      ...DEFAULT_CONFIG,
      linkedin: { ...DEFAULT_CONFIG.linkedin, apiVersion: "20260" },
    };
    expect(validateConfig(invalid)).toBe(false);
  });

  test("rejects wrong ai.provider", () => {
    const invalid = {
      ...DEFAULT_CONFIG,
      ai: { ...DEFAULT_CONFIG.ai, provider: "openai" },
    };
    expect(validateConfig(invalid)).toBe(false);
  });

  test("rejects ai.humanizationPasses out of range", () => {
    const tooLow = {
      ...DEFAULT_CONFIG,
      ai: { ...DEFAULT_CONFIG.ai, humanizationPasses: 0 },
    };
    expect(validateConfig(tooLow)).toBe(false);

    const tooHigh = {
      ...DEFAULT_CONFIG,
      ai: { ...DEFAULT_CONFIG.ai, humanizationPasses: 5 },
    };
    expect(validateConfig(tooHigh)).toBe(false);
  });

  test("rejects non-positive content lengths", () => {
    const zeroPost = {
      ...DEFAULT_CONFIG,
      content: { ...DEFAULT_CONFIG.content, maxPostLength: 0 },
    };
    expect(validateConfig(zeroPost)).toBe(false);

    const negativeComment = {
      ...DEFAULT_CONFIG,
      content: { ...DEFAULT_CONFIG.content, maxCommentLength: -1 },
    };
    expect(validateConfig(negativeComment)).toBe(false);
  });

  test("rejects scheduler.checkIntervalMinutes < 1", () => {
    const invalid = {
      ...DEFAULT_CONFIG,
      scheduler: { ...DEFAULT_CONFIG.scheduler, checkIntervalMinutes: 0 },
    };
    expect(validateConfig(invalid)).toBe(false);
  });

  test("rejects scheduler.minGapMinutes < 0", () => {
    const invalid = {
      ...DEFAULT_CONFIG,
      scheduler: { ...DEFAULT_CONFIG.scheduler, minGapMinutes: -1 },
    };
    expect(validateConfig(invalid)).toBe(false);
  });

  test("rejects empty timezone", () => {
    const invalid = { ...DEFAULT_CONFIG, timezone: "" };
    expect(validateConfig(invalid)).toBe(false);
  });
});

describe("validateConfig edge cases", () => {
  test("accepts valid config with optional fields missing", () => {
    const minimal = {
      ...DEFAULT_CONFIG,
      linkedin: {
        clientId: "c",
        clientSecret: "s",
        redirectUri: "http://localhost:3000/callback",
        apiVersion: "202605",
      },
    };
    expect(validateConfig(minimal)).toBe(true);
  });
});
