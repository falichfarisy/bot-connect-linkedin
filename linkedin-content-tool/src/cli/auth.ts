import { Command } from "commander";
import { loadConfig } from "../config/loader";
import {
  startOAuthFlow,
  refreshAccessToken,
  isTokenExpiringSoon,
} from "../linkedin/auth";

export function registerAuthCommands(cmd: Command): void {
  cmd
    .command("login")
    .description("Authenticate with LinkedIn via OAuth 2.0")
    .action(async () => {
      const config = loadConfig();
      if (!config.linkedin.clientId || !config.linkedin.clientSecret) {
        console.log(
          "⚠️  LinkedIn credentials not configured. Run `bun run main.ts config init` first to set up clientId and clientSecret.",
        );
        process.exit(1);
      }
      console.log("Opening browser for LinkedIn OAuth...");
      try {
        const result = await startOAuthFlow(config.linkedin);
        console.log("✅ Authentication successful!");
        console.log(`Token expires at: ${result.expiresAt}`);
      } catch (err) {
        console.error(
          "❌ Authentication failed:",
          err instanceof Error ? err.message : String(err),
        );
        process.exit(1);
      }
    });

  cmd
    .command("status")
    .description("Show authentication status")
    .action(async () => {
      const config = loadConfig();
      if (!config.linkedin.accessToken) {
        console.log("Status: NOT AUTHENTICATED");
        console.log("Run `bun run main.ts auth login` to authenticate");
        return;
      }
      const expiring = isTokenExpiringSoon(
        config.linkedin.tokenExpiresAt || "",
      );
      console.log(
        `Status: ${expiring ? "TOKEN EXPIRING SOON" : "AUTHENTICATED"}`,
      );
      console.log(
        `Token expires: ${config.linkedin.tokenExpiresAt || "unknown"}`,
      );
    });

  cmd
    .command("refresh")
    .description("Manually refresh access token")
    .action(async () => {
      const config = loadConfig();
      if (!config.linkedin.refreshToken) {
        console.log(
          "Error: No refresh token available. Run `bun run main.ts auth login` first.",
        );
        return;
      }
      console.log("Refreshing token...");
      try {
        const result = await refreshAccessToken(config.linkedin);
        console.log("✅ Token refreshed successfully");
        console.log(`New token expires at: ${result.expiresAt}`);
      } catch (err) {
        console.error(
          "❌ Token refresh failed:",
          err instanceof Error ? err.message : String(err),
        );
        process.exit(1);
      }
    });
}
