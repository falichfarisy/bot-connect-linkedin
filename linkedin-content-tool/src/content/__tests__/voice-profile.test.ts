import { describe, expect, test, beforeEach, afterAll } from "bun:test";
import {
  existsSync,
  mkdtempSync,
  rmSync,
  readFileSync,
  writeFileSync,
  realpathSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  loadVoiceProfile,
  validateVoiceProfile,
  createDefaultVoiceProfile,
} from "../voice-profile";
import type { VoiceProfile } from "../voice-profile-schema";

const tempDirs: string[] = [];

function useTempDir(): string {
  const dir = mkdtempSync(
    join(realpathSync(tmpdir()), "voice-profile-test-")
  );
  tempDirs.push(dir);
  return dir;
}

const validProfile: VoiceProfile = {
  name: "Test Profile",
  sentenceRhythm: "short-long-short",
  openerPattern: "contrarian_statement",
  metaphorDomain: "fitness",
  bannedPhrases: ["game-changer", "crushing it"],
  signatureMove: "inverts_conventional_wisdom",
  closingStyle: "specific_question",
  contractionFrequency: "frequent",
  examples: [
    "Most founders get this wrong.",
    "Here's what nobody tells you.",
    "The data says otherwise.",
  ],
};

const validYaml = `name: "Test Profile"
sentenceRhythm: "short-long-short"
openerPattern: "contrarian_statement"
metaphorDomain: "fitness"
bannedPhrases:
  - "game-changer"
  - "crushing it"
signatureMove: "inverts_conventional_wisdom"
closingStyle: "specific_question"
contractionFrequency: "frequent"
examples:
  - "Most founders get this wrong."
  - "Here's what nobody tells you."
  - "The data says otherwise."
`;

describe("validateVoiceProfile", () => {
  test("returns true for valid VoiceProfile", () => {
    expect(validateVoiceProfile(validProfile)).toBe(true);
  });

  test("returns true for valid profile without optional fields", () => {
    const minimal: VoiceProfile = {
      name: "Minimal",
      sentenceRhythm: "mixed",
      openerPattern: "statement",
      bannedPhrases: [],
      closingStyle: "question",
      contractionFrequency: "moderate",
      examples: ["Just an example."],
    };
    expect(validateVoiceProfile(minimal)).toBe(true);
  });

  test("rejects null / undefined", () => {
    expect(validateVoiceProfile(null)).toBe(false);
    expect(validateVoiceProfile(undefined)).toBe(false);
  });

  test("rejects non-object", () => {
    expect(validateVoiceProfile("string")).toBe(false);
    expect(validateVoiceProfile(42)).toBe(false);
    expect(validateVoiceProfile([])).toBe(false);
  });

  test("rejects missing required fields", () => {
    const noName = { ...validProfile, name: "" };
    expect(validateVoiceProfile(noName)).toBe(false);

    const noRhythm = { ...validProfile, sentenceRhythm: "" };
    expect(validateVoiceProfile(noRhythm)).toBe(false);

    const noOpener = { ...validProfile, openerPattern: "" };
    expect(validateVoiceProfile(noOpener)).toBe(false);

    const noBanned = { ...validProfile, bannedPhrases: "not-an-array" };
    expect(validateVoiceProfile(noBanned)).toBe(false);

    const noClosing = { ...validProfile, closingStyle: "" };
    expect(validateVoiceProfile(noClosing)).toBe(false);

    const noContraction = { ...validProfile, contractionFrequency: "" };
    expect(validateVoiceProfile(noContraction)).toBe(false);

    const emptyExamples = { ...validProfile, examples: [] };
    expect(validateVoiceProfile(emptyExamples)).toBe(false);
  });

  test("rejects optional fields with wrong type", () => {
    const badMetaphor = { ...validProfile, metaphorDomain: 123 };
    expect(validateVoiceProfile(badMetaphor)).toBe(false);

    const badSignature = { ...validProfile, signatureMove: true };
    expect(validateVoiceProfile(badSignature)).toBe(false);
  });
});

describe("loadVoiceProfile", () => {
  let dir: string;

  beforeEach(() => {
    dir = useTempDir();
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

  test("parses YAML and returns valid VoiceProfile", () => {
    writeFileSync(join(dir, "test.yaml"), validYaml, "utf-8");
    const profile = loadVoiceProfile("test", dir);

    expect(profile.name).toBe("Test Profile");
    expect(profile.sentenceRhythm).toBe("short-long-short");
    expect(profile.openerPattern).toBe("contrarian_statement");
    expect(profile.metaphorDomain).toBe("fitness");
    expect(profile.bannedPhrases).toEqual(["game-changer", "crushing it"]);
    expect(profile.signatureMove).toBe("inverts_conventional_wisdom");
    expect(profile.closingStyle).toBe("specific_question");
    expect(profile.contractionFrequency).toBe("frequent");
    expect(profile.examples).toHaveLength(3);
  });

  test("throws clear error for missing file", () => {
    expect(() => loadVoiceProfile("nonexistent", dir)).toThrow(
      /Voice profile not found/
    );
  });

  test("throws clear error for invalid YAML content", () => {
    writeFileSync(join(dir, "bad.yaml"), "name: 42\nsentenceRhythm: 123", "utf-8");
    expect(() => loadVoiceProfile("bad", dir)).toThrow(/Invalid voice profile/);
  });
});

describe("createDefaultVoiceProfile", () => {
  let dir: string;

  beforeEach(() => {
    dir = useTempDir();
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

  test("creates default.yaml in given directory", () => {
    createDefaultVoiceProfile(dir);

    const filePath = join(dir, "default.yaml");
    expect(existsSync(filePath)).toBe(true);

    const profile = loadVoiceProfile("default", dir);
    expect(profile.name).toBe("Default");
    expect(profile.examples).toHaveLength(3);
  });

  test("creates directory if it does not exist", () => {
    const nestedDir = join(dir, "sub", "profiles");
    createDefaultVoiceProfile(nestedDir);

    const filePath = join(nestedDir, "default.yaml");
    expect(existsSync(filePath)).toBe(true);
  });

  test("does not overwrite existing default.yaml", () => {
    createDefaultVoiceProfile(dir);

    const filePath = join(dir, "default.yaml");
    writeFileSync(filePath, "name: Modified", "utf-8");

    createDefaultVoiceProfile(dir);

    const content = readFileSync(filePath, "utf-8");
    expect(content).toBe("name: Modified");
  });
});
