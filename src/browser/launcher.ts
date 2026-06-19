import puppeteer from "puppeteer";
import type { Browser, Page } from "puppeteer";
import { resolve } from "path";

export const PROFILE_PATH = resolve(".browser-profile");

export async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    headless: false,
    executablePath: "/usr/bin/brave",
    userDataDir: PROFILE_PATH,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  });
}

export async function setupPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  );
  await page.setViewport({ width: 1920, height: 1080 });
  return page;
}
