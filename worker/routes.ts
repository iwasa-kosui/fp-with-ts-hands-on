export type WorkerRoute =
  | Readonly<{ kind: "health" }>
  | Readonly<{ kind: "redirect"; location: string }>
  | Readonly<{ kind: "asset" }>;

export const resolveWorkerRoute = (pathname: string): WorkerRoute => {
  if (pathname === "/healthz") return { kind: "health" };

  if (pathname === "/module-00" || pathname === "/module-00/") {
    return {
      kind: "redirect",
      location: "/sessions/00-break-the-app/",
    };
  }

  return { kind: "asset" };
};
