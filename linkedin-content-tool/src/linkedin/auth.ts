import type { LinkedInConfig } from "../config/schema";
import { loadConfig, saveConfig } from "../config/loader";

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO 8601
}

function generateState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getRedirectPort(redirectUri: string): number {
  try {
    const url = new URL(redirectUri);
    return parseInt(url.port || "80", 10);
  } catch {
    return 3000;
  }
}

function openBrowser(url: string): void {
  const platform = process.platform;
  const cmd =
    platform === "darwin"
      ? "open"
      : platform === "win32"
        ? "start"
        : "xdg-open";
  const { execSync } = require("child_process");
  execSync(`${cmd} "${url}"`);
}

/**
 * Opens browser for OAuth flow.
 * 1. Generate random CSRF state token
 * 2. Open browser to LinkedIn authorization URL
 * 3. Start temporary HTTP server on redirect URI port (3000)
 * 4. Receive callback with 'code' parameter
 * 5. Exchange code for tokens via POST to LinkedIn token endpoint
 * 6. Save tokens to config.json
 * 7. Shut down HTTP server
 * Returns the tokens
 */
export async function startOAuthFlow(
  config: LinkedInConfig,
): Promise<AuthResult> {
  if (!config.clientId || !config.clientSecret) {
    throw new Error(
      "LinkedIn clientId and clientSecret are required. Run `bun run main.ts config init` to set up credentials.",
    );
  }

  const state = generateState();
  const scope = "openid profile w_member_social";
  const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", config.redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", scope);

  const port = getRedirectPort(config.redirectUri);

  let code: string | null = null;
  let receivedState: string | null = null;
  let serverError: Error | null = null;

  const server = Bun.serve({
    port,
    fetch(req: Request) {
      const url = new URL(req.url);
      const reqCode = url.searchParams.get("code");
      const reqState = url.searchParams.get("state");
      const error = url.searchParams.get("error");
      const errorDescription = url.searchParams.get("error_description");

      if (error) {
        serverError = new Error(
          `OAuth error: ${error}${errorDescription ? ` - ${errorDescription}` : ""}`,
        );
        return new Response(
          `<html><body><h1>Authentication failed</h1><p>${error}${errorDescription ? `: ${errorDescription}` : ""}</p><p>You can close this tab.</p></body></html>`,
          { headers: { "Content-Type": "text/html" } },
        );
      }

      if (reqCode) {
        code = reqCode;
        receivedState = reqState;
        return new Response(
          `<html><body><h1>Authentication complete!</h1><p>You can close this tab.</p></body></html>`,
          { headers: { "Content-Type": "text/html" } },
        );
      }

      return new Response("Not found", { status: 404 });
    },
  });

  try {
    openBrowser(authUrl.toString());

    // Wait for callback with timeout (5 minutes)
    const startTime = Date.now();
    const timeoutMs = 5 * 60 * 1000;

    while (!code && !serverError) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error("OAuth flow timed out after 5 minutes.");
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (serverError) {
      throw serverError;
    }

    if (!code) {
      throw new Error("No authorization code received.");
    }

    if (receivedState !== state) {
      throw new Error("CSRF state mismatch. Possible attack.");
    }

    // Exchange code for tokens
    const response = await fetch(
      "https://www.linkedin.com/oauth/v2/accessToken",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: config.redirectUri,
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Token exchange failed: ${response.status} ${response.statusText} - ${text}`,
      );
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    const expiresAt = new Date(
      Date.now() + (data.expires_in || 60 * 24 * 60 * 60) * 1000,
    ).toISOString();

    const result: AuthResult = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || "",
      expiresAt,
    };

    // Save tokens to config
    const appConfig = loadConfig();
    appConfig.linkedin.accessToken = result.accessToken;
    appConfig.linkedin.refreshToken = result.refreshToken;
    appConfig.linkedin.tokenExpiresAt = result.expiresAt;
    saveConfig(appConfig);

    return result;
  } finally {
    server.stop();
  }
}

/**
 * Uses refresh token to get new access token.
 * POST https://www.linkedin.com/oauth/v2/accessToken
 * with grant_type=refresh_token
 */
export async function refreshAccessToken(
  config: LinkedInConfig,
): Promise<AuthResult> {
  if (!config.clientId || !config.clientSecret) {
    throw new Error(
      "LinkedIn clientId and clientSecret are required. Run `bun run main.ts config init` to set up credentials.",
    );
  }

  if (!config.refreshToken) {
    throw new Error("No refresh token available. Run `bun run main.ts auth login` first.");
  }

  const response = await fetch(
    "https://www.linkedin.com/oauth/v2/accessToken",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: config.refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Token refresh failed: ${response.status} ${response.statusText} - ${text}`,
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const expiresAt = new Date(
    Date.now() + (data.expires_in || 60 * 24 * 60 * 60) * 1000,
  ).toISOString();

  const result: AuthResult = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || config.refreshToken,
    expiresAt,
  };

  // Save tokens to config
  const appConfig = loadConfig();
  appConfig.linkedin.accessToken = result.accessToken;
  appConfig.linkedin.refreshToken = result.refreshToken;
  appConfig.linkedin.tokenExpiresAt = result.expiresAt;
  saveConfig(appConfig);

  return result;
}

/**
 * Checks if token expires within the given threshold (default 7 days)
 */
export function isTokenExpiringSoon(
  expiresAt: string,
  daysThreshold: number = 7,
): boolean {
  if (!expiresAt) return true;
  const expiry = new Date(expiresAt).getTime();
  if (isNaN(expiry)) return true;
  const thresholdMs = daysThreshold * 24 * 60 * 60 * 1000;
  return Date.now() + thresholdMs >= expiry;
}

/**
 * Auto-refreshes if token is expiring soon.
 * Returns updated config if refreshed, or original config if not needed.
 */
export async function ensureValidToken(
  config: LinkedInConfig,
): Promise<LinkedInConfig> {
  if (!config.accessToken) {
    throw new Error("No access token available. Run `bun run main.ts auth login` first.");
  }

  if (isTokenExpiringSoon(config.tokenExpiresAt || "", 7)) {
    if (!config.refreshToken) {
      throw new Error("Token is expiring soon but no refresh token is available. Run `bun run main.ts auth login` to re-authenticate.");
    }
    const result = await refreshAccessToken(config);
    return {
      ...config,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      tokenExpiresAt: result.expiresAt,
    };
  }

  return config;
}
