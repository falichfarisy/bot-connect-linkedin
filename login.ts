import type { Page } from "puppeteer";

export async function isSessionValid(page: Page): Promise<boolean> {
  const url = page.url();

  if (
    url.includes("/login") ||
    url.includes("/checkpoint") ||
    url.includes("/authwall") ||
    url.includes("/uas/login")
  ) {
    return false;
  }

  try {
    await page.waitForSelector(
      'a[href*="/feed/"], ' +
      'a[aria-label*="Notification"], ' +
      '[aria-label="Search"], ' +
      'a[href*="/mynetwork/"]',
      { timeout: 8000 }
    );
    return true;
  } catch {
    return false;
  }
}
