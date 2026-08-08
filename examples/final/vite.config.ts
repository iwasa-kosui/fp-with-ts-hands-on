import { inertiaPages } from "@hono/inertia/vite";
import build from "@hono/vite-build/node";
import devServer from "@hono/vite-dev-server";
import nodeAdapter from "@hono/vite-dev-server/node";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const inertiaPlugin = inertiaPages({
    pagesDir: "src/adaptor/primary/web/pages",
    outFile: "src/adaptor/primary/web/pages.gen.ts",
    serverModule: "../../../app.js",
  });

  if (mode === "client") {
    return {
      plugins: [inertiaPlugin, react()],
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
      inertiaPlugin,
      react(),
      devServer({ entry: "./src/app.ts", adapter: nodeAdapter }),
      build({
        entry: "./src/app.ts",
        external: ["better-sqlite3"],
      }),
    ],
  };
});
