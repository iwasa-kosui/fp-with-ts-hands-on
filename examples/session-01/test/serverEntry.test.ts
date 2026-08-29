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

test("server entryはHTTP起動をViteへ委譲しprocess終了時にappを閉じる", async () => {
  const processOnce = vi.spyOn(process, "once");
  const processOn = vi.spyOn(process, "on");
  processOnce.mockImplementation((() => process) as typeof process.once);

  try {
    await import("../src/server.js");

    expect(serve).not.toHaveBeenCalled();
    expect(
      processOnce.mock.calls.some(
        ([event]) => event === "SIGINT" || event === "SIGTERM",
      ),
    ).toBe(false);
    expect(
      processOn.mock.calls.some(
        ([event]) => event === "SIGINT" || event === "SIGTERM",
      ),
    ).toBe(false);

    const closeOnExit = processOnce.mock.calls.find(
      ([event]) => event === "exit",
    )?.[1] as NodeJS.ExitListener | undefined;
    expect(closeOnExit).toBeDefined();
    closeOnExit?.(0);
    expect(app.close).toHaveBeenCalledOnce();

    const source = readFileSync(
      new URL("../src/server.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain("@hono/node-server");
    expect(source).not.toMatch(
      /process\.(?:on|once|addListener)\(["']SIG(?:INT|TERM)/,
    );
  } finally {
    processOn.mockRestore();
    processOnce.mockRestore();
  }
});
