import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { fileURLToPath } from "node:url";

import { sqliteSchema } from "./schema.js";

export type SqliteDatabase = BetterSQLite3Database<typeof sqliteSchema>;

const migrationsFolder = fileURLToPath(new URL(
  import.meta.env.PROD ? "./drizzle" : "../../../../drizzle",
  import.meta.url,
));

export const createSqliteDatabase = (path: string): SqliteDatabase => {
  const client = new Database(path);
  client.pragma("foreign_keys = ON");

  return drizzle(client, { schema: sqliteSchema });
};

export const migrateDatabase = (
  db: SqliteDatabase,
  folder = migrationsFolder,
): void => {
  migrate(db, { migrationsFolder: folder });
};
