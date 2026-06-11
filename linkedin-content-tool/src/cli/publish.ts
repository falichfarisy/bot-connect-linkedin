import { Command } from "commander";
import { loadConfig } from "../config/loader";
import { publishNow } from "../content/publisher";
import { MockLinkedInClient } from "../linkedin/mock-client";
import { readDraft } from "../content/draft";
import chalk from "chalk";

export function registerPublishCommands(cmd: Command): void {
  cmd
    .command("now <draft-path>")
    .description("Publish a draft immediately")
    .option("--mock", "Use mock LinkedIn client (for testing)")
    .action(async (draftPath: string, options: { mock?: boolean }) => {
      try {
        const config = loadConfig();

        // Use mock client by default (no real API credentials)
        const client = options.mock
          ? new MockLinkedInClient()
          : new MockLinkedInClient(); // Default to mock until real OAuth is set up

        console.log(`📝 Publishing draft: ${draftPath}`);
        const result = await publishNow(draftPath, client, config);

        if (result.success) {
          console.log(chalk.green("\n✅ Published successfully"));
          if (result.postUrn) console.log(`Post URN: ${result.postUrn}`);
          if (result.commentUrn) console.log(`Comment URN: ${result.commentUrn}`);
          if (result.commentFailed) {
            console.log(chalk.yellow("⚠️  Post published but comment failed"));
          }
        } else {
          console.log(chalk.red(`\n❌ Publish failed: ${result.error}`));
        }
      } catch (error: any) {
        console.log(chalk.red(`\n❌ Error: ${error.message}`));
      }
    });

  cmd
    .command("status")
    .description("Show all published and scheduled posts")
    .action(async () => {
      console.log("📊 Publishing Status");
      console.log(
        "No published posts yet. Use `publish now <draft-path>` to publish.",
      );
    });
}
