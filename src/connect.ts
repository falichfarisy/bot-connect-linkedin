import type { Page, ElementHandle } from "puppeteer";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { TechRole, type SearchProfile, type TechRoleOptions, ROLE_CONFIGS, INDONESIA_GEO_ID } from "./types.ts";
import {
	searchRoleProfiles,
	clickConnectOnSearch,
	clickFollowOnSearch,
	handleConnectPopup,
	goToNextPage,
} from "./search.ts";

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

function loadKeywordsFile(fileName: string, fallback: string[]): string[] {
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
 * Primary stable selector: LinkedIn uses aria-label="Invite <Name> to connect"
 * on all "Connect" buttons. These don't use auto-generated class names.
 */
function connectButtonSelector(): string {
	return 'a[aria-label^="Invite"], button[aria-label^="Invite"]';
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
		const pa = a.role ? (priorityOrder[a.role] ?? 99) : 99;
		const pb = b.role ? (priorityOrder[b.role] ?? 99) : 99;
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

export async function clickConnectButton(page: Page, button: ElementHandle): Promise<boolean> {
	try {
		const info = await button.evaluate((el) => {
			const nama = el.getAttribute("aria-label")?.replace("Invite ", "").replace(" to connect", "").trim() || "";

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

		await button.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));

		await randomDelay(1000, 3000);

		await button.click().catch(() => {});
		await randomDelay(2000, 4000);

		// Handle the "Send without a note" dialog if it appears
		await handleConnectPopup(page);

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

export async function scrollUntilNoMore(page: Page, maxScrolls: number): Promise<boolean> {
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
	const patterns = [/invitation.*limit/i, /you've reached the weekly/i, /can't send more invitations/i];
	return patterns.some((p) => p.test(bodyText));
}

export async function detectCaptcha(page: Page): Promise<boolean> {
	const url = page.url();
	if (url.includes("/checkpoint")) return true;

	const hasChallenge = await page.$('iframe[src*="challenge"], #captcha, [data-test-id*="captcha"]');
	return hasChallenge !== null;
}

export async function detectSessionExpired(page: Page): Promise<boolean> {
	const url = page.url();
	return url.includes("/login") || url.includes("/authwall") || url.includes("/uas/login");
}

const TECH_ROLE_DEFAULTS: TechRoleOptions = {
	techRoleMode: true,
	maxPerRole: 10,
	geoIds: [INDONESIA_GEO_ID],
};

export async function processTechRoleConnections(
	page: Page,
	partialOptions?: Partial<ConnectOptions & TechRoleOptions>,
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

		const targetPerRole = roleConfig.max ?? options.maxPerRole;
		console.log(`\n Cari ${roleConfig.displayName} (target: ${targetPerRole})...`);

		let pageNum = 1;
		let scannedThisRole = 0;
		let processedThisRole = 0;
		let firstAction = true;
		const maxPages = 50;

		while (processedThisRole < targetPerRole && pageNum <= maxPages) {
			if (result.stopped || result.limitReached) break;

			const profiles = await searchRoleProfiles(page, roleConfig.keyword, options.geoIds, targetPerRole, pageNum);

			if (profiles.length === 0) {
				pageNum++;
				continue;
			}

			for (const p of profiles) {
				if (processedThisRole >= targetPerRole) break;
				if (result.sent >= (options.maxPerSession ?? 50)) break;
				if (result.stopped || result.limitReached) break;

				scannedThisRole++;

				const detected = detectTechRole(p.headline);
				if (detected === null) {
					result.skipped++;
					continue;
				}
				p.role = detected;

				if (!firstAction) {
					const delayDetik = Math.round((options.delayMinMs ?? 30000) / 1000);
					console.log(` Menunggu ${delayDetik}-${Math.round((options.delayMaxMs ?? 90000) / 1000)} detik...`);
					await randomDelay(options.delayMinMs ?? 30000, options.delayMaxMs ?? 90000);
				}
				firstAction = false;

				if (mode === "connect" && (await detectWeeklyLimit(page))) {
					console.log(" Weekly Connect limit reached. Switching to Follow mode.");
					mode = "follow";
				}

				let actionDone = "";
				let success = false;
				if (mode === "connect") {
					success = await clickConnectOnSearch(page, p);
					if (success) {
						actionDone = "Connection";
					} else {
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
					processedThisRole++;
					console.log(` [${result.sent}/${options.maxPerSession ?? 50}] ✉ ${actionDone} — ${p.name} (${p.role})`);
				} else {
					result.errors++;
					console.log(`   ✗ Button tidak ditemukan: ${p.name}`);
				}

				if (result.sent >= (options.maxPerSession ?? 50)) break;
			}

			if (processedThisRole >= targetPerRole) break;
			if (result.sent >= (options.maxPerSession ?? 50)) break;

			const moved = await goToNextPage(page);
			if (!moved) break;
			pageNum++;
		}

		if (processedThisRole === 0) {
			console.log(`   Tidak ada profil ${roleConfig.displayName} ditemukan.`);
		} else {
			console.log(
				`   ✓ ${processedThisRole}/${targetPerRole} ${roleConfig.displayName} — ${scannedThisRole} profil di-scan`,
			);
		}
	}

	return result;
}
