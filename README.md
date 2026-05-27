# LinkedIn Connection Bot

Automated bot to send LinkedIn connection requests to tech professionals (Tech Leads, Software Engineers, Frontend Engineers) across USA, Australia, and Europe. Uses **Puppeteer + Bun** with a **persistent browser profile** for session persistence.

> ⚠️ **Disclaimer**: This bot is built for educational purposes. Use responsibly — LinkedIn has a weekly limit (~80-100 invites/week). Don't spam.

## Features

- **Tech Role Targeting** — Searches LinkedIn for Tech Leads, Software Engineers, and Frontend Engineers by priority
- **Location Filtering** — Targets USA, Australia, and 9 European countries via LinkedIn Geo IDs
- **Connect → Follow Fallback** — Sends Connect invites first; auto-switches to Follow when the weekly Connect limit is reached
- **Headline Validation** — Verifies each profile's role using keyword matching against `keywords/tech-roles.txt`
- **Human-like Delays** — Configurable random delays between actions to avoid detection
- **Persistent Session** — Login once, reuse the session across runs

## Prerequisites

- [Bun](https://bun.sh) v1.3.5+ — `curl -fsSL https://bun.sh/install | bash`
- [Brave Browser](https://brave.com) (at `/usr/bin/brave`) — or change the `executablePath` in the code for Chrome/Chromium

## Installation

```bash
# Clone & enter the folder
cd bot_connection_linkedin

# Install dependencies
bun install
```

## Usage

### First Run — Login

```bash
bun start
```

A Brave window will open. **Log in to LinkedIn manually** (email + password). After successful login, the bot will:
1. Detect the active session
2. Search LinkedIn for Tech Lead → Software Engineer → Frontend Engineer profiles
3. Send Connect invites (or Follow if Connect is unavailable)

Your login session is saved in `.browser-profile/`. **Next time just run `bun start`** — no need to log in again.

### Skip Login (Session Already Exists)

If your `.browser-profile` session is still valid:

```bash
bun start
```

The bot will detect the session and start immediately.

## How It Works

1. **Search Phase** — For each role (Tech Lead → Software Engineer → Frontend Engineer), the bot searches LinkedIn People Search with location filters
2. **Validation Phase** — Each profile's headline is checked against role-specific keywords in `keywords/tech-roles.txt`
3. **Action Phase** — Valid profiles receive a Connect invite. If the weekly Connect limit is hit, the bot automatically switches to Follow for the remaining profiles
4. **Delay** — A random delay (configurable, default 30-90s) between each action mimics human behavior

### Target Locations

United States, Australia, Germany, United Kingdom, Spain, Italy, Sweden, France, Belgium, Netherlands, Switzerland.

## Project Structure

```
bot_connection_linkedin/
├── get-cookie.ts            # Main entry → `bun start` (login flow + bot)
├── index.ts                 # Alternative entry (no auto-login, session-only)
├── login.ts                 # Helper: check if LinkedIn session is valid
├── src/
│   ├── connect.ts           # Core logic: role detection, main processing loop
│   ├── search.ts            # LinkedIn search navigation & profile extraction
│   └── types.ts             # Type definitions, Geo IDs, role configs
├── keywords/
│   └── tech-roles.txt       # Role keywords for headline validation
├── package.json
├── tsconfig.json
└── .browser-profile/        # Persistent browser profile — gitignored
```

### File Descriptions

| File | Purpose |
|---|---|
| `get-cookie.ts` | **Main entry**. Opens browser, handles login, searches for tech profiles, runs the bot. |
| `index.ts` | Alternative entry. No auto-login — checks existing session only. |
| `login.ts` | `isSessionValid()` — checks if the LinkedIn page shows logged-in indicators (feed, notifications, search). |
| `src/types.ts` | Type definitions, LinkedIn Geo IDs, TechRole enum, role configuration. |
| `src/search.ts` | LinkedIn People Search: URL builder, navigation, profile card extraction, pagination, Connect/Follow click handlers. |
| `src/connect.ts` | Bot logic: role detection from headlines, priority sorting, `processTechRoleConnections()` main loop, CAPTCHA/limit detection. |
| `keywords/tech-roles.txt` | Role-specific keywords (Tech Lead, Software Engineer, Frontend Engineer) for headline validation. |

## Configuration

Edit the options in `get-cookie.ts`:

```ts
const result = await processTechRoleConnections(page, {
  maxPerSession: 30,       // Max connections per session (total)
  maxPerRole: 10,          // Targets per role (Tech Lead, SE, FE)
  delayMinMs: 30000,       // Minimum delay between actions (30s)
  delayMaxMs: 90000,       // Maximum delay between actions (90s)
});
```

### Delay Recommendations

| Speed | Min Delay | Max Delay | Safety |
|---|---|---|---|
| Relaxed | 60s | 120s | ✅ Safest |
| Normal | 30s | 90s | ✅ Safe |
| Fast | 15s | 45s | ⚠️ Higher limit risk |
| Aggressive | 5s | 15s | ❌ Ban risk |

## Safety & Important Notes

### Weekly Limit
LinkedIn limits invites to 80-100 per week (depending on account age). When the limit is hit:
- A popup appears: "You've reached the weekly invitation limit"
- Connect buttons disappear
- **Wait 1 week** — the limit resets automatically
- This is a **protection, not a ban**. It's safe.

### Ban vs Limit
| Scenario | Consequence |
|---|---|
| Hit limit (delays too fast) | Temporarily stopped for 1 week |
| Banned (mass spam, fake accounts) | Account permanently deleted |

Keep delays at 30s minimum to stay safe.

### Connect → Follow Auto-Switch
When the weekly Connect limit is reached, the bot automatically switches to "Follow" mode for the remaining profiles. This keeps the session productive without violating LinkedIn's limits.

### .browser-profile
This folder stores your **LinkedIn login session** (cookies). The session persists even after closing the browser. It is already in `.gitignore`.

If the session expires and the bot asks you to log in again:
```bash
# Delete old profile, log in again
rm -rf .browser-profile
bun start
```

### Different Browser
If you use Chrome/Chromium, change the `executablePath` in `get-cookie.ts`:
```ts
executablePath: "/usr/bin/google-chrome",   // Chrome
executablePath: "/usr/bin/chromium-browser", // Chromium
```

## Troubleshooting

| Issue | Solution |
|---|---|
| Browser opens but bot stops | Check internet connection. Refresh manually and rerun. |
| "Session tidak valid" | Run `bun start` again — log in manually once more. |
| No profiles found for a role | LinkedIn search may return limited results. The bot gracefully skips empty results. |
| Connect button not found | Bot auto-fallsback to Follow. If both missing, the profile is skipped. |
| `ERR_TOO_MANY_REDIRECTS` | Usually fixed by persistent profile. If persistent, delete `.browser-profile/` and re-login. |
| Brave "executable not found" | Install Brave, or change the path to Chrome/Chromium in the code. |
