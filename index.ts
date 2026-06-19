import { launchBrowser, setupPage } from "./src/browser/launcher.ts";
import { isSessionValid } from "./src/auth/session.ts";
import { processTechRoleConnections } from "./src/core/connection-processor.ts";

async function main() {
  console.log(" Memulai bot LinkedIn...");

  const browser = await launchBrowser();
  const page = await setupPage(browser);

  try {
    await page.goto("https://www.linkedin.com", {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
  } catch {
  }

  await new Promise((r) => setTimeout(r, 5000));

  let sessionValid = false;
  try {
    sessionValid = await isSessionValid(page);
  } catch {
  }

  if (!sessionValid) {
    console.error(" Session LinkedIn tidak valid!");
    console.log("   Jalankan: bun run get-cookie.ts");
    console.log("   Login sekali, lalu jalankan ulang bot ini.");
    await browser.close();
    process.exit(1);
  }

  console.log(" Session valid! LinkedIn mengenali Anda.");
  console.log(" Halaman: " + page.url());

  console.log(" Memulai tech role search...");

  try {
    const result = await processTechRoleConnections(page, {
      maxPerSession: 40,
      delayMinMs: 30000,
      delayMaxMs: 90000,
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
