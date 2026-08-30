import { cpSync } from "node:fs";

import { createClinicViteConfig } from "@fp-with-ts/clinic-web/vite";
import { defineConfig, type Plugin } from "vite";

import { closeEnvironmentOwnedApp } from "./src/serverLifecycle.js";

const serverEntryUrl = new URL("./src/server.ts", import.meta.url).href;

const closeDatabaseInDevelopment = (): Plugin => ({
  name: "session-07:close-database",
  apply: "serve",
  configureServer: (server) => {
    server.httpServer?.once("close", () => {
      closeEnvironmentOwnedApp(serverEntryUrl);
    });
  },
  handleHotUpdate: ({ modules }) => {
    if (modules.some((module) => Boolean(module.ssrModule))) {
      closeEnvironmentOwnedApp(serverEntryUrl);
    }
  },
});

const copyDrizzleMigrations = (): Plugin => ({
  name: "copy-drizzle-migrations",
  apply: "build",
  closeBundle: () => {
    cpSync(
      new URL("./drizzle", import.meta.url),
      new URL("./dist/drizzle", import.meta.url),
      { recursive: true },
    );
  },
});

const clinicViteConfig = createClinicViteConfig({
  external: ["better-sqlite3"],
  shutdownTimeoutMs: 10_000,
});

export default defineConfig(async (environment) => {
  if (typeof clinicViteConfig !== "function") {
    throw new TypeError("Clinic Vite config must be a function");
  }

  const config = await clinicViteConfig(environment);
  const plugins = Array.isArray(config.plugins)
    ? config.plugins
    : [config.plugins];

  return {
    ...config,
    plugins: [
      closeDatabaseInDevelopment(),
      ...plugins,
      copyDrizzleMigrations(),
    ],
  };
});
