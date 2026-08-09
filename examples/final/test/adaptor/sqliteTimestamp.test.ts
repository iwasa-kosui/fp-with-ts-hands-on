import { sql } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import { createSqliteDatabase } from "../../src/adaptor/secondary/sqlite/db.js";
import { sqliteTimestampText } from "../../src/adaptor/secondary/sqlite/sqliteTimestamp.js";

describe("sqliteTimestampText", () => {
  test.each([
    ["2026-08-10T01:02+0930", "2026-08-10T01:02+09:30"],
    ["2026-08-10T01:02:03.123-1400", "2026-08-10T01:02:03.123-14:00"],
    ["2026-08-10T01:02:03+1400", "2026-08-10T01:02:03+14:00"],
    ["2026-08-10T01:02:03Z", "2026-08-10T01:02:03Z"],
    ["2026-08-10T01:02+00:00", "2026-08-10T01:02+00:00"],
    ["2026-08-10T01:02+0000", "2026-08-10T01:02+00:00"],
    ["2026-08-10T01:02:03-09:30", "2026-08-10T01:02:03-09:30"],
    ["2026-08-10", "2026-08-10"],
  ])("normalizes only a trailing compact offset in %s", (value, expected) => {
    const database = createSqliteDatabase(":memory:");

    const row = database.get<{ normalized: string }>(sql`
      SELECT ${sqliteTimestampText(value)} AS normalized
    `);

    expect(row).toEqual({ normalized: expected });
  });

  test("binds a timestamp-like value as data instead of executable SQL", () => {
    const database = createSqliteDatabase(":memory:");
    const value = "2026-08-10T01:02' || raise(FAIL, 'unsafe') || '+0930";

    const row = database.get<{ normalized: string }>(sql`
      SELECT ${sqliteTimestampText(value)} AS normalized
    `);

    expect(row).toEqual({ normalized: value.slice(0, -2) + ":30" });
  });
});
