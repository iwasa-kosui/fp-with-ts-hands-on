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
        location: "/sessions/00-system-handover/",
      });
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
  ])("redirects the previous canonical path %s to %s", (pathname, location) => {
    expect(resolveWorkerRoute(pathname)).toEqual({
      kind: "redirect",
      location,
    });
  });

  it.each([
    "/sessions/04-agent-review",
    "/sessions/04-agent-review/",
    "/sessions/05-mini-integration",
    "/sessions/05-mini-integration/",
  ])("redirects the retired curriculum path %s", (pathname) => {
    expect(resolveWorkerRoute(pathname)).toEqual({
      kind: "redirect",
      location: "/sessions/05-effects-and-consistency/",
    });
  });

  it("delegates static pages to assets", () => {
    expect(resolveWorkerRoute("/sessions/01-business-events-and-workflows/")).toEqual({
      kind: "asset",
    });
  });
});
