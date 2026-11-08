import { fileURLToPath } from "node:url";

import { createDatabaseBackedApp } from "./app.js";
import { createEnvironmentOwnedApp } from "./serverLifecycle.js";

const databasePath = import.meta.env.PROD
  ? fileURLToPath(new URL("./clinic.sqlite", import.meta.url))
  : fileURLToPath(new URL("../clinic.sqlite", import.meta.url));
const migrationsFolder = import.meta.env.PROD
  ? fileURLToPath(new URL("./drizzle", import.meta.url))
  : fileURLToPath(new URL("../drizzle", import.meta.url));

const app = createEnvironmentOwnedApp({
  createApp: () =>
    createDatabaseBackedApp({
      databasePath,
      migrationsFolder,
      isProduction: import.meta.env.PROD,
    }),
  environment: import.meta.url,
  hot: import.meta.hot,
  isProduction: import.meta.env.PROD,
  process,
});

export default app;
