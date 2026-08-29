import { expect, test, vi } from "vitest";

import { createShutdown } from "../src/serverLifecycle.js";

test("shutdownはHTTP serverを閉じてからdatabaseを一度だけ閉じる", () => {
  const events: string[] = [];
  const closeDatabase = vi.fn(() => events.push("database"));
  const server = {
    close: vi.fn((callback: () => void) => {
      events.push("server");
      callback();
    }),
  };
  const shutdown = createShutdown({ server, closeDatabase });

  shutdown();
  shutdown();

  expect(events).toEqual(["server", "database"]);
  expect(server.close).toHaveBeenCalledOnce();
  expect(closeDatabase).toHaveBeenCalledOnce();
});
