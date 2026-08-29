import { describe, expect, it } from "vitest";
import { redirectRoutes, resolveWorkerRoute } from "./routes";

describe("resolveWorkerRoute", () => {
  it("keeps health checks in the worker", () => {
    expect(resolveWorkerRoute("/healthz")).toEqual({ kind: "health" });
  });

  it.each(redirectRoutes)(
    "redirects $pathname to $location",
    ({ pathname, location }) => {
      expect(resolveWorkerRoute(pathname)).toEqual({
        kind: "redirect",
        location,
      });
    },
  );

  it("delegates static pages to assets", () => {
    expect(
      resolveWorkerRoute("/sessions/01-business-events-and-workflows/"),
    ).toEqual({
      kind: "asset",
    });
  });
});
