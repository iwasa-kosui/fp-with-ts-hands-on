import { inertiaPages } from "@hono/inertia/vite";
import build from "@hono/vite-build/node";
import devServer from "@hono/vite-dev-server";
import nodeAdapter from "@hono/vite-dev-server/node";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  if (mode === "client") {
    return {
      plugins: [inertiaPages(), react()],
      build: {
        copyPublicDir: false,
        emptyOutDir: false,
        rollupOptions: {
          input: "./src/adaptor/primary/web/client.tsx",
          output: {
            dir: "./dist/static",
            entryFileNames: "client.js",
            assetFileNames: "styles.css",
          },
        },
      },
    };
  }

  return {
    plugins: [
      inertiaPages(),
      react(),
      devServer({ entry: "./src/app.ts", adapter: nodeAdapter }),
      build({
        entry: "./src/app.ts",
        external: ["better-sqlite3"],
      }),
    ],
  };
});
