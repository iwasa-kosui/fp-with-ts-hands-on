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

  it("delegates static pages to assets", () => {
    for (const pathname of [
      "/sessions/01-invariants/",
      "/sessions/02-state-vocabulary/",
      "/sessions/06-input-boundary/",
      "/sessions/09-typed-failures/",
      "/sessions/13-safe-follow-up/",
    ]) {
      expect(resolveWorkerRoute(pathname)).toEqual({ kind: "asset" });
    }
  });

  it.each([
    ["/sessions/01-state-modeling/", "/sessions/02-state-vocabulary/"],
    ["/sessions/02-boundary-and-ids/", "/sessions/06-input-boundary/"],
    ["/sessions/03-result-errors/", "/sessions/09-typed-failures/"],
    ["/sessions/04-agent-review/", "/sessions/13-safe-follow-up/"],
    ["/sessions/05-mini-integration/", "/sessions/13-safe-follow-up/"],
  ])("redirects the former session path %s", (pathname, location) => {
    expect(resolveWorkerRoute(pathname)).toEqual({ kind: "redirect", location });
  });
});
