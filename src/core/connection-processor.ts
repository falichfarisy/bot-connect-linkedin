import type { Page } from "puppeteer";
import { TechRole } from "../types/roles.ts";
import type { TechRoleOptions, SearchProfile } from "../types/roles.ts";
import type { ConnectOptions, ConnectResult } from "../types/connection.ts";
import { ROLE_CONFIGS } from "../config/roles.ts";
import { INDONESIA_GEO_ID } from "../config/geo.ts";
import { detectTechRole } from "../utils/keywords.ts";
import { randomDelay } from "../utils/delay.ts";
import { searchRoleProfiles, goToNextPage } from "../linkedin/search.ts";
import { clickConnectOnSearch, clickFollowOnSearch } from "../linkedin/actions.ts";
import { detectWeeklyLimit } from "../linkedin/detectors.ts";

const DEFAULTS: ConnectOptions = {
  maxPerSession: 50,
  delayMinMs: 30000,
  delayMaxMs: 90000,
  maxScrolls: 30,
  hrFilter: false,
  maxRefreshes: 10,
};

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
