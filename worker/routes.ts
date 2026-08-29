export type WorkerRoute =
  | Readonly<{ kind: "health" }>
  | Readonly<{ kind: "redirect"; location: string }>
  | Readonly<{ kind: "asset" }>;

type RedirectRoute = Readonly<{ pathname: string; location: string }>;

export const redirectRoutes = [
  { pathname: "/module-00", location: "/sessions/00-system-handover/" },
  { pathname: "/module-00/", location: "/sessions/00-system-handover/" },
  {
    pathname: "/sessions/00-break-the-app/",
    location: "/sessions/00-system-handover/",
  },
  {
    pathname: "/sessions/00-read-the-incident/",
    location: "/sessions/00-system-handover/",
  },
  {
    pathname: "/sessions/00-onboarding/",
    location: "/sessions/00-system-handover/",
  },
  {
    pathname: "/sessions/01-state-modeling/",
    location: "/sessions/02-state-transitions/",
  },
  {
    pathname: "/sessions/02-boundary-and-ids/",
    location: "/sessions/03-boundaries-and-semantic-values/",
  },
  {
    pathname: "/sessions/03-result-errors/",
    location: "/sessions/04-workflow-errors/",
  },
  {
    pathname: "/sessions/04-effects-and-events/",
    location: "/sessions/05-effects-and-consistency/",
  },
  {
    pathname: "/sessions/04-agent-review",
    location: "/sessions/05-effects-and-consistency/",
  },
  {
    pathname: "/sessions/04-agent-review/",
    location: "/sessions/05-effects-and-consistency/",
  },
  {
    pathname: "/sessions/05-mini-integration",
    location: "/sessions/05-effects-and-consistency/",
  },
  {
    pathname: "/sessions/05-mini-integration/",
    location: "/sessions/05-effects-and-consistency/",
  },
] as const satisfies readonly RedirectRoute[];

const redirectLocations = new Map<string, string>(
  redirectRoutes.map(({ pathname, location }) => [pathname, location]),
);

export const resolveWorkerRoute = (pathname: string): WorkerRoute => {
  if (pathname === "/healthz") return { kind: "health" };

  const location = redirectLocations.get(pathname);
  if (location !== undefined) {
    return { kind: "redirect", location };
  }

  return { kind: "asset" };
};
