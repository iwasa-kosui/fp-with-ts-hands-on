import { describe, expect, it, vi } from "vitest";
import { handleRequest } from "./index";

const createAssets = (response: Response) => {
  const fetch = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
      response,
  );

  return { env: { ASSETS: { fetch } }, fetch };
};

describe("worker request handler", () => {
  it("returns the health response without calling assets", async () => {
    const { env, fetch } = createAssets(new Response("asset"));

    const response = await handleRequest(
      new Request("https://example.test/healthz"),
      env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(await response.text()).toBe("ok");
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["/module-00", "/module-00/"])(
    "redirects the legacy module path %s permanently",
    async (pathname) => {
      const { env, fetch } = createAssets(new Response("asset"));

      const response = await handleRequest(
        new Request(`https://example.test${pathname}`),
        env,
      );

      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe(
        "https://example.test/sessions/00-break-the-app/",
      );
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("returns the exact asset response for the original request", async () => {
    const assetResponse = new Response("asset", {
      headers: { "x-asset": "original" },
    });
    const { env, fetch } = createAssets(assetResponse);
    const request = new Request(
      "https://example.test/sessions/01-state-modeling/?source=worker-test",
      { headers: { "x-request": "original" } },
    );

    const response = await handleRequest(request, env);

    expect(response).toBe(assetResponse);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(request);
  });
});
