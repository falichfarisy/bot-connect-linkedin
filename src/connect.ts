import type { Page, ElementHandle } from "puppeteer";

export interface ConnectOptions {
  maxPerSession: number;
  delayMinMs: number;
  delayMaxMs: number;
  maxScrolls: number;
}

export interface ConnectResult {
  sent: number;
  skipped: number;
  errors: number;
  limitReached: boolean;
  stopped: boolean;
}

const DEFAULTS: ConnectOptions = {
  maxPerSession: 30,
  delayMinMs: 30000,
  delayMaxMs: 90000,
  maxScrolls: 30,
};

/**
 * Primary stable selector: LinkedIn uses aria-label="Invite <Name> to connect"
 * on all "Connect" buttons. These don't use auto-generated class names.
 */
function connectButtonSelector(): string {
  return 'button[aria-label^="Invite"]';
}

/**
 * Check if a button's visible text is "Connect" (not "Pending" or "Follow").
 * This filters out buttons that match the aria-label selector but aren't
 * actually clickable (already invited / following).
 */
async function hasConnectText(page: Page, button: ElementHandle): Promise<boolean> {
  try {
    const text = await page.evaluate((el) => {
      const spans = el.querySelectorAll("span");
      for (const span of spans) {
        if (span.textContent?.trim() === "Connect") return true;
      }
      return false;
    }, button);
    return text;
  } catch {
    return false;
  }
}

export async function findConnectButtons(page: Page): Promise<ElementHandle[]> {
  const allButtons = await page.$$(connectButtonSelector());
  if (allButtons.length === 0) return [];

  const connectButtons: ElementHandle[] = [];
  for (const btn of allButtons) {
    const isConnect = await hasConnectText(page, btn);
    if (isConnect) connectButtons.push(btn);
    else btn.dispose();
  }
  return connectButtons;
}

export async function clickConnectButton(
  page: Page,
  button: ElementHandle
): Promise<boolean> {
  try {
    const info = await button.evaluate((el) => {
      const nama =
        el.getAttribute("aria-label")
          ?.replace("Invite ", "")
          .replace(" to connect", "")
          .trim() || "";

      let card = el.parentElement;
      for (let i = 0; i < 4 && card; i++) {
        if (card.children.length > 3) break;
        card = card.parentElement;
      }

      let motto = "";
      if (card) {
        const teks = card.innerText.split("\n");
        for (const t of teks) {
          const s = t.trim();
          if (
            s &&
            s !== nama &&
            !s.includes("Connect") &&
            !s.includes("Pending") &&
            !s.includes("Follow") &&
            s.length > 5 &&
            s.length < 200
          ) {
            motto = s;
            break;
          }
        }
      }

      return { nama, motto };
    });

    await button.evaluate((el) =>
      el.scrollIntoView({ block: "center", behavior: "instant" })
    );

    await randomDelay(1000, 3000);

    await button.click();
    await randomDelay(2000, 4000);

    const log = ` [${info.nama}]`;
    if (info.motto) console.log(` Mengirim: ${log} — ${info.motto}`);
    else console.log(` Mengirim: ${log}`);
    return true;
  } catch {
    return false;
  }
}

async function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

export async function scrollToLoadMore(page: Page): Promise<void> {
  await page.evaluate("window.scrollBy(0, 800)");
  await page.evaluate("window.scrollBy(0, 400)");
  await randomDelay(4000, 6000);
}

export async function scrollUntilNoMore(
  page: Page,
  maxScrolls: number
): Promise<boolean> {
  let emptyScrolls = 0;

  for (let i = 0; i < maxScrolls; i++) {
    const buttonsBefore = (await findConnectButtons(page)).length;
    await scrollToLoadMore(page);
    const buttonsAfter = (await findConnectButtons(page)).length;

    if (buttonsAfter > buttonsBefore) {
      emptyScrolls = 0;
    } else {
      emptyScrolls++;
    }

    if (emptyScrolls >= 3) return false;
  }

  return false;
}

export async function detectWeeklyLimit(page: Page): Promise<boolean> {
  const bodyText = await page.evaluate(() => document.body.innerText);
  const patterns = [
    /invitation.*limit/i,
    /you've reached the weekly/i,
    /can't send more invitations/i,
  ];
  return patterns.some((p) => p.test(bodyText));
}

export async function detectCaptcha(page: Page): Promise<boolean> {
  const url = page.url();
  if (url.includes("/checkpoint")) return true;

  const hasChallenge = await page.$(
    'iframe[src*="challenge"], #captcha, [data-test-id*="captcha"]'
  );
  return hasChallenge !== null;
}

export async function detectSessionExpired(page: Page): Promise<boolean> {
  const url = page.url();
  return (
    url.includes("/login") ||
    url.includes("/authwall") ||
    url.includes("/uas/login")
  );
}

export async function processConnections(
  page: Page,
  partialOptions?: Partial<ConnectOptions>
): Promise<ConnectResult> {
  const options = { ...DEFAULTS, ...partialOptions };
  const result: ConnectResult = {
    sent: 0,
    skipped: 0,
    errors: 0,
    limitReached: false,
    stopped: false,
  };

  while (result.sent < options.maxPerSession) {
    if (await detectSessionExpired(page)) {
      console.log(" Session expired mid-flow. Stopping.");
      result.stopped = true;
      break;
    }
    if (await detectCaptcha(page)) {
      console.log(" CAPTCHA detected. Stopping.");
      result.stopped = true;
      break;
    }
    if (await detectWeeklyLimit(page)) {
      console.log(" Weekly connection limit reached. Stopping.");
      result.limitReached = true;
      break;
    }

    const buttons = await findConnectButtons(page);

    if (buttons.length === 0) {
      const canScroll = await scrollUntilNoMore(page, options.maxScrolls);
      if (canScroll) continue;
      console.log(" No more Connect buttons found.");
      break;
    }

    for (const btn of buttons) {
      if (result.sent >= options.maxPerSession) break;
      if (await detectWeeklyLimit(page)) {
        result.limitReached = true;
        btn.dispose();
        break;
      }
      if (await detectSessionExpired(page)) {
        result.stopped = true;
        btn.dispose();
        break;
      }

      const success = await clickConnectButton(page, btn);
      if (success) {
        result.sent++;
        console.log(` [${result.sent}/${options.maxPerSession}] Connection sent`);
      } else {
        result.errors++;
        console.log(` Error sending connection`);
      }

      btn.dispose();

      const delayDetik = Math.round(options.delayMinMs / 1000);
      console.log(` Menunggu ${delayDetik}-${Math.round(options.delayMaxMs / 1000)} detik...`);
      await randomDelay(options.delayMinMs, options.delayMaxMs);
    }
  }

  return result;
}
