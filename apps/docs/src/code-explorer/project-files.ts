import tsconfigBaseSource from "../../../../tsconfig.base.json?raw";
import clinicFixtureSource from "../../../../examples/fixtures/clinic.ts?raw";
import clinicWebContractsSource from "../../../../packages/clinic-web/src/contracts.ts?raw";
import clinicWebNoticeSource from "../../../../packages/clinic-web/src/notice.ts?raw";
import clinicWebRootViewSource from "../../../../packages/clinic-web/src/rootView.tsx?raw";
import clinicWebServerSource from "../../../../packages/clinic-web/src/server.ts?raw";
import session05InMemoryAppSource from "./replacements/session-05-app.ts.txt?raw";
import type { ExampleSnapshot } from "../sessions/types";
import type { ProjectFiles } from "./types";

type ProjectSnapshot = Exclude<ExampleSnapshot, "session-01">;

const rawProjectFiles = import.meta.glob(
  "../../../../examples/{session-*,final}/{package.json,tsconfig.json,tsconfig.exercises.json,vitest.config.ts,vitest.exercises.config.ts,src/**/*.ts,exercises/**/*.ts,exercises/**/*.mjs,test/**/*.ts}",
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

const clinicWebAlias = "@fp-with-ts/clinic-web/server";
const clinicWebVendorServerPath = "vendor/clinic-web/server.ts";
const clinicWebTypesAlias = "@fp-with-ts/clinic-web";
const clinicWebVendorContractsPath = "vendor/clinic-web/contracts.ts";

const session05VendorFiles = {
  [clinicWebVendorContractsPath]: clinicWebContractsSource,
  "vendor/clinic-web/notice.ts": clinicWebNoticeSource,
  "vendor/clinic-web/rootView.tsx": clinicWebRootViewSource,
  [clinicWebVendorServerPath]: clinicWebServerSource,
} as const;

const session05VitestExercisesConfigSource = `import { fileURLToPath } from "node:url";
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

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  [key: string]: unknown;
};

const withoutWorkspaceDependencies = (
  dependencies: Record<string, string> | undefined,
): Record<string, string> | undefined =>
  dependencies === undefined
    ? undefined
    : Object.fromEntries(
        Object.entries(dependencies).filter(
          ([, version]) => !version.startsWith("workspace:"),
        ),
      );

export const browserPackageJsonFor = (
  packageJson: PackageJson,
): PackageJson => ({
  ...packageJson,
  dependencies: withoutWorkspaceDependencies(packageJson.dependencies),
  devDependencies: withoutWorkspaceDependencies(packageJson.devDependencies),
  optionalDependencies: withoutWorkspaceDependencies(
    packageJson.optionalDependencies,
  ),
  peerDependencies: withoutWorkspaceDependencies(packageJson.peerDependencies),
});

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
  const exerciseSequence = /^session-(0[2-6])$/.exec(snapshot)?.[1];
  const isSession05 = snapshot === "session-05";

  return Object.freeze({
    ...files,
    ...(isSession05
      ? {
          ...session05VendorFiles,
          "src/app.ts": session05InMemoryAppSource,
          "vitest.exercises.config.ts": session05VitestExercisesConfigSource,
        }
      : {}),
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
      {
        ...tsconfig,
        extends: "./tsconfig.base.json",
        ...(isSession05
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
