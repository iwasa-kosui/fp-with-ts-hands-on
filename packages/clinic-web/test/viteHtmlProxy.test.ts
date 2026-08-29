import type { PageObject } from "@hono/inertia";
import react from "@vitejs/plugin-react";
import type { Context } from "hono";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";

import { createClinicRootView } from "../src/server.js";

const page: PageObject = {
  component: "ClinicDashboard",
  props: {},
  url: "/",
  version: "1",
};

describe("development HTML proxy", () => {
  let vite: ViteDevServer;

  beforeAll(async () => {
    vite = await createServer({
      appType: "custom",
      configFile: false,
      plugins: [react()],
      server: { hmr: false, middlewareMode: true, ws: false },
    });
  });

  afterAll(async () => {
    await vite.close();
  });

  it("Honoの絶対URLから生成したHTML proxy moduleを解決できる", async () => {
    const rootView = createClinicRootView(false, "/src/client.tsx");
    const context = {
      env: { vite },
      req: {
        path: "/",
        url: "http://localhost:3000/",
      },
    } as Context;

    const html = await rootView(page, context);
    const proxyUrl = html.match(/src="([^"]+html-proxy[^"]+)"/)?.[1];

    expect(proxyUrl).toBeDefined();
    const proxyId = proxyUrl!.replace("/@id/__x00__", "\0");
    await expect(vite.transformRequest(proxyId)).resolves.toMatchObject({
      code: expect.stringContaining("injectIntoGlobalHook"),
    });
  });
});
