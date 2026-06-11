import { describe, test, expect, beforeAll } from "bun:test";
import { Database } from "bun:sqlite";
import {
  saveSnapshot,
  isDataComplete,
  getAllSnapshots,
} from "../storage";
import { renderReport } from "../../cli/analytics";

function createTestDb(): Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE IF NOT EXISTS analytics_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_urn TEXT NOT NULL,
      account_id TEXT NOT NULL DEFAULT 'default',
      impressions INTEGER,
      reactions INTEGER,
      comments INTEGER,
      shares INTEGER,
      saves INTEGER,
      link_clicks INTEGER,
      followers_gained INTEGER,
      profile_views INTEGER,
      snapshot_date TEXT NOT NULL,
      raw_json TEXT,
      UNIQUE(post_urn, snapshot_date)
    );
  `);
  return db;
}

describe("saveSnapshot - null metric storage", () => {
  test("stores null (not 0) when metrics are missing", () => {
    const db = createTestDb();

    saveSnapshot("urn:li:activity:test1", { reactions: 5 }, db);
    saveSnapshot("urn:li:activity:test2", {}, db);

    const rows = db.query("SELECT * FROM analytics_snapshots ORDER BY post_urn").all() as Record<string, unknown>[];
    expect(rows.length).toBe(2);

    const row1 = rows.find(r => r.post_urn === "urn:li:activity:test1")!;
    expect(row1.impressions).toBeNull();
    expect(row1.reactions).toBe(5);
    expect(row1.comments).toBeNull();
    expect(row1.shares).toBeNull();
    expect(row1.saves).toBeNull();

    const row2 = rows.find(r => r.post_urn === "urn:li:activity:test2")!;
    expect(row2.impressions).toBeNull();
    expect(row2.reactions).toBeNull();
    expect(row2.comments).toBeNull();
    expect(row2.shares).toBeNull();
    expect(row2.saves).toBeNull();
  });

  test("stores zero explicitly when value is zero", () => {
    const db = createTestDb();

    saveSnapshot("urn:li:activity:test-zero", {
      impressions: 0,
      reactions: 0,
      comments: 0,
      shares: 0,
      saves: 0,
    }, db);

    const rows = db.query("SELECT * FROM analytics_snapshots").all() as Record<string, unknown>[];
    expect(rows.length).toBe(1);
    expect(rows[0].impressions).toBe(0);
    expect(rows[0].reactions).toBe(0);
    expect(rows[0].comments).toBe(0);
    expect(rows[0].shares).toBe(0);
    expect(rows[0].saves).toBe(0);
  });
});

describe("isDataComplete", () => {
  test("returns false when some metrics are missing", () => {
    const result = isDataComplete({
      impressions: 100,
      reactions: 5,
      comments: 1,
    });
    expect(result).toBe(false);
  });

  test("returns false when all metrics are null", () => {
    const result = isDataComplete({
      impressions: null as unknown as undefined,
      reactions: null as unknown as undefined,
      comments: null as unknown as undefined,
      shares: null as unknown as undefined,
      saves: null as unknown as undefined,
    });
    expect(result).toBe(false);
  });

  test("returns true when all primary metrics are present", () => {
    const result = isDataComplete({
      impressions: 1000,
      reactions: 50,
      comments: 20,
      shares: 10,
      saves: 5,
    });
    expect(result).toBe(true);
  });

  test("returns true with zero values (zero != missing)", () => {
    const result = isDataComplete({
      impressions: 500,
      reactions: 0,
      comments: 0,
      shares: 0,
      saves: 0,
    });
    expect(result).toBe(true);
  });
});

describe("renderReport - N/A display", () => {
  test("displays N/A for missing metrics", async () => {
    const db = createTestDb();

    saveSnapshot("urn:li:activity:partial", { impressions: 100 }, db);

    let output = "";
    const origLog = console.log;
    console.log = (...msgs: unknown[]) => {
      output += msgs.map(String).join(" ") + "\n";
    };

    try {
      await renderReport({}, db);
    } finally {
      console.log = origLog;
    }

    expect(output).toContain("N/A");
    expect(output).toContain("100");
  });

  test("shows warning for incomplete data", async () => {
    const db = createTestDb();

    saveSnapshot("urn:li:activity:partial-1", { impressions: 200 }, db);

    let output = "";
    const origLog = console.log;
    console.log = (...msgs: unknown[]) => {
      output += msgs.map(String).join(" ") + "\n";
    };

    try {
      await renderReport({}, db);
    } finally {
      console.log = origLog;
    }

    expect(output).toContain("incomplete data");
    expect(output).toContain("post too recent");
  });
});

describe("renderReport - complete-only filter", () => {
  test("excludes posts with null metrics when --complete-only is set", async () => {
    const db = createTestDb();

    saveSnapshot("urn:li:activity:full", {
      impressions: 1000,
      reactions: 50,
      comments: 20,
      shares: 10,
      saves: 5,
    }, db);

    saveSnapshot("urn:li:activity:part", {
      impressions: 500,
      reactions: 10,
      comments: 2,
      shares: 1,
    }, db);

    let output = "";
    const origLog = console.log;
    console.log = (...msgs: unknown[]) => {
      output += msgs.map(String).join(" ") + "\n";
    };

    try {
      await renderReport({ completeOnly: true }, db);
    } finally {
      console.log = origLog;
    }

    expect(output).toContain("full");
    expect(output).not.toContain("part");
    expect(output).not.toContain("incomplete data");
  });

  test("shows all posts without --complete-only", async () => {
    const db = createTestDb();

    saveSnapshot("urn:li:activity:full", {
      impressions: 1000,
      reactions: 50,
      comments: 20,
      shares: 10,
      saves: 5,
    }, db);

    saveSnapshot("urn:li:activity:partial", {
      impressions: 500,
      reactions: 10,
    }, db);

    let output = "";
    const origLog = console.log;
    console.log = (...msgs: unknown[]) => {
      output += msgs.map(String).join(" ") + "\n";
    };

    try {
      await renderReport({}, db);
    } finally {
      console.log = origLog;
    }

    expect(output).toContain("full");
    expect(output).toContain("partial");
  });
});

describe("getAllSnapshots - dataComplete flag", () => {
  test("dataComplete is false when snapshot has null metrics", () => {
    const db = createTestDb();

    saveSnapshot("urn:li:activity:dctest1", {
      impressions: 100,
      reactions: 5,
    }, db);

    const snapshots = getAllSnapshots(db);
    expect(snapshots.length).toBe(1);
    expect(snapshots[0].dataComplete).toBe(false);
  });

  test("dataComplete is true when snapshot has all metrics", () => {
    const db = createTestDb();

    saveSnapshot("urn:li:activity:dctest2", {
      impressions: 100,
      reactions: 5,
      comments: 1,
      shares: 0,
      saves: 0,
    }, db);

    const snapshots = getAllSnapshots(db);
    expect(snapshots.length).toBe(1);
    expect(snapshots[0].dataComplete).toBe(true);
  });
});
