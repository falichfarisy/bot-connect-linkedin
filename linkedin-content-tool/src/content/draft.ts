import { readFileSync, writeFileSync, unlinkSync, readdirSync, existsSync, mkdirSync } from "fs";
import { join, parse } from "path";
import matter from "gray-matter";
import type { DraftMetadata, DraftSummary } from "./types";

const DEFAULT_DRAFTS_DIR = "content/drafts";

let _idCounter = 0;

function generateDraftId(): string {
  const now = new Date();
  const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, "");
  const hhmmss = now.toISOString().slice(11, 19).replace(/:/g, "");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  const seq = String(++_idCounter).padStart(3, "0");
  return `draft-${yyyymmdd}-${hhmmss}${ms}-${seq}`;
}

function toISOString(date: Date): string {
  return date.toISOString();
}

export function createDraft(
  title: string,
  content: string,
  metadata: Partial<DraftMetadata>,
  draftsDir?: string,
): string {
  const dir = draftsDir ?? DEFAULT_DRAFTS_DIR;
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const id = generateDraftId();
  const now = toISOString(new Date());

  const frontmatter: DraftMetadata = {
    title,
    status: "draft",
    topic: "",
    voiceProfile: "default",
    aiModel: "",
    humanizationPasses: 0,
    ...metadata,
    id,
    createdAt: now,
    updatedAt: now,
  };

  const fileContent = matter.stringify(content, frontmatter);
  const filePath = join(dir, `${id}.md`);
  writeFileSync(filePath, fileContent, "utf-8");
  return filePath;
}

export function readDraft(path: string): { content: string; metadata: DraftMetadata } {
  if (!existsSync(path)) {
    throw new Error(`Draft not found: ${path}`);
  }

  const raw = readFileSync(path, "utf-8");
  const parsed = matter(raw);

  return {
    content: parsed.content.trim(),
    metadata: parsed.data as DraftMetadata,
  };
}

export function updateDraft(
  path: string,
  content: string,
  metadata: Partial<DraftMetadata>,
): void {
  if (!existsSync(path)) {
    throw new Error(`Draft not found: ${path}`);
  }

  const raw = readFileSync(path, "utf-8");
  const parsed = matter(raw);
  const existingData = parsed.data as DraftMetadata;

  const updatedMetadata: DraftMetadata = {
    ...existingData,
    ...metadata,
    updatedAt: toISOString(new Date()),
  };

  const fileContent = matter.stringify(content, updatedMetadata);
  writeFileSync(path, fileContent, "utf-8");
}

export function deleteDraft(path: string): void {
  if (!existsSync(path)) {
    throw new Error(`Draft not found: ${path}`);
  }
  unlinkSync(path);
}

export function listDrafts(
  dir: string,
  filter?: { status?: string },
): DraftSummary[] {
  if (!existsSync(dir)) {
    return [];
  }

  const entries = readdirSync(dir, { withFileTypes: true });
  const drafts: DraftSummary[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }

    const filePath = join(dir, entry.name);

    try {
      const raw = readFileSync(filePath, "utf-8");
      const parsed = matter(raw);
      const data = parsed.data as Partial<DraftMetadata>;

      if (!data.id || !data.title) {
        continue;
      }

      const summary: DraftSummary = {
        path: filePath,
        id: data.id,
        title: data.title,
        status: data.status ?? "unknown",
        topic: data.topic ?? "",
        scheduledAt: data.scheduledAt,
        createdAt: data.createdAt ?? "",
      };

      if (filter?.status && summary.status !== filter.status) {
        continue;
      }

      drafts.push(summary);
    } catch {
      // Skip files that can't be parsed
      continue;
    }
  }

  // Sort by createdAt descending (most recent first)
  drafts.sort((a, b) => {
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return b.createdAt.localeCompare(a.createdAt);
  });

  return drafts;
}
