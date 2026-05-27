import type { Page, ElementHandle } from "puppeteer";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { TechRole, type SearchProfile, type TechRoleOptions, ROLE_CONFIGS, GEO_IDS } from "./types.ts";
import { searchRoleProfiles, clickConnectOnSearch, clickFollowOnSearch } from "./search.ts";

export interface ConnectOptions {
  maxPerSession: number;
  delayMinMs: number;
  delayMaxMs: number;
  maxScrolls: number;
  /** Hanya kirim koneksi ke profil dengan kata kunci HR (HR IT filter). */
  hrFilter?: boolean;
  /** Maksimal refresh halaman kalau semua profil di-filter (default 10). */
  maxRefreshes?: number;
}

export interface ConnectResult {
  sent: number;
  skipped: number;
  errors: number;
  limitReached: boolean;
  stopped: boolean;
}

const DEFAULTS: ConnectOptions = {
  maxPerSession: 50,
  delayMinMs: 30000,
  delayMaxMs: 90000,
  maxScrolls: 30,
  hrFilter: false,
  maxRefreshes: 10,
};

/**
 * Load keywords from a text file in the keywords/ directory.
 * Format: satu keyword per baris, baris # adalah komentar, baris kosong dilewati.
 * Fallback ke array default jika file tidak ditemukan.
 */
const KEYWORDS_DIR = resolve(process.cwd(), "keywords");

function loadKeywordsFile(
  fileName: string,
  fallback: string[]
): string[] {
  const filePath = resolve(KEYWORDS_DIR, fileName);
  if (!existsSync(filePath)) {
    console.warn(`   File ${fileName} tidak ditemukan di keywords/, pakai default.`);
    return fallback;
  }
  try {
    const content = readFileSync(filePath, "utf-8");
    const keywords = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
    if (keywords.length === 0) {
      console.warn(`   File ${fileName} kosong, pakai default.`);
      return fallback;
    }
    return keywords;
  } catch (err) {
    console.warn(`   Gagal baca ${fileName}: ${err}, pakai default.`);
    return fallback;
  }
}

/**
 * Kata kunci HR (Human Resources) — Inggris & Indonesia.
 * Default fallback, akan di-override oleh keywords/hr-keywords.txt jika ada.
 */
const HR_KEYWORDS_FALLBACK: string[] = [
  "hr", "human resources", "human resource",
  "hr business partner", "hrbp",
  "hr generalist", "hr manager", "hr director", "hr lead", "hr head",
  "hr coordinator", "hr specialist", "hr advisor", "hr officer",
  "talent acquisition", "talent management", "talent partner",
  "talent sourcing", "talent development",
  "recruiter", "recruitment", "recruiting",
  "technical recruiter", "tech recruiter", "it recruiter",
  "sourcer", "executive search", "headhunter",
  "people & culture", "people and culture", "people operations",
  "people partner", "people team", "people success",
  "employee relations", "learning & development",
  "employer branding",
  "personalia", "sumber daya manusia",
  "hrga", "rekrutmen", "rekruter", "sdm",
  "head of people", "head of talent", "head of hr",
];

const HR_KEYWORDS: string[] = loadKeywordsFile(
  "hr-keywords.txt",
  HR_KEYWORDS_FALLBACK
);

/**
 * Kata kunci IT/Tech — untuk konteks tambahan HR IT.
 * Akan di-override oleh keywords/tech-keywords.txt jika ada.
 */
const TECH_KEYWORDS_FALLBACK: string[] = [
  "technology", "it",
  "software", "engineer", "engineering",
  "developer", "programmer",
  "cloud", "saas", "aws",
  "artificial intelligence", "machine learning",
  "data scientist", "data engineer",
  "backend", "frontend", "full stack",
  "devops", "infrastructure",
  "startup", "tech company",
  "digital", "computer science",
  "teknologi", "informatika", "komputer",
];

const TECH_KEYWORDS: string[] = loadKeywordsFile(
  "tech-keywords.txt",
  TECH_KEYWORDS_FALLBACK
);

/**
 * Primary stable selector: LinkedIn uses aria-label="Invite <Name> to connect"
 * on all "Connect" buttons. These don't use auto-generated class names.
 */
function connectButtonSelector(): string {
  return 'button[aria-label^="Invite"]';
}

/**
 * Check if a button's visible text is "Connect" (not "Pending" or "Follow").
 * This filters out buttons that match the aria-label selector but aren't
 * actually clickable (already invited / following).
 */
async function hasConnectText(page: Page, button: ElementHandle): Promise<boolean> {
  try {
    const text = await page.evaluate((el) => {
      const spans = el.querySelectorAll("span");
      for (const span of spans) {
        if (span.textContent?.trim() === "Connect") return true;
      }
      return false;
    }, button);
    return text;
  } catch {
    return false;
  }
}

/**
 * Cocokkan teks (headline) dengan daftar kata kunci (case-insensitive).
 */
function matchKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

/**
 * Ekstrak headline/posisi dari kartu profil grow page.
 * Strategi: ambil nama dari aria-label tombol Connect, lalu cari baris pertama
 * di dalam kartu yang bukan nama dan bukan tombol/aksi.
 */
async function extractHeadline(page: Page, button: ElementHandle): Promise<string> {
  try {
    return await page.evaluate((btn) => {
      const name = btn.getAttribute("aria-label")
        ?.replace("Invite ", "")
        .replace(" to connect", "")
        .trim() || "";

      // Cari container kartu dengan walk parent
      let card = btn.parentElement;
      for (let i = 0; i < 5 && card; i++) {
        if (card.children.length > 2) break;
        card = card.parentElement;
      }
      if (!card) return "";

      const lines = card.innerText.split("\n");
      for (const line of lines) {
        const s = line.trim();
        if (!s) continue;
        if (s === name) continue;
        if (
          s.includes("Connect") ||
          s.includes("Pending") ||
          s.includes("Follow") ||
          s.includes("Dismiss")
        )
          continue;
        if (s.length < 5 || s.length > 200) continue;
        return s;
      }
      return "";
    }, button);
  } catch {
    return "";
  }
}

/**
 * Cek apakah headline mengandung kata kunci HR.
 */
function isHRProfile(headline: string): boolean {
  return matchKeywords(headline, HR_KEYWORDS);
}

/**
 * Cek apakah headline mengandung konteks IT/Tech (digunakan bersama HR filter).
 */
function isTechProfile(headline: string): boolean {
  return matchKeywords(headline, TECH_KEYWORDS);
}

const TECH_ROLES_KEYWORDS_DIR = resolve(process.cwd(), "keywords");

let _techRoleKeywords: Record<TechRole, string[]> | null = null;

function loadTechRoleKeywords(): Record<TechRole, string[]> {
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
      if (sectionMatch) {
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
    const pa = a.role ? priorityOrder[a.role] ?? 99 : 99;
    const pb = b.role ? priorityOrder[b.role] ?? 99 : 99;
    return pa - pb;
  });
}

export async function findConnectButtons(page: Page): Promise<ElementHandle[]> {
  const allButtons = await page.$$(connectButtonSelector());
  if (allButtons.length === 0) return [];

  const connectButtons: ElementHandle[] = [];
  for (const btn of allButtons) {
    const isConnect = await hasConnectText(page, btn);
    if (isConnect) connectButtons.push(btn);
    else btn.dispose();
  }
  return connectButtons;
}

export async function clickConnectButton(
  page: Page,
  button: ElementHandle
): Promise<boolean> {
  try {
    const info = await button.evaluate((el) => {
      const nama =
        el.getAttribute("aria-label")
          ?.replace("Invite ", "")
          .replace(" to connect", "")
          .trim() || "";

      let card = el.parentElement;
      for (let i = 0; i < 4 && card; i++) {
        if (card.children.length > 3) break;
        card = card.parentElement;
      }

      let motto = "";
      if (card) {
        const teks = card.innerText.split("\n");
        for (const t of teks) {
          const s = t.trim();
          if (
            s &&
            s !== nama &&
            !s.includes("Connect") &&
            !s.includes("Pending") &&
            !s.includes("Follow") &&
            s.length > 5 &&
            s.length < 200
          ) {
            motto = s;
            break;
          }
        }
      }

      return { nama, motto };
    });

    await button.evaluate((el) =>
      el.scrollIntoView({ block: "center", behavior: "instant" })
    );

    await randomDelay(1000, 3000);

    await button.click();
    await randomDelay(2000, 4000);

    const log = ` [${info.nama}]`;
    if (info.motto) console.log(` Mengirim: ${log} — ${info.motto}`);
    else console.log(` Mengirim: ${log}`);
    return true;
  } catch {
    return false;
  }
}

async function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

export async function scrollToLoadMore(page: Page): Promise<void> {
  await page.evaluate("window.scrollBy(0, 800)");
  await page.evaluate("window.scrollBy(0, 400)");
  await randomDelay(4000, 6000);
}

export async function scrollUntilNoMore(
  page: Page,
  maxScrolls: number
): Promise<boolean> {
  let emptyScrolls = 0;

  for (let i = 0; i < maxScrolls; i++) {
    const buttonsBefore = (await findConnectButtons(page)).length;
    await scrollToLoadMore(page);
    const buttonsAfter = (await findConnectButtons(page)).length;

    if (buttonsAfter > buttonsBefore) {
      emptyScrolls = 0;
    } else {
      emptyScrolls++;
    }

    if (emptyScrolls >= 3) return false;
  }

  return false;
}

export async function detectWeeklyLimit(page: Page): Promise<boolean> {
  const bodyText = await page.evaluate(() => document.body.innerText);
  const patterns = [
    /invitation.*limit/i,
    /you've reached the weekly/i,
    /can't send more invitations/i,
  ];
  return patterns.some((p) => p.test(bodyText));
}

export async function detectCaptcha(page: Page): Promise<boolean> {
  const url = page.url();
  if (url.includes("/checkpoint")) return true;

  const hasChallenge = await page.$(
    'iframe[src*="challenge"], #captcha, [data-test-id*="captcha"]'
  );
  return hasChallenge !== null;
}

export async function detectSessionExpired(page: Page): Promise<boolean> {
  const url = page.url();
  return (
    url.includes("/login") ||
    url.includes("/authwall") ||
    url.includes("/uas/login")
  );
}

export async function processConnections(
  page: Page,
  partialOptions?: Partial<ConnectOptions>
): Promise<ConnectResult> {
  const options = { ...DEFAULTS, ...partialOptions };
  const result: ConnectResult = {
    sent: 0,
    skipped: 0,
    errors: 0,
    limitReached: false,
    stopped: false,
  };

  let refreshCount = 0;

  while (result.sent < options.maxPerSession) {
    if (await detectSessionExpired(page)) {
      console.log(" Session expired mid-flow. Stopping.");
      result.stopped = true;
      break;
    }
    if (await detectCaptcha(page)) {
      console.log(" CAPTCHA detected. Stopping.");
      result.stopped = true;
      break;
    }
    if (await detectWeeklyLimit(page)) {
      console.log(" Weekly connection limit reached. Stopping.");
      result.limitReached = true;
      break;
    }

    const buttons = await findConnectButtons(page);

    if (buttons.length === 0) {
      const canScroll = await scrollUntilNoMore(page, options.maxScrolls);
      if (canScroll) continue;
      console.log(" No more Connect buttons found.");
      break;
    }

    let sentInBatch = 0;

    for (const btn of buttons) {
      if (result.sent >= options.maxPerSession) break;
      if (await detectWeeklyLimit(page)) {
        result.limitReached = true;
        btn.dispose();
        break;
      }
      if (await detectSessionExpired(page)) {
        result.stopped = true;
        btn.dispose();
        break;
      }

      // ── HR Filter ──
      if (options.hrFilter) {
        const headline = await extractHeadline(page, btn);
        if (!headline || !isHRProfile(headline)) {
          result.skipped++;
          if (headline) {
            console.log(` Dilewati (bukan HR): ${headline.slice(0, 60)}`);
          } else {
            console.log(` Dilewati (headline tidak terbaca)`);
          }
          btn.dispose();
          continue;
        }
        if (isTechProfile(headline)) {
          console.log(` HR IT: ${headline.slice(0, 60)}`);
        }
      }

      const success = await clickConnectButton(page, btn);
      if (success) {
        result.sent++;
        sentInBatch++;
        console.log(` [${result.sent}/${options.maxPerSession}] Connection sent`);
      } else {
        result.errors++;
        console.log(` Error sending connection`);
      }

      btn.dispose();

      if (result.sent >= options.maxPerSession) break;

      const delayDetik = Math.round(options.delayMinMs / 1000);
      console.log(` Menunggu ${delayDetik}-${Math.round(options.delayMaxMs / 1000)} detik...`);
      await randomDelay(options.delayMinMs, options.delayMaxMs);
    }

    // Jika semua tombol di batch ini di-skip filter, refresh cari profil baru
    if (sentInBatch === 0 && result.sent < options.maxPerSession) {
      refreshCount++;
      if (refreshCount > (options.maxRefreshes ?? 10)) {
        console.log(` Sudah refresh ${refreshCount - 1}x, berhenti.`);
        break;
      }
      console.log(` Semua dilewati, refresh halaman (ke-${refreshCount})...`);
      try {
        await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
      } catch {
        console.log("  Refresh timeout, lanjut...");
        await page.goto("https://www.linkedin.com/mynetwork/grow/", {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        }).catch(() => {});
      }
      await randomDelay(4000, 6000);
      continue;
    }
  }

  return result;
}

const TECH_ROLE_DEFAULTS: TechRoleOptions = {
  techRoleMode: true,
  maxPerRole: 10,
  geoIds: GEO_IDS,
};

export async function processTechRoleConnections(
  page: Page,
  partialOptions?: Partial<ConnectOptions & TechRoleOptions>
): Promise<ConnectResult> {
  const options = { ...TECH_ROLE_DEFAULTS, ...partialOptions };
  const result: ConnectResult = {
    sent: 0,
    skipped: 0,
    errors: 0,
    limitReached: false,
    stopped: false,
  };

  console.log(` Tech Role Mode: ${ROLE_CONFIGS.length} roles, ${options.geoIds.length} countries`);
  console.log(` Target: ${ROLE_CONFIGS.map((r) => r.displayName).join(" → ")}`);
  console.log(` Max per role: ${options.maxPerRole}\n`);

  let mode: "connect" | "follow" = "connect";

  for (const roleConfig of ROLE_CONFIGS) {
    if (result.stopped || result.limitReached) break;

    console.log(`\n Cari ${roleConfig.displayName}...`);
    const profiles = await searchRoleProfiles(
      page,
      roleConfig.keyword,
      options.geoIds,
      options.maxPerRole
    );

    if (profiles.length === 0) {
      console.log(`   Tidak ada profil ${roleConfig.displayName} ditemukan.`);
      continue;
    }

    // Validate headlines and process valid profiles immediately
    let processed = 0;
    let firstAction = true;
    for (const p of profiles) {
      if (result.sent >= (options.maxPerSession ?? 50)) break;
      if (result.stopped || result.limitReached) break;

      const detected = detectTechRole(p.headline);
      if (detected === null) {
        result.skipped++;
        continue;
      }
      p.role = detected;

      // Delay before action (skip for first action in session)
      if (!firstAction) {
        const delayDetik = Math.round((options.delayMinMs ?? 30000) / 1000);
        console.log(` Menunggu ${delayDetik}-${Math.round((options.delayMaxMs ?? 90000) / 1000)} detik...`);
        await randomDelay(options.delayMinMs ?? 30000, options.delayMaxMs ?? 90000);
      }
      firstAction = false;

      if (mode === "connect" && await detectWeeklyLimit(page)) {
        console.log(" Weekly Connect limit reached. Switching to Follow mode.");
        mode = "follow";
      }

      // Try Connect first, fallback to Follow
      let actionDone = "";
      let success = false;
      if (mode === "connect") {
        success = await clickConnectOnSearch(page, p);
        if (success) {
          actionDone = "Connection";
        } else {
          // Fallback: if Connect not available, try Follow
          const followOk = await clickFollowOnSearch(page, p);
          if (followOk) {
            success = true;
            actionDone = "Follow (Connect not available)";
          }
        }
      } else {
        success = await clickFollowOnSearch(page, p);
        if (success) actionDone = "Follow";
      }

      if (success) {
        result.sent++;
        processed++;
        console.log(` [${result.sent}/${options.maxPerSession ?? 50}] ${actionDone} sent — ${p.name} (${p.role})`);
      } else {
        result.errors++;
        console.log(` No action button found for: ${p.name}`);
      }

      if (result.sent >= (options.maxPerSession ?? 50)) break;
    }
    console.log(`   ${processed}/${profiles.length} ${roleConfig.displayName} diproses`);
  }

  return result;
}
