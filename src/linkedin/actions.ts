import type { Page, ElementHandle } from "puppeteer";
import type { SearchProfile } from "../types/roles.ts";
import { randomDelay } from "../utils/delay.ts";

export async function handleConnectPopup(page: Page): Promise<boolean> {
  try {
    await page.waitForSelector('div.send-invite[role="dialog"]', {
      timeout: 8000,
    });
    await randomDelay(1000, 2000);

    const sendBtn = await page.$('button[aria-label="Send without a note"]');
    if (!sendBtn) return false;

    await sendBtn.click();
    await randomDelay(2000, 3000);
    return true;
  } catch {
    return false;
  }
}

function extractVanityName(href: string): string | null {
  try {
    const url = new URL(href, "https://www.linkedin.com");
    return url.searchParams.get("vanityName");
  } catch {
    return null;
  }
}

async function findButtonForProfile(
  page: Page,
  profile: SearchProfile,
  action: "connect" | "follow",
): Promise<ElementHandle | null> {
  const escapedName = profile.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const selector =
    action === "connect"
      ? `a[aria-label^="Invite ${escapedName}"], button[aria-label^="Invite ${escapedName}"]`
      : `a[aria-label^="Follow ${escapedName}"], button[aria-label^="Follow ${escapedName}"]`;
  return await page.$(selector);
}

export async function clickConnectOnSearch(page: Page, profile: SearchProfile): Promise<boolean> {
  try {
    const btn = await findButtonForProfile(page, profile, "connect");
    if (!btn) return false;

    const originalHref = await btn.evaluate((el) => el.getAttribute("href") || "");
    const vanityName = extractVanityName(originalHref);

    await btn.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
    await randomDelay(1000, 2000);

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

    btn.dispose();

    if (vanityName) {
      const searchUrl = page.url();
      const inviteUrl = `https://www.linkedin.com/preload/search-custom-invite/?vanityName=${encodeURIComponent(vanityName)}`;
      await page
        .goto(inviteUrl, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        })
        .catch(() => {});
      await randomDelay(2000, 4000);

      const sentFallback = await handleConnectPopup(page);
      if (sentFallback) {
        const log = ` [${profile.name}]`;
        if (profile.headline) console.log(` Mengirim: ${log} — ${profile.headline}`);
        else console.log(` Mengirim: ${log}`);
        await page
          .goto(searchUrl, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          })
          .catch(() => {});
        await randomDelay(2000, 3000);
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

export async function clickFollowOnSearch(page: Page, profile: SearchProfile): Promise<boolean> {
  try {
    const btn = await findButtonForProfile(page, profile, "follow");
    if (!btn) return false;

    await btn.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
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
