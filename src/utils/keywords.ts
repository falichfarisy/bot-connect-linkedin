import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { TechRole } from "../types/roles.ts";
import type { SearchProfile } from "../types/roles.ts";

const TECH_ROLES_KEYWORDS_DIR = resolve(process.cwd(), "keywords");

let _techRoleKeywords: Record<TechRole, string[]> | null = null;

/**
 * Load role-specific keywords from keywords/tech-roles.txt.
 * Falls back to empty arrays if file not found.
 */
export function loadTechRoleKeywords(): Record<TechRole, string[]> {
  if (_techRoleKeywords) return _techRoleKeywords;

  const roleMap: Record<string, TechRole> = {
    "tech lead": TechRole.TechLead,
    "software engineer": TechRole.SoftwareEngineer,
    "frontend engineer": TechRole.FrontendEngineer,
  };

  const keywords: Record<TechRole, string[]> = {
    [TechRole.TechLead]: [],
    [TechRole.SoftwareEngineer]: [],
    [TechRole.FrontendEngineer]: [],
  };

  const filePath = resolve(TECH_ROLES_KEYWORDS_DIR, "tech-roles.txt");
  if (!existsSync(filePath)) {
    console.warn("   File tech-roles.txt tidak ditemukan, pakai default internal.");
    _techRoleKeywords = keywords;
    return keywords;
  }

  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    let currentRole: TechRole | null = null;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      const sectionMatch = line.match(/^# ── (.+) ──$/);
      if (sectionMatch && sectionMatch[1]) {
        const sectionName = sectionMatch[1].toLowerCase();
        currentRole = roleMap[sectionName] || null;
        continue;
      }

      if (line.startsWith("#")) continue;

      if (currentRole && line.length > 0) {
        keywords[currentRole].push(line.toLowerCase());
      }
    }

    _techRoleKeywords = keywords;
    return keywords;
  } catch (err) {
    console.warn(`   Gagal baca tech-roles.txt: ${err}`);
    _techRoleKeywords = keywords;
    return keywords;
  }
}

export function matchKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

export function detectTechRole(headline: string): TechRole | null {
  const keywords = loadTechRoleKeywords();
  const lower = headline.toLowerCase();

  if (matchKeywords(lower, keywords[TechRole.TechLead])) return TechRole.TechLead;
  if (matchKeywords(lower, keywords[TechRole.SoftwareEngineer])) return TechRole.SoftwareEngineer;
  if (matchKeywords(lower, keywords[TechRole.FrontendEngineer])) return TechRole.FrontendEngineer;

  return null;
}

export function sortByPriority(profiles: SearchProfile[]): SearchProfile[] {
  const priorityOrder: Record<string, number> = {
    [TechRole.TechLead]: 1,
    [TechRole.SoftwareEngineer]: 2,
    [TechRole.FrontendEngineer]: 3,
  };

  return [...profiles].sort((a, b) => {
    const pa = a.role ? (priorityOrder[a.role] ?? 99) : 99;
    const pb = b.role ? (priorityOrder[b.role] ?? 99) : 99;
    return pa - pb;
  });
}
