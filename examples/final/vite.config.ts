import { inertiaPages } from "@hono/inertia/vite";
import build from "@hono/vite-build/node";
import devServer from "@hono/vite-dev-server";
import nodeAdapter from "@hono/vite-dev-server/node";
import react from "@vitejs/plugin-react";
import { builtinModules } from "node:module";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const inertiaPlugin = inertiaPages({
    pagesDir: "src/adaptor/primary/web/pages",
    outFile: "src/adaptor/primary/web/pages.gen.ts",
    serverModule: "../../../server.js",
  });

  if (mode === "client") {
    return {
      plugins: [inertiaPlugin, react()],
      build: {
        copyPublicDir: false,
        emptyOutDir: true,
        outDir: "./dist",
        rollupOptions: {
          input: "./src/adaptor/primary/web/client.tsx",
          output: {
            entryFileNames: "static/client.js",
            chunkFileNames: "static/assets/[name]-[hash].js",
            assetFileNames: "static/styles.css",
          },
        },
      },
    };
  }

  if (mode === "app-artifact") {
    return {
      plugins: [inertiaPlugin, react()],
      ssr: {
        external: ["better-sqlite3"],
        noExternal: true,
        target: "node",
      },
      build: {
        copyPublicDir: false,
        emptyOutDir: false,
        minify: true,
        outDir: "./dist",
        ssr: "./src/app.ts",
        rollupOptions: {
          external: [...builtinModules, /^node:/, "better-sqlite3"],
          output: { entryFileNames: "app.js" },
        },
      },
    };
  }

  return {
    plugins: [
      inertiaPlugin,
      react(),
      devServer({
        entry: "./src/server.ts",
        adapter: nodeAdapter,
        injectClientScript: false,
      }),
      build({
        entry: "./src/server.ts",
        external: ["better-sqlite3"],
        minify: false,
      }),
    ],
  };
});
