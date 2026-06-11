import { Command } from "commander";
import { Database } from "bun:sqlite";
import { loadConfig } from "../config/loader";
import { getAnalyticsDb } from "../db/connection";
import { getAllLatestSnapshots, saveSnapshot, isDataComplete, type AnalyticsSnapshot } from "../analytics/storage";
import { MockLinkedInClient } from "../linkedin/mock-client";
import { fetchPostAnalytics, calculateEngagementRate } from "../linkedin/analytics";
import type { LinkedInAnalytics } from "../linkedin/types";
import Table from "cli-table3";
import { writeFileSync } from "fs";

function snapshotToAnalytics(s: AnalyticsSnapshot): LinkedInAnalytics {
  return {
    impressions: s.impressions ?? undefined,
    reactions: s.reactions ?? undefined,
    comments: s.comments ?? undefined,
    shares: s.shares ?? undefined,
    saves: s.saves ?? undefined,
  };
}

/**
 * Renders an analytics report from the given database.
 * Exported separately for testability.
 */
export async function renderReport(
  options: { format?: string; completeOnly?: boolean },
  db: Database,
): Promise<void> {
  const snapshots = getAllLatestSnapshots(db);

  if (snapshots.length === 0) {
    console.log("\ud83d\udcca No analytics data available.");
    console.log("Use `analytics fetch --post-urn <urn>` to fetch data.");
    return;
  }

  const completeSnapshots = snapshots.filter(s => isDataComplete(s));
  const incompleteCount = snapshots.length - completeSnapshots.length;

  let filteredSnapshots = snapshots;
  if (options.completeOnly) {
    filteredSnapshots = completeSnapshots;
  }

  if (filteredSnapshots.length === 0) {
    console.log("No posts with complete data found.");
    return;
  }

  if (options.format === "csv") {
    console.log("post_urn,impressions,reactions,comments,shares,saves,engagement_rate,snapshot_date");
    for (const s of filteredSnapshots) {
      const er = calculateEngagementRate(snapshotToAnalytics(s));
      console.log(`${s.postUrn},${s.impressions ?? "N/A"},${s.reactions ?? "N/A"},${s.comments ?? "N/A"},${s.shares ?? "N/A"},${s.saves ?? "N/A"},${er !== null ? er.toFixed(3) : "N/A"},${s.snapshotDate}`);
    }
  } else {
    const table = new Table({
      head: ["Post URN", "Impressions", "Reactions", "Comments", "Shares", "Saves", "Eng. Rate"],
      style: { head: ["cyan"] },
      colWidths: [30, 12, 10, 10, 8, 8, 10],
    });

    for (const s of filteredSnapshots) {
      const er = calculateEngagementRate(snapshotToAnalytics(s));

      table.push([
        s.postUrn.length > 27 ? s.postUrn.substring(0, 24) + "..." : s.postUrn,
        s.impressions?.toLocaleString() ?? "N/A",
        s.reactions?.toLocaleString() ?? "N/A",
        s.comments?.toLocaleString() ?? "N/A",
        s.shares?.toLocaleString() ?? "N/A",
        s.saves?.toLocaleString() ?? "N/A",
        er !== null ? `${(er * 100).toFixed(1)}%` : "N/A",
      ]);
    }

    console.log(table.toString());

          if (incompleteCount > 0 && !options.completeOnly) {
            console.log(`\n\u26a0\ufe0f  ${incompleteCount} post(s) have incomplete data (some metrics unavailable \u2014 post too recent)`);
            console.log("Use --complete-only to show only posts with full data.");
          }
  }
}

export function registerAnalyticsCommands(cmd: Command): void {
  cmd
    .command("fetch")
    .option("--post-urn <urn>", "Fetch analytics for a specific post")
    .description("Fetch latest analytics from LinkedIn API")
    .action(async (options: { postUrn?: string }) => {
      try {
        loadConfig();
        const client = new MockLinkedInClient();
        const db = getAnalyticsDb();

        if (options.postUrn) {
          const result = await fetchPostAnalytics(client, {
            postUrn: options.postUrn,
            scopeApproved: false,
          });

          saveSnapshot(options.postUrn, result.analytics, db);

          if (result.warning) {
            console.log(`\u26a0\ufe0f  ${result.warning}`);
          }
          console.log("\u2705 Analytics saved");
        } else {
          console.log("Fetching analytics for all posts...");
          console.log("Use --post-urn to specify a post.");
        }

        db.close();
      } catch (error: any) {
        console.log(`Error: ${error.message}`);
        process.exitCode = 1;
      }
    });

  cmd
    .command("report")
    .option("--format <type>", "Output format (table or csv)", "table")
    .option("--complete-only", "Only show posts with complete data")
    .description("Display analytics report")
    .action(async (options: { format: string; completeOnly?: boolean }) => {
      try {
        const db = getAnalyticsDb();
        await renderReport(options, db);
        db.close();
      } catch (error: any) {
        console.log(`Error: ${error.message}`);
        process.exitCode = 1;
      }
    });

  cmd
    .command("export")
    .requiredOption("--output <path>", "Output file path")
    .description("Export analytics to CSV file")
    .action(async (options: { output: string }) => {
      try {
        const db = getAnalyticsDb();
        const snapshots = getAllLatestSnapshots(db);
        db.close();

        let csv = "post_urn,impressions,reactions,comments,shares,saves,engagement_rate,snapshot_date\n";
        for (const s of snapshots) {
          const er = calculateEngagementRate(snapshotToAnalytics(s));
          csv += `${s.postUrn},${s.impressions ?? "N/A"},${s.reactions ?? "N/A"},${s.comments ?? "N/A"},${s.shares ?? "N/A"},${s.saves ?? "N/A"},${er !== null ? er.toFixed(3) : "N/A"},${s.snapshotDate}\n`;
        }

        writeFileSync(options.output, csv);
        console.log(`\u2705 Analytics exported to ${options.output}`);
      } catch (error: any) {
        console.log(`Error: ${error.message}`);
        process.exitCode = 1;
      }
    });
}
