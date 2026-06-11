import { Command } from "commander";
import { readDraft, deleteDraft, listDrafts } from "../content/draft";
import { loadConfig } from "../config/loader";
import { generateDraft } from "../content/drafter";
import { execSync } from "child_process";
import Table from "cli-table3";
import { existsSync } from "fs";
import { createInterface } from "readline";

export function registerDraftCommands(cmd: Command): void {
  cmd
    .command("create")
    .description("Create a new draft")
    .requiredOption("--topic <topic>", "Draft topic")
    .option("--angle <angle>", "Content angle (e.g., contrarian, howto, story)")
    .option("--voice-profile <name>", "Voice profile to use")
    .action(async (opts: { topic: string; angle?: string; voiceProfile?: string }) => {
      const result = await generateDraft({
        topic: opts.topic,
        angle: opts.angle,
        voiceProfile: opts.voiceProfile,
      }).catch((err: Error) => {
        console.error("Failed to create draft:", err.message);
        throw err;
      });
      console.log("Draft created successfully!");
      console.log(`   Path: ${result.path}`);
      console.log(`   Title: ${result.metadata.title}`);
      console.log(`   Words: ${result.content.split(/\s+/).length}`);
      console.log(`   Model: ${result.metadata.aiModel}`);
    });

  cmd
    .command("list")
    .description("List all drafts")
    .option("--status <status>", "Filter by status")
    .action((opts: { status?: string }) => {
      const config = loadConfig();
      const drafts = listDrafts(config.content.draftsDir, {
        status: opts.status,
      });

      if (drafts.length === 0) {
        console.log("No drafts found.");
        return;
      }

      const table = new Table({
        head: ["ID", "Title", "Status", "Topic", "Scheduled"],
        style: { head: ["cyan"] },
        colWidths: [22, 30, 12, 16, 22],
      });

      for (const draft of drafts) {
        table.push([
          draft.id,
          draft.title.length > 28 ? draft.title.slice(0, 27) + "\u2026" : draft.title,
          draft.status,
          draft.topic.length > 14 ? draft.topic.slice(0, 13) + "\u2026" : draft.topic,
          draft.scheduledAt
            ? new Date(draft.scheduledAt).toLocaleDateString()
            : "-",
        ]);
      }

      console.log(table.toString());
    });

  cmd
    .command("edit")
    .description("Open draft in default editor")
    .argument("<path>", "Path to draft file")
    .action((path: string) => {
      if (!existsSync(path)) {
        console.error("Draft not found:", path);
        process.exitCode = 1;
        return;
      }

      const editor = process.env.EDITOR || "vim";
      try {
        execSync(`${editor} "${path}"`, { stdio: "inherit" });
      } catch {
        console.error("Editor exited with an error.");
        process.exitCode = 1;
      }
    });

  cmd
    .command("delete")
    .description("Delete a draft")
    .argument("<path>", "Path to draft file")
    .action((path: string) => {
      if (!existsSync(path)) {
        console.error("Draft not found:", path);
        process.exitCode = 1;
        return;
      }

      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question(`Delete ${path}? (y/N): `, (answer: string) => {
        rl.close();
        if (answer.toLowerCase() !== "y") {
          console.log("Cancelled.");
          return;
        }

        try {
          deleteDraft(path);
          console.log("Deleted:", path);
        } catch (err) {
          console.error(
            "Failed to delete:",
            err instanceof Error ? err.message : String(err),
          );
          process.exitCode = 1;
        }
      });
    });

  cmd
    .command("show")
    .description("Display draft content and metadata")
    .argument("<path>", "Path to draft file")
    .action((path: string) => {
      try {
        const { content, metadata } = readDraft(path);

        console.log("--- Metadata ---");
        console.log(`ID:       ${metadata.id}`);
        console.log(`Title:    ${metadata.title}`);
        console.log(`Status:   ${metadata.status}`);
        console.log(`Topic:    ${metadata.topic}`);
        console.log(`Angle:    ${metadata.angle || "-"}`);
        console.log(`Voice:    ${metadata.voiceProfile}`);
        console.log(`Model:    ${metadata.aiModel}`);
        console.log(`Created:  ${metadata.createdAt}`);
        console.log(`Updated:  ${metadata.updatedAt}`);
        if (metadata.scheduledAt) {
          console.log(`Scheduled: ${metadata.scheduledAt}`);
        }
        console.log("");
        console.log("--- Content ---");
        console.log(content);
      } catch (err) {
        console.error(
          "Failed to read draft:",
          err instanceof Error ? err.message : String(err),
        );
        process.exitCode = 1;
      }
    });
}
