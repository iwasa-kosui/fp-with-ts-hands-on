import tsconfigBaseSource from "../../../../tsconfig.base.json?raw";
import clinicFixtureSource from "../../../../examples/fixtures/clinic.ts?raw";
import type { ExampleSnapshot } from "../sessions/types";
import type { ProjectFiles } from "./types";

type ProjectSnapshot = Exclude<ExampleSnapshot, "session-01">;

const rawProjectFiles = import.meta.glob(
  "../../../../examples/{session-*,final}/{package.json,tsconfig.json,vitest.config.ts,vitest.exercises.config.ts,src/**/*.ts,exercises/**/*.ts,test/**/*.ts}",
  { eager: true, query: "?raw", import: "default" },
) as Record<string, string>;

const snapshots = [
  "session-00",
  "session-02",
  "session-03",
  "session-04",
  "session-05",
  "session-06",
  "final",
  "session-07",
] as const satisfies readonly ProjectSnapshot[];

const requiredRuntimeFiles = [
  "package.json",
  "tsconfig.json",
  "vitest.config.ts",
] as const;

const buildProjectFiles = (snapshot: ProjectSnapshot): ProjectFiles => {
  const prefix = `../../../../examples/${snapshot}/`;
  const files = Object.fromEntries(
    Object.entries(rawProjectFiles)
      .filter(([path]) => path.startsWith(prefix))
      .map(([path, source]) => [path.slice(prefix.length), source]),
  );
  const missingRuntimeFiles = requiredRuntimeFiles.filter(
    (path) => files[path] === undefined,
  );
  if (missingRuntimeFiles.length > 0) {
    throw new Error(
      `Missing runtime files for snapshot ${snapshot}: ${missingRuntimeFiles.join(", ")}`,
    );
  }

  const packageJson = JSON.parse(files["package.json"]!) as {
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
    [key: string]: unknown;
  };
  const tsconfig = JSON.parse(files["tsconfig.json"]!) as {
    extends?: string;
    [key: string]: unknown;
  };
  const exerciseSequence = /^session-(0[2-6])$/.exec(snapshot)?.[1];

  return Object.freeze({
    ...files,
    "../fixtures/clinic.ts": clinicFixtureSource,
    "package.json": JSON.stringify(
      {
        ...packageJson,
        scripts:
          exerciseSequence === undefined
            ? packageJson.scripts
            : {
                ...packageJson.scripts,
                [`exercise:${exerciseSequence}`]: "pnpm exercise",
              },
        devDependencies: {
          ...packageJson.devDependencies,
          tsx: "4.23.9",
          typescript: "5.9.3",
        },
      },
      null,
      2,
    ),
    "tsconfig.json": JSON.stringify(
      { ...tsconfig, extends: "./tsconfig.base.json" },
      null,
      2,
    ),
    "tsconfig.base.json": tsconfigBaseSource,
  });
};

const projectFilesBySnapshot = Object.fromEntries(
  snapshots.map((snapshot) => [snapshot, buildProjectFiles(snapshot)]),
) as Readonly<Record<ProjectSnapshot, ProjectFiles>>;

export const projectFilesForSnapshot = (
  snapshot: ProjectSnapshot,
): ProjectFiles => projectFilesBySnapshot[snapshot];
