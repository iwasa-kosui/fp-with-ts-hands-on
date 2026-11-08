import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    pool: "forks",
    testTimeout: 180_000,
    include: ["test/*.test.mjs"],
    exclude: ["**/node_modules/**", "test/fixtures/**"],
  },
});
