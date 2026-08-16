export type WorkerRoute =
  | Readonly<{ kind: "health" }>
  | Readonly<{ kind: "redirect"; location: string }>
  | Readonly<{ kind: "asset" }>;

const onboardingRedirects = new Set([
  "/module-00",
  "/module-00/",
  "/sessions/00-break-the-app/",
  "/sessions/00-read-the-incident/",
]);

const previousCanonicalRedirects = new Map([
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
]);

const retiredCurriculumRedirects = new Set([
  "/sessions/04-agent-review",
  "/sessions/04-agent-review/",
  "/sessions/05-mini-integration",
  "/sessions/05-mini-integration/",
]);

export const resolveWorkerRoute = (pathname: string): WorkerRoute => {
  if (pathname === "/healthz") return { kind: "health" };

  if (onboardingRedirects.has(pathname)) {
    return {
      kind: "redirect",
      location: "/sessions/00-system-handover/",
    };
  }

  const previousCanonicalLocation = previousCanonicalRedirects.get(pathname);
  if (previousCanonicalLocation !== undefined) {
    return { kind: "redirect", location: previousCanonicalLocation };
  }

  if (retiredCurriculumRedirects.has(pathname)) {
    return {
      kind: "redirect",
      location: "/sessions/05-effects-and-consistency/",
    };
  }

  return { kind: "asset" };
};
