import { createApp } from "./app.js";
import {
  createSqliteDatabase,
  migrateDatabase,
} from "./adaptor/secondary/sqlite/db.js";

const database = createSqliteDatabase(":memory:");
migrateDatabase(database);

const app = createApp(database, import.meta.env.PROD);

export default app;
