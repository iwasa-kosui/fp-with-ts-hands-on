import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveWorkerRoute } from "./routes";

const legacySessionRedirects = [
  "/sessions/01-state-modeling/",
  "/sessions/02-boundary-and-ids/",
  "/sessions/03-result-errors/",
  "/sessions/04-agent-review/",
  "/sessions/05-mini-integration/",
] as const;

const deployedWorkerFirstPaths = [
  "/module-00",
  "/module-00/",
  "/sessions/00-break-the-app/",
  "/sessions/00-read-the-incident/",
  ...legacySessionRedirects,
] as const;

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
    [legacySessionRedirects[0], "/sessions/02-state-vocabulary/"],
    [legacySessionRedirects[1], "/sessions/06-input-boundary/"],
    [legacySessionRedirects[2], "/sessions/09-typed-failures/"],
    [legacySessionRedirects[3], "/sessions/13-safe-follow-up/"],
    [legacySessionRedirects[4], "/sessions/13-safe-follow-up/"],
  ])("redirects the former session path %s", (pathname, location) => {
    expect(resolveWorkerRoute(pathname)).toEqual({ kind: "redirect", location });
  });

  it("runs the worker before deployed assets for every legacy redirect path", () => {
    const config = JSON.parse(
      readFileSync(resolve("../../wrangler.jsonc"), "utf8"),
    ) as { assets?: { run_worker_first?: string[] } };

    expect(config.assets?.run_worker_first).toEqual(
      expect.arrayContaining(deployedWorkerFirstPaths),
    );
  });
});
