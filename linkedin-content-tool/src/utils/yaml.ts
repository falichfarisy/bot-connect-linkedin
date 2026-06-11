/**
 * Minimal YAML parser/stringifier for flat objects with array support only.
 *
 * Handles the subset of YAML used by voice profiles:
 * - Top-level key: scalar_value pairs
 * - Array values as `key:` followed by `  - "item"` lines
 * - Comments (# ...)
 * - No nested objects, multi-line strings, or anchors/aliases
 */

export function parseYaml(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let currentKey: string | null = null;

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    const listMatch = trimmed.match(/^-\s+(.+)/);
    if (listMatch && currentKey) {
      const arr = result[currentKey];
      if (!Array.isArray(arr)) {
        result[currentKey] = [];
      }
      (result[currentKey] as unknown[]).push(parseScalar(listMatch[1].trim()));
      continue;
    }

    const kvMatch = trimmed.match(/^(\w+):\s*(.*)/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      const val = kvMatch[2].trim();
      if (val === "[]") {
        result[currentKey] = [];
      } else if (val !== "" && val !== "null") {
        result[currentKey] = parseScalar(val);
      }
    }
  }

  return result;
}

export function stringifyYaml(obj: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - "${String(item)}"`);
        }
      }
    } else {
      lines.push(`${key}: ${String(value)}`);
    }
  }
  return lines.join("\n") + "\n";
}

function parseScalar(val: string): string | number | boolean {
  const unquoted = val.replace(/^["']|["']$/g, "");
  if (unquoted === "true") return true;
  if (unquoted === "false") return false;
  if (/^\d+$/.test(unquoted)) return parseInt(unquoted, 10);
  if (/^\d+\.\d+$/.test(unquoted)) return parseFloat(unquoted);
  return unquoted;
}
