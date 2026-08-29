import { expect, test, vi } from "vitest";

const app = vi.hoisted(() => ({ close: vi.fn(), fetch: vi.fn() }));

vi.mock("../src/app.js", () => ({
  createDatabaseBackedApp: vi.fn(() => app),
}));

vi.mock("@hono/node-server", () => ({
  serve: vi.fn(),
}));

import { serve } from "@hono/node-server";

test("development entryはHTTP起動とprocess cleanupをViteへ委譲する", async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("PROD", false);
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

    expect(processOnce.mock.calls.some(([event]) => event === "exit")).toBe(
      false,
    );
    expect(app.close).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllEnvs();
    processOn.mockRestore();
    processOnce.mockRestore();
  }
});

test("production entryはprocess exitで所有appを一度閉じる", async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("PROD", true);
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
    expect(closeOnExit).toBeTypeOf("function");

    closeOnExit?.(0);
    closeOnExit?.(0);

    expect(app.close).toHaveBeenCalledOnce();
  } finally {
    vi.unstubAllEnvs();
    processOn.mockRestore();
    processOnce.mockRestore();
  }
});
