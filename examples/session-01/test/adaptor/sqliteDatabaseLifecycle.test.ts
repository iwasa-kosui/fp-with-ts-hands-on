import { expect, test, vi } from "vitest";

const nativeClose = vi.hoisted(() => vi.fn());

vi.mock("better-sqlite3", () => ({
  default: class {
    pragma(): void {}

    close = nativeClose;
  },
}));

import { createSqliteDatabase } from "../../src/adaptor/secondary/sqlite/db.js";

test("SQLite databaseを繰り返し閉じてもnative clientは一度だけ閉じる", () => {
  const database = createSqliteDatabase(":memory:");

  database.close();
  database.close();

  expect(nativeClose).toHaveBeenCalledOnce();
});
