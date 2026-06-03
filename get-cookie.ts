import puppeteer from "puppeteer";
import { resolve } from "path";
import { isSessionValid } from "./login.ts";
import { processTechRoleConnections } from "./src/connect.ts";
import { COUNTRY_MAP, GEO_REGIONS, INDONESIA_GEO_ID } from "./src/types.ts";

const PROFILE_PATH = resolve(".browser-profile");

/**
 * Parse CLI argument --countries=ID,US,AU and resolve to LinkedIn Geo IDs.
 * Falls back to Indonesia only if no flag is provided.
 */
function resolveTargetGeoIds(): string[] {
  const flag = process.argv.find((a) => a.startsWith("--countries="));
  if (!flag) return [INDONESIA_GEO_ID];

  const codes = flag.replace("--countries=", "").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
  const geoIds: string[] = [];

  for (const code of codes) {
    const geoId = COUNTRY_MAP[code];
    if (geoId) {
      geoIds.push(geoId);
    } else {
      console.warn(`  Unknown country code: ${code}. Skipping.`);
    }
  }

  if (geoIds.length === 0) {
    console.warn("  No valid country codes provided. Falling back to Indonesia.");
    return [INDONESIA_GEO_ID];
  }

  return geoIds;
}

function logTargetedCountries(geoIds: string[]): void {
  const names = geoIds.map((id) => {
    const region = GEO_REGIONS.find((r) => r.geoId === id);
    return region ? region.name : id;
  });
  console.log(` Target: ${names.join(", ")} (${geoIds.length} countries)`);
}

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

  const targetGeoIds = resolveTargetGeoIds();
  logTargetedCountries(targetGeoIds);

  try {
    const result = await processTechRoleConnections(page, {
      maxPerSession: 30,
      delayMinMs: 30000,
      delayMaxMs: 90000,
      maxPerRole: 10,
      geoIds: targetGeoIds,
    });

    console.log("\n Sesi selesai:");
    console.log(`  Terkirim: ${result.sent}`);
    console.log(`  Dilewati: ${result.skipped}`);
    console.log(`  Error: ${result.errors}`);
    if (result.limitReached) console.log("  Limit mingguan tercapai");
    if (result.stopped) console.log("  Dihentikan (session/CAPTCHA)");
  } catch (err) {
    console.error(" Error:", err);
  } finally {
    await browser.close();
    console.log(" Browser ditutup.");
  }
}

main();
