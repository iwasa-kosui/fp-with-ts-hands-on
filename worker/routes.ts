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
    location: "/sessions/01-state-transitions/",
  },
  {
    pathname: "/sessions/02-boundary-and-ids/",
    location: "/sessions/03-boundaries-and-pii/",
  },
  {
    pathname: "/sessions/03-result-errors/",
    location: "/sessions/04-workflow-errors/",
  },
  {
    pathname: "/sessions/04-effects-and-events/",
    location: "/sessions/06-effects-and-consistency/",
  },
  {
    pathname: "/sessions/04-agent-review",
    location: "/sessions/06-effects-and-consistency/",
  },
  {
    pathname: "/sessions/04-agent-review/",
    location: "/sessions/06-effects-and-consistency/",
  },
  {
    pathname: "/sessions/05-mini-integration",
    location: "/sessions/06-effects-and-consistency/",
  },
  {
    pathname: "/sessions/05-mini-integration/",
    location: "/sessions/06-effects-and-consistency/",
  },
  {
    pathname: "/sessions/03-semantic-identifiers",
    location: "/sessions/03-boundaries-and-pii/",
  },
  {
    pathname: "/sessions/03-semantic-identifiers/",
    location: "/sessions/03-boundaries-and-pii/",
  },
  {
    pathname: "/sessions/01-business-events-and-workflows",
    location: "/sessions/05-business-events-and-workflows/",
  },
  {
    pathname: "/sessions/01-business-events-and-workflows/",
    location: "/sessions/05-business-events-and-workflows/",
  },
  {
    pathname: "/sessions/02-state-transitions",
    location: "/sessions/01-state-transitions/",
  },
  {
    pathname: "/sessions/02-state-transitions/",
    location: "/sessions/01-state-transitions/",
  },
  {
    pathname: "/sessions/03-adt-and-exhaustiveness",
    location: "/sessions/02-adt-and-exhaustiveness/",
  },
  {
    pathname: "/sessions/03-adt-and-exhaustiveness/",
    location: "/sessions/02-adt-and-exhaustiveness/",
  },
  {
    pathname: "/sessions/04-boundaries-and-pii",
    location: "/sessions/03-boundaries-and-pii/",
  },
  {
    pathname: "/sessions/04-boundaries-and-pii/",
    location: "/sessions/03-boundaries-and-pii/",
  },
  {
    pathname: "/sessions/05-workflow-errors",
    location: "/sessions/04-workflow-errors/",
  },
  {
    pathname: "/sessions/05-workflow-errors/",
    location: "/sessions/04-workflow-errors/",
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
