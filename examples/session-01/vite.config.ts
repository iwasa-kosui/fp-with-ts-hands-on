import { cpSync } from "node:fs";

import { createClinicViteConfig } from "@fp-with-ts/clinic-web/vite";
import { defineConfig, type Plugin } from "vite";

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
    plugins: [...plugins, copyDrizzleMigrations()],
  };
});
