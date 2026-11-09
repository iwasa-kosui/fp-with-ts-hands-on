import type { ProjectFiles } from "./types";

export const guardPeerCaseId = "R1-peer-change";

export const guardPaths = {
  config: "exercises/guard/guard.config.mjs",
  cases: "exercises/guard/cases/",
  subjects: "exercises/guard/subjects/",
  mine: "exercises/guard/mine/",
  answer: "exercises/guard/answer/",
  peerCase: `exercises/guard/cases/${guardPeerCaseId}.ts`,
  eslintConfig: "eslint.config.mjs",
  result: "dist/guard/result.json",
} as const;

export const guardCommand = {
  command: "node",
  args: ["vendor/exercise-guard/cli.mjs"],
} as const;

export const guardCommandSize = { cols: 80, rows: 24 } as const;

export type GuardBehaviorPart = Readonly<{ text: string; value?: string }>;

export type GuardBehavior = Readonly<{
  input: GuardBehaviorPart;
  expected: GuardBehaviorPart;
  actual: GuardBehaviorPart;
}>;

export type GuardCaseInfo = Readonly<{
  id: string;
  kind: "bad" | "good";
  title: string;
  stage: number;
  required: boolean;
  path: string | undefined;
  behavior?: GuardBehavior;
}>;

const isVisibleGuardPath = (path: string): boolean =>
  path === guardPaths.eslintConfig ||
  path.startsWith(guardPaths.mine) ||
  path.startsWith(guardPaths.cases) ||
  path.startsWith(guardPaths.subjects);

export const guardVisibleFiles = (projectFiles: ProjectFiles): readonly string[] =>
  Object.keys(projectFiles).filter(isVisibleGuardPath);

export const guardInitialFile = (visibleFiles: readonly string[]): string =>
  visibleFiles.find((path) => path === guardPaths.eslintConfig) ??
  visibleFiles.find((path) => path.startsWith(guardPaths.mine)) ??
  visibleFiles[0] ??
  guardPaths.eslintConfig;

export const isGuardReadOnlyPath = (path: string): boolean =>
  path !== guardPaths.peerCase &&
  (path.startsWith(guardPaths.cases) || path.startsWith(guardPaths.subjects));

export const guardAnswerFiles = (projectFiles: ProjectFiles): ProjectFiles =>
  Object.fromEntries(
    Object.entries(projectFiles).filter(([path]) =>
      path.startsWith(guardPaths.answer),
    ),
  );

const answerDisplayPath = (path: string): string =>
  path === `${guardPaths.answer}${guardPaths.eslintConfig}`
    ? guardPaths.eslintConfig
    : `${guardPaths.mine}${path.slice(`${guardPaths.answer}mine/`.length)}`;

const answerDisplaySource = (source: string): string =>
  source
    .replaceAll("../../subjects/", "../subjects/")
    .replaceAll("../../../../src/", "../../../src/");

export const guardAnswerDisplayFiles = (
  projectFiles: ProjectFiles,
): ProjectFiles =>
  Object.fromEntries(
    Object.entries(guardAnswerFiles(projectFiles))
      .map(([path, source]) => [
        answerDisplayPath(path),
        answerDisplaySource(source),
      ])
      .filter(
        ([displayPath, source]) => projectFiles[displayPath] !== source,
      ),
  );

export const casePathFor = (
  paths: Iterable<string>,
  id: string,
): string | undefined => {
  const known = new Set(paths);
  return [`${guardPaths.cases}${id}.ts`, `${guardPaths.cases}${id}/index.ts`].find(
    (candidate) => known.has(candidate),
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseConfigCases = (source: string): readonly unknown[] | undefined => {
  try {
    const literal = source.replace(/^\s*export\s+default\s*/m, "return ");
    const config: unknown = new Function(literal)();
    return isRecord(config) && Array.isArray(config.cases)
      ? config.cases
      : undefined;
  } catch {
    return undefined;
  }
};

const behaviorPartFrom = (raw: unknown): GuardBehaviorPart | undefined =>
  isRecord(raw) &&
  typeof raw.text === "string" &&
  raw.text !== "" &&
  (raw.value === undefined || typeof raw.value === "string")
    ? {
        text: raw.text,
        ...(typeof raw.value === "string" ? { value: raw.value } : {}),
      }
    : undefined;

const behaviorFrom = (raw: unknown): GuardBehavior | undefined => {
  if (!isRecord(raw)) return undefined;
  const input = behaviorPartFrom(raw.input);
  const expected = behaviorPartFrom(raw.expected);
  const actual = behaviorPartFrom(raw.actual);
  return input === undefined || expected === undefined || actual === undefined
    ? undefined
    : { input, expected, actual };
};

const caseFromConfig = (
  raw: unknown,
  projectFiles: ProjectFiles,
): GuardCaseInfo | undefined => {
  if (!isRecord(raw) || typeof raw.id !== "string") return undefined;
  const behavior = behaviorFrom(raw.behavior);
  return {
    id: raw.id,
    kind: raw.kind === "good" ? "good" : "bad",
    title: typeof raw.title === "string" ? raw.title : raw.id,
    stage: typeof raw.stage === "number" ? raw.stage : 1,
    required: raw.required !== false,
    path: casePathFor(Object.keys(projectFiles), raw.id),
    ...(behavior === undefined ? {} : { behavior }),
  };
};

const casesFromFileNames = (
  projectFiles: ProjectFiles,
): readonly GuardCaseInfo[] =>
  Object.keys(projectFiles)
    .filter((path) => path.startsWith(guardPaths.cases) && path.endsWith(".ts"))
    .sort()
    .map((path) => {
      const id = path
        .slice(guardPaths.cases.length)
        .replace(/\/index\.ts$/, "")
        .replace(/\.ts$/, "");
      return {
        id,
        kind: id.startsWith("G") ? "good" : "bad",
        title: id,
        stage: 1,
        required: true,
        path,
      };
    });

export const readGuardCases = (
  projectFiles: ProjectFiles,
): readonly GuardCaseInfo[] => {
  const source = projectFiles[guardPaths.config];
  const configured =
    source === undefined ? undefined : parseConfigCases(source);
  if (configured === undefined) return casesFromFileNames(projectFiles);
  return configured.flatMap((raw) => {
    const info = caseFromConfig(raw, projectFiles);
    return info === undefined ? [] : [info];
  });
};
