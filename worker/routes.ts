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

const sessionRedirects = new Map([
  ["/sessions/01-state-modeling/", "/sessions/02-state-vocabulary/"],
  ["/sessions/02-boundary-and-ids/", "/sessions/06-input-boundary/"],
  ["/sessions/03-result-errors/", "/sessions/09-typed-failures/"],
  ["/sessions/04-agent-review/", "/sessions/13-safe-follow-up/"],
  ["/sessions/05-mini-integration/", "/sessions/13-safe-follow-up/"],
]);

export const resolveWorkerRoute = (pathname: string): WorkerRoute => {
  if (pathname === "/healthz") return { kind: "health" };

  if (onboardingRedirects.has(pathname)) {
    return {
      kind: "redirect",
      location: "/sessions/00-onboarding/",
    };
  }

  const sessionRedirect = sessionRedirects.get(pathname);
  if (sessionRedirect !== undefined) {
    return { kind: "redirect", location: sessionRedirect };
  }

  return { kind: "asset" };
};
