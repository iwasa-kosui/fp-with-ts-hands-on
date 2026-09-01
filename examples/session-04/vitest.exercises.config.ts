import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@fp-with-ts/clinic-web/server": fileURLToPath(
        new URL("./exercises/clinicWebServerStub.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["exercises/**/*.test.ts"],
  },
});
