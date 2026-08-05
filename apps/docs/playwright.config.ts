import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  use: { baseURL: "http://127.0.0.1:4321", locale: "ja-JP" },
  webServer: {
    command: "pnpm dev --port 4321",
    url: "http://127.0.0.1:4321",
    reuseExistingServer: false,
  },
});
