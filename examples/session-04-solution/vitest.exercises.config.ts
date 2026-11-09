import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["exercises/**/*.test.ts"],
    exclude: ["exercises/guard/**", "**/node_modules/**"],
  },
});
