import { fileURLToPath } from "node:url";

import { expect, test } from "vitest";
import type { Plugin, ResolvedConfig, UserConfig } from "vite";

import viteConfig from "../vite.config.js";

test("production buildはHono node serverを閉じてからprocessを終了する", async () => {
  expect(viteConfig).toBeTypeOf("function");
  if (typeof viteConfig !== "function") {
    throw new TypeError("Session 01 Vite config must be a function");
  }

  const config = (await viteConfig({
    command: "build",
    isPreview: false,
    isSsrBuild: true,
    mode: "production",
  })) as UserConfig;
  const plugins = (Array.isArray(config.plugins)
    ? config.plugins.flat()
    : [config.plugins]
  ).filter((plugin): plugin is Plugin => Boolean(plugin));
  const nodeBuild = plugins.find(
    (plugin) => plugin.name === "@hono/vite-build/node",
  );

  expect(nodeBuild).toBeDefined();
  if (
    nodeBuild === undefined ||
    typeof nodeBuild.configResolved !== "function" ||
    typeof nodeBuild.load !== "function"
  ) {
    throw new TypeError("Hono node build plugin hooks must be functions");
  }

  await nodeBuild.configResolved({
    root: fileURLToPath(new URL("..", import.meta.url)),
    publicDir: fileURLToPath(new URL("../public", import.meta.url)),
    build: {
      outDir: fileURLToPath(new URL("../dist", import.meta.url)),
    },
  } as ResolvedConfig);
  const loadEntry = nodeBuild.load as unknown as (
    id: string,
  ) => Promise<unknown>;
  const generatedEntry = await loadEntry("\0virtual:build-entry-module");

  expect(generatedEntry).toBeTypeOf("string");
  expect(generatedEntry).toContain("const server = serve");
  expect(generatedEntry).toContain("server.close(() => process.exit(0))");
  expect(generatedEntry).toContain("process.on('SIGINT', gracefulShutdown)");
  expect(generatedEntry).toContain("process.on('SIGTERM', gracefulShutdown)");
});
