import build from "@hono/vite-build/node";
import devServer from "@hono/vite-dev-server";
import nodeAdapter from "@hono/vite-dev-server/node";
import react from "@vitejs/plugin-react";
import { defineConfig, type UserConfigExport } from "vite";

export const createClinicViteConfig = (): UserConfigExport =>
  defineConfig(({ mode }) => {
    if (mode === "client") {
      return {
        plugins: [react()],
        build: {
          copyPublicDir: false,
          emptyOutDir: true,
          outDir: "./dist",
          rollupOptions: {
            input: "./src/web/client.tsx",
            output: {
              entryFileNames: "static/client.js",
              chunkFileNames: "static/assets/[name]-[hash].js",
              assetFileNames: "static/styles.css",
            },
          },
        },
      };
    }

    return {
      plugins: [
        react(),
        devServer({
          entry: "./src/server.ts",
          adapter: nodeAdapter,
          injectClientScript: false,
        }),
        build({
          entry: "./src/server.ts",
          minify: false,
        }),
      ],
    };
  });
