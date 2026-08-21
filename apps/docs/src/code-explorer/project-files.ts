import tsconfigBaseSource from "../../../../tsconfig.base.json?raw";
import clinicFixtureSource from "../../../../examples/fixtures/clinic.ts?raw";
import {
  sessions,
  sessionBySlug,
  type PublicCodeExplorerSnapshot,
} from "../sessions/catalog";
import type { ProjectFiles } from "./types";

type ProjectSnapshot = PublicCodeExplorerSnapshot | "session-07";

const rawProjectFiles = import.meta.glob(
  "../../../../examples/{session-*,final}/{package.json,tsconfig.json,vitest.config.ts,vitest.exercises.config.ts,src/**/*.ts,exercises/**/*.ts,test/**/*.ts}",
  { eager: true, query: "?raw", import: "default" },
) as Record<string, string>;

const snapshots = [
  ...new Set<ProjectSnapshot>([
    ...sessions.flatMap(({ snapshot }) =>
      snapshot === undefined ? [] : [snapshot],
    ),
    "session-07",
  ]),
] as const;

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
    [key: string]: unknown;
  };
  const tsconfig = JSON.parse(files["tsconfig.json"]!) as {
    extends?: string;
    [key: string]: unknown;
  };

  return Object.freeze({
    ...files,
    "../fixtures/clinic.ts": clinicFixtureSource,
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
) as Readonly<Record<ProjectSnapshot, ProjectFiles>>;

export const projectFilesForSnapshot = (
  snapshot: ProjectSnapshot,
): ProjectFiles => projectFilesBySnapshot[snapshot];

export const projectFilesFor = (slug: string): ProjectFiles => {
  const session = sessionBySlug(slug);
  if (session === undefined || session.snapshot === undefined) {
    throw new Error(`Unknown session project: ${slug}`);
  }
  return projectFilesForSnapshot(session.snapshot);
};
