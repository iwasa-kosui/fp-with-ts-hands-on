import Database from "better-sqlite3";
import {
  drizzle,
  type BetterSQLite3Database,
} from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { fileURLToPath } from "node:url";

import { sqliteSchema } from "./schema.js";

export type SqliteDatabase = BetterSQLite3Database<typeof sqliteSchema> &
  Readonly<{
    close: () => void;
  }>;

const defaultMigrationsFolder = fileURLToPath(
  new URL(
    import.meta.env.PROD ? "./drizzle" : "../../../../drizzle",
    import.meta.url,
  ),
);

export const createSqliteDatabase = (path: string): SqliteDatabase => {
  const client = new Database(path);
  let closed = false;
  client.pragma("foreign_keys = ON");

  return Object.assign(drizzle(client, { schema: sqliteSchema }), {
    close: () => {
      if (closed) {
        return;
      }

      closed = true;
      client.close();
    },
  });
};

export const migrateDatabase = (
  database: SqliteDatabase,
  migrationsFolder = defaultMigrationsFolder,
): void => {
  migrate(database, { migrationsFolder });
};
