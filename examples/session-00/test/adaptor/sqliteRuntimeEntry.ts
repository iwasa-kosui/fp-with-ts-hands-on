import { sql } from "drizzle-orm";

import {
  createSqliteDatabase,
  migrateDatabase,
} from "../../src/adaptor/secondary/sqlite/db.js";

const database = createSqliteDatabase(":memory:");

migrateDatabase(database);
migrateDatabase(database);

console.log(JSON.stringify(
  database
    .all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
    )
    .map(({ name }) => name),
));
