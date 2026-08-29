import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { build } from "vite";

import {
  createSqliteDatabase,
  migrateDatabase,
} from "../../src/adaptor/secondary/sqlite/db.js";

const sessionRoot = fileURLToPath(new URL("../..", import.meta.url));

const runBuiltSqliteRuntime = async (): Promise<string> => {
  const outDir = join(sessionRoot, "dist");

  execFileSync("pnpm", ["build"], {
    cwd: sessionRoot,
    stdio: "pipe",
  });

  await build({
    configFile: false,
    define: { "import.meta.env.PROD": "true" },
    logLevel: "silent",
    root: sessionRoot,
    build: {
      emptyOutDir: false,
      outDir,
      ssr: "test/adaptor/sqliteRuntimeEntry.ts",
      rollupOptions: {
        output: { entryFileNames: "sqlite-runtime.mjs" },
      },
    },
  });

  return execFileSync(process.execPath, [join(outDir, "sqlite-runtime.mjs")], {
    cwd: sessionRoot,
    encoding: "utf8",
  });
};

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

  test("ビルド済みSSR artifactから既定migrationを適用できる", async () => {
    const output = await runBuiltSqliteRuntime();

    expect(JSON.parse(output)).toEqual(expect.arrayContaining([
      "__drizzle_migrations",
      "appointments",
      "audit_logs",
    ]));
  });
});
