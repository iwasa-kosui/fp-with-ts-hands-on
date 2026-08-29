import { fileURLToPath } from "node:url";

import { createDatabaseBackedApp } from "./app.js";

const databasePath = import.meta.env.PROD
  ? fileURLToPath(new URL("./clinic.sqlite", import.meta.url))
  : fileURLToPath(new URL("../clinic.sqlite", import.meta.url));
const migrationsFolder = import.meta.env.PROD
  ? fileURLToPath(new URL("./drizzle", import.meta.url))
  : fileURLToPath(new URL("../drizzle", import.meta.url));

const app = createDatabaseBackedApp({
  databasePath,
  migrationsFolder,
  isProduction: import.meta.env.PROD,
});

export default app;
