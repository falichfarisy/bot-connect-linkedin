import type { Page, ElementHandle } from "puppeteer";
import type { SearchProfile } from "./types.ts";
import { GEO_IDS } from "./types.ts";

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

export function buildSearchUrl(
  keyword: string,
  geoIds: string[] = GEO_IDS,
  page: number = 1
): string {
  const encodedKeyword = encodeURIComponent(keyword);
  const geoUrn = JSON.stringify(geoIds);
  const encodedGeoUrn = encodeURIComponent(geoUrn);
  return `https://www.linkedin.com/search/results/people/?keywords=${encodedKeyword}&geoUrn=${encodedGeoUrn}&origin=GLOBAL_SEARCH_HEADER&page=${page}`;
}

export async function waitForSearchResults(page: Page): Promise<boolean> {
  try {
    await page.waitForSelector(
      'button[aria-label^="Invite"], ' +
        'button[aria-label^="Follow"], ' +
        "ul.reusable-search__entity-result-list " +
        'li[data-urn]:not([data-urn=""])',
      { timeout: 15000 }
    );
    return true;
  } catch {
    return false;
  }
}

export async function extractProfilesFromCurrentPage(
  page: Page
): Promise<SearchProfile[]> {
  const profiles: SearchProfile[] = [];

  const buttons = await page.$$(
    'button[aria-label^="Invite"], button[aria-label^="Follow"]'
  );

  if (buttons.length === 0) return [];

  for (const btn of buttons) {
    try {
      const data = await page.evaluate((el) => {
        const ariaLabel = el.getAttribute("aria-label") || "";
        let name = "";

        if (ariaLabel.startsWith("Invite")) {
          name = ariaLabel
            .replace("Invite ", "")
            .replace(" to connect", "")
            .trim();
        } else if (ariaLabel.startsWith("Follow")) {
          name = ariaLabel.replace("Follow ", "").trim();
        }

        // Walk up to find the card container.
        // LinkedIn uses auto-generated class names, so detect by content:
        // container has the profile name in its text, multiple children, and substantial content.
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

        const lines = card.innerText.split("\n").map((l: string) => l.trim()).filter(Boolean);

        let headline = "";
        let location = "";
        for (const line of lines) {
          // Skip name line even if it has connection degree appended (e.g. "Name • 2nd")
          if (line === name || line.startsWith(name)) continue;
          // Skip connection degree indicators: • 1st, • 2nd, • 3rd, +1, and similar
          if (/^[•·●]\s*\d/.test(line) || /^\+\d/.test(line) || /^\d/.test(line)) continue;
          // Skip mutual connections count
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
    } catch {
    }

    btn.dispose();
  }

  return profiles;
}

export async function goToNextPage(page: Page): Promise<boolean> {
  try {
    const nextButton = await page.$(
      'button[aria-label="Next"], ' +
        '.artdeco-pagination__button--next:not([disabled])'
    );
    if (!nextButton) return false;

    await nextButton.click();
    await randomDelay(3000, 5000);

    const hasResults = await waitForSearchResults(page);
    return hasResults;
  } catch {
    return false;
  }
}

async function findButtonForProfile(
  page: Page,
  profile: SearchProfile,
  action: "connect" | "follow"
): Promise<ElementHandle | null> {
  const escapedName = profile.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const selector =
    action === "connect"
      ? `button[aria-label^="Invite ${escapedName}"]`
      : `button[aria-label^="Follow ${escapedName}"]`;
  return await page.$(selector);
}

export async function clickConnectOnSearch(
  page: Page,
  profile: SearchProfile
): Promise<boolean> {
  try {
    const btn = await findButtonForProfile(page, profile, "connect");
    if (!btn) return false;

    await btn.evaluate((el) =>
      el.scrollIntoView({ block: "center", behavior: "instant" })
    );
    await randomDelay(1000, 3000);
    await btn.click();
    await randomDelay(2000, 4000);

    const log = ` [${profile.name}]`;
    if (profile.headline) console.log(` Mengirim: ${log} — ${profile.headline}`);
    else console.log(` Mengirim: ${log}`);
    btn.dispose();
    return true;
  } catch {
    return false;
  }
}

export async function clickFollowOnSearch(
  page: Page,
  profile: SearchProfile
): Promise<boolean> {
  try {
    const btn = await findButtonForProfile(page, profile, "follow");
    if (!btn) return false;

    await btn.evaluate((el) =>
      el.scrollIntoView({ block: "center", behavior: "instant" })
    );
    await randomDelay(1000, 3000);
    await btn.click();
    await randomDelay(2000, 4000);

    console.log(` Follow: [${profile.name}] — ${profile.headline || ""}`);
    btn.dispose();
    return true;
  } catch {
    return false;
  }
}

export async function searchRoleProfiles(
  page: Page,
  keyword: string,
  geoIds: string[] = GEO_IDS,
  maxResults: number = 10
): Promise<SearchProfile[]> {
  const allProfiles: SearchProfile[] = [];
  const maxPages = 3;

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    const url = buildSearchUrl(keyword, geoIds, pageNum);
    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
    } catch {
      // If navigation timeout, try to continue anyway
    }

    await randomDelay(3000, 5000);

    const hasResults = await waitForSearchResults(page);
    if (!hasResults) break;

    const profiles = await extractProfilesFromCurrentPage(page);
    allProfiles.push(...profiles);

    if (allProfiles.length >= maxResults) break;

    const hasNext = await goToNextPage(page);
    if (!hasNext) break;
  }

  return allProfiles.slice(0, maxResults);
}
