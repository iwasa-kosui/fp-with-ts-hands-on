import { join } from "node:path";

import { expect, test, vi } from "vitest";

const lifecycle = vi.hoisted(() => {
  const close = vi.fn();
  return { close, database: { close } };
});

vi.mock("../../src/adaptor/secondary/sqlite/db.js", () => ({
  createSqliteDatabase: vi.fn(() => lifecycle.database),
  migrateDatabase: vi.fn(() => {
    throw new Error("migration failed");
  }),
}));

import { createDatabaseBackedApp } from "../../src/app.js";

test("migration失敗時は開いたSQLite clientを閉じる", () => {
  expect(() =>
    createDatabaseBackedApp({
      databasePath: join("/tmp", "clinic.sqlite"),
      migrationsFolder: "/tmp/migrations",
      isProduction: false,
    }),
  ).toThrow("migration failed");

  expect(lifecycle.close).toHaveBeenCalledOnce();
});
