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

export const resolveWorkerRoute = (pathname: string): WorkerRoute => {
  if (pathname === "/healthz") return { kind: "health" };

  if (onboardingRedirects.has(pathname)) {
    return {
      kind: "redirect",
      location: "/sessions/00-onboarding/",
    };
  }

  return { kind: "asset" };
};
