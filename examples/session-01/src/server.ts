import { fileURLToPath } from "node:url";

import { serve } from "@hono/node-server";

import { createDatabaseBackedApp } from "./app.js";
import { createShutdown } from "./serverLifecycle.js";

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
const server = serve({ fetch: app.fetch });

if (import.meta.env.PROD) {
  let requestedSignal: NodeJS.Signals | undefined;
  const shutdown = createShutdown({
    server,
    closeDatabase: app.close,
    onComplete: () => {
      if (requestedSignal === undefined) {
        return;
      }

      process.off("SIGINT", onSigint);
      process.off("SIGTERM", onSigterm);
      process.kill(process.pid, requestedSignal);
    },
  });
  const requestShutdown = (signal: NodeJS.Signals): void => {
    requestedSignal ??= signal;
    shutdown();
  };
  const onSigint = () => requestShutdown("SIGINT");
  const onSigterm = () => requestShutdown("SIGTERM");

  process.once("SIGINT", onSigint);
  process.once("SIGTERM", onSigterm);
}

export default app;
