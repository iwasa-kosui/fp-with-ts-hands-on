import react from "@astrojs/react";
import { defineConfig } from "astro/config";

export const isolationHeaders = {
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Opener-Policy": "same-origin",
} as const;

export default defineConfig({
  devToolbar: { enabled: false },
  integrations: [react()],
  output: "static",
  outDir: "./dist",
  trailingSlash: "always",
  server: { headers: isolationHeaders },
});
