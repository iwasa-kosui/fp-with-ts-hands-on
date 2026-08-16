import { describe, expect, it } from "vitest";
import { resolveWorkerRoute } from "./routes";

describe("resolveWorkerRoute", () => {
  it("keeps health checks in the worker", () => {
    expect(resolveWorkerRoute("/healthz")).toEqual({ kind: "health" });
  });

  it.each([
    "/module-00",
    "/module-00/",
    "/sessions/00-break-the-app/",
    "/sessions/00-read-the-incident/",
  ])(
    "redirects the legacy path %s",
    (pathname) => {
      expect(resolveWorkerRoute(pathname)).toEqual({
        kind: "redirect",
        location: "/sessions/00-onboarding/",
      });
    },
  );

  it.each([
    "/sessions/04-agent-review",
    "/sessions/04-agent-review/",
    "/sessions/05-mini-integration",
    "/sessions/05-mini-integration/",
  ])("redirects the retired curriculum path %s", (pathname) => {
    expect(resolveWorkerRoute(pathname)).toEqual({
      kind: "redirect",
      location: "/sessions/04-effects-and-events/",
    });
  });

  it("delegates static pages to assets", () => {
    expect(resolveWorkerRoute("/sessions/01-state-modeling/")).toEqual({
      kind: "asset",
    });
  });
});
