import { launchBrowser, setupPage } from "./src/browser/launcher.ts";
import { isSessionValid } from "./src/auth/session.ts";
import { waitForManualLogin, tryQuickSignIn } from "./src/auth/login-flow.ts";
import { processTechRoleConnections } from "./src/core/connection-processor.ts";
import { resolveTargetGeoIds, logTargetedCountries } from "./src/utils/cli.ts";

async function main() {
  console.log("🔑 Login LinkedIn dulu ya\n");

  const browser = await launchBrowser();
  const page = await setupPage(browser);

  await page.goto("https://www.linkedin.com", {
    waitUntil: "domcontentloaded",
  });
  await new Promise((r) => setTimeout(r, 3000));

  await tryQuickSignIn(page);

  let sudahLogin = false;
  try {
    sudahLogin = await isSessionValid(page);
  } catch {
  }

  if (!sudahLogin) {
    const loginSuccess = await waitForManualLogin(page);
    if (!loginSuccess) {
      await browser.close();
      process.exit(1);
    }
  }

  console.log(" Login berhasil! Mulai cari koneksi...\n");

  const targetGeoIds = resolveTargetGeoIds();
  logTargetedCountries(targetGeoIds);

  try {
    const result = await processTechRoleConnections(page, {
      maxPerSession: 40,
      delayMinMs: 30000,
      delayMaxMs: 90000,
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
