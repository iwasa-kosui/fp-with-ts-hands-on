import { fileURLToPath } from "node:url";

import { createDatabaseBackedApp } from "./app.js";

const app = createDatabaseBackedApp({
  databasePath: fileURLToPath(new URL("../clinic.sqlite", import.meta.url)),
  migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
  isProduction: import.meta.env.PROD,
});

export default app;
