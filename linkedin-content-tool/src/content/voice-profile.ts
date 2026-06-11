import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { VoiceProfile } from "./voice-profile-schema";
import { parseYaml, stringifyYaml } from "../utils/yaml";

/**
 * Loads a voice profile YAML file and validates its schema.
 *
 * @param name - Profile name (without .yaml extension).
 * @param dir  - Directory containing voice profile YAML files.
 * @returns    - Validated VoiceProfile object.
 * @throws     - If the file does not exist or validation fails.
 */
export function loadVoiceProfile(name: string, dir: string): VoiceProfile {
  const filePath = join(dir, `${name}.yaml`);

  if (!existsSync(filePath)) {
    throw new Error(
      `Voice profile not found: ${filePath}\n` +
        `Create one with createDefaultVoiceProfile("${dir}") first.`
    );
  }

  const raw = readFileSync(filePath, "utf-8");
  const parsed = parseYaml(raw);

  if (!validateVoiceProfile(parsed)) {
    const errors: string[] = [];

    if (typeof parsed !== "object" || parsed === null) {
      errors.push("Root value must be an object");
    } else {
      const p = parsed as Record<string, unknown>;
      if (typeof p.name !== "string" || p.name.length === 0) {
        errors.push("name: required string");
      }
      if (typeof p.sentenceRhythm !== "string" || p.sentenceRhythm.length === 0) {
        errors.push("sentenceRhythm: required string");
      }
      if (typeof p.openerPattern !== "string" || p.openerPattern.length === 0) {
        errors.push("openerPattern: required string");
      }
      if (!Array.isArray(p.bannedPhrases)) {
        errors.push("bannedPhrases: required array");
      }
      if (typeof p.closingStyle !== "string" || p.closingStyle.length === 0) {
        errors.push("closingStyle: required string");
      }
      if (typeof p.contractionFrequency !== "string" || p.contractionFrequency.length === 0) {
        errors.push("contractionFrequency: required string");
      }
      if (!Array.isArray(p.examples) || p.examples.length === 0) {
        errors.push("examples: required non-empty array");
      }
    }

    throw new Error(
      `Invalid voice profile in ${filePath}:\n  - ${errors.join("\n  - ")}`
    );
  }

  return parsed;
}

/**
 * Runtime type guard for VoiceProfile.
 * Returns true if the provided value conforms to the VoiceProfile interface.
 */
export function validateVoiceProfile(data: unknown): data is VoiceProfile {
  if (typeof data !== "object" || data === null) return false;

  const p = data as Record<string, unknown>;

  if (typeof p.name !== "string" || p.name.length === 0) return false;
  if (typeof p.sentenceRhythm !== "string" || p.sentenceRhythm.length === 0) return false;
  if (typeof p.openerPattern !== "string" || p.openerPattern.length === 0) return false;
  if (!Array.isArray(p.bannedPhrases)) return false;
  if (typeof p.closingStyle !== "string" || p.closingStyle.length === 0) return false;
  if (typeof p.contractionFrequency !== "string" || p.contractionFrequency.length === 0) return false;
  if (!Array.isArray(p.examples) || p.examples.length === 0) return false;

  if (p.metaphorDomain !== undefined && typeof p.metaphorDomain !== "string") return false;
  if (p.signatureMove !== undefined && typeof p.signatureMove !== "string") return false;

  return true;
}

/**
 * Creates the default voice profile YAML file in the given directory.
 * Creates the directory if it does not exist. Does not overwrite.
 */
export function createDefaultVoiceProfile(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const filePath = join(dir, "default.yaml");

  if (existsSync(filePath)) {
    return;
  }

  const defaults: VoiceProfile = {
    name: "Default",
    sentenceRhythm: "mixed",
    openerPattern: "statement",
    bannedPhrases: [],
    closingStyle: "specific_question",
    contractionFrequency: "moderate",
    examples: [
      "Most companies get this wrong.",
      "Here's what actually works.",
      "The data tells a different story.",
    ],
  };

  writeFileSync(filePath, stringifyYaml(defaults as unknown as Record<string, unknown>), "utf-8");
}
