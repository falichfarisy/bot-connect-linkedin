# LinkedIn Auto-Connect Bot — Connect Flow

## TL;DR

> **Objective**: Build the connection logic for a LinkedIn auto-connect bot: navigate to suggested profiles, find "Connect" buttons, and send invites with anti-detection measures.
>
> **Deliverables**:
> - `src/connect.ts` — Core connection module (button detection, clicking, scrolling, limits)
> - `src/logger.ts` — Session logging utility
> - Updated `index.ts` — Orchestration orchestrator connecting login + connect flow
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES — 2 waves
> **Critical Path**: Task 1 → Task 3 → Task 4

---

## Context

### Original Request
User is building a LinkedIn auto-connect bot using Puppeteer + Bun. Login session via cookie `li_at` is already implemented. Now needs the flow to:
1. Navigate to `mynetwork/grow/`
2. Find "Connect" buttons (not "Pending" or "Follow")
3. Click them with human-like delays
4. Handle rate limits and errors

### Key Gaps Identified
| Gap | Impact | Solution |
|-----|--------|----------|
| Button CSS classes are auto-generated | Selector will break | Use `aria-label^="Invite"` — stable text-based selector |
| No state detection | Might click "Pending" buttons | Filter by button text content "Connect" |
| No infinite scroll | Only 10-15 profiles shown | Implement scroll-to-load loop with detection |
| No rate limiting | LinkedIn will block account | Configurable limit + weekly limit detection |
| No randomized delays | Bot detection | Random delay 30-90s between actions |
| No error handling | Script crashes mid-flow | Graceful handling of limits, CAPTCHA, expiry |

---

## Work Objectives

### Core Objective
Create a robust, anti-detection-aware connection module that navigates LinkedIn's grow page, identifies connectable profiles, and sends invites with proper rate limiting.

### Concrete Deliverables
- `src/connect.ts` — Complete connect module
- Updated `index.ts` — Full orchestrator flow
- Console-based logging of each session

### Definition of Done
- [ ] `bun run index.ts` — Bot connects to LinkedIn, navigates to grow page, sends invites until limit or no more buttons
- [ ] Bot stops gracefully on weekly limit reached
- [ ] Bot distinguishes Connect vs Pending buttons correctly
- [ ] All errors logged with clear messages

### Must Have
- Session injection via cookie (DONE ✅)
- Navigate to `mynetwork/grow/`
- Find Connect buttons using stable selectors (`aria-label`)
- Click Connect with human-like timing
- Stop on weekly limit detection
- Configurable max connections per session
- Console logging (sent, skipped, errors)

### Must NOT Have
- No email/password login fallback (cookie-only)
- No GUI or dashboard
- No persistent database
- No headless mode (must use `headless: false`)
- No "add note" modal handling (scope-limited)
- No targeting specific people by name/keyword

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed via the bot itself.

### Test Decision
- **Infrastructure exists**: NO (no test framework)
- **Automated tests**: None — reliance on Agent-Executed QA
- **Framework**: bun test (if user wants later)

### QA Policy
Every task MUST include agent-executed QA scenarios. The QA runs the actual bot against LinkedIn (using the user's credentials/session).

- **Evidence**: Console output + screenshots saved to `.sisyphus/evidence/`

---

## Execution Strategy

### Waves

```
Wave 1 (Start — core modules, MAX PARALLEL):
├── Task 1: connect.ts — detect & click Connect buttons [medium]
├── Task 2: connect.ts — infinite scroll + load more profiles [medium]
└── Task 3: connect.ts — limits, delays & anti-detection [medium]

Wave 2 (After Wave 1 — integration):
├── Task 4: index.ts — integrate connect flow into orchestrator [medium]
└── Task 5: verification — full run test [medium]
```

### Dependency Matrix

- **1**: None — can start immediately — Blocks: 4
- **2**: 1 (uses button detection from T1) — Blocks: 4
- **3**: 1 (uses button detection) — Blocks: 4
- **4**: 1, 2, 3 — Blocks: 5
- **5**: 4 — Final verification

---

## TODOs

- [ ] 1. **Create `src/connect.ts` — Button Detection & Clicking**

  **What to do**:
  Create the core module for finding and clicking Connect buttons on LinkedIn's grow page.

  Functions to implement:
  - `findConnectButtons(page)` — scan the page for all visible Connect buttons
    - Use `button[aria-label^="Invite"]` as primary selector (stable text-based)
    - Filter out buttons that have text "Pending", "Follow", or "Message"
    - Return array of element handles
  - `clickConnectButton(page, button)` — click a specific Connect button
    - Scroll element into view first
    - Add small pre-click delay (1-3 seconds random)
    - Click using `elementHandle.click()`
    - Wait 2-3 seconds after click (modal might appear)
    - Return true if click succeeded, false if error
  - `isConnectButton(page, button)` — verify a button is actually "Connect" (double-check text)

  **Selector strategy**:
  ```typescript
  // Primary: aria-label — this is stable
  const allInviteButtons = await page.$$('button[aria-label^="Invite"]');
  
  // Secondary verification: check text contains "Connect" not "Pending"
  // Filter via evaluate on each button
  ```

  **Must NOT do**:
  - Don't rely on CSS class names (they change)
  - Don't click buttons that say "Pending" or "Follow"
  - Don't add note / modal handling (future scope)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-medium`
    - Reason: Core Puppeteer interaction logic — not complex enough for `deep`, but more involved than `quick`
  - **Skills**: `[]` — no special skills needed beyond standard Puppeteer knowledge

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Task 4
  - **Blocked By**: None (can start immediately)

  **References**:
  - `login.ts:33-35` — Existing pattern for Puppeteer page interaction
  - `index.ts:7-12` — Browser launch config pattern
  - Puppeteer docs: `page.$$()`, `elementHandle.click()`, `page.evaluate()`

  **Acceptance Criteria**:

  **QA Scenarios**:

  ```
  Scenario: Find valid Connect buttons on mynetwork/grow/
    Preconditions: Bot has valid session, navigated to mynetwork/grow/
    Steps:
      1. Call findConnectButtons(page)
      2. Check that returned array contains only buttons with "Connect" text
      3. Verify no "Pending" or "Follow" buttons in results
    Expected Result: Only actual "Connect" buttons returned
    Evidence: .sisyphus/evidence/task-1-connect-buttons.md

  Scenario: Click a Connect button successfully
    Preconditions: At least 1 Connect button visible on page
    Steps:
      1. Call findConnectButtons(page) → get first button
      2. Call clickConnectButton(page, button)
      3. Wait 3 seconds
      4. Check that button text changed to "Pending"
    Expected Result: Button clicked, invite sent
    Evidence: .sisyphus/evidence/task-1-click-success.md
  ```

  **Evidence to Capture**:
  - [ ] Screenshot of grow page with Connect buttons highlighted
  - [ ] Console log showing button detection results
  - [ ] Screenshot after click showing "Pending" state

  **Commit**: YES (group with 2, 3)
  - Message: `feat(connect): add button detection and clicking logic`
  - Files: `src/connect.ts`

- [ ] 2. **Create `src/connect.ts` — Infinite Scroll for More Profiles**

  **What to do**:
  Add infinite scroll functionality to load more suggested profiles on mynetwork/grow/.

  Functions to implement:
  - `scrollToLoadMore(page)` — scroll down incrementally
    - Scroll by `window.scrollBy(0, 800)` — roughly one viewport
    - Wait for new content: `waitForSelector` or check page height change
    - Timeout: 5 seconds max wait per scroll
  - `getTotalProfilesLoaded(page)` — count how many profile cards are currently rendered
  - `hasMoreConnectButtons(page)` — check if there are new Connect buttons after scrolling
  - `scrollUntilNoMore(page, maxScrolls)` — keep scrolling until no new Connect buttons appear or maxScrolls reached
    - Max scrolls: default 30 (configurable)
    - Stop condition: 3 consecutive scrolls with no new Connect buttons

  **Scroll logic**:
  ```typescript
  async function scrollToLoadMore(page) {
    const prevHeight = await page.evaluate('document.body.scrollHeight');
    await page.evaluate('window.scrollBy(0, 800)');
    
    // Wait for potential new content
    try {
      await page.waitForFunction(
        `document.body.scrollHeight > ${prevHeight}`,
        { timeout: 5000 }
      );
    } catch {
      // No new content loaded
    }
    await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));
  }
  ```

  **Must NOT do**:
  - Don't scroll too fast — add delays between scrolls
  - Don't use smooth scrolling (can interfere with detection)
  - Don't scroll beyond what's reasonable (maxScrolls guard)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-medium`
    - Reason: Page interaction logic, similar complexity to Task 1
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 4
  - **Blocked By**: Task 1 (uses findConnectButtons)

  **References**:
  - Puppeteer docs: `page.evaluate()`, `page.waitForFunction()`
  - Task 1 (uses findConnectButtons for hasMoreConnectButtons check)

  **Acceptance Criteria**:

  **QA Scenarios**:

  ```
  Scenario: Scroll loads more profiles
    Preconditions: On mynetwork/grow/, initial profiles visible
    Steps:
      1. Count initial Connect buttons: count1 = findConnectButtons(page).length
      2. Call scrollToLoadMore(page)
      3. Count Connect buttons again: count2 = findConnectButtons(page).length
    Expected Result: count2 > count1 (more buttons loaded)
    Failure Indicators: count2 === count1 (no new content loaded)
    Evidence: .sisyphus/evidence/task-2-scroll-loads-more.md

  Scenario: scrollUntilNoMore stops when no more content
    Preconditions: On mynetwork/grow/
    Steps:
      1. Call scrollUntilNoMore(page, maxScrolls=5)
      2. Check function returns without error
      3. Verify page height is stable after last scroll
    Expected Result: Function exits gracefully, no infinite loop
    Evidence: .sisyphus/evidence/task-2-scroll-end.md
  ```

  **Evidence to Capture**:
  - [ ] Console log showing scroll count and button count per scroll

  **Commit**: YES (group with 1, 3)
  - Message: `feat(connect): add infinite scroll for loading profiles`
  - Files: `src/connect.ts`

- [ ] 3. **Create `src/connect.ts` — Limits, Delays & Anti-Detection**

  **What to do**:
  Add rate limiting, randomized delays, and error detection to the connect module.

  Functions to implement:
  - `randomDelay(min, max)` — generate random delay in milliseconds
    - Default: 30000-90000 ms (30-90 seconds between connections)
    - Use `Math.random()` with exponential distribution for more natural timing
  - `detectWeeklyLimit(page)` — check if LinkedIn's "weekly limit reached" popup is showing
    - Search for text "invitation" + "limit" or "You've reached the weekly" on page
    - Return true if limit popup detected
  - `detectCaptcha(page)` — check for security verification page
    - URL contains "checkpoint" or page has security challenge element
  - `detectSessionExpired(page)` — check if redirected to login mid-flow
    - URL contains "/login" or "authwall"
  - `handleLimitReached(page)` — graceful stop when limit reached
    - Log warning message
    - Return stop signal to main loop
  - `processConnections(page, options)` — orchestrator function combining everything
    - Options: `{ maxPerSession, delayMin, delayMax, maxScrolls }`
    - Loop: scroll → find buttons → click → delay → repeat
    - Check limits after each click
    - Return stats: `{ sent, skipped, errors, limitReached, stopped }`

  **Config structure**:
  ```typescript
  interface ConnectOptions {
    maxPerSession: number;   // default: 30
    delayMin: number;        // default: 30000 (30s)
    delayMax: number;        // default: 90000 (90s)
    maxScrolls: number;      // default: 30
  }
  ```

  **Loop pseudocode**:
  ```typescript
  async function processConnections(page, options) {
    let sent = 0;
    
    while (sent < options.maxPerSession) {
      const buttons = await findConnectButtons(page);
      
      if (buttons.length === 0) {
        const hasMore = await scrollUntilNoMore(page, options.maxScrolls);
        if (!hasMore) break; // no more profiles at all
        continue;
      }
      
      for (const button of buttons) {
        if (sent >= options.maxPerSession) break;
        if (await detectWeeklyLimit(page)) break;
        if (await detectSessionExpired(page)) break;
        
        const success = await clickConnectButton(page, button);
        if (success) sent++;
        
        await randomDelay(options.delayMin, options.delayMax);
      }
    }
    
    return { sent };
  }
  ```

  **Must NOT do**:
  - Don't set delays too short (< 20 seconds between clicks)
  - Don't ignore weekly limit popup (must stop immediately)
  - Don't continue if session expired mid-flow
  - Don't send more than maxPerSession (default 30)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-medium`
    - Reason: Logic-heavy with state machine, limits, and error handling
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Task 4
  - **Blocked By**: Task 1 (uses findConnectButtons, clickConnectButton)

  **References**:
  - Task 1 for button detection functions
  - Task 2 for scroll functions
  - Puppeteer docs: `page.$()`, `page.evaluate()`, `page.url()`

  **Acceptance Criteria**:

  **QA Scenarios**:

  ```
  Scenario: Process connections sends up to maxPerSession
    Preconditions: Valid session, on mynetwork/grow/
    Steps:
      1. Call processConnections(page, { maxPerSession: 2, delayMin: 10000, delayMax: 20000 })
      2. Wait for function to complete
      3. Check return value: { sent: 2 }
    Expected Result: Exactly 2 Connect buttons clicked
    Evidence: .sisyphus/evidence/task-3-process-connections.md

  Scenario: Detects weekly limit and stops
    Preconditions: LinkedIn account near weekly limit
    Steps:
      1. Call processConnections(page, { maxPerSession: 10 })
      2. When weekly limit popup appears, function stops
    Expected Result: Function stops before 10, returns { limitReached: true }
    Evidence: .sisyphus/evidence/task-3-limit-detected.md
  ```

  **Evidence to Capture**:
  - [ ] Console log showing each connection attempt
  - [ ] Screenshot of weekly limit popup if triggered
  - [ ] Final stats output

  **Commit**: YES (group with 1, 2)
  - Message: `feat(connect): add rate limiting, delays, and error handling`
  - Files: `src/connect.ts`

- [ ] 4. **Update `index.ts` — Full Orchestration**

  **What to do**:
  Update `index.ts` to integrate the connect flow. Import and call `processConnections` after successful session validation.

  Changes:
  - Add `import { processConnections } from "./connect.ts";`
  - After session validation passes, call `processConnections(page, options)`
  - Log results (sent count, errors, etc.)
  - Handle the case where no Connect buttons found at all
  - Keep session check + graceful exit intact

  **Updated flow**:
  ```typescript
  import { ensureSession } from "./login.ts";
  import { processConnections } from "./connect.ts";
  
  async function main() {
    const browser = await puppeteer.launch({...});
    const page = await browser.newPage();
    // ... user-agent, viewport ...
    
    const sessionValid = await ensureSession(page);
    if (!sessionValid) { /* exit */ }
    
    // Navigate to grow page
    await page.goto("https://www.linkedin.com/mynetwork/grow/", {
      waitUntil: "networkidle2",
    });
    
    // Process connections
    const result = await processConnections(page, {
      maxPerSession: 30,
      delayMin: 30000,
      delayMax: 90000,
      maxScrolls: 30,
    });
    
    // Log results
    console.log("📊 Session complete:");
    console.log(`  ✅ Connected: ${result.sent}`);
    if (result.limitReached) console.log("  ⛔ Weekly limit reached");
    
    await browser.close();
  }
  ```

  **Must NOT do**:
  - Don't remove existing session validation
  - Don't change browser launch config (still headless: false)
  - Don't add anything beyond the connect flow (no new features)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-medium`
    - Reason: Integration and orchestration wiring
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (sequential — after Tasks 1-3)
  - **Blocks**: Task 5
  - **Blocked By**: Tasks 1, 2, 3

  **References**:
  - Current `index.ts` — base to modify
  - Tasks 1-3 for understanding the connect API

  **Acceptance Criteria**:

  **QA Scenarios**:

  ```
  Scenario: Full bot run with connect flow
    Preconditions: Valid SID_LI_AT in .env
    Steps:
      1. Run `bun run index.ts`
      2. Observe browser: login → navigate to grow page → find buttons
      3. Bot sends at least 1 connection request
      4. Check console output for final stats
    Expected Result: Full flow completes, connections sent, clean exit
    Evidence: .sisyphus/evidence/task-4-full-run.md (console + screenshot)
  ```

  **Evidence to Capture**:
  - [ ] Full console log of a bot session
  - [ ] Screenshot of final state

  **Commit**: YES
  - Message: `feat(core): integrate connect flow into main orchestrator`
  - Files: `index.ts`

---

## Final Verification Wave

> After ALL implementation tasks, run end-to-end verification.

- [ ] F1. **End-to-End Test**
  Run `bun run index.ts`. Observe browser: login session, navigate to grow page, find Connect buttons, click at least 2-3 with proper delays. Verify:
  - Login succeeds (no redirect to login page)
  - Navigates to mynetwork/grow/ correctly
  - Finds Connect buttons (not Pending/Follow)
  - Clicks at least 1 button
  - Stops gracefully (after limit or no more buttons)
  - Console logs show all expected output
  - Screenshot evidence saved

---

## Commit Strategy

- **1-3**: `feat(connect): create connection module with detection, scroll, and limits`
- **4**: `feat(core): integrate connect flow into main orchestrator`

---

## Success Criteria

### Final Checklist
- [ ] Bot can complete a full session: login → grow page → send N invites → stop
- [ ] Correctly identifies Connect buttons (not Pending/Follow)
- [ ] Handles weekly limit gracefully
- [ ] Random delays applied between clicks
- [ ] Session expiry detected mid-flow
- [ ] Console logs clear stats at end
