import { Command } from "commander";
import { loadConfig } from "../config/loader";
import { Scheduler } from "../scheduler/engine";
import { MockLinkedInClient } from "../linkedin/mock-client";
import { getCalendarDb } from "../db/connection";

let schedulerInstance: Scheduler | null = null;

export function registerSchedulerCommands(cmd: Command): void {
  cmd
    .command("start")
    .description("Start the scheduler in foreground (Ctrl+C to stop)")
    .option("--mock", "Use mock LinkedIn client")
    .action(async (options: { mock?: boolean }) => {
      try {
        const config = loadConfig();
        const client = new MockLinkedInClient();
        const db = getCalendarDb();

        schedulerInstance = new Scheduler(config, client, db);
        schedulerInstance.start();

        console.log("Scheduler running. Press Ctrl+C to stop.");

        process.on("SIGINT", () => {
          console.log("\nStopping scheduler...");
          if (schedulerInstance) {
            schedulerInstance.stop();
          }
          db.close();
          process.exit(0);
        });

        // Block forever
        await new Promise(() => {});
      } catch (error: any) {
        console.error("Error:", error.message);
        process.exitCode = 1;
      }
    });

  cmd
    .command("status")
    .description("Show scheduler state")
    .action(async () => {
      if (schedulerInstance && schedulerInstance.isRunning()) {
        console.log("Scheduler: RUNNING");
      } else {
        console.log("Scheduler: STOPPED");
        console.log("Use `scheduler start` to start");
      }
    });
}
