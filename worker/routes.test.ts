import { describe, expect, it } from "vitest";
import { resolveWorkerRoute } from "./routes";

describe("resolveWorkerRoute", () => {
  it("keeps health checks in the worker", () => {
    expect(resolveWorkerRoute("/healthz")).toEqual({ kind: "health" });
  });

  it.each(["/module-00", "/module-00/"])(
    "redirects the legacy path %s",
    (pathname) => {
      expect(resolveWorkerRoute(pathname)).toEqual({
        kind: "redirect",
        location: "/modules/00-break-the-app/",
      });
    },
  );

  it("delegates static pages to assets", () => {
    expect(resolveWorkerRoute("/modules/01-state-modeling/")).toEqual({
      kind: "asset",
    });
  });
});
