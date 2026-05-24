import puppeteer from "puppeteer";
import { resolve } from "path";
import { isSessionValid } from "./login.ts";
import { processConnections } from "./src/connect.ts";

const PROFILE_PATH = resolve(".browser-profile");

async function main() {
  console.log("🔑 Login LinkedIn dulu ya\n");

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: "/usr/bin/brave",
    userDataDir: PROFILE_PATH,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
  );
  await page.setViewport({ width: 1920, height: 1080 });

  await page.goto("https://www.linkedin.com", {
    waitUntil: "domcontentloaded",
  });
  await new Promise((r) => setTimeout(r, 3000));

  try {
    const quickSignIn = await page.$(
      '[data-control-name="signin_confirm"], ' +
      'form[action*="/feed/"] button, ' +
      'button[id*="sign-in"]'
    );
    if (quickSignIn) {
      await quickSignIn.click();
      console.log(" Klik quick sign in...");
      await new Promise((r) => setTimeout(r, 5000));
    } else {
      const clicked = await page.evaluate(() => {
        const semuaBtn = document.querySelectorAll("button, [role=button], a");
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
    }
  } catch {
  }

  let sudahLogin = false;
  try {
    sudahLogin = await isSessionValid(page);
  } catch {
  }

  if (!sudahLogin) {
    console.log("Session belum ada atau login page. Tunggu login...\n");

    await page.goto("https://www.linkedin.com/login", {
      waitUntil: "domcontentloaded",
    });

    let menunggu = 0;
    while (menunggu < 300) {
      const currentUrl = page.url();
      const masihLoginPage =
        currentUrl.includes("/login") ||
        currentUrl.includes("/checkpoint") ||
        currentUrl.includes("/authwall");
      if (!masihLoginPage) {
        const ok = await isSessionValid(page).catch(() => false);
        if (ok) break;
      }
      await new Promise((r) => setTimeout(r, 2000));
      menunggu++;
    }

    const afterUrl = page.url();
    if (
      afterUrl.includes("/login") ||
      afterUrl.includes("/checkpoint") ||
      afterUrl.includes("/authwall")
    ) {
      console.log("Waktu login habis. Jalankan ulang: bun start");
      await browser.close();
      process.exit(1);
    }
  }

  console.log(" Login berhasil! Mulai cari koneksi...\n");

  try {
    await page.goto("https://www.linkedin.com/mynetwork/grow/", {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
  } catch {
  }

  try {
    await page.waitForSelector(
      'button[aria-label^="Invite"], ' +
      '[data-view-name="profile-card"], ' +
      '.mn-discovery-card, ' +
      '.discover-entity-card',
      { timeout: 10000 }
    );
  } catch {
    console.log(" Profile suggestion tidak muncul, coba scroll...");
  }

  await new Promise((r) => setTimeout(r, 3000));

  const result = await processConnections(page, {
    maxPerSession: 30,
    delayMinMs: 30000,
    delayMaxMs: 90000,
    maxScrolls: 30,
  });

  console.log("\n Sesi selesai:");
  console.log(`  Terkirim: ${result.sent}`);
  console.log(`  Dilewati: ${result.skipped}`);
  console.log(`  Error: ${result.errors}`);
  if (result.limitReached) console.log("  Limit mingguan tercapai");
  if (result.stopped) console.log("  Dihentikan (session/CAPTCHA)");

  await browser.close();
}

main();
