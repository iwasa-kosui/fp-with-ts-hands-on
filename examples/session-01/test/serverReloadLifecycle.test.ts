import Database from "better-sqlite3";
import { EventEmitter } from "node:events";
import { fileURLToPath } from "node:url";

import { expect, test } from "vitest";
import {
  createServer,
  type HmrContext,
  type Plugin,
  type UserConfig,
  type ViteDevServer,
} from "vite";

import viteConfig from "../vite.config.js";

type TrackedApp = Readonly<{
  database: Database.Database;
  close: () => void;
}>;

const trackedAppsKey = "__session01ServerReloadLifecycleApps";

test("development entryの再評価前に旧SQLite接続を閉じる", async () => {
  const trackedApps: TrackedApp[] = [];
  Object.assign(globalThis, { [trackedAppsKey]: trackedApps });

  const databaseBackedApp: Plugin = {
    name: "test-database-backed-app",
    enforce: "pre",
    resolveId(source, importer) {
      if (source === "./app.js" && importer?.endsWith("/src/server.ts")) {
        return "\0test-database-backed-app";
      }
    },
    load(id) {
      if (id !== "\0test-database-backed-app") {
        return;
      }

      return `
        import Database from "better-sqlite3";

        export const createDatabaseBackedApp = () => {
          const database = new Database(":memory:");
          const app = {
            database,
            close: () => database.close(),
            fetch: () => new Response(),
          };
          globalThis[${JSON.stringify(trackedAppsKey)}].push(app);
          return app;
        };
      `;
    },
  };
  const root = fileURLToPath(new URL("..", import.meta.url));
  const server = await createServer({
    appType: "custom",
    configFile: false,
    logLevel: "silent",
    mode: "development",
    plugins: [databaseBackedApp],
    root,
    server: { middlewareMode: true },
  });

  try {
    await server.ssrLoadModule("/src/server.ts");
    const entry = await server.moduleGraph.getModuleByUrl(
      "/src/server.ts",
      true,
    );
    if (entry === undefined) {
      throw new TypeError("Session 01 server entry must be in module graph");
    }

    if (typeof viteConfig !== "function") {
      throw new TypeError("Session 01 Vite config must be a function");
    }
    const config = (await viteConfig({
      command: "serve",
      isPreview: false,
      mode: "development",
    })) as UserConfig;
    const plugins = (Array.isArray(config.plugins)
      ? config.plugins.flat()
      : [config.plugins]
    ).filter((plugin): plugin is Plugin => Boolean(plugin));
    const closeDatabase = plugins.find(
      (plugin) => plugin.name === "session-01:close-database",
    );
    expect(closeDatabase).toBeDefined();
    if (typeof closeDatabase?.handleHotUpdate !== "function") {
      throw new TypeError("Database cleanup HMR hook must be a function");
    }

    await closeDatabase.handleHotUpdate({
      modules: [entry],
      server,
    } as HmrContext);

    expect(trackedApps[0]?.database.open).toBe(false);

    server.moduleGraph.invalidateModule(entry);
    await server.ssrLoadModule("/src/server.ts");

    expect(trackedApps).toHaveLength(2);
    expect(trackedApps[0]?.database.open).toBe(false);
    expect(trackedApps[1]?.database.open).toBe(true);

    expect(closeDatabase.configureServer).toBeTypeOf("function");
    if (typeof closeDatabase.configureServer !== "function") {
      throw new TypeError("Database cleanup server hook must be a function");
    }
    const httpServer = new EventEmitter();
    closeDatabase.configureServer({
      httpServer,
    } as unknown as ViteDevServer);
    httpServer.emit("close");

    expect(trackedApps[1]?.database.open).toBe(false);
  } finally {
    await server.close();
    for (const app of trackedApps) {
      if (app.database.open) {
        app.close();
      }
    }
    Reflect.deleteProperty(globalThis, trackedAppsKey);
  }
});
