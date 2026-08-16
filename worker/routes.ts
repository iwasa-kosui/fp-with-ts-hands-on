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
      location: "/sessions/00-onboarding/",
    };
  }

  if (retiredCurriculumRedirects.has(pathname)) {
    return {
      kind: "redirect",
      location: "/sessions/04-effects-and-events/",
    };
  }

  return { kind: "asset" };
};
