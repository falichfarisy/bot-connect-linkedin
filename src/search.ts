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
    'a[aria-label^="Invite"], button[aria-label^="Invite"], ' +
    'a[aria-label^="Follow"], button[aria-label^="Follow"]'
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
    // Try direct selectors first, then fallback to text content search
    let nextButton = await page.$(
      'button[aria-label="Next"], ' +
      'button[aria-label="Next page"], ' +
      '.artdeco-pagination__button--next:not([disabled])'
    );

    if (!nextButton) {
      const allButtons = await page.$$("button");
      for (const btn of allButtons) {
        const text = await page.evaluate(
          (el) => el.textContent?.trim(),
          btn
        );
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
      ? `a[aria-label^="Invite ${escapedName}"], button[aria-label^="Invite ${escapedName}"]`
      : `a[aria-label^="Follow ${escapedName}"], button[aria-label^="Follow ${escapedName}"]`;
  return await page.$(selector);
}

/**
 * Handle the "Send without a note" dialog that appears after sending a Connect invitation.
 * Waits for the dialog and clicks the send button.
 */
export async function handleConnectPopup(page: Page): Promise<boolean> {
  try {
    await page.waitForSelector('div.send-invite[role="dialog"]', {
      timeout: 8000,
    });
    await randomDelay(1000, 2000);

    const sendBtn = await page.$(
      'button[aria-label="Send without a note"]'
    );
    if (!sendBtn) return false;

    await sendBtn.click();
    await randomDelay(2000, 3000);
    return true;
  } catch {
    // Dialog might not appear — LinkedIn sometimes sends connect directly
    return false;
  }
}

/**
 * Extract vanity name from a Connect button's href.
 * URL format: /preload/search-custom-invite/?vanityName={name}
 */
function extractVanityName(href: string): string | null {
  try {
    const url = new URL(href, "https://www.linkedin.com");
    return url.searchParams.get("vanityName");
  } catch {
    return null;
  }
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
    await randomDelay(1000, 2000);

    // Remove href from <a> elements so React can intercept the click without browser navigation
    await page.evaluate((el) => {
      if (el.tagName === "A") {
        el.removeAttribute("href");
      }
    }, btn);

    await btn.click();
    await randomDelay(2000, 3000);

    const sentDirect = await handleConnectPopup(page);
    if (sentDirect) {
      btn.dispose();
      const log = ` [${profile.name}]`;
      if (profile.headline) console.log(` Mengirim: ${log} — ${profile.headline}`);
      else console.log(` Mengirim: ${log}`);
      return true;
    }

    const href = await btn.evaluate((el) => el.getAttribute("href") || "");
    const vanityName = extractVanityName(href);
    btn.dispose();

    if (vanityName) {
      const searchUrl = page.url();
      const inviteUrl = `https://www.linkedin.com/preload/search-custom-invite/?vanityName=${encodeURIComponent(vanityName)}`;
      await page.goto(inviteUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      }).catch(() => {});
      await randomDelay(2000, 4000);

      const sentFallback = await handleConnectPopup(page);
      if (sentFallback) {
        const log = ` [${profile.name}]`;
        if (profile.headline) console.log(` Mengirim: ${log} — ${profile.headline}`);
        else console.log(` Mengirim: ${log}`);
        await page.goto(searchUrl, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        }).catch(() => {});
        await randomDelay(2000, 3000);
        return true;
      }
    }

    return false;
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
