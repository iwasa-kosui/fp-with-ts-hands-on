import type { ExampleSnapshot } from "../sessions/catalog";

export type ProjectFiles = Readonly<Record<string, string>>;

export type SessionWorkspace = Readonly<{
  slug: string;
  snapshot: ExampleSnapshot;
  description: string;
  initialFile: string;
  visibleFiles: readonly string[];
}>;
