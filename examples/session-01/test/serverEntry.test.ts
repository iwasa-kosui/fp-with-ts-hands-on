import { readFileSync } from "node:fs";

import { expect, test, vi } from "vitest";

const app = vi.hoisted(() => ({ close: vi.fn(), fetch: vi.fn() }));

vi.mock("../src/app.js", () => ({
  createDatabaseBackedApp: vi.fn(() => app),
}));

vi.mock("@hono/node-server", () => ({
  serve: vi.fn(),
}));

import { serve } from "@hono/node-server";

test("server entryの評価はViteへHTTP lifecycleを委譲する", async () => {
  const processOnce = vi.spyOn(process, "once");

  await import("../src/server.js");

  expect(serve).not.toHaveBeenCalled();
  expect(processOnce).not.toHaveBeenCalled();

  const source = readFileSync(
    new URL("../src/server.ts", import.meta.url),
    "utf8",
  );
  expect(source).not.toContain("@hono/node-server");
  expect(source).not.toContain("process.once");

  processOnce.mockRestore();
});
