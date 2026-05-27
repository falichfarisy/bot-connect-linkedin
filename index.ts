import puppeteer from "puppeteer";
import { isSessionValid } from "./login.ts";
import { processTechRoleConnections } from "./src/connect.ts";
import { resolve } from "path";

const PROFILE_PATH = resolve(".browser-profile");

async function main() {
  console.log(" Memulai bot LinkedIn...");

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: "/usr/bin/brave",
    userDataDir: PROFILE_PATH,
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
  );
  await page.setViewport({ width: 1366, height: 768 });

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
      maxPerSession: 30,
      delayMinMs: 30000,
      delayMaxMs: 90000,
      maxPerRole: 10,
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
