import type { SessionPage } from "./types";

export type SplitSession = Readonly<{
  previous: string;
  previousTitle: string;
  next: string;
  nextTitle: string;
  pages: readonly string[];
  expectedPages: readonly (readonly [string, string, string, string, number])[];
  lastInTime: string;
}>;

const specs = import.meta.glob<{ default: SplitSession }>(
  ["../../../scripts/split-sessions/*.mjs", "!../../../scripts/split-sessions/index.mjs"],
  { eager: true },
);
const pageModules = import.meta.glob<{ sessionPages: readonly SessionPage[] }>(
  ["./*.ts", "!./*.test.ts", "!./*.fixture.ts"],
  { eager: true },
);

export const splitSessions = Object.entries(specs).map(([path, spec]) => {
  const slug = path.replace(/^.*\//, "").replace(/\.mjs$/, "");
  const sessionPages = pageModules[`./${slug}.ts`]?.sessionPages;
  if (sessionPages === undefined) {
    throw new Error(`Missing page definition src/sessions/pages/${slug}.ts`);
  }
  return { slug, ...spec.default, sessionPages };
});
