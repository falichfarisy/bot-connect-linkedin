import type { Page } from "puppeteer";
import { isSessionValid } from "./session.ts";

export async function waitForManualLogin(page: Page, timeoutSeconds = 300): Promise<boolean> {
  await page.goto("https://www.linkedin.com/login", {
    waitUntil: "domcontentloaded",
  });

  let menunggu = 0;
  while (menunggu < timeoutSeconds) {
    const currentUrl = page.url();
    const masihLoginPage =
      currentUrl.includes("/login") ||
      currentUrl.includes("/checkpoint") ||
      currentUrl.includes("/authwall");
    if (!masihLoginPage) {
      const ok = await isSessionValid(page).catch(() => false);
      if (ok) return true;
    }
    await new Promise((r) => setTimeout(r, 2000));
    menunggu++;
  }

  return false;
}

export async function tryQuickSignIn(page: Page): Promise<void> {
  try {
    const quickSignIn = await page.$(
      '[data-control-name="signin_confirm"], ' +
        'form[action*="/feed/"] button, ' +
        'button[id*="sign-in"]',
    );
    if (quickSignIn) {
      await quickSignIn.click();
      console.log(" Klik quick sign in...");
      await new Promise((r) => setTimeout(r, 5000));
      return;
    }

    const clicked = await page.evaluate(() => {
      const semuaBtn = document.querySelectorAll("button, [role=button]");
      for (const el of semuaBtn) {
        if (el.textContent?.includes("@") && !el.textContent?.includes("Cancel")) {
          (el as HTMLElement).click();
          return true;
        }
      }
      return false;
    });
    if (clicked) {
      console.log(" Klik element sign-in...");
      await new Promise((r) => setTimeout(r, 5000));
    }
  } catch {}
}
