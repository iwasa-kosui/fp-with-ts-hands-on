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

  it("redirects a legacy path permanently without calling assets", async () => {
    const { env, fetch } = createAssets(new Response("asset"));

    const response = await handleRequest(
      new Request("https://example.test/module-00"),
      env,
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://example.test/sessions/00-system-handover/",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("preserves query parameters when redirecting", async () => {
    const { env, fetch } = createAssets(new Response("asset"));

    const response = await handleRequest(
      new Request("https://example.test/module-00?source=legacy&step=1"),
      env,
    );

    expect(response.headers.get("location")).toBe(
      "https://example.test/sessions/00-system-handover/?source=legacy&step=1",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns the exact asset response for the original request", async () => {
    const assetResponse = new Response("asset", {
      headers: { "x-asset": "original" },
    });
    const { env, fetch } = createAssets(assetResponse);
    const request = new Request(
      "https://example.test/sessions/01-business-events-and-workflows/?source=worker-test",
      { headers: { "x-request": "original" } },
    );

    const response = await handleRequest(request, env);

    expect(response).toBe(assetResponse);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(request);
  });
});
