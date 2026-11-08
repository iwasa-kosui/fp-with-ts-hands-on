import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { expect, it } from "vitest";

const projectDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

it("演習用の型検査に識別子の取り違えを残した型テストを含める", () => {
  const configPath = path.join(projectDirectory, "tsconfig.exercises.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    projectDirectory,
  );

  expect(parsed.fileNames).toContain(
    path.join(projectDirectory, "src/domain/domain.test-types.ts"),
  );
});
