import { sql } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import {
  createSqliteDatabase,
  migrateDatabase,
} from "../../src/adaptor/secondary/sqlite/db.js";

describe("SQLite runtime", () => {
  test("migrationを繰り返し適用しても初期テーブルを利用できる", () => {
    const database = createSqliteDatabase(":memory:");

    migrateDatabase(database);
    migrateDatabase(database);

    expect(
      database
        .all<{ name: string }>(
          sql`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
        )
        .map(({ name }) => name),
    ).toEqual(expect.arrayContaining([
      "__drizzle_migrations",
      "appointments",
      "audit_logs",
    ]));
  });
});
