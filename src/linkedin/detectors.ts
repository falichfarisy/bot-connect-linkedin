import type { Page } from "puppeteer";

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
