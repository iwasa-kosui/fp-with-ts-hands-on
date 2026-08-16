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

  it.each([
    "/module-00",
    "/module-00/",
    "/sessions/00-break-the-app/",
    "/sessions/00-read-the-incident/",
  ])(
    "redirects the legacy module path %s permanently",
    async (pathname) => {
      const { env, fetch } = createAssets(new Response("asset"));

      const response = await handleRequest(
        new Request(`https://example.test${pathname}`),
        env,
      );

      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe(
        "https://example.test/sessions/00-system-handover/",
      );
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["/sessions/00-onboarding/", "/sessions/00-system-handover/"],
    ["/sessions/01-state-modeling/", "/sessions/02-state-transitions/"],
    [
      "/sessions/02-boundary-and-ids/",
      "/sessions/03-boundaries-and-semantic-values/",
    ],
    ["/sessions/03-result-errors/", "/sessions/04-workflow-errors/"],
    [
      "/sessions/04-effects-and-events/",
      "/sessions/05-effects-and-consistency/",
    ],
  ])(
    "redirects the previous canonical path %s permanently to %s",
    async (pathname, location) => {
      const { env, fetch } = createAssets(new Response("asset"));

      const response = await handleRequest(
        new Request(`https://example.test${pathname}`),
        env,
      );

      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe(
        `https://example.test${location}`,
      );
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it.each([
    "/sessions/04-agent-review",
    "/sessions/04-agent-review/",
    "/sessions/05-mini-integration",
    "/sessions/05-mini-integration/",
  ])("redirects the retired curriculum path %s without calling assets", async (pathname) => {
    const { env, fetch } = createAssets(new Response("asset"));

    const response = await handleRequest(
      new Request(`https://example.test${pathname}`),
      env,
    );

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "https://example.test/sessions/05-effects-and-consistency/",
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
