import type { PageObject } from "@hono/inertia";
import type { Context } from "hono";
import { describe, expect, it } from "vitest";

import { createClinicRootView } from "../src/server.js";
import { createClinicViteConfig } from "../src/viteConfig.js";

const page: PageObject = {
  component: "ClinicDashboard",
  props: {},
  url: "/",
  version: "1",
};

const context = {} as Context;

describe("createClinicRootView", () => {
  it("development clientと安全にserializeしたInertia pageを埋め込む", async () => {
    const rootView = createClinicRootView(false, "/src/web/client.tsx");

    const html = await rootView(page, context);

    expect(html).toContain('<html lang="ja">');
    expect(html).toContain(
      'import { injectIntoGlobalHook } from "/@react-refresh";',
    );
    expect(html).toContain("injectIntoGlobalHook(window);");
    expect(html).toContain("window.$RefreshReg$ = () => {};");
    expect(html).toContain("window.$RefreshSig$ = () => (type) => type;");
    expect(html).toContain('src="/src/web/client.tsx"');
    expect(html).toContain('data-page="app"');
    expect(html).not.toContain('/static/styles.css');
  });

  it("production assetsを固定URLで参照する", async () => {
    const rootView = createClinicRootView(true, "/src/web/client.tsx");

    const html = await rootView(page, context);

    expect(html).toContain('src="/static/client.js"');
    expect(html).toContain('href="/static/styles.css"');
    expect(html).not.toContain("/@react-refresh");
  });
});

describe("createClinicViteConfig", () => {
  it("session共通のclient entryをproduction assetへbuildする", async () => {
    const config = createClinicViteConfig();
    expect(config).toBeTypeOf("function");
    if (typeof config !== "function") {
      throw new TypeError("Vite config must be a function");
    }

    const resolved = await config({
      command: "build",
      isPreview: false,
      isSsrBuild: false,
      mode: "client",
    });

    expect(resolved.build?.rollupOptions).toMatchObject({
      input: "./src/web/client.tsx",
      output: {
        assetFileNames: "static/styles.css",
        entryFileNames: "static/client.js",
      },
    });
  });

  it("server buildで指定したnative dependencyをexternalにする", async () => {
    const config = createClinicViteConfig({ external: ["better-sqlite3"] });
    expect(config).toBeTypeOf("function");
    if (typeof config !== "function") {
      throw new TypeError("config must be a function");
    }

    const resolved = await config({
      command: "build",
      isPreview: false,
      isSsrBuild: true,
      mode: "server",
    });

    expect(resolved.ssr?.external).toEqual(["better-sqlite3"]);
  });
});
