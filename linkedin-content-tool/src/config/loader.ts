import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { AppConfig } from "./schema";
import { DEFAULT_CONFIG } from "./defaults";

/** Path to the config file. Override for testing. */
let _configPath = join(process.cwd(), "config.json");

/** Get the current config file path. */
export function getConfigPath(): string {
  return _configPath;
}

/** Override the config file path (for testing). */
export function setConfigPath(path: string): void {
  _configPath = path;
}

/**
 * Deep merge a partial config into the defaults.
 * Only plain objects are merged recursively; all other values overwrite.
 */
function mergeDefaults(config: Partial<AppConfig>): AppConfig {
  const merged: AppConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

  for (const key of Object.keys(config) as (keyof AppConfig)[]) {
    const val = config[key];
    if (val === undefined) continue;

    if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      Object.assign(merged[key] as any, val);
    } else {
      (merged as any)[key] = val;
    }
  }

  return merged;
}

export function loadConfig(overrides?: Partial<AppConfig>): AppConfig {
  let config: AppConfig;

  if (existsSync(_configPath)) {
    const raw = readFileSync(_configPath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    config = mergeDefaults(parsed);
  } else {
    config = { ...DEFAULT_CONFIG };
  }

  if (overrides) {
    config = mergeOverrides(config, overrides);
  }

  return config;
}

/**
 * Apply top-level overrides to an already-resolved config.
 * Sub-objects are shallow-merged.
 */
function mergeOverrides(base: AppConfig, overrides: Partial<AppConfig>): AppConfig {
  const result = { ...base };

  for (const key of Object.keys(overrides) as (keyof AppConfig)[]) {
    const val = overrides[key];
    if (val === undefined) continue;

    if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      (result as any)[key] = { ...(result as any)[key], ...val };
    } else {
      (result as any)[key] = val;
    }
  }

  return result;
}

export function saveConfig(config: AppConfig): void {
  writeFileSync(_configPath, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Runtime type guard. Validates that the provided value conforms to AppConfig.
 * Returns `true` if valid, `false` otherwise.
 */
export function validateConfig(config: unknown): config is AppConfig {
  if (typeof config !== "object" || config === null) return false;

  const c = config as Record<string, unknown>;

  // timezone
  if (typeof c.timezone !== "string" || c.timezone.length === 0) return false;

  // linkedin
  if (typeof c.linkedin !== "object" || c.linkedin === null) return false;
  const li = c.linkedin as Record<string, unknown>;
  if (typeof li.clientId !== "string" || li.clientId.length === 0) return false;
  if (typeof li.clientSecret !== "string" || li.clientSecret.length === 0) return false;
  if (typeof li.apiVersion !== "string" || !/^\d{6}$/.test(li.apiVersion)) return false;

  // ai
  if (typeof c.ai !== "object" || c.ai === null) return false;
  const ai = c.ai as Record<string, unknown>;
  if (ai.provider !== "opencode-go") return false;
  if (typeof ai.humanizationPasses !== "number" || ai.humanizationPasses < 1 || ai.humanizationPasses > 4) return false;

  // content
  if (typeof c.content !== "object" || c.content === null) return false;
  const ct = c.content as Record<string, unknown>;
  if (typeof ct.maxPostLength !== "number" || ct.maxPostLength <= 0) return false;
  if (typeof ct.maxCommentLength !== "number" || ct.maxCommentLength <= 0) return false;

  // scheduler
  if (typeof c.scheduler !== "object" || c.scheduler === null) return false;
  const sc = c.scheduler as Record<string, unknown>;
  if (typeof sc.checkIntervalMinutes !== "number" || sc.checkIntervalMinutes < 1) return false;
  if (typeof sc.minGapMinutes !== "number" || sc.minGapMinutes < 0) return false;

  return true;
}
