import type { ExampleSnapshot } from "../sessions/types";

export type ProjectFiles = Readonly<Record<string, string>>;

export type SessionWorkspace<
  Snapshot extends ExampleSnapshot = ExampleSnapshot,
> = Readonly<{
  slug: string;
  snapshot: Snapshot;
  description: string;
  initialFile: string;
  visibleFiles: readonly string[];
}>;
