import { Command } from "commander";
import { getCalendarDb } from "../db/connection";
import { readDraft, updateDraft } from "../content/draft";
import { transition, canTransition } from "../calendar/state-machine";
import Table from "cli-table3";

export function registerCalendarCommands(cmd: Command): void {
  cmd
    .command("add <draft-path>")
    .requiredOption("--at <datetime>", "Scheduled datetime (ISO 8601)")
    .description("Add a draft to the calendar")
    .action(async (draftPath: string, options: { at: string }) => {
      try {
        const scheduledDate = new Date(options.at);
        if (isNaN(scheduledDate.getTime())) {
          console.log(
            "Error: Invalid datetime format. Use ISO 8601 (e.g., 2026-06-15T08:00:00Z)",
          );
          return;
        }

        const draft = readDraft(draftPath);

        if (!canTransition(draft.metadata.status, "scheduled")) {
          console.log(
            `Error: Cannot schedule draft in status "${draft.metadata.status}"`,
          );
          return;
        }

        const now = new Date().toISOString();

        updateDraft(draftPath, draft.content, {
          status: "scheduled",
          scheduledAt: options.at,
          updatedAt: now,
        });


        const db = getCalendarDb();
        const insertStmt = db.prepare(
          "INSERT INTO content_items (id, title, status, draft_path, scheduled_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        );
        insertStmt.run(
          draft.metadata.id,
          draft.metadata.title,
          draft.metadata.status,
          draftPath,
          options.at,
          now,
          now,
        );

        transition(draft.metadata.id, draft.metadata.status, "scheduled", db);
        db.close();

        console.log(`Draft scheduled for ${options.at}`);
      } catch (error: any) {
        console.log(`Error: ${error.message}`);
      }
    });

  cmd
    .command("list")
    .option("--status <status>", "Filter by status")
    .description("List all calendar items")
    .action(async (options: { status?: string }) => {
      try {
        const db = getCalendarDb();
        let query =
          "SELECT id, title, status, scheduled_at, created_at FROM content_items";
        const params: any[] = [];

        if (options.status) {
          query += " WHERE status = ?";
          params.push(options.status);
        }
        query += " ORDER BY scheduled_at ASC";

        const items = db.prepare(query).all(...params) as any[];
        db.close();

        if (items.length === 0) {
          console.log("No calendar items found.");
          return;
        }

        const table = new Table({
          head: ["ID", "Title", "Status", "Scheduled"],
          style: { head: ["cyan"] },
          colWidths: [22, 40, 12, 22],
        });

        for (const item of items) {
          table.push([
            item.id,
            item.title?.substring(0, 38) || "(untitled)",
            item.status,
            item.scheduled_at
              ? new Date(item.scheduled_at).toLocaleDateString()
              : "-",
          ]);
        }

        console.log(table.toString());
      } catch (error: any) {
        console.log(`Error: ${error.message}`);
      }
    });

  cmd
    .command("move <item-id>")
    .requiredOption("--to <datetime>", "New scheduled datetime (ISO 8601)")
    .description("Reschedule a calendar item")
    .action(async (itemId: string, options: { to: string }) => {
      try {
        const newDate = new Date(options.to);
        if (isNaN(newDate.getTime())) {
          console.log(
            "Error: Invalid datetime format. Use ISO 8601 (e.g., 2026-06-15T08:00:00Z)",
          );
          return;
        }

        const db = getCalendarDb();
        const item = db
          .prepare("SELECT id, status FROM content_items WHERE id = ?")
          .get(itemId) as { id: string; status: string } | undefined;

        if (!item) {
          console.log(`Error: Calendar item not found: ${itemId}`);
          db.close();
          return;
        }

        if (!canTransition(item.status, "scheduled")) {
          console.log(
            `Error: Cannot reschedule item in status "${item.status}"`,
          );
          db.close();
          return;
        }

        db.prepare(
          "UPDATE content_items SET scheduled_at = ?, updated_at = ? WHERE id = ?",
        ).run(options.to, new Date().toISOString(), itemId);

        transition(itemId, item.status, "scheduled", db);

        db.close();
        console.log(`Item ${itemId} rescheduled to ${options.to}`);
      } catch (error: any) {
        console.log(`Error: ${error.message}`);
      }
    });

  cmd
    .command("remove <item-id>")
    .description("Remove item from calendar (move back to approved)")
    .action(async (itemId: string) => {
      try {
        const db = getCalendarDb();
        const item = db
          .prepare("SELECT id, status FROM content_items WHERE id = ?")
          .get(itemId) as { id: string; status: string } | undefined;

        if (!item) {
          console.log(`Error: Calendar item not found: ${itemId}`);
          db.close();
          return;
        }

        if (!canTransition(item.status, "approved")) {
          console.log(
            `Error: Cannot remove item in status "${item.status}"`,
          );
          db.close();
          return;
        }

        transition(itemId, item.status, "approved", db);
        db.close();

        console.log(`Item ${itemId} moved back to approved`);
      } catch (error: any) {
        console.log(`Error: ${error.message}`);
      }
    });
}
