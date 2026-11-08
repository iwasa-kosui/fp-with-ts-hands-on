import tsconfigBaseSource from "../../../../tsconfig.base.json?raw";
import clinicFixtureSource from "../../../../examples/fixtures/clinic.ts?raw";
import clinicWebContractsSource from "../../../../packages/clinic-web/src/contracts.ts?raw";
import clinicWebNoticeSource from "../../../../packages/clinic-web/src/notice.ts?raw";
import clinicWebRootViewSource from "../../../../packages/clinic-web/src/rootView.tsx?raw";
import clinicWebServerSource from "../../../../packages/clinic-web/src/server.ts?raw";
import inMemoryAppSourceTemplate from "./replacements/in-memory-app.ts.txt?raw";
import type { ExampleSnapshot } from "../sessions/types";
import {
  browserPackageJsonFor,
  withRuntimeTools,
  type PackageJson,
} from "./deps-snapshot-shared.mjs";
import type { ProjectFiles } from "./types";

type ProjectSnapshot = ExampleSnapshot;

const rawProjectFiles = import.meta.glob(
  "../../../../examples/{session-*,final}/{package.json,tsconfig.json,tsconfig.exercises.json,vitest.config.ts,vitest.exercises.config.ts,eslint.config.mjs,src/**/*.ts,exercises/**/*.ts,exercises/**/*.mjs,test/**/*.ts}",
  { eager: true, query: "?raw", import: "default" },
) as Record<string, string>;

const exerciseGuardSources = import.meta.glob(
  "../../../../packages/exercise-guard/src/*.mjs",
  { eager: true, query: "?raw", import: "default" },
) as Record<string, string>;

const exerciseGuardConfigPath = "exercises/guard/guard.config.mjs";
const exerciseGuardVendorDir = "vendor/exercise-guard";

const exerciseGuardVendorFiles: ProjectFiles = Object.fromEntries(
  Object.entries(exerciseGuardSources).map(([path, source]) => [
    `${exerciseGuardVendorDir}/${path.slice(path.lastIndexOf("/") + 1)}`,
    source,
  ]),
);

const snapshots = [
  "session-00",
  "session-01",
  "session-01-solution",
  "session-02",
  "session-02-solution",
  "session-03-supplement",
  "session-03-supplement-solution",
  "session-03",
  "session-03-solution",
  "session-04",
  "session-04-solution",
  "session-05",
  "session-06",
  "session-06-solution",
  "final",
] as const satisfies readonly ProjectSnapshot[];

const inMemoryAppSnapshots: readonly ProjectSnapshot[] = [
  "session-03-solution",
  "session-04",
];

const initialAppointmentExportFor = (snapshot: ProjectSnapshot): string =>
  `${snapshot.replace(/-(\w)/g, (_, initial: string) => initial.toUpperCase())}InitialAppointment`;

const requiredRuntimeFiles = [
  "package.json",
  "tsconfig.json",
  "vitest.config.ts",
] as const;

const clinicWebAlias = "@fp-with-ts/clinic-web/server";
const clinicWebVendorServerPath = "vendor/clinic-web/server.ts";
const clinicWebTypesAlias = "@fp-with-ts/clinic-web";
const clinicWebVendorContractsPath = "vendor/clinic-web/contracts.ts";

const inMemoryAppVendorFiles = {
  [clinicWebVendorContractsPath]: clinicWebContractsSource,
  "vendor/clinic-web/notice.ts": clinicWebNoticeSource,
  "vendor/clinic-web/rootView.tsx": clinicWebRootViewSource,
  [clinicWebVendorServerPath]: clinicWebServerSource,
} as const;

const inMemoryAppVitestExercisesConfigSource = `import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "${clinicWebAlias}": fileURLToPath(
        new URL("./${clinicWebVendorServerPath}", import.meta.url),
      ),
    },
  },
  test: {
    include: ["exercises/**/*.test.ts"],
  },
});
`;

export { browserPackageJsonFor };

export const exerciseGuardAdditionsFor = (
  files: ProjectFiles,
): Readonly<{ files: ProjectFiles; scripts: Readonly<Record<string, string>> }> =>
  files[exerciseGuardConfigPath] === undefined
    ? { files: {}, scripts: {} }
    : {
        files: exerciseGuardVendorFiles,
        scripts: { guard: `node ${exerciseGuardVendorDir}/cli.mjs` },
      };

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

  const packageJson = browserPackageJsonFor(
    JSON.parse(files["package.json"]!) as PackageJson,
  );
  const tsconfig = JSON.parse(files["tsconfig.json"]!) as {
    extends?: string;
    compilerOptions?: Record<string, unknown>;
    [key: string]: unknown;
  };
  const exerciseSequence =
    /^session-(01|02|03|03-supplement|04|06)$/.exec(snapshot)?.[1];
  const usesInMemoryApp = inMemoryAppSnapshots.includes(snapshot);
  const exerciseGuard = exerciseGuardAdditionsFor(files);
  const exerciseScripts =
    exerciseSequence === undefined
      ? packageJson.scripts
      : {
          ...packageJson.scripts,
          [`exercise:${exerciseSequence}`]: "pnpm exercise",
        };

  return Object.freeze({
    ...files,
    ...(usesInMemoryApp
      ? {
          ...inMemoryAppVendorFiles,
          "src/app.ts": inMemoryAppSourceTemplate.replaceAll(
            "INITIAL_APPOINTMENT",
            initialAppointmentExportFor(snapshot),
          ),
          "vitest.exercises.config.ts": inMemoryAppVitestExercisesConfigSource,
        }
      : {}),
    ...exerciseGuard.files,
    "../fixtures/clinic.ts": clinicFixtureSource,
    "package.json": JSON.stringify(
      {
        ...packageJson,
        scripts:
          Object.keys(exerciseGuard.scripts).length === 0
            ? exerciseScripts
            : { ...exerciseScripts, ...exerciseGuard.scripts },
        devDependencies: withRuntimeTools(packageJson.devDependencies),
      },
      null,
      2,
    ),
    "tsconfig.json": JSON.stringify(
      {
        ...tsconfig,
        extends: "./tsconfig.base.json",
        ...(usesInMemoryApp
          ? {
              compilerOptions: {
                ...tsconfig.compilerOptions,
                paths: {
                  [clinicWebAlias]: [`./${clinicWebVendorServerPath}`],
                  [clinicWebTypesAlias]: [`./${clinicWebVendorContractsPath}`],
                },
              },
            }
          : {}),
      },
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
