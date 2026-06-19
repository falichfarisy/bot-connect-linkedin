import type { Page } from "puppeteer";
import type { SearchProfile } from "../types/roles.ts";
import { GEO_IDS } from "../config/geo.ts";
import { randomDelay } from "../utils/delay.ts";

export function buildSearchUrl(keyword: string, geoIds: string[] = GEO_IDS, page: number = 1): string {
  const encodedKeyword = encodeURIComponent(keyword);
  const encodedGeoFacet = encodeURIComponent(JSON.stringify(geoIds));
  return `https://www.linkedin.com/search/results/people/?keywords=${encodedKeyword}&facetGeoRegion=${encodedGeoFacet}&origin=GLOBAL_SEARCH_HEADER&page=${page}`;
}

export async function waitForSearchResults(page: Page): Promise<boolean> {
  try {
    await page.waitForSelector(
      'a[aria-label^="Invite"], ' +
        'button[aria-label^="Invite"], ' +
        'a[aria-label^="Follow"], ' +
        'button[aria-label^="Follow"], ' +
        'div[role="listitem"]',
      { timeout: 15000 },
    );
    return true;
  } catch {
    return false;
  }
}

export async function extractProfilesFromCurrentPage(page: Page): Promise<SearchProfile[]> {
  const profiles: SearchProfile[] = [];

  const buttons = await page.$$(
    'a[aria-label^="Invite"], button[aria-label^="Invite"], ' +
      'a[aria-label^="Follow"], button[aria-label^="Follow"]',
  );

  if (buttons.length === 0) return [];

  for (const btn of buttons) {
    try {
      const data = await page.evaluate((el) => {
        const ariaLabel = el.getAttribute("aria-label") || "";
        let name = "";

        if (ariaLabel.startsWith("Invite")) {
          name = ariaLabel.replace("Invite ", "").replace(" to connect", "").trim();
        } else if (ariaLabel.startsWith("Follow")) {
          name = ariaLabel.replace("Follow ", "").trim();
        }

        let card = el.parentElement;
        for (let i = 0; i < 12 && card; i++) {
          const text = card.innerText || "";
          const hasName = text.includes(name);
          const multiChild = card.children.length >= 2;
          const substantial = text.length > 40;
          if (hasName && multiChild && substantial) break;
          card = card.parentElement;
        }
        if (!card) return { name, headline: "", location: "" };

        const lines = card.innerText
          .split("\n")
          .map((l: string) => l.trim())
          .filter(Boolean);

        let headline = "";
        let location = "";
        for (const line of lines) {
          if (line === name || line.startsWith(name)) continue;
          if (/^[•·●]\s*\d/.test(line) || /^\+\d/.test(line) || /^\d/.test(line)) continue;
          if (/\d+\s*(mutual|bersama|shared)/i.test(line)) continue;
          if (
            line.includes("Connect") ||
            line.includes("Pending") ||
            line.includes("Follow") ||
            line.includes("Following") ||
            line.includes("Dismiss") ||
            line.includes("Message") ||
            line.includes("More") ||
            line.includes("...more") ||
            line.length < 3
          )
            continue;

          if (!headline) {
            headline = line;
          } else if (!location) {
            location = line;
            break;
          }
        }

        return { name, headline, location };
      }, btn);

      profiles.push({
        name: data.name,
        headline: data.headline,
        location: data.location,
        role: null,
      });
    } catch {}

    btn.dispose();
  }

  return profiles;
}

export async function goToNextPage(page: Page): Promise<boolean> {
  try {
    let nextButton = await page.$(
      'button[aria-label="Next"], ' +
        'button[aria-label="Next page"], ' +
        ".artdeco-pagination__button--next:not([disabled])",
    );

    if (!nextButton) {
      const allButtons = await page.$$("button");
      for (const btn of allButtons) {
        const text = await page.evaluate((el) => el.textContent?.trim(), btn);
        if (text === "Next" || text === "Next page") {
          nextButton = btn;
          break;
        }
        btn.dispose();
      }
    }

    if (!nextButton) return false;

    await nextButton.click();
    await randomDelay(3000, 5000);

    return await waitForSearchResults(page);
  } catch {
    return false;
  }
}

export async function searchRoleProfiles(
  page: Page,
  keyword: string,
  geoIds: string[] = GEO_IDS,
  maxResults: number = 10,
  pageNum: number = 1,
): Promise<SearchProfile[]> {
  const url = buildSearchUrl(keyword, geoIds, pageNum);
  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
  } catch {}

  await randomDelay(3000, 5000);

  const hasResults = await waitForSearchResults(page);
  if (!hasResults) return [];

  const profiles = await extractProfilesFromCurrentPage(page);
  return profiles.slice(0, maxResults);
}
