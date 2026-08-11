import tsconfigBaseSource from "../../../../tsconfig.base.json?raw";
import {
  sessionBySlug,
  type ExampleSnapshot,
} from "../sessions/catalog";
import type { ProjectFiles } from "./types";

const rawProjectFiles = import.meta.glob(
  [
    "../../../../examples/session-00/{package.json,tsconfig.json,vitest.config.ts,vitest.exercises.config.ts,src/**/*.ts,exercises/**/*.ts,test/**/*.ts}",
    "../../../../examples/session-01/{package.json,tsconfig.json,vitest.config.ts,vitest.exercises.config.ts,src/**/*.ts,exercises/**/*.ts,test/**/*.ts}",
    "../../../../examples/session-02/{package.json,tsconfig.json,vitest.config.ts,vitest.exercises.config.ts,src/**/*.ts,exercises/**/*.ts,test/**/*.ts}",
    "../../../../examples/session-03/{package.json,tsconfig.json,vitest.config.ts,vitest.exercises.config.ts,src/**/*.ts,exercises/**/*.ts,test/**/*.ts}",
    "../../../../examples/session-04/{package.json,tsconfig.json,vitest.config.ts,vitest.exercises.config.ts,src/**/*.ts,exercises/**/*.ts,test/**/*.ts}",
    "../../../../examples/session-05/{package.json,tsconfig.json,vitest.config.ts,vitest.exercises.config.ts,src/**/*.ts,exercises/**/*.ts,test/**/*.ts}",
    "../../../../examples/session-06/{package.json,tsconfig.json,vitest.config.ts,vitest.exercises.config.ts,src/**/*.ts,exercises/**/*.ts,test/**/*.ts}",
    "../../../../examples/session-07/{package.json,tsconfig.json,vitest.config.ts,vitest.exercises.config.ts,src/**/*.ts,exercises/**/*.ts,test/**/*.ts}",
    "../../../../examples/session-08/{package.json,tsconfig.json,vitest.config.ts,vitest.exercises.config.ts,src/**/*.ts,exercises/**/*.ts,test/**/*.ts}",
    "../../../../examples/session-09/{package.json,tsconfig.json,vitest.config.ts,vitest.exercises.config.ts,src/**/*.ts,exercises/**/*.ts,test/**/*.ts}",
    "../../../../examples/session-10/{package.json,tsconfig.json,vitest.config.ts,vitest.exercises.config.ts,src/**/*.ts,exercises/**/*.ts,test/**/*.ts}",
    "../../../../examples/session-11/{package.json,tsconfig.json,vitest.config.ts,vitest.exercises.config.ts,src/**/*.ts,exercises/**/*.ts,test/**/*.ts}",
    "../../../../examples/session-12/{package.json,tsconfig.json,vitest.config.ts,vitest.exercises.config.ts,src/**/*.ts,exercises/**/*.ts,test/**/*.ts}",
    "../../../../examples/session-13/{package.json,tsconfig.json,vitest.config.ts,vitest.exercises.config.ts,src/**/*.ts,exercises/**/*.ts,test/**/*.ts}",
    "../../../../examples/final/{package.json,tsconfig.json,vitest.config.ts,src/**/*.ts,test/**/*.ts}",
  ],
  { eager: true, query: "?raw", import: "default" },
) as Record<string, string>;

const snapshots = [
  "session-00",
  "session-01",
  "session-02",
  "session-03",
  "session-04",
  "session-05",
  "session-06",
  "session-07",
  "session-08",
  "session-09",
  "session-10",
  "session-11",
  "session-12",
  "session-13",
  "final",
] as const satisfies readonly ExampleSnapshot[];

const requiredRuntimeFiles = [
  "package.json",
  "tsconfig.json",
  "vitest.config.ts",
] as const;

const buildProjectFiles = (snapshot: ExampleSnapshot): ProjectFiles => {
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
    [key: string]: unknown;
  };
  const tsconfig = JSON.parse(files["tsconfig.json"]!) as {
    extends?: string;
    [key: string]: unknown;
  };

  return Object.freeze({
    ...files,
    "package.json": JSON.stringify(
      {
        ...packageJson,
        devDependencies: { ...packageJson.devDependencies, tsx: "4.23.9" },
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
) as Readonly<Record<ExampleSnapshot, ProjectFiles>>;

export const projectFilesFor = (slug: string): ProjectFiles => {
  const session = sessionBySlug(slug);
  if (session === undefined) {
    throw new Error(`Unknown session project: ${slug}`);
  }
  return projectFilesBySnapshot[session.snapshot];
};
