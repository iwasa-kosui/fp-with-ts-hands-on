import packageJsonSource from "../../../../packages/clinic-example/package.json?raw";
import tsconfigSource from "../../../../packages/clinic-example/tsconfig.json?raw";
import vitestConfigSource from "../../../../packages/clinic-example/vitest.config.ts?raw";
import exerciseConfigSource from "../../../../packages/clinic-example/vitest.exercises.config.ts?raw";
import tsconfigBaseSource from "../../../../tsconfig.base.json?raw";
import type { ProjectFiles } from "./types";

const packageSources = import.meta.glob(
  "../../../../packages/clinic-example/{src,exercises,test}/**/*.ts",
  { eager: true, query: "?raw", import: "default" },
) as Record<string, string>;

const packagePrefix = "../../../../packages/clinic-example/";
const packageJson = JSON.parse(packageJsonSource) as {
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
};
const tsconfig = JSON.parse(tsconfigSource) as {
  extends?: string;
  [key: string]: unknown;
};

export const projectFiles: ProjectFiles = Object.freeze({
  ...Object.fromEntries(
    Object.entries(packageSources).map(([path, source]) => [
      path.replace(packagePrefix, ""),
      source,
    ]),
  ),
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
  "vitest.config.ts": vitestConfigSource,
  "vitest.exercises.config.ts": exerciseConfigSource,
});
